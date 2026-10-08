import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { discoverPodLocations, churchLocation, currentInstrument, selectInstrument, metric, placeMatchesSource } from "../src/lib/organ-import-core.mjs";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

/*
 * The OpenOrgan Project — Greater Boston church-organ importer
 *
 * Design goals:
 *   1. One OpenOrgan listing per Pipe Organ Database LOCATION (church), never per historical instrument record.
 *   2. Choose ONE canonical instrument for each church. Other builders/opuses at the same church are omitted.
 *   3. Prefer a playable/main/larger instrument over a small chapel or historical duplicate.
 *   4. Use the Pipe Organ Database JSON API for detail work; Playwright is used only to discover location IDs.
 *   5. Fetch OHS JSON concurrently and batch Google Routes checks, making the importer much faster than
 *      visiting every location/instrument page in a browser.
 *   6. Import church locations only.
 *   7. Use Google Places only to resolve a usable full address / Place ID / coordinates.
 *
 * Usage:
 *   npm run import:boston
 *   npm run import:boston -- --commit
 *   npm run import:boston -- --commit --rebuild
 *   npm run import:boston -- --max=20
 *   npm run import:boston -- --cities=Boston,Cambridge,Somerville
 */

const POD_WEB = "https://pipeorgandatabase.org";
const POD_API = "https://api.pipeorgandatabase.org";
const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_ROUTE_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const BOSTON_CENTER = { latitude: 42.3601, longitude: -71.0589 };
const DEFAULT_RADIUS_MILES = 25;
const METERS_PER_MILE = 1609.344;
const MIN_SAFE_REBUILD_COUNT = 5;
const GOOGLE_PLACES_BIAS_RADIUS_METERS = 50_000;

const DEFAULT_CITIES = [
  "Boston",
  "Cambridge",
  "Somerville",
  "Brookline",
  "Newton",
  "Watertown",
  "Belmont",
  "Arlington",
  "Medford",
  "Malden",
  "Everett",
  "Chelsea",
  "Revere",
  "Winthrop",
  "Quincy",
  "Milton",
  "Braintree",
  "Weymouth",
  "Dedham",
  "Needham",
  "Wellesley",
  "Weston",
  "Waltham",
  "Lexington",
  "Concord",
  "Lincoln",
  "Bedford",
  "Burlington",
  "Winchester",
  "Stoneham",
  "Melrose",
  "Wakefield",
  "Saugus",
  "Lynn",
  "Nahant",
  "Swampscott",
  "Marblehead",
  "Salem",
  "Peabody",
  "Danvers",
  "Canton",
  "Norwood",
  "Westwood",
  "Dover",
  "Hingham",
  "Hull",
  "Natick",
];

const CHURCH_TYPE_RE = /\bchurch\b|baptist|catholic|roman\s+catholic|episcopal|anglican|lutheran|methodist|presbyterian|congregational|unitarian|universalist|nondenominational|non-denominational|disciples\s+of\s+christ|christian\s+science|christian|evangelical|protestant|reformed|orthodox|pentecostal|assembl(?:y|ies)\s+of\s+god|adventist|seventh-day|mennonite|moravian|brethren|church\s+of\s+christ|church\s+of\s+god|church\s+of\s+jesus\s+christ|latter-day|mormon|friends|quaker|salvation\s+army|swedenborgian|religious\s+institution/i;

const CHURCH_NAME_RE = /\b(?:church|cathedral|chapel|parish|basilica|abbey|meeting\s*house|congregation)\b/i;
const NON_PLAYABLE_RE = /\b(?:not\s+extant|not\s+playable|destroyed|dismantled|removed|no\s+longer\s+extant|extinct)\b/i;
const PLAYABLE_RE = /\b(?:extant\s+and\s+playable|playable|extant)\b/i;
const MAIN_ROOM_RE = /\b(?:main|sanctuary|nave|chancel|gallery)\b/i;
const SECONDARY_ROOM_RE = /\b(?:chapel|crypt|practice|choir\s+room)\b/i;

await loadEnvFiles();

