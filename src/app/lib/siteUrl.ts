/** Server-only metadata origin; update SITE_URL when the canonical domain changes. */
import "server-only";
export const siteUrl = new URL(process.env.SITE_URL || "https://rueda-mobility.vercel.app");
