import fs from "node:fs/promises";
import { refreshCalendars } from "../src/lib/events-refresh.mjs";
const filename="src/data/events-snapshot.json";
const previous=await fs.readFile(filename,"utf8").then(JSON.parse).catch(()=>({events:[]}));
const result=await refreshCalendars(previous);
const warnings=result.sources.filter(s=>!s.ok);
for(const source of warnings) console.warn(`${process.env.GITHUB_ACTIONS ? "::warning::" : "Warning: "}${source.name}: ${source.error}; ${source.checkedAt ? "retaining dates last checked "+source.checkedAt : "no verified cached dates"}.`);
const upcoming=result.events.filter(e=>new Date(e.endDateTime || e.startDateTime)>new Date());
if(process.env.GITHUB_STEP_SUMMARY) {
  const summary=["### Official event refresh",`${result.events.length} events; ${upcoming.length} upcoming; ${result.sources.length-warnings.length}/${result.sources.length} sources refreshed.`,...result.sources.map(s=>`- ${s.name}: ${s.ok ? "refreshed" : "source unavailable"}${s.checkedAt ? "; last verified "+s.checkedAt : ""}`)].join("\n");
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+"\n");
}
if(!upcoming.length) throw new Error("No upcoming verified events remain; snapshot preserved for review");
if(process.argv.includes("--strict") && warnings.length) throw new Error("Strict verification: a source is unavailable");
const facts = data => JSON.stringify({events:(data.events || []).map(({sourceCheckedAt,...event})=>event),sources:(data.sources || []).map(({checkedAt,attemptedAt,...source})=>source)});
if(process.argv.includes("--if-changed") && facts(previous)===facts(result) && Date.now()-Date.parse(previous.checkedAt)<86400000) {
  console.log("Calendar facts unchanged; last verification was within 24 hours.");
} else {
  const temporary=filename+".tmp";
  await fs.writeFile(temporary,JSON.stringify(result,null,2)+"\n");
  await fs.rename(temporary,filename);
  console.log(`Saved ${result.events.length} verified events across ${new Set(result.events.map(e=>e.location?.name || e.organizationName)).size} venues.`);
}
