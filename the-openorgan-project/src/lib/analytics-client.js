"use client";

import { auth } from "@/lib/firebase-client";

const VISITOR_KEY = "openorgan_visitor_id";
const SESSION_KEY = "openorgan_session";
const SESSION_TTL_MS = 30 * 60 * 1000;

function randomId(prefix) {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Analytics must never break product behavior.
  }
}

function getVisitorId() {
  let value = storageGet(VISITOR_KEY);
  if (!value) {
    value = randomId("v");
    storageSet(VISITOR_KEY, value);
  }
  return value;
}

function getSessionId() {
  const now = Date.now();
  const raw = storageGet(SESSION_KEY);
  if (raw) {
    try {
      const current = JSON.parse(raw);
      if (current.id && now - Number(current.lastSeen || 0) < SESSION_TTL_MS) {
        storageSet(SESSION_KEY, JSON.stringify({ id: current.id, lastSeen: now }));
        return current.id;
      }
    } catch {
      // Replace malformed local state.
    }
  }
  const id = randomId("s");
  storageSet(SESSION_KEY, JSON.stringify({ id, lastSeen: now }));
  return id;
}

function cleanProperties(input = {}) {
  const allowed = [
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
  ];
  const output = {};
  for (const key of allowed) {
    const value = input[key];
    if (["string", "number", "boolean"].includes(typeof value) && String(value).length <= 160) {
      output[key] = value;
    }
  }
  return output;
}

export async function trackEvent(eventName, properties = {}) {
  if (typeof window === "undefined") return;
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(String(eventName || ""))) return;

  const payload = {
    eventName,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    referrerHost: (() => {
      try { return document.referrer ? new URL(document.referrer).hostname : ""; } catch { return ""; }
    })(),
    properties: cleanProperties(properties),
    clientOccurredAt: new Date().toISOString()
  };

  try {
    const headers = { "Content-Type": "application/json" };
    if (auth?.currentUser) {
      try {
        headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {
        // Anonymous event is still useful if token refresh fails.
      }
    }

    const response = await fetch("/api/analytics/event", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
      cache: "no-store",
      credentials: "same-origin"
    });

    if (process.env.NODE_ENV !== "production") {
      const data = await response.clone().json().catch(() => null);
      if (!data?.recorded) console.warn("OpenOrgan analytics event was not recorded.", data);
    }
  } catch {
    // Deliberately silent: tracking must never affect the user experience.
  }
}
