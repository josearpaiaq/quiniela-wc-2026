const kickoffFormatter = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "jue, 11 jun, 13:00" in the viewer's timezone. Render inside suppressHydrationWarning. */
export function formatKickoff(iso: string): string {
  return kickoffFormatter.format(new Date(iso)).replace(",", " ·");
}

export function shortVenue(venue: string): string {
  return venue.split(",")[1]?.trim() ?? venue;
}