const args = parseArgs(process.argv.slice(2));
const COMMIT = args.has("commit");
const REBUILD = args.has("rebuild");
const SOURCE_ONLY = args.has("source-only");
if (SOURCE_ONLY && (COMMIT || REBUILD)) throw new Error("--source-only cannot write or rebuild Firestore");
if (REBUILD && (args.has("max") || args.has("cities"))) throw new Error("Rebuild requires complete default regional coverage; use a dry run for limited imports");
const MAX = positiveInteger(args.get("max"));
const RADIUS_MILES = positiveNumber(args.get("radius")) || DEFAULT_RADIUS_MILES;
const CITIES = args.get("cities")
  ? args.get("cities").split(",").map((value) => value.trim()).filter(Boolean)
  : DEFAULT_CITIES;

const GOOGLE_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
if (!GOOGLE_KEY && !SOURCE_ONLY) {
  throw new Error("GOOGLE_MAPS_SERVER_API_KEY is missing. Put the server-side key in .env.local.");
}

const OUTPUT_DIR = path.resolve("import-output");
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const startedAt = performance.now();
const rejected = [];

console.log("\nThe OpenOrgan Project — fast Greater Boston church-organ import\n");
console.log(`Mode: ${COMMIT ? "COMMIT" : "DRY RUN"}${REBUILD ? " + REBUILD" : ""}`);
console.log(`Launch radius: ${RADIUS_MILES} route miles from central Boston`);
console.log(`Search municipalities: ${CITIES.length}`);
console.log("Deduplication: ONE listing per Pipe Organ Database church/location\n");

if (!SOURCE_ONLY) await assertGooglePlacesReady();

const discoveryStart = performance.now();
const discoveredLocations = await discoverLocations(CITIES);
const churchCandidates = discoveredLocations.filter(isChurchDiscovery);
const nonChurchCandidates = discoveredLocations.filter((entry) => !isChurchDiscovery(entry));
for (const entry of nonChurchCandidates) {
  reject(entry.id, "non_church_location", entry.sourceType || entry.name || "unknown source type");
}

const limitedChurchCandidates = MAX ? churchCandidates.slice(0, MAX) : churchCandidates;
console.log(
  `\nDiscovered ${discoveredLocations.length} unique source locations; ` +
  `${churchCandidates.length} are church locations by the Pipe Organ Database directory ` +
  `(${formatDuration(discoveryStart)}).`
);
printSourceTypeSummary(discoveredLocations);
await writeJson("source-locations.json", discoveredLocations);
if (MAX) console.log(`Debug limit active: processing first ${limitedChurchCandidates.length} church locations.`);

const locationStart = performance.now();
const locationResults = await mapConcurrent(limitedChurchCandidates, 24, async (entry) => {
  try {
    const location = await fetchPodJson(`/locations/${entry.id}`);
    // Keep the source directory metadata alongside the API result. The API's location-type
    // representation has changed before, while the public directory's Type label is stable.
    return {
      location,
      discovery: entry,
    };
  } catch (error) {
    reject(entry.id, "location_api_failed", error.message);
    return null;
  }
});

const churchLocations = locationResults
  .filter(Boolean)
  .map(({ location, discovery }) => {
    // If the detail API omits a human-readable name, preserve the public directory name.
    if (!extractName(location) && discovery?.name && location && typeof location === "object") {
      location.__openOrganSourceName = discovery.name;
    }
    if (location && typeof location === "object") {
      location.__openOrganSourceType = discovery?.sourceType || "";
    }
    return location;
  });
console.log(
  `Loaded ${churchLocations.length}/${limitedChurchCandidates.length} church location records ` +
  `(${formatDuration(locationStart)}).`
);

const instrumentStart = performance.now();
const instrumentStubMap = new Map();
for (const location of churchLocations) {
  const locationId = extractId(location);
  const stubs = extractInstrumentStubs(location).filter(currentInstrument);
  if (!stubs.length) {
    reject(locationId, "no_instruments_at_location", extractName(location));
    continue;
  }
  instrumentStubMap.set(String(locationId), stubs);
}

const instrumentIds = [...new Set(
  [...instrumentStubMap.values()].flatMap((stubs) => stubs.map(extractId).filter(Boolean).map(String))
)];

