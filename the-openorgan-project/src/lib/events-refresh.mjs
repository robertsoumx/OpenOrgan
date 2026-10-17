import { EVENT_SOURCES, parseTrinity, parseHarvard, parseJsonLd, parseAgo, curateEvents, cleanText, eventLocation, safeImage } from "./events-core.mjs";

async function request(url, fetcher) {
  const response = await fetcher(url, { cache:"no-store", signal:AbortSignal.timeout(15000), headers:{"User-Agent":"OpenOrgan/1.1 (+https://openorgan.org/about)","Accept":"text/html,application/json"} });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
function parseTrinityApi(text, source, checkedAt) {
  const data=JSON.parse(text);
  return (data.events || []).filter(e=>/organ|recital/i.test(cleanText(e.title)) && !/no recital|no concert|cancelled|canceled/i.test(cleanText(e.title))).flatMap(e=>{
    // Explicit offsets or UTC dates are required; never use the runner's timezone.
    const date = e.utc_start_date ? new Date(e.utc_start_date.replace(" ","T")+"Z") : null;
    if(!date || !Number.isFinite(date.getTime())) return [];
    const venue=e.venue || {};
    return [{id:`curated-${source.id}-${date.toLocaleDateString("en-CA",{timeZone:"America/New_York"})}`,title:cleanText(e.title),type:"Organ recital",status:"active",origin:"curated",registrationPolicy:"none",timeZone:"America/New_York",organizationName:source.name,startDateTime:date.toISOString(),description:cleanText(e.description).split(/(?<=[.!?])\s/)[0],sourceId:source.id,sourceName:source.name,sourceUrl:e.url || source.url,sourceCheckedAt:checkedAt,imageUrl:safeImage(e.image?.url || source.imageUrl),imageAlt:source.name,admission:e.cost || "See organizer",location:eventLocation(source,{name:cleanText(venue.venue) || source.name,formattedAddress:venue.address ? [venue.address,venue.city,venue.state,venue.zip].filter(Boolean).join(", ") : source.address})}];
  });
}
export async function pullSource(source, fetcher = fetch, checkedAt = new Date().toISOString()) {
  let html;
  try { html = await request(source.url, fetcher); }
  catch(error) {
    if (!source.alternateUrl) throw error;
    const events = parseTrinityApi(await request(source.alternateUrl,fetcher),source,checkedAt);
    if(!events.length) throw new Error("Alternate official feed contains no dated organ events");
    return events;
  }
  let events;
  if(source.parser === "trinity") events=parseTrinity(html,source,checkedAt).map(e=>({...e,location:eventLocation(source)}));
  else if(source.parser === "jsonld") events=parseJsonLd(html,source,checkedAt);
  else if(source.parser === "ago") {
    const extra=await Promise.all((source.extraUrls || []).map(url=>request(url,fetcher).then(page=>parseAgo(page,{...source,url},checkedAt)).catch(()=>[])));
    events=[...parseAgo(html,source,checkedAt),...extra.flat()];
  }
  else if(source.parser === "harvard") {
    const last = Math.min(9, Math.max(0,...[...html.matchAll(/href="\?page=(\d+)"/g)].map(m=>+m[1])));
    const pages = Array.from({length:last},(_,i)=>i+1);
    const extra = await Promise.all([...new Set(pages)].map(n=>request(`${source.url}?page=${n}`,fetcher).catch(()=>"")));
    events = [html,...extra].flatMap(page=>parseHarvard(page,source,checkedAt));
  }
  if(!events?.length) {
    if(source.alternateUrl) return parseTrinityApi(await request(source.alternateUrl,fetcher),source,checkedAt);
    throw new Error("Published event format changed or no dated organ events found");
  }
  return events;
}
export async function refreshCalendars(previous = {}, {sources = EVENT_SOURCES, fetcher = fetch, now = new Date()} = {}) {
  const attemptedAt=now.toISOString();
  const checks = await Promise.all(sources.map(async source=>{
    try {
      const events=await pullSource(source,fetcher,attemptedAt);
      if (!events.length) throw new Error("No published dates found");
      return {sourceId:source.id,name:source.name,url:source.url,ok:true,checkedAt:attemptedAt,attemptedAt,events};
    } catch(error) {
      const cached=(previous.events || []).filter(e=>e.sourceId===source.id && Number.isFinite(Date.parse(e.sourceCheckedAt)) && now-Date.parse(e.sourceCheckedAt)<=30*86400000);
      const checkedAt=cached.map(e=>e.sourceCheckedAt).sort()[0] || null;
      return {sourceId:source.id,name:source.name,url:source.url,ok:false,checkedAt,attemptedAt,error:String(error.message).slice(0,180),events:cached};
    }
  }));
  return {checkedAt:attemptedAt,events:curateEvents(checks.flatMap(c=>c.events),now),sources:checks.map(({events,...check})=>check)};
}
