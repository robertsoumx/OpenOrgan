export const DEFAULT_TIME_ZONE = "America/New_York";

export function validTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; } catch { return false; }
}

export function getTimeZone(item) {
  const zone = item?.timeZone || item?.location?.timeZone;
  return validTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

export function timeZoneLabel(zone = DEFAULT_TIME_ZONE) {
  if (!validTimeZone(zone)) return "Choose a valid time zone";
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longGeneric" }).formatToParts(new Date()).find(part => part.type === "timeZoneName")?.value;
  return `${name || zone} (${zone})`;
}

export function zonedParts(date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

// Resolve a venue's wall-clock time without using the visitor's browser zone.
export function zonedDateTime(date, time, timeZone = DEFAULT_TIME_ZONE) {
  if (!validTimeZone(timeZone)) throw new Error("Choose a valid venue time zone.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Choose a valid date and time.");
  const [year, month, day] = date.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute), check = new Date(target);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error("Choose a valid date and time.");
  const stamp = value => { const p = zonedParts(new Date(value), timeZone); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second); };
  const offsets = new Set([-2, -1, 0, 1, 2].map(dayOffset => { const value = target + dayOffset * 86400000; return stamp(value) - value; }));
  const matches = [...offsets].map(offset => target - offset).filter(value => stamp(value) === target);
  if (!matches.length) throw new Error("That time does not exist when the clocks change; choose another time.");
  if (matches.length > 1) throw new Error("That time occurs twice when the clocks change; choose a time outside the repeated hour.");
  return new Date(matches[0]);
}