const instrumentMap = new Map();
await mapConcurrent(instrumentIds, 32, async (instrumentId) => {
  try {
    const instrument = await fetchPodJson(`/instruments/${instrumentId}`);
    instrumentMap.set(String(instrumentId), instrument);
  } catch (error) {
    reject(instrumentId, "instrument_api_failed", error.message);
  }
});
console.log(`Fetched ${instrumentMap.size}/${instrumentIds.length} instrument records concurrently (${formatDuration(instrumentStart)}).`);

const canonicalStart = performance.now();
const canonicalChurches = [];
for (const location of churchLocations) {
  const locationId = String(extractId(location));
  const stubs = instrumentStubMap.get(locationId) || [];
  const instruments = stubs
    .map((stub) => instrumentMap.get(String(extractId(stub))) || stub)
    .filter(Boolean)
    .filter(currentInstrument);

  if (!instruments.length) {
    reject(locationId, "no_usable_instrument", extractName(location));
    continue;
  }

  const canonicalInstrument = chooseCanonicalInstrument(instruments);
  canonicalChurches.push({ location, instrument: canonicalInstrument });
}
console.log(`Collapsed ${churchLocations.length} church locations to ${canonicalChurches.length} current playable organs (${formatDuration(canonicalStart)}).`);
if (SOURCE_ONLY) {
  const candidates = canonicalChurches.map(({location,instrument}) => ({ sourceLocationId:String(location.id), sourceInstrumentId:String(instrument.id), name:extractName(location), builder:extractBuilderName(instrument), year:extractYear(instrument), manuals:metric(instrument,"manuals"), stops:metric(instrument,"stops"), ranks:metric(instrument,"ranks"), sourceAddress:buildSourceAddress(location), sourceUrl:`${POD_WEB}/instruments/${instrument.id}`, sourceCheckedAt:new Date().toISOString(), addressValidation:"pending_google_places_and_routes" }));
  await writeJson("source-candidates.json", candidates);
  await writeJson("rejected.json", rejected);
  await writeJson("source-run-summary.json", {generatedAt:new Date().toISOString(), municipalities:CITIES.length, sourceLocations:discoveredLocations.length, churchLocations:churchLocations.length, currentPlayableCandidates:candidates.length, apiFailures:rejected.filter(x=>/_api_failed/.test(x.reason)).length, productionWrites:0});
  console.log(`Source audit saved: ${candidates.length} candidates; address/route verification pending. No production writes.`);
  process.exit(0);
}

const placesStart = performance.now();
const resolvedRaw = (await mapConcurrent(canonicalChurches, 10, async ({ location, instrument }) => {
  const locationId = String(extractId(location));
  const sourceAddress = buildSourceAddress(location);
  const placeQuery = [extractName(location), sourceAddress].filter(Boolean).join(", ");

  try {
    const googlePlace = await resolveGooglePlace(placeQuery);
    if (!placeMatchesSource(location, googlePlace)) {
      reject(locationId, "google_place_unverified", placeQuery);
      return null;
    }
    return buildImportRecord(location, instrument, googlePlace);
  } catch (error) {
    reject(locationId, "google_place_failed", error.message);
    return null;
  }
})).filter(Boolean);
const resolved = dedupeResolvedChurches(resolvedRaw);
console.log(`Resolved ${resolvedRaw.length}/${canonicalChurches.length} church addresses through Google Places; ${resolved.length} remain after physical-place deduplication (${formatDuration(placesStart)}).`);

const routesStart = performance.now();
const routed = await addRouteDistances(resolved);
const accepted = routed
  .filter((record) => {
    if (!Number.isFinite(record.importMeta.routeDistanceMeters)) {
      reject(record.sourceLocationId, "route_not_found", record.location.formattedAddress);
      return false;
    }
    if (record.importMeta.routeDistanceMeters > RADIUS_MILES * METERS_PER_MILE) {
      reject(record.sourceLocationId, "outside_launch_radius", `${(record.importMeta.routeDistanceMeters / METERS_PER_MILE).toFixed(1)} miles`);
      return false;
    }
    return true;
  })
  .sort((a, b) => a.importMeta.routeDistanceMeters - b.importMeta.routeDistanceMeters);
console.log(`Route-filtered in batches: ${accepted.length} within ${RADIUS_MILES} miles (${formatDuration(routesStart)}).`);

