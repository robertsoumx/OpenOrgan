import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

async function loadLocalEnvironment() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await fs.readFile(path.resolve(process.cwd(), file), "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator < 1) continue;
        const key = line.slice(0, separator).trim();
        if (process.env[key] !== undefined) continue;
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        process.env[key] = value;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

await loadLocalEnvironment();

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function parseDate(value, fallback) {
  const date = value ? new Date(value) : fallback;
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

function firebaseApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccount = raw ? JSON.parse(raw) : null;
  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(serviceAccount?.project_id ? { projectId: serviceAccount.project_id } : {})
  });
}

function hash(value) {
  if (!value) return "";
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function increment(map, key, amount = 1) {
  const normalized = String(key || "unknown");
  map[normalized] = (map[normalized] || 0) + amount;
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n");
}

const now = new Date();
const fromDefault = new Date(now.getTime() - 30 * 86400000);
const from = parseDate(argument("from"), fromDefault);
const to = parseDate(argument("to"), now);
if (from >= to) throw new Error("--from must be earlier than --to");

const outputDirectory = path.resolve(process.cwd(), argument("out", `analytics-output/${now.toISOString().slice(0, 10)}`));
await fs.mkdir(outputDirectory, { recursive: true });

const db = getFirestore(firebaseApp());

const analyticsSnapshot = await db.collection("analyticsEvents")
  .where("occurredAt", ">=", Timestamp.fromDate(from))
  .where("occurredAt", "<=", Timestamp.fromDate(to))
  .orderBy("occurredAt", "asc")
  .get();

const eventRows = analyticsSnapshot.docs.map((item) => {
  const data = item.data();
  return {
    occurredAt: asDate(data.occurredAt)?.toISOString() || "",
    eventName: data.eventName || "",
    role: data.role || "",
    path: data.path || "",
    feature: data.properties?.feature || "",
    action: data.properties?.action || "",
    outcome: data.properties?.outcome || "",
    targetType: data.properties?.targetType || "",
    targetId: data.properties?.targetId || "",
    sort: data.properties?.sort || "",
    limit: data.properties?.limit || "",
    resultCount: data.properties?.resultCount ?? "",
    visitorId: data.visitorId || "",
    sessionId: data.sessionId || "",
    userKey: hash(data.userId)
  };
});

const collectionNames = [
  "users",
  "organs",
  "events",
  "reservations",
  "questions",
  "eventSignups",
  "organReviews",
  "userReviews",
  "claimRequests"
];
const snapshots = Object.fromEntries(await Promise.all(collectionNames.map(async (name) => [name, await db.collection(name).get()])));

const eventNameCounts = {};
const roleCounts = {};
const featureCounts = {};
const routeCounts = {};
for (const event of eventRows) {
  increment(eventNameCounts, event.eventName);
  increment(roleCounts, event.role);
  if (event.feature) increment(featureCounts, event.feature);
  if (event.path) increment(routeCounts, event.path.split("?")[0]);
}

const usersByRole = {};
snapshots.users.docs.forEach((item) => increment(usersByRole, item.data().role));

const organs = snapshots.organs.docs.map((item) => item.data());
const organsByOwnership = {};
const organsByPricing = {};
organs.forEach((item) => {
  increment(organsByOwnership, item.listingOwnership);
  increment(organsByPricing, item.pricing?.model || "unknown");
});

const events = snapshots.events.docs.map((item) => item.data());
const eventsByRegistration = {};
events.forEach((item) => increment(eventsByRegistration, item.registrationPolicy || "none"));

const reservations = snapshots.reservations.docs.map((item) => item.data());
const reservationsByStatus = {};
reservations.forEach((item) => increment(reservationsByStatus, item.status));

const questions = snapshots.questions.docs.map((item) => item.data());
const questionsByStatus = {};
const questionsByTarget = {};
questions.forEach((item) => {
  increment(questionsByStatus, item.status);
  increment(questionsByTarget, item.targetType);
});

const organReviews = snapshots.organReviews.docs.map((item) => item.data());
const userReviews = snapshots.userReviews.docs.map((item) => item.data());
const claimRequests = snapshots.claimRequests.docs.map((item) => item.data());
const claimsByStatus = {};
claimRequests.forEach((item) => increment(claimsByStatus, item.status));

const summary = {
  generatedAt: now.toISOString(),
  window: { from: from.toISOString(), to: to.toISOString() },
  behavioralAnalytics: {
    events: eventRows.length,
    uniqueVisitors: new Set(eventRows.map((item) => item.visitorId).filter(Boolean)).size,
    sessions: new Set(eventRows.map((item) => item.sessionId).filter(Boolean)).size,
    signedInUsers: new Set(eventRows.map((item) => item.userKey).filter(Boolean)).size,
    eventNameCounts,
    roleCounts,
    featureCounts,
    topRoutes: Object.fromEntries(Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).slice(0, 30))
  },
  productData: {
    users: { total: snapshots.users.size, byRole: usersByRole },
    organs: { total: organs.length, active: organs.filter((item) => item.status === "active").length, byOwnership: organsByOwnership, byPricing: organsByPricing },
    events: { total: events.length, active: events.filter((item) => item.status === "active").length, byRegistrationPolicy: eventsByRegistration },
    reservations: { total: reservations.length, byStatus: reservationsByStatus },
    questions: { total: questions.length, byStatus: questionsByStatus, byTargetType: questionsByTarget },
    eventSignups: { total: snapshots.eventSignups.size },
    organReviews: { total: organReviews.length, averageRating: Number(average(organReviews.map((item) => item.rating)).toFixed(3)) },
    userReviews: {
      total: userReviews.length,
      averageRating: Number(average(userReviews.map((item) => item.rating)).toFixed(3)),
      wouldHostAgainRate: userReviews.length ? userReviews.filter((item) => item.wouldHostAgain).length / userReviews.length : 0
    },
    claims: { total: claimRequests.length, byStatus: claimsByStatus }
  }
};

await Promise.all([
  fs.writeFile(path.join(outputDirectory, "analytics-events.csv"), toCsv(eventRows, [
    "occurredAt", "eventName", "role", "path", "feature", "action", "outcome", "targetType", "targetId", "sort", "limit", "resultCount", "visitorId", "sessionId", "userKey"
  ])),
  fs.writeFile(path.join(outputDirectory, "summary.json"), JSON.stringify(summary, null, 2))
]);

console.log(`Exported ${eventRows.length} analytics events.`);
console.log(`Report window: ${from.toISOString()} → ${to.toISOString()}`);
console.log(`Output: ${outputDirectory}`);
