import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseTrinity, curateEvents, localDateTime, cleanText, safeImage, EVENT_SOURCES, parseHarvard, parseJsonLd, parseAgo, mapUrl, diverseUpcoming } from "../src/lib/events-core.mjs";
import { refreshCalendars, pullSource } from "../src/lib/events-refresh.mjs";
import { sourceFlag, currentInstrument, selectInstrument, churchLocation, metric, discoverPodLocations, placeMatchesSource } from "../src/lib/organ-import-core.mjs";

test("Published dates only; skip holidays and handle Eastern daylight saving", () => {
  const html = "<h2>Fall 2026 Recitals</h2><ul><li>Oct. 9 <strong>Stephen Kalnoske</strong></li><li>Nov. 6 <strong>Angela Kraft Cross</strong></li><li>Nov. 27 No Recital</li></ul><h2>Spring 2027 Recitals</h2><ul><li>Mar. 26 No concert for Good Friday</li><li>Apr. 9 <strong>Mark Pacoe</strong></li></ul>";
  const events = parseTrinity(html);
  assert.equal(events.length,3);
  assert.equal(events[0].startDateTime,"2026-10-09T16:15:00.000Z");
  assert.equal(events[1].startDateTime,"2026-11-06T17:15:00.000Z");
  assert.equal(events[2].startDateTime,"2027-04-09T16:15:00.000Z");
  assert.equal(parseTrinity("<h2>Other unrelated calendar</h2>").length,0);
  assert.equal(localDateTime(2027,1,8),"2027-01-08T17:15:00.000Z");
});
test("Curator rejects expired, cancelled, invalid and unrelated items, deduplicates and sorts", () => {
  const base = {id:"a", title:"Organ recital", type:"Organ recital", status:"active", organizationName:"Church", startDateTime:"2026-10-09T16:15:00Z", origin:"curated"};
  const result = curateEvents([base,{...base,id:"duplicate"},{...base,id:"cancelled",eventStatus:"cancelled"},{...base,id:"old",startDateTime:"2025-10-01"},{...base,id:"invalid",startDateTime:"bad"},{...base,id:"later",startDateTime:"2026-11-06T17:15:00Z"},{...base,id:"dinner",type:"Dinner",title:"Community dinner",startDateTime:"2026-10-10"}],new Date("2026-10-07"));
  assert.deepEqual(result.map(x=>x.id),["a","later"]);
});
test("Image and text cleanup removes emoji and unsafe image schemes", () => {
  assert.equal(cleanText("Organ "+String.fromCodePoint(0x1f3b9)),"Organ");
  assert.equal(safeImage("javascript:alert(1)"),"/event-cover.svg");
  assert.equal(safeImage("https://example.org/photo.jpg"),"https://example.org/photo.jpg");
});
test("Numeric POD flags reject removed and unknown instruments, select one current main organ", () => {
  assert.equal(sourceFlag(0),false); assert.equal(sourceFlag(1),true); assert.equal(sourceFlag(2),null);
  assert.equal(currentInstrument({extant:0,playable:1}),false);
  assert.equal(currentInstrument({extant:1,playable:2}),false);
  assert.equal(currentInstrument({extant:1,playable:1,futureInstrumentId:99}),false);
  const selected=selectInstrument([{id:1,extant:0,playable:0,ranks:100},{id:2,extant:1,playable:1,room:"Chapel",ranks:100},{id:3,extant:1,playable:1,room:"Sanctuary",ranks:30}]);
  assert.equal(selected.id,3);
});
test("Church filtering excludes theatres, residences, schools and unknown source types", () => {
  assert.equal(churchLocation({name:"Trinity Church",type:0}),true);
  assert.equal(churchLocation({name:"Trinity Church",type:2}),false);
  assert.equal(churchLocation({name:"School Chapel",type:0}),false);
  assert.equal(churchLocation({name:"Synagogue",type:0}),false);
  assert.equal(churchLocation({name:"Old Church Theatre",type:2}),false);
  assert.equal(churchLocation({name:"Church",type:null}),false);
});
test("Missing instrument facts remain unknown rather than borrowing from history or counting stoplists", () => {
  assert.equal(metric({originalInstrument:{manuals:4},stoplists:[1,2,3]},"manuals"),0);
  assert.equal(metric({stoplists:[1,2,3]},"stops"),0);
  assert.equal(metric({ranks:46},"ranks"),46);
});
test("Pagination uses skip, verifies complete coverage and stops on repeated source pages", async () => {
  const page = [{id:1,name:"Church",city:"Boston",state:"MA",type:0},{id:2,name:"Other church",city:"Boston",state:"MA",type:0}];
  const calls=[];
  const list=await discoverPodLocations(["Boston"],async url=>{calls.push(url); const skip=Number(new URL("https://example.org"+url).searchParams.get("skip"));return {total:3,locations:skip ? [{...page[0],id:3}] : page};});
  assert.equal(list.length,3); assert.match(calls[1],/skip=2/);
  await assert.rejects(discoverPodLocations(["Boston"],async()=>({total:3,locations:page})),/Repeated API page|coverage changed/);
});
test("Address resolution rejects a same-name church at the wrong street or postal region", () => {
  const loc={name:"Trinity Church",address:"206 Clarendon Street",latitude:42.35,longitude:-71.07};
  const place={id:"verified",displayName:{text:"Trinity Church Boston"},formattedAddress:"206 Clarendon Street, Boston, MA 02116",location:{latitude:42.35,longitude:-71.07},addressComponents:[{types:["street_number"],longText:"206"},{types:["route"],longText:"Clarendon Street"},{types:["postal_code"],longText:"02116"},{types:["administrative_area_level_1"],shortText:"MA"},{types:["country"],shortText:"US"}]};
  assert.equal(placeMatchesSource(loc,place),true);
  assert.equal(placeMatchesSource(loc,{...place,addressComponents:place.addressComponents.map(c=>c.types[0]==="route"?{...c,longText:"Main Street"}:c)}),false);
});
test("Committed event snapshot has recent and upcoming real dates at handoff", () => {
  const snapshot=JSON.parse(fs.readFileSync("src/data/events-snapshot.json","utf8"));
  const checked=new Date(snapshot.checkedAt);
  assert.ok(snapshot.events.filter(e=>new Date(e.startDateTime)>checked).length>=3);
  assert.ok(snapshot.events.some(e=>new Date(e.startDateTime)<checked));
  assert.ok(new Set(snapshot.events.map(e=>e.location?.name)).size >= 4);
  assert.ok(snapshot.events.every(e=>e.sourceUrl.startsWith("https://") && e.location?.formattedAddress));
  assert.ok(new Set(snapshot.events.map(e=>e.sourceId)).size >= 3);
});

