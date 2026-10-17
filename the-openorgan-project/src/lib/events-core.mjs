import { EVENT_SOURCES } from "./event-sources.mjs";
export { EVENT_SOURCES };
export function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(Math.min(0x10ffff, parseInt(hex || dec, hex ? 16 : 10)))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim();
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
      events.push({ id, title: performer + " · Friday organ recital", performer, organizationName: source.name, type: "Organ recital", status: "active", startDateTime, timeZone: "America/New_York", registrationPolicy: "none", description: "Friday lunchtime organ recital with " + performer + ".", admission: "Free · donation welcome", imageUrl: source.imageUrl, imageAlt: "Trinity Church Boston organ recital series", imageCredit: source.name, sourceUrl: source.url, sourceName: source.name, sourceId: source.id, sourceCheckedAt: checkedAt, origin: "curated", location: { name: source.name, city: source.city, region: source.region, formattedAddress: source.address } });
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

export function eventLocation(source, extra = {}) {
  const location = { name:source.name, formattedAddress:source.address || "", city:source.city || "", region:source.region || "", country:"US", ...extra };
  location.googleMapsUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location.name, location.formattedAddress].filter(Boolean).join(", "))}`;
  return location;
}
export function mapUrl(location, directions = false) {
  const query = [location?.name, location?.formattedAddress].filter(Boolean).join(", ");
  if (!query) return "";
  const params = new URLSearchParams({ api:"1", [directions ? "destination" : "query"]:query });
  if (location?.placeId) params.set(directions ? "destination_place_id" : "query_place_id", location.placeId);
  return `https://www.google.com/maps/${directions ? "dir" : "search"}/?${params}`;
}
function curated(source, item, checkedAt) {
  return { type:"Organ event", status:"active", origin:"curated", registrationPolicy:"none", timeZone:"America/New_York", sourceId:source.id, sourceName:source.name, sourceUrl:source.url, sourceCheckedAt:checkedAt, organizationName:source.name, imageUrl:safeImage(item.imageUrl || source.imageUrl), imageCredit:source.name, location:eventLocation(source), ...item };
}
const MONTHS = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
function clock(text, fallbackPeriod = "") {
  const m = cleanText(text).match(fallbackPeriod ? /(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i : /(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)/i);
  if (!m) return null;
  const period = (m[3] || fallbackPeriod).replace(/\./g, "").toLowerCase();
  if (!period || +m[1] > 12 || +m[1] < 1 || +(m[2] || 0) > 59) return null;
  return [Number(m[1]) % 12 + (period === "pm" ? 12 : 0), Number(m[2] || 0)];
}
function dated(dayText, timeText) {
  const d = cleanText(dayText).match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})/);
  const t = clock(timeText);
  return d && MONTHS[d[1].toLowerCase()] && t ? localDateTime(+d[3], MONTHS[d[1].toLowerCase()], +d[2], ...t) : null;
}
export function parseHarvard(html, source, checkedAt) {
  const events = [];
  for (const match of html.matchAll(/<article\b[^>]*class="[^"]*event-card[^"]*"[\s\S]*?<\/article>/gi)) {
    const card = match[0].replace(/<div[^>]*class="[^"]*event-card--delimiter[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    const get = name => card.match(new RegExp('class="[^"]*event-card__'+name+'[^" ]*[^"]*"[^>]*>([\\s\\S]*?)<\\/div>', 'i'))?.[1] || "";
    const title = cleanText(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    const description = cleanText(get("description"));
    if (!/organ|recital/i.test(title+" "+description) || /cancelled|canceled|postponed/i.test(title+" "+description)) continue;
    const startDateTime = dated(get("date"), cleanText(get("time")).replace(/^\|\s*/,""));
    const href = card.match(/href="([^"]*\/event\/[^"?]*)/)?.[1];
    if (!startDateTime || !href) continue;
    const url = new URL(href,source.url).href;
    const image = card.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const time = cleanText(get("time")), endClock = clock(time.split(/\s-\s/)[1] || "");
    const localDay = new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(startDateTime));
    const [y,m,d] = localDay.split("-").map(Number);
    events.push(curated(source,{id:`curated-${source.id}-${url.split("/").pop()}`,title: /^Organist /i.test(description) ? cleanText(description.replace(/^Organist /i,"").split(/\s+(?:performs|forms|presents)\b|\.\s+(?:The|This|Admission|Free|Join)\b/)[0].replace(/\.$/,"")) + " · Organ recital" : title,description,type:"Organ recital",startDateTime,...(endClock?{endDateTime:localDateTime(y,m,d,...endClock)}:{}),sourceUrl:url,imageUrl:image ? new URL(image,source.url).href : "/event-cover.svg",imageAlt:source.name,admission:/free/i.test(description)?"Free":"See organizer"},checkedAt));
  }
  return events;
}
export function parseJsonLd(html, source, checkedAt) {
  const events = [];
  function visit(item) {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) { item.forEach(visit); return; }
    if (item["@graph"]) visit(item["@graph"]);
    if (![item["@type"]].flat().includes("Event")) return;
    const title = cleanText(item.name), description = cleanText(item.description);
    if (!/\borgan(?:ist)?\b/i.test(title+" "+description) || /cancelled|canceled|postponed/i.test(item.eventStatus || "")) return;
    let startDateTime;
    if (/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(item.startDate || "")) startDateTime = new Date(item.startDate).toISOString();
    else {
      const day = String(item.startDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/), t = clock(description);
      if (!day || !t) return; // A date without a published time must not become a midnight concert.
      startDateTime = localDateTime(+day[1],+day[2],+day[3],...t);
    }
    const url = new URL(item.url || source.url,source.url);
    if (url.origin !== new URL(source.url).origin) return;
    const image = typeof item.image === "string" ? item.image : Array.isArray(item.image) ? item.image[0] : item.image?.url;
    // Some calendars publish a zero-price placeholder alongside paid ticket text.
    const admission = /Free to Attend|Free Admission\s*(?:Doors|$)/i.test(description) ? "Free" : /Tickets?:/i.test(description) ? cleanText(description.match(/Tickets?:\s*([\s\S]*?)(?:Doors open|Tickets on Sale|Reserved Seating|$)/i)?.[1]).slice(0,110) : "See organizer for tickets";
    const body = description.replace(/^.*?20\d{2}\s+\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*/i,"").split(/Tickets?:|Doors open|Sponsored by|Reserved Seating/)[0].trim();
    events.push(curated(source,{id:`curated-${source.id}-${url.pathname.split("/").filter(Boolean).pop()}`,title,description:body,type:"Organ concert",eventStatus:item.eventStatus,startDateTime,sourceUrl:url.href,imageUrl:safeImage(image),imageAlt:title,admission},checkedAt));
  }
  for (const script of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { visit(JSON.parse(script[1])); } catch {} }
  return events;
}
export function parseAgo(html, source, checkedAt) {
  const content = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  const year = Number(cleanText(content.match(/<h1[^>]*>([\s\S]*?20\d{2}[\s\S]*?)<\/h1>/i)?.[1]).match(/20\d{2}/)?.[0]);
  if (!year) return [];
  const headings = [...content.matchAll(/<h2[^>]*>\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*<\/h2>\s*<h2[^>]*>\s*(\d{1,2})\s*<\/h2>/gi)];
  const events = [];
  for(let i=0;i<headings.length;i++) {
    const h=headings[i], block=content.slice(h.index,headings[i+1]?.index || content.length), text=cleanText(block);
    if (/cancelled|canceled|Location TBA|Zoom event/i.test(text)) continue;
    const info = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
    const lines = info.split(/<br\s*\/?>/i).map(cleanText).filter(Boolean);
    const heading = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1] || "";
    const title = heading.split(/<br\s*\/?>/i).map(cleanText).find(Boolean);
    const times = lines[0]?.match(/(\d{1,2}:\d{2})\s*([AP]M)?\s*-\s*(\d{1,2}:\d{2})\s*([AP]M)/i);
    if (!title || !times || !lines[1] || !/^\d+\s/.test(lines[2] || "")) continue;
    const t=clock(times[1]+(times[2]||times[4])), end=clock(times[3]+times[4]);
    const month=MONTHS[h[1].toLowerCase()],day=+h[2];
    const image = block.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1];
    const city = lines[2].split(",").pop().trim();
    const type = /recital|concert/i.test(title)?"Organ concert":"Organ workshop";
    const displayTitle = title.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    events.push(curated(source,{id:`curated-${source.id}-${year}-${month}-${day}`,title:displayTitle,type,organizationName:lines[1],startDateTime:localDateTime(year,month,day,...t),endDateTime:localDateTime(year,month,day,...end),description:cleanText(heading),admission:lines.slice(3).join(" ").replace(/\.$/,""),imageUrl:safeImage(image),imageAlt:lines[1],location:eventLocation(source,{name:lines[1],formattedAddress:lines[2]+", MA",city,region:"MA"})},checkedAt));
  }
  return events;
}
export function diverseUpcoming(events, count = 3, now = new Date()) {
  const upcoming = events.filter(e=>new Date(e.startDateTime)>=now), result=[],venues=new Set();
  for(const event of upcoming) {
    const venue = event.location?.name || event.organizationName;
    if (!venues.has(venue)) { result.push(event); venues.add(venue); }
    if (result.length === count) return result;
  }
  for(const event of upcoming) { if (!result.includes(event)) result.push(event); if(result.length===count) break; }
  return result;
}
