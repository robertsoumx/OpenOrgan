const base=process.env.SMOKE_BASE_URL||"http://localhost:3000";
const routes=["/","/about","/search","/events","/login","/register"];
let failed=false;
for(const route of routes){try{const response=await fetch(base+route,{redirect:"manual"});const ok=response.status>=200&&response.status<400;console.log(`${ok?"PASS":"FAIL"} ${response.status} ${route}`);if(!ok)failed=true;}catch(error){console.error(`FAIL ${route}: ${error.message}`);failed=true;}}
if(failed)process.exit(1);