await writeJson("accepted.json", accepted);
await writeJson("rejected.json", rejected);
await writeJson("run-summary.json", {
  generatedAt: new Date().toISOString(),
  mode: COMMIT ? "commit" : "dry-run",
  rebuild: REBUILD,
  sourceLocationsDiscovered: discoveredLocations.length,
  sourceChurchLocationsDiscovered: churchCandidates.length,
  sourceLocationsProcessed: limitedChurchCandidates.length,
  churchLocations: churchLocations.length,
  sourceInstrumentRecordsFetched: instrumentMap.size,
  canonicalOrgans: canonicalChurches.length,
  placesResolved: resolved.length,
  accepted: accepted.length,
  rejected: rejected.length,
  radiusMiles: RADIUS_MILES,
  cities: CITIES,
});

printRejectionSummary();
console.log(`\nAccepted ${accepted.length} unique church organs.`);
console.log(`Dry-run files: ${path.join(OUTPUT_DIR, "accepted.json")}`);

if (!COMMIT) {
  console.log("No Firestore writes were made. Review accepted.json, then run with --commit.");
  console.log(`Total runtime: ${formatDuration(startedAt)}\n`);
  process.exit(0);
}

if (REBUILD && accepted.length < MIN_SAFE_REBUILD_COUNT) {
  throw new Error(
    `Safety stop: only ${accepted.length} replacement listings were accepted. ` +
    `At least ${MIN_SAFE_REBUILD_COUNT} are required before --rebuild may delete previous imports.`
  );
}

if (REBUILD && rejected.some(item => /_api_failed|google_place_failed|route_not_found/.test(item.reason))) {
  throw new Error("Incomplete source/address/route verification: rebuild blocked. Inspect rejected.json; no Firestore writes made.");
}
const db = await getAdminDb();
const commitStart = performance.now();
const existingSnapshot = await db.collection("organs").get();
const claimedLocationIds = new Set();
const claimedPlaceIds = new Set();
const oldImportedRefs = [];

for (const doc of existingSnapshot.docs) {
  const data = doc.data();
  const sourceLocationId = String(
    data.sourceLocationId ?? data.source?.locationId ?? data.importMeta?.sourceLocationId ?? ""
  );
  const isPod = isPipeOrganDatabaseRecord(data);

  if (data.listingOwnership === "claimed") {
    if (sourceLocationId) claimedLocationIds.add(sourceLocationId);
    if(data.location?.placeId) claimedPlaceIds.add(data.location.placeId);
  }

  if (isPod && data.listingOwnership === "unclaimed" && data.status === "active") {
    oldImportedRefs.push(doc.ref);
  }
}

const recordsToWrite = accepted.filter((record) => !claimedLocationIds.has(String(record.sourceLocationId)) && !claimedPlaceIds.has(record.location?.placeId));
await writeJson("firestore-backup-before-refresh.json", existingSnapshot.docs.map(doc => ({id:doc.id,...doc.data()})));
if (REBUILD && recordsToWrite.length < oldImportedRefs.length * 0.6) throw new Error("Rebuild would remove over 40% of the existing reference collection; inspect the audit before proceeding.");
// Write the verified replacement set first. A failed write must leave existing records available.
await writeRecordsInBatches(db, recordsToWrite);

if (REBUILD) {
  const currentIds = new Set(recordsToWrite.map(record => record.id));
  const stale = oldImportedRefs.filter(ref => !currentIds.has(ref.id));
  await mapConcurrent(stale, 8, ref => db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (current.exists && current.data().listingOwnership === "unclaimed") transaction.update(ref,{status:"archived",archivedReason:"outside_verified_replacement_set",updatedAt:FieldValue.serverTimestamp()});
  }));
  console.log(`Archived ${stale.length} stale unclaimed imports after replacement writes succeeded.`);
}

console.log(`Committed ${recordsToWrite.length} unique church listings.`);
if (accepted.length !== recordsToWrite.length) {
  console.log(`Preserved ${accepted.length - recordsToWrite.length} already-claimed source locations.`);
}
console.log(`Total runtime: ${formatDuration(startedAt)}\n`);

