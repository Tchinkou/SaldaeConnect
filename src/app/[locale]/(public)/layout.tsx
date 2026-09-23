import { Footer } from "@/components/layout/footer";

/**
 * Habillage commun des pages publiques (§C). Le `Header` n'est pas ici :
 * les pages à slug traduit (service, réalisation) doivent lui passer leurs
 * propres `localeAlternates`/`localeFallback` pour un sélecteur de langue
 * correct (§G.1), donc chaque page l'inclut elle-même.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      {children}
      <Footer />
    </div>
  );
}
