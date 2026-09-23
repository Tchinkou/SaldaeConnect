import type { SVGProps } from "react";

/** Icône non directionnelle : pas besoin de miroir en RTL (§G.6). */
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}
