import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { apiError, requireServerUser } from "@/lib/auth-server";

function hashesMatch(code, storedHash) {
  if (!storedHash) return false;
  const candidate = Buffer.from(crypto.createHash("sha256").update(String(code)).digest("hex"));
  const stored = Buffer.from(String(storedHash));
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

export async function POST(request) {
  try {
    const { decoded, account, db } = await requireServerUser(request);
    if (account?.role !== "organization") {
      throw Object.assign(new Error("Organization account required."), { status: 403 });
    }

    const { code } = await request.json();
    const cleanCode = String(code || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(cleanCode)) {
      throw Object.assign(new Error("Enter the six-digit verification code."), { status: 400 });
    }

    const ref = db.collection("verificationRequests").doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      throw Object.assign(new Error("Request a new verification code first."), { status: 404 });
    }

    const data = snap.data();
    if (data.confirmed) {
      return Response.json({ message: "Email already confirmed. Your organization is waiting for review." });
    }
    if (!data.expiresAt?.toMillis || data.expiresAt.toMillis() < Date.now()) {
      throw Object.assign(new Error("That code has expired. Request a new one."), { status: 400 });
    }
    if (Number(data.attempts || 0) >= 5) {
      throw Object.assign(new Error("Too many incorrect attempts. Request a new code."), { status: 429 });
    }

    if (!hashesMatch(cleanCode, data.codeHash)) {
      await ref.update({
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });
      throw Object.assign(new Error("That code is not correct."), { status: 400 });
    }

    const batch = db.batch();
    batch.update(db.collection("users").doc(decoded.uid), {
      verificationStatus: "pending_manual",
      verificationWebsite: data.website,
      verificationEmail: data.email,
      verificationDomain: FieldValue.delete(),
      emailVerifiedAt: FieldValue.serverTimestamp(),
      domainVerifiedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.update(ref, {
      confirmed: true,
      confirmedAt: FieldValue.serverTimestamp(),
      codeHash: FieldValue.delete(),
      attempts: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await batch.commit();

    return Response.json({
      message: "Email confirmed. Your organization is now waiting for manual approval."
    });
  } catch (error) {
    return apiError(error);
  }
}
