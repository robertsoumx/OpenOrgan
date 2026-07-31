import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const COMMIT = process.argv.includes("--commit");
const CENTER = { latitude: 42.3601, longitude: -71.0589 };
const MAX_ROUTE_METERS = 25 * 1609.344;
const SEARCH_URL = "https://pipeorgandatabase.org/";
const SOURCE_HOST_FRAGMENT = "pipeorgandatabase.org";
const SEARCHES = [
  "Massachusetts", "Boston", "Cambridge", "Somerville", "Brookline", "Newton",
  "Quincy", "Medford", "Malden", "Everett", "Chelsea", "Revere", "Watertown",
  "Belmont", "Arlington", "Milton", "Dedham", "Waltham", "Lexington", "Winchester", "Needham"
];

function firebaseApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccount = raw ? JSON.parse(raw) : null;
  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(serviceAccount?.project_id ? { projectId: serviceAccount.project_id } : {})
  });
}

const db = COMMIT ? getFirestore(firebaseApp()) : null;

function instrumentId(value) {
  return value?.instrumentId || value?.instrument_id || value?.instrument?.id || value?.databaseId || value?.database_id || value?.id || null;
}

function instrumentLike(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !instrumentId(value)) return false;
  const keys = Object.keys(value).join(" ").toLowerCase();
  return /instrument|organ|builder|opus|manual|stop|installation|location|venue|church/.test(keys);
}

function collectInstrumentObjects(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (instrumentLike(value)) output.push(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectInstrumentObjects(item, output));
  } else {
    Object.values(value).forEach((item) => collectInstrumentObjects(item, output));
  }
  return output;
}

function terminal(value) {
  return /not extant|destroyed|removed|private residence/i.test(JSON.stringify(value || {}));
}

async function captureJson(page, action) {
  const payloads = [];
  const urls = new Set();
  const handler = async (response) => {
    if (!response.url().includes(SOURCE_HOST_FRAGMENT)) return;
    const type = response.headers()["content-type"] || "";
    if (!type.includes("json")) return;
    urls.add(response.url());
    try {
      payloads.push(await response.json());
    } catch {
      // A response can be aborted while the interface navigates. Ignore it.
    }
  };
  page.on("response", handler);
  try {
    await action();
    await page.waitForTimeout(1500);
  } finally {
    page.off("response", handler);
  }
  return { payloads, urls: [...urls] };
}

async function instrumentLinks(page) {
  return page.locator('a[href*="/instruments/"]').evaluateAll((links) =>
    links.map((link) => link.href).filter(Boolean)
  ).catch(() => []);
}

async function captureSearch(page, term) {
  const links = new Set();
  const responseObjects = [];
  const responseUrls = new Set();

  const capture = await captureJson(page, async () => {
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1800);

    const candidates = page.locator('input[type="search"], input[type="text"]');
    let input = null;
    for (let index = 0; index < await candidates.count(); index += 1) {
      const item = candidates.nth(index);
      const metadata = `${await item.getAttribute("name") || ""} ${await item.getAttribute("placeholder") || ""} ${await item.getAttribute("aria-label") || ""}`;
      if (/search|builder|venue|city|state|keyword|database/i.test(metadata)) {
        input = item;
        break;
      }
    }
    input ||= candidates.first();
    if (!await input.count()) throw new Error("The Pipe Organ Database search input was not found.");
    await input.fill(term);
    await input.press("Enter");
    await page.waitForTimeout(2600);

    for (let index = 0; index < 14; index += 1) {
      (await instrumentLinks(page)).forEach((href) => links.add(href));
      const next = page.getByRole("button", { name: /next|more|load more/i }).first();
      if (await next.count() && await next.isEnabled().catch(() => false)) {
        await next.click().catch(() => {});
        await page.waitForTimeout(700);
      } else {
        await page.mouse.wheel(0, 1800);
        await page.waitForTimeout(450);
      }
    }
  });

  capture.payloads.forEach((payload) => responseObjects.push(...collectInstrumentObjects(payload)));
  capture.urls.forEach((url) => responseUrls.add(url));

  return { links: [...links], objects: responseObjects, urls: [...responseUrls] };
}

