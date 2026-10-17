import { currentInstrument, selectInstrument, churchLocation, metric } from "./organ-import-core.mjs";
export const DIRECTORY_CITIES = ["Boston","Cambridge","Somerville","Brookline","Newton","Watertown","Belmont","Arlington","Medford","Malden","Everett","Chelsea","Revere","Winthrop","Quincy","Milton","Braintree","Weymouth","Dedham","Needham","Wellesley","Weston","Waltham","Lexington","Concord","Lincoln","Bedford","Burlington","Winchester","Stoneham","Melrose","Wakefield","Saugus","Lynn","Nahant","Swampscott","Marblehead","Salem","Peabody","Danvers","Canton","Norwood","Westwood","Dover","Hingham","Hull","Natick"];
export function coordinates(location) {
  if(location?.latitude == null || location?.longitude == null || location.latitude === "" || location.longitude === "") return null;
  const lat=Number(location.latitude),lng=Number(location.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&!(lat===0&&lng===0) ? {lat,lng} : null;
}
export function municipality(value) {
  const city=String(value || "").toLowerCase();
  return DIRECTORY_CITIES.find(name=>city===name.toLowerCase() || city.startsWith(name.toLowerCase()+" ") || city.startsWith(name.toLowerCase()+":"))?.toLowerCase() || city;
}
export function addressKey(location) {
  const street=String(location?.formattedAddress || "").split(",")[0];
  return [street,municipality(location?.city),location?.region].join(" ").toLowerCase().replace(/\b(street|avenue|road|drive|lane|boulevard|saint)\b/g,m=>({street:"st",avenue:"ave",road:"rd",drive:"dr",lane:"ln",boulevard:"blvd",saint:"st"}[m])).replace(/[^a-z0-9]/g,"");
}
export function sourceRecord(location,instruments,checkedAt) {
  if(typeof location?.name!=="string"||!location.name.trim()||!churchLocation(location)||Number(location.approvalStatus)!==1||!/^\s*\d+[a-z]?\s+/i.test(location.address || "")) return null;
  const instrument=selectInstrument(instruments.filter(i=>Number(i.approvalStatus)===1));
  const point=coordinates(location);
  if(!instrument || !currentInstrument(instrument)||!point||point.lat<41||point.lat>43.1||point.lng< -73.6||point.lng> -69.8) return null;
  const address=[location.address,location.city,location.state,location.zipcode].filter(Boolean).join(", ");
  const sourceLocationId=String(location.id),sourceInstrumentId=String(instrument.id);
  return {id:`ohs-location-${sourceLocationId}`,name:location.name,organizationName:location.name,ownerId:"",status:"active",listingOwnership:"unclaimed",claimStatus:"available",bookingEnabled:false,directoryReference:true,verificationStatus:"source_imported",builder:instrument.builder?.name || "",year:instrument.year || "",opus:instrument.opus || "",manuals:metric(instrument,"manuals") || "",stops:metric(instrument,"stops") || "",ranks:metric(instrument,"ranks") || "",description:"Pipe Organ Database reference for this church's current playable instrument.",sourceLocationId,sourceInstrumentId,sourceType:"pipe_organ_database",sourceName:"Pipe Organ Database",sourceUrl:`https://pipeorgandatabase.org/instruments/${sourceInstrumentId}`,sourceLocationUrl:`https://pipeorgandatabase.org/locations/${sourceLocationId}`,location:{name:location.name,formattedAddress:address,city:location.city,region:location.state,country:location.country,latitude:point.lat,longitude:point.lng,placeId:"",googleMapsUri:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name+", "+address)}`},importMeta:{verifiedAt:checkedAt,sourceExtant:true,sourcePlayable:true,addressVerification:"reported_by_pipe_organ_database",canonicalSelection:"one_current_playable_instrument_per_physical_church"}};
}
export function dedupeReferences(records) {
  const places=new Map(),coordinateAliases=new Map();
  const sorted=[...records].sort((a,b)=>Number(b.year || 0)-Number(a.year || 0)||Number(b.manuals || 0)-Number(a.manuals || 0)||Number(b.sourceLocationId)-Number(a.sourceLocationId));
  for(const item of sorted) {
    const key=addressKey(item.location);if(!key || places.has(key)) continue;
    const point=coordinates(item.location),number=item.location.formattedAddress.match(/^\s*(\d+[a-z]?)/i)?.[1];
    const alias=point&&number?`${point.lat.toFixed(5)},${point.lng.toFixed(5)}:${number}:${municipality(item.location.city)}`:null;
    if(alias&&coordinateAliases.has(alias))continue;
    if(alias)coordinateAliases.set(alias,item);places.set(key,item);
  }
  const remaining=[...places.values()],points=new Map();
  for(const item of remaining){const p=coordinates(item.location);if(!p)continue;const key=`${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;if(!points.has(key))points.set(key,[]);points.get(key).push(item);}
  for(const group of points.values())if(group.length>1)for(const item of group){item.location={...item.location,latitude:null,longitude:null};item.importMeta={...item.importMeta,coordinateReview:"different street addresses share a source coordinate"};}
  return remaining.sort((a,b)=>a.location.city.localeCompare(b.location.city)||a.name.localeCompare(b.name));
}
export function mergeDirectory(references,hosted) {
  const remaining=new Map(references.map(o=>[o.id,o])),output=[];
  for(const item of [...hosted].sort((a,b)=>(b.listingOwnership==="claimed")-(a.listingOwnership==="claimed"))) {
    const matches=[...remaining.values()].filter(r=>String(r.sourceLocationId)===String(item.sourceLocationId || item.source?.locationId || "") || addressKey(r.location)===addressKey(item.location));
    const current=matches[0];matches.forEach(r=>remaining.delete(r.id));
    if(item.listingOwnership==="claimed") {if(item.status==="active")output.push(item);continue;}
    // Recheck old unclaimed imports against the current source catalogue.
    if(!current || item.status!=="active")continue;
    const originalPoint=coordinates(item.location),sourcePoint=coordinates(current.location);
    const close=originalPoint&&sourcePoint&&Math.hypot((originalPoint.lat-sourcePoint.lat)*111000,(originalPoint.lng-sourcePoint.lng)*82000)<250;
    output.push({...current,id:item.id,directoryReference:false,...(item.location?.placeId&&close?{location:{...current.location,...item.location}}:{})});
  }
  return [...output,...remaining.values()];
}
export function geographicGroups(items,zoom) {
  // At wide zooms, group nearby points into selectable geographic cells.
  const cell=360/(2**zoom*6),groups=new Map();
  for(const item of items) {
    const point=coordinates(item.location);if(!point)continue;
    const key=`${Math.floor(point.lat/cell)}:${Math.floor(point.lng/cell)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);
  }
  return [...groups.values()];
}
