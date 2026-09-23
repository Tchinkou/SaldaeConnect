export interface PageBlock {
  type: "heading" | "paragraph";
  text: string;
}

/** Rend les blocs de contenu structuré d'une `PageTranslation` (§C, §G.3). */
export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  return (
    <div className="prose prose-ink mt-8 max-w-none">
      {blocks.map((block, index) =>
        block.type === "heading" ? (
          <h2 key={index} className="mt-6 text-xl font-semibold text-foreground">
            {block.text}
          </h2>
        ) : (
          <p key={index} className="mt-3 text-foreground">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
