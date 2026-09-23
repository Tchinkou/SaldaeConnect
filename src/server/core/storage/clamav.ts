import "server-only";
import { Socket } from "node:net";

/**
 * Client ClamAV réel (protocole INSTREAM, §H.4.2 : « l'antivirus tourne s'il
 * est configuré »). Envoie le contenu par blocs préfixés de leur taille sur
 * 4 octets big-endian, terminés par un bloc de taille 0, puis lit la réponse
 * texte de clamd (« stream: OK », « stream: <signature> FOUND », ou une
 * erreur). Aucun clamd réel n'est disponible dans cet environnement de
 * développement pour un test de bout en bout — voir `clamav.test.ts` pour la
 * couverture contre un faux serveur TCP reproduisant ce protocole.
 */

const INSTREAM_CHUNK_SIZE = 8192;
const SCAN_TIMEOUT_MS = 20_000;

export interface ClamAvScanResult {
  clean: boolean;
  signature?: string;
}

export async function scanBuffer(bytes: Uint8Array, host: string, port: number): Promise<ClamAvScanResult> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const responseChunks: Buffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      settle(() => reject(new Error("Délai dépassé lors de l'analyse antivirus.")));
    }, SCAN_TIMEOUT_MS);

    function settle(run: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      run();
    }

    socket.on("error", (error) => settle(() => reject(error)));

    socket.connect(port, host, () => {
      socket.write("zINSTREAM\0");

      let offset = 0;
      while (offset < bytes.length) {
        const chunk = bytes.subarray(offset, offset + INSTREAM_CHUNK_SIZE);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(chunk.length, 0);
        socket.write(header);
        socket.write(chunk);
        offset += chunk.length;
      }

      const terminator = Buffer.alloc(4); // taille 0 : fin du flux (protocole INSTREAM)
      socket.write(terminator);
    });

    socket.on("data", (data) => {
      responseChunks.push(data);
    });

    socket.on("end", () => {
      settle(() => {
        const response = Buffer.concat(responseChunks).toString("utf8").replace(/\0/g, "").trim();
        try {
          resolve(parseResponse(response));
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

function parseResponse(response: string): ClamAvScanResult {
  if (/\bOK$/.test(response)) {
    return { clean: true };
  }
  const foundMatch = response.match(/:\s*(.+?)\s+FOUND$/);
  if (foundMatch) {
    return { clean: false, signature: foundMatch[1] };
  }
  throw new Error(`Réponse ClamAV inattendue : « ${response || "(vide)"} ».`);
}
