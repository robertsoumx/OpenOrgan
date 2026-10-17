import { cache } from "react";
import snapshot from "@/data/organ-directory.json";
import { mergeDirectory } from "@/lib/directory-core.mjs";
import { getAdminServices } from "@/lib/firebase-admin";
import { getActivePublicDocuments, serialize } from "@/lib/server-data";
export const getOrganDirectory = cache(async()=>{
  const admin=getAdminServices();let hosted;
  try {hosted=admin ? (await admin.db.collection("organs").get()).docs.map(d=>serialize({id:d.id,...d.data()})) : await getActivePublicDocuments("organs",5000);}
  catch {hosted=await getActivePublicDocuments("organs",5000);}
  return mergeDirectory(snapshot.organs,hosted).map(({internalAccessNotes,...organ})=>organ);
});
export async function getDirectoryOrgan(id) {return (await getOrganDirectory()).find(o=>o.id===id) || null;}
export const directoryMetadata={checkedAt:snapshot.checkedAt,municipalities:snapshot.municipalities,sourceLocations:snapshot.sourceLocations};
