import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseTrinity, curateEvents, localDateTime, cleanText, safeImage } from "../src/lib/events-core.mjs";
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
  assert.ok(snapshot.events.every(e=>e.sourceUrl==="https://trinitychurchboston.org/music/organ-recitals/"));
});