function bestInstrumentObject(payloads, id) {
  const matches = payloads
    .flatMap((payload) => collectInstrumentObjects(payload))
    .filter((item) => String(instrumentId(item)) === String(id));
  return matches.sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0] || null;
}

async function instrumentDetail(page, id, searchFallback = {}) {
  const captured = await captureJson(page, async () => {
    await page.goto(`https://pipeorgandatabase.org/instruments/${id}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await page.waitForTimeout(2200);
  });

  const fromPage = bestInstrumentObject(captured.payloads, id);
  if (fromPage) return { ...searchFallback, ...fromPage };

  const endpoints = [
    `https://api.pipeorgandatabase.org/instruments/${id}`,
    `https://api.pipeorgandatabase.org/api/instruments/${id}`
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return { ...searchFallback, ...(await response.json()) };
    } catch {
      // Continue to the next fallback.
    }
  }

  if (Object.keys(searchFallback).length) return searchFallback;
  throw new Error(`Unable to retrieve instrument ${id}.`);
}

function venueText(data) {
  const location = data.location || data.institution || data.venue || {};
  return [
    location.name, data.locationName, data.location_name, data.institutionName,
    data.churchName, data.venueName, location.address, data.address,
    location.city, data.city, "Massachusetts"
  ].filter(Boolean).join(", ");
}

function builderName(data) {
  const value = data.builder || data.builders?.[0] || data.installer || {};
  return value.name || data.builderName || data.builder_name || data.organBuilder || "";
}

function addressPart(parts, type, short = false) {
  const item = parts?.find((value) => value.types?.includes(type));
  return item ? (short ? item.shortText : item.longText) || item.longText || item.shortText || "" : "";
}

async function googlePlace(text) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_SERVER_API_KEY is required.");
  if (!text.trim()) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.addressComponents"
    },
    body: JSON.stringify({
      textQuery: text,
      locationBias: { circle: { center: CENTER, radius: 50000 } },
      maxResultCount: 3
    })
  });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}: ${await response.text()}`);
  return (await response.json()).places?.[0] || null;
}

async function routeMeters(placeId) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters"
    },
    body: JSON.stringify({
      origins: [{ waypoint: { location: { latLng: CENTER } } }],
      destinations: [{ waypoint: { placeId } }],
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE"
    })
  });
  if (!response.ok) throw new Error(`Google Routes returned ${response.status}: ${await response.text()}`);
  const row = (await response.json())?.[0];
  return row?.condition === "ROUTE_EXISTS" ? Number(row.distanceMeters) : Infinity;
}

function makeDocument(id, data, place, meters) {
  const location = place.location || {};
  const components = place.addressComponents || [];
  const venue = place.displayName?.text || data.locationName || data.institutionName || "Pipe organ venue";
  const builder = builderName(data);
  const year = data.year || data.installationYear || data.installation_year || "";
  return {
    ownerId: "",
    name: data.organName || data.instrumentName || [builder, year].filter(Boolean).join(" ") || `Pipe organ at ${venue}`,
    organizationName: venue,
    location: {
      placeId: place.id,
      name: venue,
      formattedAddress: place.formattedAddress || "",
      googleMapsUri: place.googleMapsUri || "",
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      city: addressPart(components, "locality") || addressPart(components, "postal_town") || addressPart(components, "administrative_area_level_2"),
      region: addressPart(components, "administrative_area_level_1", true),
      postalCode: addressPart(components, "postal_code"),
      country: addressPart(components, "country")
    },
    builder,
    year: String(year || ""),
    manuals: Number(data.manuals || data.numberOfManuals || data.number_of_manuals || 0),
    stops: Number(data.stops || data.numberOfStops || data.number_of_stops || 0),
    description: "Public reference listing imported for the Greater Boston launch area. Confirm instrument details and current access directly with the venue and the cited source.",
    publicAccessNotes: "This listing has not been claimed. Practice access is not available through The OpenOrgan Project yet.",
    pricing: { model: "free", amountCents: 0, currency: "USD", paymentTiming: "", paymentMethods: [], instructions: "" },
    listingOwnership: "unclaimed",
    claimStatus: "available",
    bookingEnabled: false,
    status: "active",
    verificationStatus: "source_imported",
    sourceKey: `ohs:${id}`,
    source: {
      name: "Pipe Organ Database — Organ Historical Society",
      externalId: String(id),
      url: `https://pipeorgandatabase.org/instruments/${id}`,
      routeDistanceMeters: meters
    },
    createdAt: COMMIT ? FieldValue.serverTimestamp() : new Date().toISOString(),
    updatedAt: COMMIT ? FieldValue.serverTimestamp() : new Date().toISOString()
  };
}

