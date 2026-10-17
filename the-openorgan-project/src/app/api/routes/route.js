import { getOrganDirectory } from "@/lib/directory-server";
import { getEventFeed } from "@/lib/events-server";
import { rankRoutes, validOrigin } from "@/lib/routes-core.mjs";
export const runtime="nodejs";
const routeCache=new Map();
const error=(message,status)=>Response.json({message,userFacing:true},{status});
export async function POST(request) {
  try {
    const text=await request.text();if(text.length>200000)return error("Too many destinations were requested.",400);
    const body=JSON.parse(text),origin=validOrigin(body.origin),kind=body.kind || "organs";
    const ids=body.ids || body.destinations?.map(d=>d.id);
    if(!origin||!Array.isArray(ids)||!ids.length||ids.length>2000||!ids.every(id=>typeof id==="string"&&id.length<=150)||!["organs","events"].includes(kind))return error("Choose a starting place and valid destinations.",400);
    const key=process.env.GOOGLE_MAPS_SERVER_API_KEY;
    if(!key)return error("Driving routes are temporarily unavailable.",503);
    const catalogue=kind==="events"?(await getEventFeed()).events:await getOrganDirectory();
    const allowed=new Map(catalogue.map(item=>[item.id,item]));
    const items=[...new Set(ids)].flatMap(id=>allowed.has(id)?[allowed.get(id)]:[]);
    if(!items.length)return error("No public destinations are available.",400);
    const result=await rankRoutes({origin,items,key,cache:routeCache});
    if(!result.results.length)return error("Driving routes are unavailable for these destinations.",503);
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch {return error("Driving routes are temporarily unavailable.",503);}
}
