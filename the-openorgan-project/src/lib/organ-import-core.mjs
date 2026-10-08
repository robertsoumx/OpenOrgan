export function sourceFlag(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}
export function currentInstrument(instrument) {
  const extant = sourceFlag(instrument?.extant ?? instrument?.isExtant);
  const playable = sourceFlag(instrument?.playable ?? instrument?.isPlayable);
  return extant === true && playable === true && !instrument?.futureInstrumentId && !/not\s+(?:extant|playable)|destroyed|removed|dismantled/i.test(String(instrument?.status || ""));
}
export function churchLocation(location) {
  const name = String(location?.name || "");
  if (/\b(?:synagogue|mosque|temple|residence|residential|school|college|university|auditorium|theat(?:re|er)|museum|convention|funeral|cemetery)\b/i.test(name)) return false;
  if (location?.type === 0 || location?.type === "0") return true;
  const type = String(location?.locationType?.name || location?.sourceType || location?.type?.name || location?.type || "");
  if (/church|baptist|catholic|episcopal|anglican|lutheran|methodist|presbyterian|congregational|unitarian|universalist|christian|reformed|orthodox|quaker/i.test(type)) return true;
  // Unknown classifications are held for review, never guessed from a church-like name.
  return false;
}
export function sourceScopeMatches(location, city) {
  return String(location?.state || "").toUpperCase() === "MA" &&
    String(location?.city || "").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").slice(0, city.split(" ").length).join(" ") === city.toLowerCase();
}
export function selectInstrument(instruments) {
  const number = value => Number(value) || 0;
  const score = x => {
    const room = String(x.room || "");
    const roomScore = /\b(main|sanctuary|nave|chancel|gallery)\b/i.test(room) ? 1e9 : /\b(chapel|crypt|practice)\b/i.test(room) ? -1e9 : 0;
    return roomScore + number(x.manuals)*1e6 + number(x.stops)*1e4 + number(x.ranks)*100 + number(x.year);
  };
  return instruments.filter(currentInstrument).sort((a,b) => score(b)-score(a) || number(b.id)-number(a.id))[0] || null;
}
export function metric(instrument, name) {
  // Read only this instrument's metrics, not historical related objects or stoplist lengths.
  const aliases = { manuals: ["manuals","numManuals","numberOfManuals"], stops: ["stops","numStops","numberOfStops"], ranks: ["ranks","numRanks","numberOfRanks"], pipes: ["pipes","numPipes","numberOfPipes"] };
  for (const key of aliases[name] || [name]) {
    const value = instrument?.[key];
    if (value != null && value !== "" && !Array.isArray(value) && typeof value !== "object" && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  }
  // Newer API stores manual counts in console entries.
  if (name === "manuals" && Array.isArray(instrument?.consoles)) {
    const values = instrument.consoles.map(x => Number(x.manuals)).filter(x => Number.isFinite(x) && x > 0);
    if (values.length) return Math.max(...values);
  }
  return 0;
}
export function placeMatchesSource(location, place) {
  if (!place?.id || !place?.location || !place.formattedAddress || !place.addressComponents?.length) return false;
  const component = type => place.addressComponents.find(c => c.types?.includes(type));
  if (component("country")?.shortText !== "US" || component("administrative_area_level_1")?.shortText !== "MA") return false;
  if (!component("street_number") || !component("route") || !component("postal_code")) return false;
  const streetNumber = String(location.address || "").match(/^\s*(\d+[A-Za-z]?)/)?.[1]?.toLowerCase();
  if (!streetNumber || component("street_number")?.longText?.toLowerCase() !== streetNumber) return false;
  const street = value => String(value || "").toLowerCase().replace(/^\s*\d+[a-z]?\s*/, "").replace(/\([^)]*\)/g, "").replace(/\b(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|place|pl)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
  const sourceStreet = street(location.address), googleStreet = street(component("route")?.longText);
  if (!sourceStreet || sourceStreet !== googleStreet) return false;
  const words = value => new Set(String(value || "").toLowerCase().replace(/saint/g,"st").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(x => x && !["church","the","of","in","boston","saints","parish","new","old"].includes(x)));
  const left = words(location.name), right = words(place.displayName?.text);
  if (!left.size || ![...left].some(w => right.has(w))) return false;
  const lat = Number(location.latitude), lng = Number(location.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
    // Prevent a same-name church at a different physical location being accepted.
    const dlat = (lat-place.location.latitude)*111000, dlng = (lng-place.location.longitude)*82000;
    if (Math.hypot(dlat,dlng) > 2500) return false;
  }
  return true;
}
export async function discoverPodLocations(cities, fetchJson, onProgress = () => {}) {
  const discovered = new Map();
  for (const city of cities) {
    let skip = 0, total = null;
    const cityIds = new Set();
    do {
      const qs = new URLSearchParams({ city, state:"MA", limit:"250", skip:String(skip) });
      const page = await fetchJson("/locations?" + qs.toString());
      if (!Array.isArray(page.locations) || !Number.isInteger(page.total) || page.total < 0) throw new Error("Unexpected location API shape for " + city);
      total = page.total;
      if (!page.locations.length && skip < total) throw new Error("Incomplete pagination for " + city);
      let added = 0;
      for (const location of page.locations) {
        if (location?.id == null || cityIds.has(String(location.id))) continue;
        cityIds.add(String(location.id)); added++;
        if (sourceScopeMatches(location, city)) discovered.set(String(location.id), Object.fromEntries(["id","name","address","city","state","country","zipcode","type","subtype","latitude","longitude","approvalStatus"].map(key => [key,location[key] ?? null])));
      }
      if (!added && skip < total) throw new Error("Repeated API page for " + city + "; import stopped");
      skip += page.locations.length;
    } while (skip < total);
    if (cityIds.size !== total) throw new Error("Source coverage changed during pagination for " + city + "; retry required");
    onProgress(city, discovered.size);
  }
  return [...discovered.values()];
}