// --------------------------------------------------------------------------------------
// Discovery: browser ONLY gathers location IDs. No per-location or per-instrument browsing.
// --------------------------------------------------------------------------------------

async function discoverLocations(cities) {
  return discoverPodLocations(cities, fetchPodJson, (city, count) => console.log(`Source city ${city}: ${count} unique in-scope locations`));
}
function isChurchDiscovery(entry) { return churchLocation(entry); }

function printSourceTypeSummary(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const type = stringValue(entry?.sourceType) || "(type missing)";
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!top.length) return;
  console.log("Source location types (top):");
  for (const [type, count] of top) {
    console.log(`  ${String(count).padStart(4)}  ${type}`);
  }
}

// --------------------------------------------------------------------------------------
// Canonical church/instrument selection
// --------------------------------------------------------------------------------------

function chooseCanonicalInstrument(instruments) { return selectInstrument(instruments); }

// --------------------------------------------------------------------------------------
// Pipe Organ Database JSON API
// --------------------------------------------------------------------------------------

async function fetchPodJson(endpoint) {
  return fetchJson(`${POD_API}${endpoint}`, {
    headers: { Accept: "application/json" },
    timeoutMs: 12_000,
    retries: 3,
  });
}

function extractInstrumentStubs(location) {
  const candidates = [
    location?.instruments,
    location?.organs,
    location?.instrumentRecords,
    location?.data?.instruments,
    location?.relationships?.instruments,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return uniqueById(candidate);
  }

  // Defensive fallback for minor API-shape changes.
  const found = [];
  walk(location, (key, value) => {
    if (/instrument/i.test(key) && Array.isArray(value)) found.push(...value);
  }, 0, 4);
  return uniqueById(found);
}

function isChurchLocation(location) {
  const type = extractLocationType(location);
  if (type && CHURCH_TYPE_RE.test(type)) return true;
  if (type) return false;
  return CHURCH_NAME_RE.test(extractName(location));
}

function extractLocationType(location) {
  return stringValue(firstDefined(
    location?.locationType?.name,
    location?.locationType,
    location?.type?.name,
    location?.type,
    location?.subType?.name,
    location?.locationSubType?.name,
    location?.__openOrganSourceType,
  ));
}

// --------------------------------------------------------------------------------------
// Google Places + batched Routes
// --------------------------------------------------------------------------------------

async function assertGooglePlacesReady() {
  const response = await fetchJson(GOOGLE_PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": "places.id,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: "Trinity Church, Boston, MA",
      pageSize: 1,
      regionCode: "US",
      locationBias: {
        circle: {
          center: BOSTON_CENTER,
          radius: GOOGLE_PLACES_BIAS_RADIUS_METERS,
        },
      },
    }),
    timeoutMs: 10_000,
    retries: 0,
  }).catch((error) => {
    throw new Error(
      `Google Places preflight failed before import discovery. ${error.message}\n` +
      "Check GOOGLE_MAPS_SERVER_API_KEY, enable Places API (New), and make sure the key is not HTTP-referrer restricted."
    );
  });

  if (!response || typeof response !== "object") {
    throw new Error("Google Places preflight returned an invalid response.");
  }

  console.log("Google Places preflight: OK (50 km Boston location bias).\n");
}

async function resolveGooglePlace(textQuery) {
  const response = await fetchJson(GOOGLE_PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.addressComponents",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery,
      pageSize: 1,
      regionCode: "US",
      locationBias: {
        circle: {
          center: BOSTON_CENTER,
          radius: GOOGLE_PLACES_BIAS_RADIUS_METERS,
        },
      },
    }),
    timeoutMs: 10_000,
    retries: 2,
  });
  return response?.places?.[0] || null;
}

