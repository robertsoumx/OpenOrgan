import { requireAdminServices } from "@/lib/firebase-admin";

export function adminUidSet() {
  return new Set(String(process.env.OPENORGAN_ADMIN_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

export async function requireServerUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const error = new Error("Authentication is required.");
    error.status = 401;
    throw error;
  }
  const { auth, db } = requireAdminServices();
  const decoded = await auth.verifyIdToken(token);
  const snapshot = await db.collection("users").doc(decoded.uid).get();
  return { decoded, account: snapshot.exists ? snapshot.data() : null, db };
}

export async function requireServerAdmin(request) {
  const context = await requireServerUser(request);
  if (!adminUidSet().has(context.decoded.uid)) {
    const error = new Error("Administrator access is required.");
    error.status = 403;
    throw error;
  }
  return context;
}

export function apiError(error) {
  console.error(error);
  return Response.json({ error: error?.message || "Request failed." }, { status: error?.status || 500 });
}
