import crypto from "node:crypto";
import { Resend } from "resend";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { apiError, requireServerUser } from "@/lib/auth-server";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60_000;

function websiteHost(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function emailHost(value) {
  return String(value || "").trim().toLowerCase().split("@")[1] || "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  if (!local || !domain) return "your contact email";
  const shown = local.length <= 2 ? local[0] || "" : local.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(2, Math.min(6, local.length - shown.length)))}@${domain}`;
}

export async function POST(request) {
  try {
    const { decoded, account, db } = await requireServerUser(request);
    if (account?.role !== "organization") {
      throw Object.assign(new Error("Organization account required."), { status: 403 });
    }
    if (account?.verificationStatus === "verified") {
      return Response.json({ message: "This organization is already verified." });
    }

    const { website, email } = await request.json();
    const cleanWebsite = String(website || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const host = websiteHost(cleanWebsite);

    if (!/^https?:\/\//i.test(cleanWebsite) || !host) {
      throw Object.assign(new Error("Enter a valid organization website beginning with https:// or http://."), { status: 400 });
    }
    if (!validEmail(cleanEmail)) {
      throw Object.assign(new Error("Enter a valid contact email."), { status: 400 });
    }

    const requestRef = db.collection("verificationRequests").doc(decoded.uid);
    const previous = await requestRef.get();
    if (previous.exists && previous.data().lastSentAt?.toMillis?.() > Date.now() - RESEND_COOLDOWN_MS) {
      throw Object.assign(new Error("A code was just sent. Wait one minute before requesting another."), { status: 429 });
    }

    const code = String(crypto.randomInt(100000, 1_000_000));
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = Timestamp.fromMillis(Date.now() + CODE_TTL_MINUTES * 60_000);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw Object.assign(new Error("Verification email is temporarily unavailable."), { status: 503 });
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: process.env.VERIFICATION_FROM_EMAIL || "The OpenOrgan Project <verify@openorgan.org>",
      to: cleanEmail,
      subject: `${code} is your OpenOrgan verification code`,
      text: `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not request this code, you can ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#32151f">
          <p style="font-size:14px;color:#8f1838;font-weight:700">THE OPENORGAN PROJECT</p>
          <h1 style="font-size:24px;margin:18px 0 8px">Verify your organization email</h1>
          <p style="line-height:1.6;color:#6c4a55">Enter this code on OpenOrgan:</p>
          <div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#f5ecef;border:1px solid #d9c7cc;padding:18px 20px;text-align:center;color:#7b1737">${code}</div>
          <p style="line-height:1.6;color:#6c4a55">The code expires in ${CODE_TTL_MINUTES} minutes.</p>
        </div>
      `
    });

    if (result.error) {
      throw Object.assign(new Error("We could not send the verification code. Try again."), { status: 502 });
    }

    await requestRef.set({
      userId: decoded.uid,
      website: cleanWebsite,
      websiteDomain: host,
      email: cleanEmail,
      emailDomain: emailHost(cleanEmail),
      codeHash,
      attempts: 0,
      confirmed: false,
      expiresAt,
      lastSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await db.collection("users").doc(decoded.uid).update({
      verificationStatus: "code_sent",
      verificationEmail: cleanEmail,
      verificationWebsite: cleanWebsite,
      verificationDomain: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return Response.json({
      message: "Verification code sent.",
      sentTo: maskEmail(cleanEmail),
      expiresInMinutes: CODE_TTL_MINUTES
    });
  } catch (error) {
    return apiError(error);
  }
}