async function addRouteDistances(records) {
  const output = records.map((record) => structuredClone(record));

  // Google permits up to 50 address/place-ID waypoints in a matrix request. With one coordinate
  // origin we keep destination chunks at 49, turning dozens of individual route calls into only
  // a handful of matrix requests.
  for (let start = 0; start < output.length; start += 49) {
    const chunk = output.slice(start, start + 49);
    const body = {
      origins: [{
        waypoint: {
          location: { latLng: BOSTON_CENTER },
        },
      }],
      destinations: chunk.map((record) => ({
        waypoint: { placeId: record.location.placeId },
      })),
      travelMode: "DRIVE",
    };

    const response = await fetchRawJsonOrStream(GOOGLE_ROUTE_MATRIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,condition,status",
      },
      body: JSON.stringify(body),
      timeoutMs: 20_000,
      retries: 2,
    });

    const elements = Array.isArray(response) ? response : response?.routes || response?.elements || [];
    for (const element of elements) {
      const destinationIndex = Number(element?.destinationIndex);
      if (!Number.isInteger(destinationIndex) || !chunk[destinationIndex]) continue;
      if (Number.isFinite(Number(element?.distanceMeters))) {
        output[start + destinationIndex].importMeta.routeDistanceMeters = Number(element.distanceMeters);
      }
    }
  }
  return output;
}

