export const NZ_TIMEZONE = "Pacific/Auckland";

const nzClockFormatter = new Intl.DateTimeFormat("en-NZ", {
  timeZone: NZ_TIMEZONE,
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

export function formatNzClock(date: Date): string {
  return nzClockFormatter.format(date);
}
