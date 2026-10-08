export const EVENT_SOURCES = [
  { id: "trinity-boston", name: "Trinity Church Boston", url: "https://trinitychurchboston.org/music/organ-recitals/", parser: "trinity", city: "Boston", region: "MA", address: "206 Clarendon Street, Boston, MA 02116", imageUrl: "https://trinitychurchboston.org/wp-content/uploads/2016/11/FATBanner-1024x252.jpg" }
];
export function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim();
}
export function safeImage(value, fallback = "/event-cover.svg") {
  try { const u = new URL(value); return u.protocol === "https:" ? u.href : fallback; } catch { return String(value || "").startsWith("/") && !String(value).startsWith("//") ? value : fallback; }
}
export function localDateTime(year, month, day, hour = 12, minute = 15) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(zone.formatToParts(new Date(instant)).map(x => [x.type, x.value]));
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    instant += wall - shown;
  }
  return new Date(instant).toISOString();
}
export function parseTrinity(html, source = EVENT_SOURCES[0], checkedAt = new Date().toISOString()) {
  const events = [];
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  // Expand only explicitly published dates, never an assumed weekly recurrence.
  const seasons = [...html.matchAll(/(?:Fall|Spring)\s+(20\d{2})\s+Recitals[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/gi)];
  for (const season of seasons) {
    const year = Number(season[1]);
    for (const item of season[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = cleanText(item[1]);
      const date = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+20\d{2})?\s+(.*)/);
      if (!date || /no (?:concert|recital)/i.test(date[3])) continue;
      const month = months[date[1].slice(0, 3).toLowerCase()];
      const day = Number(date[2]);
      const performer = cleanText(date[3].split(/No Recital|No Concert/i)[0]);
      if (!month || !performer || day < 1 || day > 31) continue;
      const startDateTime = localDateTime(year, month, day);
      if (new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date(startDateTime)) !== "Friday") continue;
      const id = ["curated", source.id, year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
      events.push({ id, title: performer + " · Friday organ recital", performer, organizationName: source.name, type: "Organ recital", status: "active", startDateTime, timeZone: "America/New_York", registrationPolicy: "none", description: "Hear " + performer + " at Trinity Church Boston's Friday lunchtime organ series. Admission is free; the church welcomes a donation. Check the organizer's page for the latest program and any changes.", admission: "Free · donation welcome", imageUrl: source.imageUrl, imageAlt: "Trinity Church Boston organ recital series", imageCredit: source.name, sourceUrl: source.url, sourceName: source.name, sourceId: source.id, sourceCheckedAt: checkedAt, origin: "curated", location: { name: source.name, city: source.city, region: source.region, formattedAddress: source.address } });
    }
  }
  return events;
}
export function curateEvents(events, now = new Date()) {
  const lower = now.getTime() - 30 * 86400000, upper = now.getTime() + 270 * 86400000;
  const unique = new Map();
  for (const event of events) {
    const date = new Date(event.startDateTime);
    if (event.status !== "active" || !Number.isFinite(date.getTime()) || date < lower || date > upper) continue;
    if (/cancelled|canceled|postponed/i.test(event.eventStatus || "")) continue;
    const title = cleanText(event.title);
    if (!title || !/organ|recital|workshop/i.test([event.type, title, event.description].join(" "))) continue;
    const key = [date.toISOString().slice(0, 16), cleanText(event.organizationName).toLowerCase(), cleanText(event.performer || title).toLowerCase()].join("|");
    const normalized = { ...event, title, description: cleanText(event.description), organizationName: cleanText(event.organizationName), imageUrl: safeImage(event.imageUrl), imageAlt: cleanText(event.imageAlt) || title, startDateTime: date.toISOString() };
    if (!unique.has(key) || event.origin !== "curated") unique.set(key, normalized);
  }
  return [...unique.values()].sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));
}
export function eventDate(value, options = {}) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", ...options }).format(new Date(value));
}
