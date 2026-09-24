import { z } from "zod";

/**
 * Forme validée de `Service.bookingConfig` (§B.3 : « validé par Zod »). Un
 * service `BOOKING` sans configuration n'est pas réservable tant qu'un admin
 * ne l'a pas définie — la publication du service ne suffit pas.
 */
export const bookingConfigSchema = z.object({
  mode: z.enum(["AGENCY_SLOT", "EXTERNAL_APPOINTMENT"]),
  slotMinutes: z.number().int().min(5).max(480).default(30),
  capacityPerSlot: z.number().int().min(1).max(50).default(1),
  minNoticeHours: z.number().int().min(0).max(720).default(24),
  maxAdvanceDays: z.number().int().min(1).max(365).default(60),
  /** Libellés des documents à joindre à la demande, saisis librement par l'admin. */
  requiredDocuments: z.array(z.string().trim().min(1)).default([]),
  /** Montant en unité mineure (§B.1) ; absent = pas de frais affichés à la demande. */
  fee: z.number().int().nonnegative().nullable().default(null),
});

export type BookingConfig = z.infer<typeof bookingConfigSchema>;

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  mode: "AGENCY_SLOT",
  slotMinutes: 30,
  capacityPerSlot: 1,
  minNoticeHours: 24,
  maxAdvanceDays: 60,
  requiredDocuments: [],
  fee: null,
};

export function parseBookingConfig(raw: unknown): BookingConfig | null {
  if (!raw) return null;
  const parsed = bookingConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
