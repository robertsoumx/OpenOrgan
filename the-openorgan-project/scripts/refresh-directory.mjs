import fs from "node:fs/promises";
import { discoverPodLocations } from "../src/lib/organ-import-core.mjs";
import { DIRECTORY_CITIES, sourceRecord, dedupeReferences } from "../src/lib/directory-core.mjs";
const checkedAt=new Date().toISOString(),failures=[];
async function json(endpoint) {
  let failure;
  for(let n=0;n<3;n++) {
    try {const response=await fetch("https://api.pipeorgandatabase.org"+endpoint,{signal:AbortSignal.timeout(15000),headers:{Accept:"application/json"}});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}
    catch(error){failure=error;}
  }
  throw failure;
}
async function concurrent(items,fn) {
  const results=new Array(items.length);let next=0;
  await Promise.all(Array.from({length:12},async()=>{while(next<items.length){const i=next++;results[i]=await fn(items[i]);}}));return results;
}
try {
const discovered=await discoverPodLocations(DIRECTORY_CITIES,json,(city,count)=>console.log(`${city}: ${count} source locations`));
const locations=await concurrent(discovered.filter(l=>Number(l.type)===0),async loc=>{try{return await json(`/locations/${loc.id}`);}catch(e){failures.push({id:loc.id,error:e.message});return null;}});
const candidates=locations.filter(Boolean).filter(l=>l.instruments?.some(i=>i.extant===1&&i.playable===1&&!i.futureInstrumentId));
console.log(`Checking instruments at ${candidates.length} church locations`);
const records=await concurrent(candidates,async location=>{
  const instruments=await Promise.all((location.instruments || []).filter(i=>i.extant===1&&i.playable===1&&!i.futureInstrumentId).map(async stub=>{try{return await json(`/instruments/${stub.id}`);}catch(e){failures.push({id:stub.id,error:e.message});return null;}}));
  return sourceRecord(location,instruments.filter(Boolean),checkedAt);
});
if(failures.length)throw new Error(`${failures.length} API failures; existing catalogue preserved`);
const organs=dedupeReferences(records.filter(Boolean));
if(organs.length<100 || new Set(organs.map(o=>o.location.city)).size<20)throw new Error("Incomplete regional coverage; catalogue preserved");
const result={checkedAt,scope:"Churches in 47 municipalities",sourceLocations:discovered.length,municipalities:DIRECTORY_CITIES.length,organs};
const filename="src/data/organ-directory.json";
const previous=await fs.readFile(filename,"utf8").then(JSON.parse).catch(()=>null);
if(previous && organs.length<previous.organs.length*.8)throw new Error("Source catalogue shrank by more than 20%; review required");
await fs.writeFile(filename+".tmp",JSON.stringify(result,null,2)+"\n");await fs.rename(filename+".tmp",filename);
console.log(`Saved ${organs.length} current playable church organs across ${new Set(organs.map(o=>o.location.city)).size} localities; no Firebase writes.`);

} catch(error) {
  const previous=await fs.readFile("src/data/organ-directory.json","utf8").then(JSON.parse).catch(()=>null);
  if(!process.argv.includes("--strict") && previous?.organs?.length>=100 && Date.now()-Date.parse(previous.checkedAt)<30*86400000) {
    console.warn(`${process.env.GITHUB_ACTIONS ? "::warning::" : "Warning: "}Source refresh unavailable; preserving the catalogue verified ${previous.checkedAt}: ${error.message}`);
  } else throw error;
}
