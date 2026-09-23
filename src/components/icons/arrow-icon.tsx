import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Icône directionnelle (§G.6) : `forward` pointe vers la fin de la ligne de
 * lecture (droite en LTR, gauche en RTL) ; `back` vers le début (gauche en
 * LTR, droite en RTL). Toujours inversée en miroir, jamais retournée à
 * l'identique, pour rester cohérente avec le sens de lecture.
 */
export function ArrowIcon({
  className,
  direction = "forward",
  ...props
}: SVGProps<SVGSVGElement> & { direction?: "forward" | "back" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        direction === "forward" ? "rtl:-scale-x-100" : "-scale-x-100 rtl:scale-x-100",
        className,
      )}
      {...props}
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}
