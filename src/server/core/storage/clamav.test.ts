import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { scanBuffer } from "@/server/core/storage/clamav";

/**
 * Aucun clamd réel n'est disponible dans cet environnement de développement
 * (confirmé : pas de binaire clamd/clamscan, docker sans démon actif). Ce
 * faux serveur TCP reproduit le protocole INSTREAM (préfixe de commande,
 * blocs taille+données, bloc de taille 0, réponse texte) pour couvrir le
 * client réellement, plutôt que de le laisser non testé.
 */
function startFakeClamd(respond: (received: Buffer) => string): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((socket) => {
      const chunks: Buffer[] = [];
      socket.on("data", (data) => {
        chunks.push(data);
        const all = Buffer.concat(chunks);
        // Le flux INSTREAM se termine par un bloc de taille 0 (4 octets à 0 après la commande).
        if (all.length >= 4 && all.subarray(all.length - 4).equals(Buffer.alloc(4))) {
          socket.end(respond(all));
        }
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;
  }
});

describe("scanBuffer", () => {
  it("reports a clean result on a clamd OK response", async () => {
    server = await startFakeClamd(() => "stream: OK\0");
    const port = (server.address() as { port: number }).port;

    const result = await scanBuffer(new TextEncoder().encode("hello"), "127.0.0.1", port);
    expect(result).toEqual({ clean: true });
  });

  it("reports an infected result with the signature on a FOUND response", async () => {
    server = await startFakeClamd(() => "stream: Eicar-Test-Signature FOUND\0");
    const port = (server.address() as { port: number }).port;

    const result = await scanBuffer(new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}"), "127.0.0.1", port);
    expect(result).toEqual({ clean: false, signature: "Eicar-Test-Signature" });
  });

  it("throws on an unrecognized clamd response", async () => {
    server = await startFakeClamd(() => "stream: ERROR whatever\0");
    const port = (server.address() as { port: number }).port;

    await expect(scanBuffer(new TextEncoder().encode("x"), "127.0.0.1", port)).rejects.toThrow();
  });

  it("sends the payload as size-prefixed INSTREAM chunks and a zero terminator", async () => {
    let received: Buffer = Buffer.alloc(0);
    server = await startFakeClamd((all) => {
      received = Buffer.from(all);
      return "stream: OK\0";
    });
    const port = (server.address() as { port: number }).port;

    const payload = new TextEncoder().encode("a".repeat(20_000)); // > chunk size, exercises multi-chunk send
    await scanBuffer(payload, "127.0.0.1", port);

    expect(received.subarray(0, 10).toString("utf8")).toBe("zINSTREAM\0");
    const firstChunkSize = received.readUInt32BE(10);
    expect(firstChunkSize).toBeGreaterThan(0);
    expect(received.subarray(received.length - 4).equals(Buffer.alloc(4))).toBe(true);
  });
});
