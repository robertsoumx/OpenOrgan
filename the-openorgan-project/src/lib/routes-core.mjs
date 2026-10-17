import { coordinates } from "./directory-core.mjs";
export function validOrigin(origin) {
  const point=coordinates(origin);
  return point ? {latitude:point.lat,longitude:point.lng} : null;
}
export function routeDestination(location) {
  if(location?.placeId)return {placeId:location.placeId};
  // Route to a full published street address when a Google Place ID is unavailable.
  if(location?.formattedAddress)return {address:[location.name,location.formattedAddress,location.country || "US"].filter(Boolean).join(", ")};
  const point=coordinates(location);
  return point ? {location:{latLng:{latitude:point.lat,longitude:point.lng}}} : null;
}
export async function rankRoutes({origin,items,key,fetcher=fetch,cache=new Map(),now=Date.now()}) {
  origin=validOrigin(origin);
  if(!origin)throw new Error("Invalid starting location");
  const groups=new Map(),results=[],unavailable=[];
  for(const item of items) {
    const waypoint=routeDestination(item.location);
    if(!waypoint){unavailable.push(item.id);continue;}
    const identity=JSON.stringify(waypoint);
    if(!groups.has(identity))groups.set(identity,{waypoint,ids:[]});groups.get(identity).ids.push(item.id);
  }
  const pending=[];
  for(const [identity,group] of groups) {
    const cacheKey=`${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}|${identity}`;
    const cached=cache.get(cacheKey);
    if(cached&&cached.expiresAt>now)group.ids.forEach(id=>results.push({id,...cached.route}));
    else pending.push({...group,cacheKey});
  }
  const batches=[];for(let i=0;i<pending.length;i+=25)batches.push(pending.slice(i,i+25));
  let next=0;
  await Promise.all(Array.from({length:Math.min(3,batches.length)},async()=>{
    while(next<batches.length) {
      const group=batches[next++];
      try {
        const response=await fetcher("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",{method:"POST",signal:AbortSignal.timeout(18000),headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"originIndex,destinationIndex,status,condition,distanceMeters,duration"},body:JSON.stringify({origins:[{waypoint:{location:{latLng:origin}}}],destinations:group.map(g=>({waypoint:g.waypoint})),travelMode:"DRIVE",routingPreference:"TRAFFIC_UNAWARE",regionCode:"us"})});
        if(!response.ok)throw new Error("Routes unavailable");
        const matrix=await response.json();if(!Array.isArray(matrix))throw new Error("Invalid route response");
        const found=new Set();
        for(const row of matrix) {
          const index=Number(row.destinationIndex ?? 0),item=group[index];
          const distance=row.distanceMeters == null ? NaN : Number(row.distanceMeters),duration=typeof row.duration === "string" && /^\d+(?:\.\d+)?s$/.test(row.duration) ? Number(row.duration.slice(0,-1)) : NaN;
          if(!item||found.has(index)||row.condition!=="ROUTE_EXISTS"||Number(row.status?.code || 0)!==0||!Number.isFinite(distance)||distance<0||!Number.isFinite(duration)||duration<0)continue;
          found.add(index);const route={routeDistanceMeters:distance,routeDurationSeconds:duration};
          cache.set(item.cacheKey,{route,expiresAt:now+15*60000});item.ids.forEach(id=>results.push({id,...route}));
        }
        group.forEach((item,index)=>{if(!found.has(index))unavailable.push(...item.ids);});
      } catch {group.forEach(item=>unavailable.push(...item.ids));}
    }
  }));
  while(cache.size>5000)cache.delete(cache.keys().next().value);
  return {results,unavailable,total:items.length,uniqueDestinations:groups.size,travelMode:"DRIVE"};
}