async function main() {
  await fs.mkdir("import-output", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const candidates = new Map();
  const capturedUrls = new Set();

  for (const term of SEARCHES) {
    console.log(`Searching source: ${term}`);
    try {
      const result = await captureSearch(page, term);
      result.urls.forEach((url) => capturedUrls.add(url));
      result.objects.forEach((item) => {
        const id = instrumentId(item);
        if (id) candidates.set(String(id), { ...(candidates.get(String(id)) || {}), ...item });
      });
      result.links.forEach((href) => {
        const id = href.match(/\/instruments\/(\d+)/)?.[1];
        if (id && !candidates.has(id)) candidates.set(id, {});
      });
    } catch (error) {
      console.warn(`${term}: ${error.message}`);
    }
  }

  await fs.writeFile(
    path.join("import-output", "captured-network.json"),
    JSON.stringify([...capturedUrls], null, 2)
  );

  if (!candidates.size) {
    await page.screenshot({ path: path.join("import-output", "source-interface.png"), fullPage: true }).catch(() => {});
    await browser.close();
    throw new Error("No instrument links or JSON records were captured. Review import-output/source-interface.png before adjusting the source selectors.");
  }

  console.log(`${candidates.size} unique candidate instruments found.`);
  const accepted = [];
  let skipped = 0;

  for (const [id, fallback] of candidates) {
    try {
      if (COMMIT) {
        const existing = await db.collection("organs").where("sourceKey", "==", `ohs:${id}`).limit(1).get();
        if (!existing.empty) {
          skipped += 1;
          continue;
        }
      }

      const data = await instrumentDetail(page, id, fallback);
      if (terminal(data)) {
        skipped += 1;
        continue;
      }

      const place = await googlePlace(venueText(data));
      if (!place?.id) {
        skipped += 1;
        continue;
      }

      const meters = await routeMeters(place.id);
      if (!Number.isFinite(meters) || meters > MAX_ROUTE_METERS) {
        skipped += 1;
        continue;
      }

      const document = makeDocument(id, data, place, meters);
      accepted.push(document);
      if (COMMIT) {
        await db.collection("organs").add(document);
        console.log(`Imported ${id}: ${document.organizationName}`);
      } else {
        console.log(`DRY RUN ${id}: ${document.organizationName} (${(meters / 1609.344).toFixed(1)} route mi)`);
      }
    } catch (error) {
      console.warn(`Skipped ${id}: ${error.message}`);
      skipped += 1;
    }
  }

  await browser.close();
  await fs.writeFile(
    path.join("import-output", "accepted.json"),
    JSON.stringify(accepted.map((item) => ({ ...item, createdAt: undefined, updatedAt: undefined })), null, 2)
  );
  console.log(`${COMMIT ? "Committed" : "Dry run accepted"} ${accepted.length}; skipped ${skipped}. Review import-output/accepted.json.${COMMIT ? "" : " Run npm run import:boston -- --commit only after review."}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
