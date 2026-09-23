import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combine des classes conditionnelles et résout les conflits Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
