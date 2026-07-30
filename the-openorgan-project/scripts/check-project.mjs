import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=["package.json","next.config.mjs","src/app/layout.js","src/app/page.js","src/app/globals.css","src/lib/firebase-client.js","firestore.rules","storage.rules","public/favicon.svg"];
const missing=required.filter((file)=>!fs.existsSync(path.join(root,file)));
if(missing.length){console.error("Missing required files:\n"+missing.join("\n"));process.exit(1);}
const source=fs.readdirSync(path.join(root,"src"),{recursive:true}).map(String);
if(source.some((file)=>file.includes("RouterCompat")||file.includes("legacy"))){console.error("Legacy compatibility code is not allowed in this repository.");process.exit(1);}
console.log("Project structure check passed.");
