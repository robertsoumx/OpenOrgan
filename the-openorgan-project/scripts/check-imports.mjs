import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap((item)=>item.isDirectory()?walk(path.join(dir,item.name)):[path.join(dir,item.name)]);}
const files=walk(path.join(root,"src")).filter((file)=>/\.(js|jsx|mjs)$/.test(file));
const failures=[];
for(const file of files){const text=fs.readFileSync(file,"utf8");const expressions=[...text.matchAll(/(?:from\s+|import\s*\()(["'])(@\/[^"']+|\.\.?\/[^"']+)\1/g)];for(const match of expressions){const spec=match[2];const base=spec.startsWith("@/")?path.join(root,"src",spec.slice(2)):path.resolve(path.dirname(file),spec);const choices=[base,`${base}.js`,`${base}.jsx`,`${base}.mjs`,path.join(base,"index.js"),path.join(base,"index.jsx")];if(!choices.some(fs.existsSync))failures.push(`${path.relative(root,file)} -> ${spec}`);}}
if(failures.length){console.error("Unresolved local imports:\n"+failures.join("\n"));process.exit(1);}console.log("All local imports resolve.");