function buildImportRecord(location, instrument, googlePlace) {
  const sourceLocationId = String(extractId(location));
  const sourceInstrumentId = String(extractId(instrument));
  const builder = extractBuilderName(instrument);
  const opus = formatOpus(instrument);
  const year = extractYear(instrument);
  const churchName = googlePlace.displayName?.text || extractName(location) || "Church organ";
  const addressParts = parseGoogleAddress(googlePlace.addressComponents || []);
  const formattedAddress = googlePlace.formattedAddress || buildSourceAddress(location);
  const manuals = extractMetric(instrument, ["manuals", "numManuals", "numberOfManuals"]);
  const stops = extractMetric(instrument, ["stops", "numStops", "numberOfStops", "stopCount"]);
  const ranks = extractMetric(instrument, ["ranks", "numRanks", "numberOfRanks", "rankCount"]);

  return {
    id: `ohs-location-${sourceLocationId}`,
    name: churchName,
    organizationName: churchName,
    ownerId: "",
    status: "active",
    listingOwnership: "unclaimed",
    claimStatus: "available",
    bookingEnabled: false,
    verificationStatus: "source_imported",

    builder,
    sourceRecordBuilder: builder,
    originalBuilder: instrument.originalBuilder?.name || "",
    sourceLocationName: extractName(location),
    originalYear: instrument.originalYear || "",
    opus,
    year: year || "",
    manuals: manuals || "",
    stops: stops || "",
    ranks: ranks || "",
    instrumentLabel: [builder, opus ? `Opus ${opus}` : ""].filter(Boolean).join(" "),

    description: "Reference listing imported from the Pipe Organ Database. This listing has not yet been claimed by the organization.",
    publicAccessNotes: "",

    location: {
      placeId: googlePlace.id,
      name: googlePlace.displayName?.text || churchName,
      formattedAddress,
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(googlePlace.id)}`,
      latitude: Number(googlePlace.location.latitude),
      longitude: Number(googlePlace.location.longitude),
      city: addressParts.city || stringValue(firstDefined(location?.city, location?.locality)),
      region: addressParts.region || stringValue(firstDefined(location?.stateProvinceCode, location?.stateCode, location?.state, location?.region)),
      postalCode: addressParts.postalCode,
      country: addressParts.country || "United States",
    },
    fullAddress: formattedAddress,
    city: addressParts.city || stringValue(firstDefined(location?.city, location?.locality)),
    region: addressParts.region || stringValue(firstDefined(location?.stateProvinceCode, location?.stateCode, location?.state, location?.region)),

    sourceType: "pipe_organ_database",
    sourceKey: `ohs-location:${sourceLocationId}`,
    sourceName: "Pipe Organ Database",
    sourceLocationId,
    sourceInstrumentId,
    sourceLocationUrl: `${POD_WEB}/locations/${sourceLocationId}`,
    sourceUrl: `${POD_WEB}/instruments/${sourceInstrumentId}`,
    source: {
      provider: "pipe_organ_database",
      locationId: sourceLocationId,
      instrumentId: sourceInstrumentId,
      locationUrl: `${POD_WEB}/locations/${sourceLocationId}`,
      instrumentUrl: `${POD_WEB}/instruments/${sourceInstrumentId}`,
    },
    importMeta: {
      sourceLocationId,
      sourceInstrumentId,
      routeDistanceMeters: null,
      canonicalSelection: "one_per_church_confirmed_current_playable_main",
      verifiedAt: new Date().toISOString(),
      sourceExtant: true,
      sourcePlayable: true,
      addressVerification: "source_street_number_name_and_google_place",
      importedAt: new Date().toISOString(),
    },
  };
}


function dedupeResolvedChurches(records) {
  const byPlace = new Map();
  for (const record of records) {
    const key = record.location?.placeId || `source:${record.sourceLocationId}`;
    const previous = byPlace.get(key);
    if (!previous) {
      byPlace.set(key, record);
      continue;
    }

    const keep = importedRecordScore(record) > importedRecordScore(previous) ? record : previous;
    const omit = keep === record ? previous : record;
    byPlace.set(key, keep);
    reject(omit.sourceLocationId, "duplicate_physical_church", `Same Google Place as source location ${keep.sourceLocationId}`);
  }
  return [...byPlace.values()];
}

function importedRecordScore(record) {
  return (Number(record.manuals) || 0) * 5_000_000 +
    (Number(record.stops) || 0) * 50_000 +
    (Number(record.ranks) || 0) * 5_000 +
    (Number(record.year) || 0);
}

// --------------------------------------------------------------------------------------
// Firestore
// --------------------------------------------------------------------------------------

async function getAdminDb() {
  if (getApps().length) {
    return getFirestore(getApps()[0]);
  }

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    undefined;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountPath) {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
    let raw;
    try {
      raw = await fs.readFile(absolutePath, "utf8");
    } catch (error) {
      throw new Error(
        `Could not read FIREBASE_SERVICE_ACCOUNT_PATH at ${absolutePath}: ${error.message}`
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `Firebase service-account file is not valid JSON (${absolutePath}): ${error.message}`
      );
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id,
    });
    return getFirestore(app);
  }

  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is invalid. Keep it as one-line JSON with escaped \n sequences, " +
        "or preferably set FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json. " +
        `Original error: ${error.message}`
      );
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id,
    });
    return getFirestore(app);
  }

  try {
    const app = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
    return getFirestore(app);
  } catch (error) {
    throw new Error(
      "Firebase Admin credentials are missing. For local imports, set " +
      "FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json. " +
      `Original error: ${error.message}`
    );
  }
}

async function writeRecordsInBatches(db, records) {
  await mapConcurrent(records, 8, async record => {
    const { id, ...data } = record;
    const ref = db.collection("organs").doc(id);
    await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if (current.exists && current.data().listingOwnership === "claimed") return;
      transaction.set(ref, {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        ...(!current.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
      }, { merge: true });
    });
  });
}

async function deleteRefsInBatches(db, refs) {
  for (let start = 0; start < refs.length; start += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(start, start + 400)) batch.delete(ref);
    await batch.commit();
  }
}

function isPipeOrganDatabaseRecord(data) {
  return data?.sourceType === "pipe_organ_database" ||
    data?.source?.provider === "pipe_organ_database" ||
    String(data?.sourceKey || "").startsWith("ohs-") ||
    String(data?.sourceKey || "").startsWith("ohs-location:");
}

// --------------------------------------------------------------------------------------
// Generic helpers
// --------------------------------------------------------------------------------------

async function fetchJson(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${url}, received ${text.slice(0, 160)}`);
  }
}

async function fetchRawJsonOrStream(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const parsed = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
    if (parsed.length) return parsed;
    throw new Error(`Expected JSON/JSON stream from ${url}, received ${text.slice(0, 160)}`);
  }
}

async function fetchWithRetry(url, options = {}) {
  const { retries = 2, timeoutMs = 10_000, ...fetchOptions } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(`${response.status} ${response.statusText}: ${body.slice(0, 240)}`);
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    } finally {
      clearTimeout(timer);
    }
    await sleep(250 * (attempt + 1));
  }
  throw lastError;
}

async function mapConcurrent(items, concurrency, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return output;
}

function extractName(object) {
  return stringValue(firstDefined(
    object?.name,
    object?.displayName?.text,
    object?.locationName,
    object?.title,
    object?.__openOrganSourceName,
  ));
}

