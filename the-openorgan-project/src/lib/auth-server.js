import { requireAdminServices } from "@/lib/firebase-admin";

export function adminUidSet() {
  return new Set(
    String(process.env.OPENORGAN_ADMIN_UIDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function requireServerUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const error = new Error("Sign in again to continue.");
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

const STATUS_MESSAGES = {
  400: "Check the information and try again.",
  401: "Sign in again to continue.",
  403: "You do not have permission to complete this action.",
  404: "The requested item could not be found.",
  409: "This item has already changed. Refresh and try again.",
  429: "Too many attempts were made. Wait a moment and try again."
};

export function apiError(error) {
  console.error(error);
  const status = Number(error?.status || 500);
  const message = status < 500
    ? String(error?.message || STATUS_MESSAGES[status] || "The request could not be completed.")
    : "The service is temporarily unavailable. Try again shortly.";

  return Response.json(
    { message, userFacing: true },
    { status }
  );
}
