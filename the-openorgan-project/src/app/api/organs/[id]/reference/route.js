import snapshot from "@/data/organ-directory.json";
import { requireServerUser, apiError } from "@/lib/auth-server";
import { FieldValue } from "firebase-admin/firestore";
export async function POST(request,{params}) {
  try {
    const {id}=await params,{account,db}=await requireServerUser(request);
    if(account?.role!=="organization"||account.verificationStatus!=="verified")throw Object.assign(new Error("Verify your institution before claiming a listing."),{status:403});
    const reference=snapshot.organs.find(o=>o.id===id);
    if(!reference)throw Object.assign(new Error("Reference listing not found."),{status:404});
    const ref=db.collection("organs").doc(id);
    await db.runTransaction(async transaction=>{
      const current=await transaction.get(ref);
      const related=await transaction.get(db.collection("organs").where("sourceLocationId","==",reference.sourceLocationId));
      if(related.docs.some(d=>d.data().listingOwnership==="claimed"))throw Object.assign(new Error("This instrument has already been claimed."),{status:409});
      if(!current.exists)transaction.create(ref,{...reference,directoryReference:false,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    });
    return Response.json({id});
  } catch(error){return apiError(error);}
}
