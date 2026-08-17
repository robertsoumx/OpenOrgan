import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const PROPERTY_KEYS = new Set([
  "feature",
  "action",
  "targetType",
  "targetId",
  "role",
  "sort",
  "limit",
  "outcome",
  "status",
  "listingOwnership",
  "pricingModel",
  "registrationPolicy",
  "locationStatus",
  "source",
  "reviewType",
  "resultCount",
  "queryLength"
]);

function cleanText(value, max = 160) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cleanProperties(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!PROPERTY_KEYS.has(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value)) {
      output[key] = typeof value === "string" ? value.slice(0, 160) : value;
    }
  }
  return output;
}

function requestOriginIsAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const allowed = new Set();
  allowed.add(request.nextUrl.origin);

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try { allowed.add(new URL(configured).origin); } catch {}
  }

  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) allowed.add(`${forwardedProto}://${forwardedHost}`);

  return allowed.has(origin);
}

async function authenticatedIdentity(services, request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return { userId: null, role: null };
  try {
    const decoded = await services.auth.verifyIdToken(header.slice(7));
    const userSnapshot = await services.db.collection("users").doc(decoded.uid).get();
    return {
      userId: decoded.uid,
      role: userSnapshot.exists ? userSnapshot.data()?.role || null : null
    };
  } catch {
    return { userId: null, role: null };
  }
}

export async function POST(request) {
  try {
    if (!requestOriginIsAllowed(request)) {
      return NextResponse.json({ ok: false, recorded: false }, { status: 403 });
    }

    const body = await request.json();
    const eventName = cleanText(body?.eventName, 64);
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(eventName)) {
      return NextResponse.json({ ok: false, recorded: false }, { status: 400 });
    }

    const visitorId = cleanText(body?.visitorId, 96);
    const sessionId = cleanText(body?.sessionId, 96);
    if (!visitorId || !sessionId) {
      return NextResponse.json({ ok: false, recorded: false }, { status: 400 });
    }

    const services = getAdminServices();
    if (!services) {
      console.error("Analytics event was not recorded because Firebase Admin is unavailable.");
      return NextResponse.json({ ok: true, recorded: false }, { status: 202 });
    }

    const identity = await authenticatedIdentity(services, request);
    const properties = cleanProperties(body?.properties);

    await services.db.collection("analyticsEvents").add({
      eventName,
      visitorId,
      sessionId,
      userId: identity.userId,
      role: identity.role || cleanText(properties.role, 32) || "public",
      path: cleanText(body?.path, 500),
      referrerHost: cleanText(body?.referrerHost, 160),
      properties,
      clientOccurredAt: cleanText(body?.clientOccurredAt, 64),
      occurredAt: new Date(),
      schemaVersion: 2
    });

    return NextResponse.json({ ok: true, recorded: true }, { status: 201 });
  } catch (error) {
    console.error("Analytics event write failed:", error?.message || error);
    return NextResponse.json({ ok: true, recorded: false }, { status: 202 });
  }
}
