import { FieldValue } from "firebase-admin/firestore";
import { apiError, requireServerUser } from "@/lib/auth-server";
import { privacyRequestBody, privacyRequestItem } from "@/lib/privacy-core.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { decoded, db } = await requireServerUser(request);
    const snapshot = await db.collection("privacyRequests").where("userId", "==", decoded.uid).get();
    const items = snapshot.docs.map(privacyRequestItem).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 20);
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const { decoded, db } = await requireServerUser(request);
    const raw = await request.text();
    if (raw.length > 5000) throw Object.assign(new Error("Keep your request under 2,000 characters."), { status: 400 });
    let input;
    try { input = JSON.parse(raw); } catch { throw Object.assign(new Error("Check your request and try again."), { status: 400 }); }
    const data = privacyRequestBody(input), reference = db.collection("privacyRequests").doc(), limit = db.collection("privacyRequestLimits").doc(decoded.uid);
    await db.runTransaction(async transaction => {
      const previous = await transaction.get(limit);
      if (previous.exists && previous.data().createdAt?.toMillis?.() > Date.now() - 60000) throw Object.assign(new Error("Wait one minute before submitting another request."), { status: 429 });
      transaction.set(reference, { userId: decoded.uid, ...data, status: "open", reply: "", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.set(limit, { createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ id: reference.id, message: "Request received; check this page for a private reply." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