test("Methuen structured dates use the published time, reject unrelated items and avoid false free claims",()=>{
  const source=EVENT_SOURCES.find(s=>s.id==="methuen");
  const items=[{"@type":"Event",name:"Organ concert",startDate:"2026-11-07",description:"Saturday, November 7, 2026 7:30 p.m. Test Organist, Organ Tickets: $35/$25 Reserved Seating Doors open at 7:00 p.m.",url:"https://mmmh.org/events/test",offers:{price:"0"}}, {"@type":"Event",name:"Jazz quartet",startDate:"2026-11-08",description:"Sunday, November 8, 2026 3:00 p.m. Jazz concert",url:"https://mmmh.org/events/jazz"},{"@type":"Event",name:"Undated organ time",startDate:"2026-11-09",description:"Organ concert",url:"https://mmmh.org/events/no-time"}];
  const parsed=parseJsonLd(`<script type="application/ld+json">${JSON.stringify(items)}</script>`,source,"2026-10-17T00:00:00Z");
  assert.equal(parsed.length,1); assert.equal(parsed[0].startDateTime,"2026-11-08T00:30:00.000Z"); assert.match(parsed[0].admission,/35/);assert.notEqual(parsed[0].admission,"Free");
});
test("Harvard calendar extracts Eastern time and an official event URL from nested cards",()=>{
  const html='<article class="event-card event-card--horizontal"><a href="/event/test-recital"><h3>Lunchtime Recital</h3></a><div class="event-card__date">October 21, 2026</div><div class="event-card__time"><div class="event-card--delimiter">|</div>12:15PM - 1:00PM EDT</div><div class="event-card__description"><div>Organist Example R. Name performs a lunchtime recital. The concert is free and open to the public.</div></div></article>';
  const parsed=parseHarvard(html,EVENT_SOURCES.find(s=>s.id==="harvard-memorial"),"2026-10-17T00:00:00Z");
  assert.equal(parsed.length,1);assert.equal(parsed[0].title,"Example R. Name · Organ recital");assert.equal(parsed[0].startDateTime,"2026-10-21T16:15:00.000Z");assert.equal(parsed[0].endDateTime,"2026-10-21T17:00:00.000Z");assert.match(parsed[0].sourceUrl,/memorialchurch.harvard.edu\/event\/test-recital/);
});
test("AGO chapter calendar rejects cancellations and unknown venues, preserves a real address",()=>{
  const block=(day,extra,place="Test Church",address="10 Main St, Boston")=>`<h2>October</h2><h2>${day}</h2><p>Saturday, 7:00 - 8:30 PM<br>${place}<br>${address}<br>Donation suggested</p><h4>ORGAN CONCERT</h4>${extra}`;
  const parsed=parseAgo('<h1>2026 Events</h1>'+block(24,"")+block(25,"This event was cancelled.")+block(26,"","Location TBA",""),EVENT_SOURCES.find(s=>s.id==="boston-ago"),"2026-10-17T00:00:00Z");
  assert.equal(parsed.length,1);assert.equal(parsed[0].startDateTime,"2026-10-24T23:00:00.000Z");assert.equal(parsed[0].location.formattedAddress,"10 Main St, Boston, MA");
});
test("403 uses the alternate official Trinity endpoint with explicit UTC dates",async()=>{
  const calls=[];
  const events=await pullSource(EVENT_SOURCES[0],async url=>{
    calls.push(url);
    return calls.length===1 ? {ok:false,status:403} : {ok:true,text:async()=>JSON.stringify({events:[{title:"Organ recital",utc_start_date:"2026-10-23 16:15:00",url:"https://trinitychurchboston.org/event/test"}]})};
  },"2026-10-17T00:00:00Z");
  assert.equal(calls.length,2);assert.match(calls[1],/wp-json\/tribe/);assert.equal(events[0].startDateTime,"2026-10-23T16:15:00.000Z");assert.ok(events[0].location.formattedAddress);
});
test("Independent refresh retains verification time on failure and expires cached dates after 30 days",async()=>{
  const now=new Date("2026-10-17T00:00:00Z"), checked="2026-10-16T00:00:00Z";
  const source={...EVENT_SOURCES[2],id:"blocked",url:"https://blocked.example"};
  const cached={id:"cached",title:"Organ recital",status:"active",type:"Organ recital",startDateTime:"2026-10-24T14:00:00Z",sourceId:"blocked",sourceCheckedAt:checked};
  const healthy={...EVENT_SOURCES[2],id:"healthy",url:"https://healthy.example"};
  const fetcher=async url=>url.includes("blocked")?{ok:false,status:403}:{ok:true,text:async()=>'<script type="application/ld+json">{"@type":"Event","name":"Organ concert","startDate":"2026-10-25T15:00:00-04:00","description":"Organ concert","url":"https://healthy.example/event"}</script>'};
  const result=await refreshCalendars({events:[cached]}, {sources:[source,healthy],fetcher,now});
  assert.equal(result.events.length,2);assert.equal(result.sources[0].ok,false);assert.equal(result.sources[1].ok,true);assert.equal(result.events.find(e=>e.id==="cached").sourceCheckedAt,checked);
  const expired=await refreshCalendars({events:[{...cached,sourceCheckedAt:"2026-09-01T00:00:00Z"}]},{sources:[source],fetcher,now});assert.equal(expired.events.length,0);
});
test("A successful changed calendar replaces its old dates rather than restoring cancelled events",async()=>{
  const source=EVENT_SOURCES[2];
  const result=await refreshCalendars({events:[{id:"old",sourceId:source.id,title:"Organ concert",status:"active",startDateTime:"2026-10-20T15:00:00Z",sourceCheckedAt:"2026-10-16T00:00:00Z"}]},{sources:[source],now:new Date("2026-10-17"),fetcher:async()=>({ok:true,text:async()=>'<script type="application/ld+json">{"@type":"Event","name":"Organ concert","startDate":"2026-10-25T15:00:00-04:00","description":"Organ concert","url":"https://mmmh.org/events/new"}</script>'})});
  assert.deepEqual(result.events.map(e=>e.id),["curated-methuen-new"]);
});
test("Directions support both exact Places IDs and verified address-only venues",()=>{
  const location={name:"Test Hall",formattedAddress:"192 Broadway, Methuen, MA"};
  const url=new URL(mapUrl(location,true));assert.equal(url.searchParams.get("destination"),"Test Hall, 192 Broadway, Methuen, MA");assert.equal(url.searchParams.get("destination_place_id"),null);
  assert.equal(new URL(mapUrl({...location,placeId:"known-id"},true)).searchParams.get("destination_place_id"),"known-id");
});
test("Home highlights include different venues while the event directory remains chronological",()=>{
  const events=["A","A","B","C"].map((name,i)=>({id:String(i),startDateTime:`2026-10-${20+i}T12:00:00Z`,location:{name}}));
  assert.deepEqual(diverseUpcoming(events,3,new Date("2026-10-17")).map(e=>e.location.name),["A","B","C"]);
});
