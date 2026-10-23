import { FieldValue } from "firebase-admin/firestore";
import { apiError, requireServerAdmin } from "@/lib/auth-server";
import { PRIVACY_REQUEST_STATUSES, privacyRequestItem } from "@/lib/privacy-core.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { db } = await requireServerAdmin(request);
    const closed = new URL(request.url).searchParams.get("status") === "closed";
    const query = db.collection("privacyRequests").where("status", "in", closed ? ["closed"] : ["open", "in_progress"]);
    const snapshot = await query.get();
    let items = snapshot.docs.map(privacyRequestItem).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    if (closed) items = items.reverse().slice(0, 100);
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const { decoded, db } = await requireServerAdmin(request);
    const raw = await request.text();
    if (raw.length > 6000) throw Object.assign(new Error("Keep the reply under 2,000 characters."), { status: 400 });
    let input;
    try { input = JSON.parse(raw); } catch { throw Object.assign(new Error("Check the response and try again."), { status: 400 }); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("Check the response and try again."), { status: 400 });
    const { id, status, expectedUpdatedAt } = input, reply = typeof input.reply === "string" ? input.reply.trim() : "";
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !Object.hasOwn(PRIVACY_REQUEST_STATUSES, status) || reply.length > 2000 || (status === "closed" && !reply)) throw Object.assign(new Error("Choose a status and include a reply before closing a request."), { status: 400 });
    await db.runTransaction(async transaction => {
      const reference = db.collection("privacyRequests").doc(id), snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw Object.assign(new Error("Request not found."), { status: 404 });
      const current = privacyRequestItem(snapshot);
      if (current.updatedAt !== expectedUpdatedAt) throw Object.assign(new Error("This request changed; refresh before responding."), { status: 409 });
      transaction.update(reference, { status, reply, updatedAt: FieldValue.serverTimestamp(), handledBy: decoded.uid });
    });
    return Response.json({ message: "Private response saved." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