function extractId(object) {
  if (object == null) return null;
  if (typeof object === "number" || typeof object === "string") return object;
  return firstDefined(object.id, object.instrumentId, object.locationId, object.organId);
}

function numericId(object) {
  return Number(extractId(object)) || 0;
}

function extractBuilderName(instrument) {
  return stringValue(firstDefined(
    instrument?.builder?.name,
    instrument?.builderName,
    instrument?.builder?.companyName,
    instrument?.manufacturer?.name,
    instrument?.builder,
  ));
}

function formatOpus(instrument) {
  const prefix = stringValue(firstDefined(instrument?.opusPrefix, instrument?.originalOpusPrefix));
  const number = firstDefined(instrument?.opus, instrument?.opusNumber, instrument?.originalOpus);
  const suffix = stringValue(firstDefined(instrument?.opusSuffix, instrument?.originalOpusSuffix));
  if (number == null || number === "") return "";
  return `${prefix}${number}${suffix}`.trim();
}

function extractYear(instrument) {
  const year = Number(firstDefined(instrument?.year, instrument?.installYear, instrument?.builtYear, instrument?.originalYear));
  return Number.isFinite(year) && year > 1000 && year < 2200 ? year : 0;
}

function extractMetric(object, keys) { return metric(object, keys[0]); }

function buildSourceAddress(location) {
  const street = stringValue(firstDefined(
    location?.address,
    location?.streetAddress,
    location?.address1,
    location?.street,
  ));
  const city = stringValue(firstDefined(location?.city, location?.locality));
  const region = stringValue(firstDefined(location?.stateProvinceCode, location?.stateCode, location?.state, location?.region));
  const postal = stringValue(firstDefined(location?.postalCode, location?.zipcode, location?.zip, location?.zipCode));
  const country = stringValue(firstDefined(location?.countryCode, location?.country, "US"));
  return [street, city, region, postal, country]
    .filter((value) => value && !/^unknown address$/i.test(value))
    .join(", ");
}

function parseGoogleAddress(components) {
  const find = (type, short = false) => {
    const component = components.find((item) => item.types?.includes(type));
    if (!component) return "";
    return short ? component.shortText || component.longText || "" : component.longText || component.shortText || "";
  };
  return {
    city: find("locality") || find("postal_town") || find("administrative_area_level_2"),
    region: find("administrative_area_level_1", true),
    postalCode: find("postal_code"),
    country: find("country"),
  };
}

function walk(value, visitor, depth = 0, maxDepth = 4) {
  if (depth > maxDepth || value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor, depth + 1, maxDepth);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child);
    walk(child, visitor, depth + 1, maxDepth);
  }
}

function uniqueById(items) {
  const map = new Map();
  for (const item of items || []) {
    const id = extractId(item);
    if (id != null) map.set(String(id), item);
  }
  return [...map.values()];
}

function reject(sourceLocationId, reason, detail = "") {
  rejected.push({ sourceLocationId: String(sourceLocationId ?? ""), reason, detail: String(detail ?? "") });
}

function printRejectionSummary() {
  const counts = new Map();
  for (const item of rejected) counts.set(item.reason, (counts.get(item.reason) || 0) + 1);
  if (!counts.size) return;
  console.log("\nRejection summary:");
  for (const [reason, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${reason}`);
  }
}

async function writeJson(filename, value) {
  await fs.writeFile(path.join(OUTPUT_DIR, filename), JSON.stringify(value, null, 2), "utf8");
}

async function loadEnvFiles() {
  for (const filename of [".env.local", ".env"]) {
    const fullPath = path.resolve(filename);
    let content;
    try { content = await fs.readFile(fullPath, "utf8"); } catch { continue; }
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const equals = line.indexOf("=");
      if (equals < 1) continue;
      const key = line.slice(0, equals).trim();
      let value = line.slice(equals + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const map = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const token = arg.slice(2);
    const equals = token.indexOf("=");
    if (equals === -1) map.set(token, true);
    else map.set(token.slice(0, equals), token.slice(equals + 1));
  }
  return map;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") return stringValue(firstDefined(value.name, value.text, value.label, value.description));
  return "";
}

function formatDuration(start) {
  const seconds = (performance.now() - start) / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
