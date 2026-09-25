import { redirect } from "next/navigation";

/**
 * The personal holiday calendar now lives in Settings, next to the Holiday
 * Leave entitlement it produces — the list and the balance it drives were on
 * two different pages, and the connection between them was invisible.
 *
 * Kept as a redirect rather than deleted so existing links and bookmarks
 * still land somewhere sensible.
 */
export default function MyHolidaysRedirect() {
  redirect("/settings?tab=holidays");
}
