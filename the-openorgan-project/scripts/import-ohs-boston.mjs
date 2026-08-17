import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
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

const POD_WEB = "https://pipeorgandatabase.org";
const POD_API = "https://api.pipeorgandatabase.org";

const PLACES_URL =
  "https://places.googleapis.com/v1/places:searchText";

const ROUTES_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

const BOSTON = {
  latitude: 42.3601,
  longitude: -71.0589,
};

const METERS_PER_MILE = 1609.344;
const DEFAULT_RADIUS = 100;
const MIN_REBUILD = 5;

const OUT_DIR =
  path.resolve("import-output");

const CHURCH_TYPE_RE =
  /baptist|catholic|episcopal|anglican|lutheran|methodist|presbyterian|congregational|unitarian|universalist|nondenominational|non-denominational|disciples\s+of\s+christ|christian\s+science|orthodox|pentecostal|adventist|mennonite|moravian|brethren|latter-day|mormon|friends|quaker|salvation\s+army|swedenborgian|church/i;

const CHURCH_NAME_RE =
  /\bchurch\b|\bcathedral\b|\bparish\b|\bbasilica\b|\babbey\b|\bmeeting\s*house\b|\bcongregation\b/i;

const NON_PLAYABLE_RE =
  /not\s+extant|not\s+playable|destroyed|dismantled|removed|no\s+longer\s+extant|extinct/i;

const PLAYABLE_RE =
  /extant\s+and\s+playable|playable|extant/i;

const MAIN_ROOM_RE =
  /main|sanctuary|nave|chancel|gallery/i;

const SECONDARY_ROOM_RE =
  /chapel|crypt|practice|choir\s+room/i;


/* ==========================================================================
   STARTUP
   ========================================================================== */

await loadEnv();

await fs.mkdir(
  OUT_DIR,
  { recursive: true }
);

const args =
  parseArgs(
    process.argv.slice(2)
  );

const COMMIT =
  args.has("commit");

const REBUILD =
  args.has("rebuild");

const MAX =
  positiveInt(
    args.get("max")
  );

const RADIUS =
  positiveNumber(
    args.get("radius")
  ) || DEFAULT_RADIUS;

const GOOGLE_KEY =
  process.env
    .GOOGLE_MAPS_SERVER_API_KEY
    ?.trim();

if (!GOOGLE_KEY) {
  throw new Error(
    "GOOGLE_MAPS_SERVER_API_KEY is missing from .env.local."
  );
}

const rejected = [];
const started = performance.now();

console.log(
  "\nThe OpenOrgan Project — Greater Boston church-organ importer\n"
);

console.log(
  `Mode: ${
    COMMIT
      ? "COMMIT"
      : "DRY RUN"
  }${
    REBUILD
      ? " + REBUILD"
      : ""
  }`
);

console.log(
  "Source: Pipe Organ Database / Organ Historical Society"
);

console.log(
  `Launch radius: ${RADIUS} route miles from central Boston`
);

console.log(
  "Deduplication: ONE canonical organ per physical church\n"
);

await placesPreflight();


/* ==========================================================================
   1. DISCOVER MASSACHUSETTS LOCATIONS
   ========================================================================== */

const t1 = performance.now();

const sourceLocations =
  await discoverMassachusettsLocations();

const churches =
  sourceLocations.filter(
    isChurchLocation
  );

for (const location of sourceLocations) {
  if (
    !isChurchLocation(location)
  ) {
    reject(
      location.id,
      "non_church_location",
      location.sourceType ||
        location.name
    );
  }
}

const candidates =
  MAX
    ? churches.slice(0, MAX)
    : churches;

console.log(
  `Discovered ${sourceLocations.length} Massachusetts source locations; ` +
  `${churches.length} are churches (${elapsed(t1)}).`
);

printTypeSummary(
  sourceLocations
);

await writeJson(
  "source-locations.json",
  sourceLocations
);

if (MAX) {
  console.log(
    `Debug limit: processing ${candidates.length} church locations.`
  );
}


/* ==========================================================================
   2. GOOGLE PLACES + PHYSICAL CHURCH DEDUPLICATION
   ========================================================================== */

const t2 = performance.now();

const resolved =
  (
    await mapLimit(
      candidates,
      12,
      async (src) => {
        try {
          const place =
            await googlePlace(
              `${src.name}, ${
                src.address ||
                "Massachusetts"
              }`
            );

          if (
            !place?.id ||
            !place?.location
          ) {
            throw new Error(
              "No Google Place match"
            );
          }

          const address =
            googleAddress(
              place.addressComponents ||
                []
            );

          if (
            address.region &&
            address.region !== "MA"
          ) {
            throw new Error(
              `Google matched ${address.region}, not MA`
            );
          }

          return {
            ...src,
            place,
          };
        } catch (error) {
          reject(
            src.id,
            "google_place_failed",
            error.message
          );

          return null;
        }
      }
    )
  ).filter(Boolean);

const byPlace =
  new Map();

for (const item of resolved) {
  const group =
    byPlace.get(
      item.place.id
    ) || {
      place: item.place,
      sources: [],
    };

  group.sources.push(item);

  byPlace.set(
    item.place.id,
    group
  );
}

const placeGroups =
  [...byPlace.values()];

for (const group of placeGroups) {
  for (
    const duplicate
    of group.sources.slice(1)
  ) {
    reject(
      duplicate.id,
      "duplicate_physical_church",
      `Same Google Place as source location ${group.sources[0].id}`
    );
  }
}

console.log(
  `Resolved ${resolved.length}/${candidates.length} church locations; ` +
  `${placeGroups.length} unique physical churches (${elapsed(t2)}).`
);


/* ==========================================================================
   3. ROUTE-DISTANCE FILTER
   ========================================================================== */

const t3 = performance.now();

const routedGroups =
  await routeGroups(
    placeGroups
  );

const nearbyGroups =
  routedGroups.filter(
    (group) => {
      if (
        !Number.isFinite(
          group.distanceMeters
        )
      ) {
        for (
          const src
          of group.sources
        ) {
          reject(
            src.id,
            "route_not_found",
            group.place
              .formattedAddress ||
              ""
          );
        }

        return false;
      }

      if (
        group.distanceMeters >
        RADIUS *
          METERS_PER_MILE
      ) {
        for (
          const src
          of group.sources
        ) {
          reject(
            src.id,
            "outside_launch_radius",
            `${
              (
                group.distanceMeters /
                METERS_PER_MILE
              ).toFixed(1)
            } miles`
          );
        }

        return false;
      }

      return true;
    }
  );

console.log(
  `Route-filtered in batches: ${nearbyGroups.length} physical churches ` +
  `within ${RADIUS} miles (${elapsed(t3)}).`
);


/* ==========================================================================
   4. LOAD PIPE ORGAN DATABASE DETAILS
   ========================================================================== */

const t4 =
  performance.now();

const sourceIds =
  [
    ...new Set(
      nearbyGroups.flatMap(
        (group) =>
          group.sources.map(
            (src) =>
              String(src.id)
          )
      )
    ),
  ];

const locationMap =
  new Map();

await mapLimit(
  sourceIds,
  24,
  async (id) => {
    try {
      locationMap.set(
        id,
        await podJson(
          `/locations/${id}`
        )
      );
    } catch (error) {
      reject(
        id,
        "location_api_failed",
        error.message
      );
    }
  }
);

const stubsByLocation =
  new Map();

for (const id of sourceIds) {
  const stubs =
    instrumentStubs(
      locationMap.get(id)
    );

  if (stubs.length) {
    stubsByLocation.set(
      id,
      stubs
    );
  } else {
    reject(
      id,
      "no_instruments_at_location",
      ""
    );
  }
}

const instrumentIds =
  [
    ...new Set(
      [
        ...stubsByLocation.values(),
      ].flatMap(
        (items) =>
          items
            .map(idOf)
            .filter(Boolean)
            .map(String)
      )
    ),
  ];

const instrumentMap =
  new Map();

await mapLimit(
  instrumentIds,
  32,
  async (id) => {
    try {
      instrumentMap.set(
        id,
        await podJson(
          `/instruments/${id}`
        )
      );
    } catch {
      // One broken historical
      // record should not reject
      // the whole church.
    }
  }
);


/* ==========================================================================
   5. RESOLVE BUILDER NAMES
   ========================================================================== */

const builderIds =
  [
    ...new Set(
      [
        ...instrumentMap.values(),
      ]
        .filter(
          (instrument) =>
            !builderOf(instrument)
        )
        .flatMap(
          builderIdsOf
        )
    ),
  ];

const builderMap =
  new Map();

await mapLimit(
  builderIds,
  16,
  async (id) => {
    try {
      const builder =
        await podJson(
          `/builders/${id}`
        );

      const name =
        text(
          first(
            builder?.name,
            builder?.companyName,
            builder?.title
          )
        );

      if (name) {
        builderMap.set(
          String(id),
          name
        );
      }
    } catch {
      // Naming fallbacks remain
      // available.
    }
  }
);

for (
  const instrument
  of instrumentMap.values()
) {
  if (
    !builderOf(instrument)
  ) {
    const name =
      builderIdsOf(
        instrument
      )
        .map(
          (id) =>
            builderMap.get(
              String(id)
            )
        )
        .find(Boolean);

    if (name) {
      instrument.__openOrganBuilderName =
        name;
    }
  }
}

console.log(
  `Loaded ${locationMap.size}/${sourceIds.length} location records and ` +
  `${instrumentMap.size}/${instrumentIds.length} instrument records ` +
  `(${elapsed(t4)}).`
);


/* ==========================================================================
   6. PICK ONE CANONICAL ORGAN PER PHYSICAL CHURCH
   ========================================================================== */

const accepted = [];

for (
  const group
  of nearbyGroups
) {
  const options = [];

  for (
    const src
    of group.sources
  ) {
    const stubs =
      stubsByLocation.get(
        String(src.id)
      ) || [];

    for (
      const stub
      of stubs
    ) {
      const instrument =
        instrumentMap.get(
          String(
            idOf(stub)
          )
        ) || stub;

      if (
        !isUnplayable(
          instrument
        )
      ) {
        options.push({
          src,
          instrument,
        });
      }
    }
  }

  if (!options.length) {
    reject(
      group.sources[0]?.id,
      "no_usable_instrument",
      group.sources[0]?.name ||
        ""
    );

    continue;
  }

  options.sort(
    (a, b) =>
      instrumentScore(
        b.instrument
      ) -
      instrumentScore(
        a.instrument
      )
  );

  const best =
    options[0];

  accepted.push(
    buildRecord(
      group,
      best.src,
      best.instrument
    )
  );
}

accepted.sort(
  (a, b) =>
    a.importMeta
      .routeDistanceMeters -
    b.importMeta
      .routeDistanceMeters
);


/* ==========================================================================
   7. OUTPUT DRY-RUN FILES
   ========================================================================== */

await writeJson(
  "accepted.json",
  accepted
);

await writeJson(
  "rejected.json",
  rejected
);

await writeJson(
  "run-summary.json",
  {
    generatedAt:
      new Date().toISOString(),

    mode:
      COMMIT
        ? "commit"
        : "dry-run",

    rebuild:
      REBUILD,

    sourceLocations:
      sourceLocations.length,

    churchLocations:
      churches.length,

    physicalChurchesResolved:
      placeGroups.length,

    nearbyPhysicalChurches:
      nearbyGroups.length,

    instrumentsFetched:
      instrumentMap.size,

    accepted:
      accepted.length,

    rejected:
      rejected.length,

    radiusMiles:
      RADIUS,
  }
);

printRejections();

console.log(
  `\nAccepted ${accepted.length} unique church organs.`
);

console.log(
  `Dry-run files: ${path.join(
    OUT_DIR,
    "accepted.json"
  )}`
);

if (!COMMIT) {
  console.log(
    "No Firestore writes were made. Review accepted.json, then run with --commit."
  );

  console.log(
    `Total runtime: ${elapsed(
      started
    )}\n`
  );

  process.exit(0);
}


/* ==========================================================================
   8. FIRESTORE COMMIT / REBUILD
   ========================================================================== */

if (
  REBUILD &&
  accepted.length <
    MIN_REBUILD
) {
  throw new Error(
    `Safety stop: only ${accepted.length} accepted listings; refusing destructive rebuild.`
  );
}

const db =
  await adminDb();

const existing =
  await db
    .collection("organs")
    .get();

const claimedPlaceIds =
  new Set();

const oldImportRefs = [];

for (
  const doc
  of existing.docs
) {
  const data =
    doc.data();

  const placeId =
    data?.location?.placeId ||
    "";

  if (
    data.listingOwnership ===
      "claimed" &&
    placeId
  ) {
    claimedPlaceIds.add(
      placeId
    );
  }

  if (
    data.listingOwnership ===
      "unclaimed" &&
    isPodRecord(data)
  ) {
    oldImportRefs.push(
      doc.ref
    );
  }
}

const toWrite =
  accepted.filter(
    (record) =>
      !claimedPlaceIds.has(
        record.location.placeId
      )
  );

/*
 * Write first.
 *
 * This is intentionally safer than
 * deleting the old import before the
 * replacement has been written.
 */
await writeBatches(
  db,
  toWrite
);

console.log(
  `Committed ${toWrite.length} unique church listings.`
);

if (REBUILD) {
  const newIds =
    new Set(
      toWrite.map(
        (record) =>
          record.id
      )
    );

  const staleRefs =
    oldImportRefs.filter(
      (ref) =>
        !newIds.has(
          ref.id
        )
    );

  await deleteBatches(
    db,
    staleRefs
  );

  console.log(
    `Removed ${staleRefs.length} stale previous unclaimed Pipe Organ Database imports.`
  );
}

if (
  toWrite.length !==
  accepted.length
) {
  console.log(
    `Preserved ${
      accepted.length -
      toWrite.length
    } already-claimed physical churches.`
  );
}

console.log(
  `Total runtime: ${elapsed(
    started
  )}\n`
);


/* ==========================================================================
   PIPE ORGAN DATABASE DISCOVERY

   IMPORTANT:
   There is NO interaction with:
   - Search Parameters
   - input fields
   - buttons
   - DOM visibility
   - city loops

   We talk directly to the POD API.

   The browser is used only as a fallback
   to observe the API URL if /locations
   does not directly return the index.
   ========================================================================== */

async function discoverMassachusettsLocations() {
  let seed;

  /*
   * First try the normal REST index
   * endpoint directly.
   */
  try {
    const url =
      `${POD_API}/locations`;

    const json =
      await requestJson(
        url,
        {
          timeoutMs: 15000,
        }
      );

    if (
      looksLikeLocationList(
        json
      )
    ) {
      seed = {
        url,
        json,
      };
    }
  } catch {
    // Fall through to passive
    // network discovery.
  }

  /*
   * If the index URL needs parameters,
   * observe the request made by POD.
   *
   * No UI elements are touched.
   */
  if (!seed) {
    seed =
      await probeLocationListRequest();
  }

  console.log(
    `POD locations API: ${
      new URL(
        seed.url
      ).pathname
    }`
  );

  /*
   * Automatically determine which
   * query parameter the current API
   * uses for State/Province.
   */
  const filtered =
    await detectStateFilteredSeed(
      seed
    );

  if (filtered) {
    console.log(
      `POD Massachusetts API filter detected: ${filtered.filterKey}=MA`
    );

    const rows =
      await fetchAllPages(
        filtered.url,
        filtered.json
      );

    return normalizeLocations(
      rows
    ).filter(
      isMassachusettsLocation
    );
  }

  /*
   * Absolute fallback:
   *
   * If the source API does not expose
   * a recognizable state query
   * parameter, paginate its index and
   * filter Massachusetts locally.
   *
   * Slower, but does not depend on the
   * frontend at all.
   */
  console.log(
    "POD state-filter parameter was not exposed; paginating the locations API and filtering MA locally."
  );

  const rows =
    await fetchAllPages(
      seed.url,
      seed.json
    );

  return normalizeLocations(
    rows
  ).filter(
    isMassachusettsLocation
  );
}


/* ==========================================================================
   PASSIVE API DISCOVERY FALLBACK
   ========================================================================== */

async function probeLocationListRequest() {
  const browser =
    await chromium.launch({
      headless: true,
    });

  const page =
    await browser.newPage();

  try {
    const found =
      new Promise(
        (
          resolve,
          rejectPromise
        ) => {
          const timer =
            setTimeout(
              () =>
                rejectPromise(
                  new Error(
                    "Timed out waiting for Pipe Organ Database locations API request."
                  )
                ),
              20000
            );

          page.on(
            "response",
            async (
              response
            ) => {
              try {
                const url =
                  response.url();

                if (
                  !url.startsWith(
                    POD_API
                  ) ||
                  !url.includes(
                    "/locations"
                  )
                ) {
                  return;
                }

                const json =
                  await response.json();

                if (
                  !looksLikeLocationList(
                    json
                  )
                ) {
                  return;
                }

                clearTimeout(
                  timer
                );

                resolve({
                  url,
                  json,
                });
              } catch {
                // Ignore unrelated API
                // responses.
              }
            }
          );
        }
      );

    await page.goto(
      `${POD_WEB}/locations`,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30000,
      }
    );

    return await found;
  } finally {
    await browser.close();
  }
}


/* ==========================================================================
   AUTOMATIC MASSACHUSETTS FILTER DETECTION
   ========================================================================== */

async function detectStateFilteredSeed(
  seed
) {
  const base =
    new URL(
      seed.url
    );

  const existingKeys =
    [
      ...base.searchParams.keys(),
    ];

  /*
   * Existing query keys are tested first.
   * That lets this automatically follow
   * future source parameter changes if the
   * request already exposes them.
   */
  const stateKeys =
    unique([
      ...existingKeys.filter(
        (key) =>
          /state|province/i.test(
            key
          )
      ),

      "stateProvinceCode",
      "stateProvince",
      "state_province_code",
      "state_province",
      "stateCode",
      "state_code",
      "state",
      "provinceCode",
      "province_code",
      "province",

      "filter[stateProvinceCode]",
      "filters[stateProvinceCode]",
      "filter[state]",
      "filters[state]",
      "search[stateProvinceCode]",
      "search[state]",
      "where[stateProvinceCode]",
      "where[state]",
    ]);

  const countryKeys =
    existingKeys.filter(
      (key) =>
        /country/i.test(
          key
        )
    );

  const baseTotal =
    totalOf(
      seed.json
    );

  for (
    const filterKey
    of stateKeys
  ) {
    const url =
      new URL(
        seed.url
      );

    resetPagination(
      url
    );

    url.searchParams.set(
      filterKey,
      "MA"
    );

    for (
      const key
      of countryKeys
    ) {
      url.searchParams.set(
        key,
        "US"
      );
    }

    try {
      const json =
        await requestJson(
          url.toString(),
          {
            timeoutMs:
              12000,

            retries: 1,
          }
        );

      const rows =
        listRows(
          json
        );

      if (!rows.length) {
        continue;
      }

      const maCount =
        rows.filter(
          isMassachusettsRaw
        ).length;

      const ratio =
        maCount /
        rows.length;

      const total =
        totalOf(json);

      /*
       * Do not accept a parameter simply
       * because the API ignored it and
       * happened to return one MA record.
       */
      const genuinelyFiltered =
        ratio >= 0.7 &&
        (
          baseTotal == null ||
          total == null ||
          total < baseTotal ||
          ratio === 1
        );

      if (
        genuinelyFiltered
      ) {
        return {
          url:
            url.toString(),

          json,

          filterKey,
        };
      }
    } catch {
      // Try the next parameter
      // spelling.
    }
  }

  return null;
}


/* ==========================================================================
   GENERIC POD PAGINATION
   ========================================================================== */

async function fetchAllPages(
  firstUrl,
  firstJson
) {
  const firstRows =
    listRows(
      firstJson
    );

  const total =
    totalOf(
      firstJson
    );

  const currentPage =
    currentPageOf(
      firstJson
    ) || 1;

  const declaredLastPage =
    lastPageOf(
      firstJson
    );

  /*
   * If the API gives total but not
   * last_page, infer the number of pages
   * from the first page size.
   */
  const inferredLastPage =
    !declaredLastPage &&
    total &&
    firstRows.length &&
    total >
      firstRows.length
      ? Math.ceil(
          total /
          firstRows.length
        )
      : null;

  const lastPage =
    declaredLastPage ||
    inferredLastPage;

  const pageKey =
    paginationKey(
      firstUrl
    );

  /*
   * Known page count:
   * fetch remaining pages concurrently.
   */
  if (
    lastPage &&
    lastPage >
      currentPage
  ) {
    const pages = [];

    for (
      let page =
        currentPage + 1;
      page <= lastPage;
      page += 1
    ) {
      pages.push(page);
    }

    const rest =
      await mapLimit(
        pages,
        16,
        async (page) => {
          const url =
            new URL(
              firstUrl
            );

          url.searchParams.set(
            pageKey,
            String(page)
          );

          const json =
            await requestJson(
              url.toString(),
              {
                timeoutMs:
                  15000,
              }
            );

          return listRows(
            json
          );
        }
      );

    return dedupeRawLocations([
      ...firstRows,
      ...rest.flat(),
    ]);
  }

  /*
   * Unknown page count:
   * follow next-page URLs if present.
   *
   * If the API does not give a next URL,
   * increment ?page= until a page is empty
   * or repeats the previous data.
   */
  let rows =
    [...firstRows];

  let json =
    firstJson;

  let url =
    firstUrl;

  const seen =
    new Set([
      url,
    ]);

  for (
    let guard = 0;
    guard < 10000;
    guard += 1
  ) {
    let next =
      nextUrlOf(
        json,
        url
      );

    if (!next) {
      const candidate =
        new URL(
          firstUrl
        );

      candidate.searchParams.set(
        pageKey,
        String(
          currentPage +
          guard +
          1
        )
      );

      next =
        candidate.toString();
    }

    if (
      seen.has(next)
    ) {
      break;
    }

    seen.add(next);

    const nextJson =
      await requestJson(
        next,
        {
          timeoutMs:
            15000,
        }
      );

    const pageRows =
      listRows(
        nextJson
      );

    if (
      !pageRows.length
    ) {
      break;
    }

    const before =
      dedupeRawLocations(
        rows
      ).length;

    rows.push(
      ...pageRows
    );

    const after =
      dedupeRawLocations(
        rows
      ).length;

    /*
     * API ignored page parameter and
     * returned the same page again.
     */
    if (
      after === before
    ) {
      break;
    }

    if (
      total &&
      after >= total
    ) {
      break;
    }

    json =
      nextJson;

    url =
      next;

    if (
      !total &&
      pageRows.length <
        firstRows.length
    ) {
      break;
    }
  }

  return dedupeRawLocations(
    rows
  );
}


/* ==========================================================================
   POD RESPONSE PARSING
   ========================================================================== */

function looksLikeLocationList(
  json
) {
  const rows =
    listRows(
      json
    );

  if (!rows.length) {
    return false;
  }

  return rows
    .slice(0, 10)
    .some(
      (row) =>
        idOf(row) != null &&
        locationNameOf(
          row
        )
    );
}

function listRows(
  json
) {
  if (
    Array.isArray(json)
  ) {
    return json;
  }

  const directKeys = [
    "data",
    "results",
    "items",
    "locations",
    "rows",
    "records",
  ];

  for (
    const key
    of directKeys
  ) {
    if (
      Array.isArray(
        json?.[key]
      )
    ) {
      return json[key];
    }
  }

  /*
   * Handle common nested pagination
   * response structures such as:
   *
   * { data: { data: [...] } }
   */
  for (
    const key
    of directKeys
  ) {
    const nested =
      json?.[key];

    if (
      nested &&
      typeof nested ===
        "object"
    ) {
      for (
        const nestedKey
        of directKeys
      ) {
        if (
          Array.isArray(
            nested?.[
              nestedKey
            ]
          )
        ) {
          return nested[
            nestedKey
          ];
        }
      }
    }
  }

  return [];
}

function totalOf(
  json
) {
  const n =
    Number(
      first(
        json?.total,
        json?.meta?.total,
        json?.pagination?.total,
        json?.data?.total,
        json?.count
      )
    );

  return Number.isFinite(n)
    ? n
    : null;
}

function currentPageOf(
  json
) {
  const n =
    Number(
      first(
        json?.current_page,
        json?.currentPage,
        json?.meta
          ?.current_page,
        json?.meta
          ?.currentPage,
        json?.pagination?.page,
        json?.data
          ?.current_page
      )
    );

  return Number.isFinite(n)
    ? n
    : null;
}

function lastPageOf(
  json
) {
  const n =
    Number(
      first(
        json?.last_page,
        json?.lastPage,
        json?.meta
          ?.last_page,
        json?.meta
          ?.lastPage,
        json?.pagination
          ?.lastPage,
        json?.pagination
          ?.pages,
        json?.data
          ?.last_page
      )
    );

  return Number.isFinite(n)
    ? n
    : null;
}

function nextUrlOf(
  json,
  currentUrl
) {
  const next =
    first(
      json?.next_page_url,
      json?.nextPageUrl,
      json?.links?.next,
      json?.pagination
        ?.next,
      json?.data
        ?.next_page_url
    );

  if (
    typeof next ===
      "string" &&
    next
  ) {
    return new URL(
      next,
      currentUrl
    ).toString();
  }

  return null;
}

function paginationKey(
  urlString
) {
  const url =
    new URL(
      urlString
    );

  const keys =
    [
      ...url.searchParams.keys(),
    ];

  return (
    keys.find(
      (key) =>
        /^page$/i.test(
          key
        )
    ) ||
    keys.find(
      (key) =>
        /page/i.test(
          key
        )
    ) ||
    "page"
  );
}

function resetPagination(
  url
) {
  for (
    const key
    of [
      ...url.searchParams.keys(),
    ]
  ) {
    if (
      /page/i.test(key)
    ) {
      url.searchParams.set(
        key,
        "1"
      );
    }

    if (
      /offset|skip/i.test(
        key
      )
    ) {
      url.searchParams.set(
        key,
        "0"
      );
    }
  }
}

function dedupeRawLocations(
  rows
) {
  const map =
    new Map();

  for (
    const row
    of rows
  ) {
    const id =
      idOf(row);

    if (
      id != null
    ) {
      map.set(
        String(id),
        row
      );
    }
  }

  return [
    ...map.values(),
  ];
}


/* ==========================================================================
   LOCATION NORMALIZATION
   ========================================================================== */

function normalizeLocations(
  rows
) {
  return dedupeRawLocations(
    rows
  ).map(
    (row) => ({
      id:
        String(
          idOf(row)
        ),

      name:
        locationNameOf(
          row
        ),

      sourceType:
        locationTypeOf(
          row
        ),

      address:
        locationAddressOf(
          row
        ),

      raw: row,
    })
  );
}

function locationNameOf(
  row
) {
  return text(
    first(
      row?.name,
      row?.locationName,
      row?.displayName
        ?.text,
      row?.title,
      row?.venueName
    )
  );
}

function locationTypeOf(
  row
) {
  const direct =
    text(
      first(
        row?.locationType
          ?.name,

        row?.locationTypeName,

        row?.type
          ?.name,

        row?.typeName,

        row?.location_type
          ?.name
      )
    );

  if (
    direct &&
    !/^\d+$/.test(
      direct
    )
  ) {
    return direct;
  }

  let found = "";

  walk(
    row,
    (
      key,
      value
    ) => {
      if (
        found ||
        !/type/i.test(
          key
        ) ||
        /id/i.test(
          key
        )
      ) {
        return;
      }

      const candidate =
        text(value);

      if (
        candidate &&
        !/^\d+$/.test(
          candidate
        )
      ) {
        found =
          candidate;
      }
    },
    0,
    3
  );

  return found;
}

function locationAddressOf(
  row
) {
  const direct =
    text(
      first(
        row?.formattedAddress,

        row?.address
          ?.formattedAddress,

        row?.address,

        row?.streetAddress,

        row?.street
      )
    );

  const city =
    text(
      first(
        row?.city?.name,
        row?.city,
        row?.locality
      )
    );

  const state =
    stateCodeOf(
      row
    );

  const country =
    text(
      first(
        row?.countryCode,

        row?.country?.code,

        row?.country
      )
    );

  return unique([
    direct,
    city,
    state,
    country,
  ])
    .filter(Boolean)
    .join(", ");
}

function stateCodeOf(
  row
) {
  const direct =
    text(
      first(
        row?.stateProvinceCode,

        row?.stateCode,

        row?.state?.code,

        row?.state
          ?.abbreviation,

        row?.provinceCode,

        row?.regionCode
      )
    );

  if (direct) {
    return direct;
  }

  let found = "";

  walk(
    row,
    (
      key,
      value
    ) => {
      if (
        found ||
        !/state|province|region/i.test(
          key
        ) ||
        /id/i.test(
          key
        )
      ) {
        return;
      }

      const candidate =
        text(value);

      if (
        /^(MA|Massachusetts)$/i.test(
          candidate
        )
      ) {
        found =
          candidate;
      }
    },
    0,
    3
  );

  return found;
}

function isMassachusettsRaw(
  row
) {
  const state =
    stateCodeOf(
      row
    );

  if (
    /^(MA|Massachusetts)$/i.test(
      state
    )
  ) {
    return true;
  }

  return (
    /(?:^|,|\s)MA(?:,|\s|$)|Massachusetts/i
      .test(
        locationAddressOf(
          row
        )
      )
  );
}

function isMassachusettsLocation(
  location
) {
  return (
    isMassachusettsRaw(
      location.raw
    ) ||
    /(?:^|,|\s)MA(?:,|\s|$)|Massachusetts/i
      .test(
        location.address
      )
  );
}

function isChurchLocation(
  location
) {
  /*
   * Prefer POD's own location type.
   *
   * Only fall back to the name when the
   * source gave no usable type at all.
   */
  if (
    location.sourceType
  ) {
    return CHURCH_TYPE_RE.test(
      location.sourceType
    );
  }

  return CHURCH_NAME_RE.test(
    location.name
  );
}


/* ==========================================================================
   GOOGLE PLACES
   ========================================================================== */

async function placesPreflight() {
  const place =
    await googlePlace(
      "Trinity Church, 206 Clarendon St, Boston, MA"
    );

  if (!place?.id) {
    throw new Error(
      "Google Places preflight returned no place."
    );
  }

  console.log(
    "Google Places preflight: OK.\n"
  );
}

async function googlePlace(
  textQuery
) {
  const json =
    await requestJson(
      PLACES_URL,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "X-Goog-Api-Key":
            GOOGLE_KEY,

          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents",
        },

        body:
          JSON.stringify({
            textQuery,

            pageSize: 1,

            regionCode:
              "US",

            locationBias: {
              circle: {
                center:
                  BOSTON,

                radius:
                  50000,
              },
            },
          }),
      }
    );

  return (
    json?.places?.[0] ||
    null
  );
}


/* ==========================================================================
   GOOGLE ROUTES
   ========================================================================== */

async function routeGroups(
  groups
) {
  const output =
    groups.map(
      (group) => ({
        ...group,

        distanceMeters:
          null,
      })
    );

  for (
    let start = 0;
    start < output.length;
    start += 49
  ) {
    const chunk =
      output.slice(
        start,
        start + 49
      );

    const response =
      await requestJsonStream(
        ROUTES_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-Goog-Api-Key":
              GOOGLE_KEY,

            "X-Goog-FieldMask":
              "originIndex,destinationIndex,distanceMeters,condition,status",
          },

          body:
            JSON.stringify({
              origins: [
                {
                  waypoint: {
                    location: {
                      latLng:
                        BOSTON,
                    },
                  },
                },
              ],

              destinations:
                chunk.map(
                  (group) => ({
                    waypoint: {
                      placeId:
                        group.place.id,
                    },
                  })
                ),

              travelMode:
                "DRIVE",
            }),

          timeoutMs:
            20000,
        }
      );

    const elements =
      Array.isArray(
        response
      )
        ? response
        : response?.elements ||
          [];

    for (
      const element
      of elements
    ) {
      const index =
        Number(
          element
            ?.destinationIndex
        );

      const distance =
        Number(
          element
            ?.distanceMeters
        );

      if (
        Number.isInteger(
          index
        ) &&
        Number.isFinite(
          distance
        ) &&
        chunk[index]
      ) {
        output[
          start + index
        ].distanceMeters =
          distance;
      }
    }
  }

  return output;
}


/* ==========================================================================
   PIPE ORGAN DATABASE DETAIL API
   ========================================================================== */

async function podJson(
  endpoint
) {
  return requestJson(
    `${POD_API}${endpoint}`,
    {
      headers: {
        Accept:
          "application/json",
      },
    }
  );
}

function instrumentStubs(
  location
) {
  if (!location) {
    return [];
  }

  const direct =
    [
      location?.instruments,

      location?.organs,

      location
        ?.instrumentRecords,

      location?.data
        ?.instruments,

      location
        ?.relationships
        ?.instruments,
    ].find(
      (value) =>
        Array.isArray(
          value
        ) &&
        value.length
    );

  if (direct) {
    return uniqueById(
      direct
    );
  }

  const found = [];

  walk(
    location,
    (
      key,
      value
    ) => {
      if (
        /instrument/i.test(
          key
        ) &&
        Array.isArray(
          value
        )
      ) {
        found.push(
          ...value
        );
      }
    },
    0,
    4
  );

  return uniqueById(
    found
  );
}


/* ==========================================================================
   BUILDER DATA
   ========================================================================== */

function builderIdsOf(
  instrument
) {
  const ids = [];

  const values = [
    instrument?.builderId,

    instrument?.builder_id,

    instrument?.builder?.id,

    ...(
      Array.isArray(
        instrument?.builders
      )
        ? instrument.builders.map(
            (builder) =>
              builder?.id
          )
        : []
    ),
  ];

  for (
    const value
    of values
  ) {
    if (
      value != null &&
      value !== ""
    ) {
      ids.push(
        String(value)
      );
    }
  }

  return unique(ids);
}

function builderOf(
  instrument
) {
  const direct =
    text(
      first(
        instrument
          ?.__openOrganBuilderName,

        instrument?.builder
          ?.name,

        instrument
          ?.builderName,

        instrument?.builder
          ?.companyName,

        instrument
          ?.manufacturer
          ?.name,

        Array.isArray(
          instrument?.builders
        )
          ? instrument.builders
              .map(
                (builder) =>
                  text(
                    first(
                      builder?.name,
                      builder
                        ?.companyName
                    )
                  )
              )
              .find(Boolean)
          : "",

        typeof instrument?.builder ===
          "string"
          ? instrument.builder
          : ""
      )
    );

  if (
    direct &&
    !/^\d+$/.test(
      direct
    )
  ) {
    return direct;
  }

  return "";
}


/* ==========================================================================
   CANONICAL ORGAN SELECTION
   ========================================================================== */

function instrumentScore(
  instrument
) {
  const room =
    text(
      first(
        instrument?.room,

        instrument
          ?.locationRoom,

        instrument
          ?.divisionLocation,

        ""
      )
    );

  return (
    (
      isPlayable(
        instrument
      )
        ? 1_000_000_000
        : 0
    ) +

    (
      MAIN_ROOM_RE.test(
        room
      )
        ? 75_000_000

        : SECONDARY_ROOM_RE.test(
            room
          )
          ? -30_000_000
          : 0
    ) +

    metric(
      instrument,
      [
        "manuals",
        "numManuals",
        "numberOfManuals",
      ]
    ) *
      5_000_000 +

    metric(
      instrument,
      [
        "stops",
        "numStops",
        "numberOfStops",
        "stopCount",
      ]
    ) *
      50_000 +

    metric(
      instrument,
      [
        "ranks",
        "numRanks",
        "numberOfRanks",
        "rankCount",
      ]
    ) *
      5_000 +

    metric(
      instrument,
      [
        "pipes",
        "numPipes",
        "numberOfPipes",
        "pipeCount",
      ]
    ) +

    yearOf(
      instrument
    )
  );
}

function statusText(
  instrument
) {
  return [
    instrument?.status,

    instrument
      ?.instrumentStatus,

    instrument?.condition,

    instrument
      ?.currentStatus,

    instrument
      ?.statusText,
  ]
    .map(text)
    .join(" ");
}

function falseFlag(
  value
) {
  return (
    value === false ||
    value === 0 ||
    value === "0" ||
    /^false$/i.test(
      String(value)
    )
  );
}

function trueFlag(
  value
) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    /^true$/i.test(
      String(value)
    )
  );
}

function isUnplayable(
  instrument
) {
  if (
    NON_PLAYABLE_RE.test(
      statusText(
        instrument
      )
    )
  ) {
    return true;
  }

  return [
    "isPlayable",
    "playable",
    "isExtant",
    "extant",
  ].some(
    (key) =>
      falseFlag(
        instrument?.[
          key
        ]
      )
  );
}

function isPlayable(
  instrument
) {
  const status =
    statusText(
      instrument
    );

  if (
    PLAYABLE_RE.test(
      status
    ) &&
    !NON_PLAYABLE_RE.test(
      status
    )
  ) {
    return true;
  }

  return [
    "isPlayable",
    "playable",
    "isExtant",
    "extant",
  ].some(
    (key) =>
      trueFlag(
        instrument?.[
          key
        ]
      )
  );
}


/* ==========================================================================
   BUILD OPENORGAN RECORD
   ========================================================================== */

function buildRecord(
  group,
  src,
  instrument
) {
  const builder =
    builderOf(
      instrument
    );

  const opus =
    opusData(
      instrument
    );

  const year =
    yearOf(
      instrument
    );

  const manuals =
    metric(
      instrument,
      [
        "manuals",
        "numManuals",
        "numberOfManuals",
      ]
    );

  const stops =
    metric(
      instrument,
      [
        "stops",
        "numStops",
        "numberOfStops",
        "stopCount",
      ]
    );

  const ranks =
    metric(
      instrument,
      [
        "ranks",
        "numRanks",
        "numberOfRanks",
        "rankCount",
      ]
    );

  const church =
    src.name ||
    group.place
      ?.displayName
      ?.text ||
    "Church";

  /*
   * name = ORGAN
   * organizationName = CHURCH
   *
   * Example:
   *
   * name:
   * Aeolian-Skinner Organ Co. Opus 940
   *
   * organizationName:
   * Church of the Advent
   */
  const name =
    organName(
      builder,
      opus,
      year,
      instrument
    );

  const address =
    googleAddress(
      group.place
        .addressComponents ||
        []
    );

  const sourceInstrumentId =
    String(
      idOf(
        instrument
      ) || ""
    );

  return {
    id:
      `ohs-place-${group.place.id}`,

    name,

    organizationName:
      church,

    venueName:
      church,

    ownerId: "",

    status:
      "active",

    listingOwnership:
      "unclaimed",

    claimStatus:
      "available",

    bookingEnabled:
      false,

    verificationStatus:
      "source_imported",

    builder,

    opus:
      opus.value,

    year:
      year || "",

    manuals:
      manuals || "",

    stops:
      stops || "",

    ranks:
      ranks || "",

    instrumentLabel:
      name,

    description:
      `Reference listing for the ${name} at ${church}, imported from the Pipe Organ Database. ` +
      "This listing has not yet been claimed by the organization.",

    publicAccessNotes:
      "",

    location: {
      placeId:
        group.place.id,

      name:
        group.place
          ?.displayName
          ?.text ||
        church,

      formattedAddress:
        group.place
          .formattedAddress ||
        src.address,

      googleMapsUri:
        `https://www.google.com/maps/search/?api=1&query_place_id=${
          encodeURIComponent(
            group.place.id
          )
        }`,

      latitude:
        Number(
          group.place
            .location
            .latitude
        ),

      longitude:
        Number(
          group.place
            .location
            .longitude
        ),

      city:
        address.city,

      region:
        address.region,

      postalCode:
        address.postalCode,

      country:
        address.country ||
        "United States",
    },

    fullAddress:
      group.place
        .formattedAddress ||
      src.address,

    city:
      address.city,

    region:
      address.region,

    sourceType:
      "pipe_organ_database",

    sourceKey:
      `ohs-place:${group.place.id}`,

    sourceName:
      "Pipe Organ Database",

    sourceLocationId:
      String(src.id),

    sourceInstrumentId,

    sourceLocationUrl:
      `${POD_WEB}/locations/${src.id}`,

    sourceUrl:
      `${POD_WEB}/instruments/${sourceInstrumentId}`,

    source: {
      provider:
        "pipe_organ_database",

      locationId:
        String(src.id),

      instrumentId:
        sourceInstrumentId,
    },

    importMeta: {
      routeDistanceMeters:
        group.distanceMeters,

      canonicalSelection:
        "one_per_physical_church",

      importedAt:
        new Date().toISOString(),
    },
  };
}


/* ==========================================================================
   ORGAN NAME
   ========================================================================== */

function opusData(
  instrument
) {
  const number =
    first(
      instrument?.opus,

      instrument
        ?.opusNumber,

      instrument
        ?.originalOpus
    );

  if (
    number == null ||
    number === ""
  ) {
    return {
      value: "",
      display: "",
    };
  }

  const prefix =
    text(
      first(
        instrument
          ?.opusPrefix,

        instrument
          ?.originalOpusPrefix,

        ""
      )
    );

  const suffix =
    text(
      first(
        instrument
          ?.opusSuffix,

        instrument
          ?.originalOpusSuffix,

        ""
      )
    );

  const value =
    `${prefix}${number}${suffix}`
      .trim();

  /*
   * Preserve source terminology:
   *
   * prefix absent -> Opus 940
   * prefix "No. " -> No. 1726
   */
  const display =
    prefix
      ? value
      : `Opus ${number}${suffix}`
          .trim();

  return {
    value,
    display,
  };
}

function organName(
  builder,
  opus,
  year,
  instrument
) {
  const cleanBuilder =
    text(builder)
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    cleanBuilder &&
    opus.display
  ) {
    return (
      `${cleanBuilder} ${opus.display}`
    );
  }

  if (
    cleanBuilder &&
    year
  ) {
    return (
      `${cleanBuilder} (${year})`
    );
  }

  if (cleanBuilder) {
    return (
      `${cleanBuilder} Pipe Organ`
    );
  }

  const title =
    text(
      first(
        instrument
          ?.instrumentName,

        instrument?.title,

        instrument
          ?.displayName
          ?.text
      )
    );

  /*
   * Do not accidentally use a venue /
   * church name as the organ name.
   */
  if (
    title &&
    !CHURCH_NAME_RE.test(
      title
    )
  ) {
    return title;
  }

  return (
    year
      ? `Pipe Organ (${year})`
      : "Pipe Organ"
  );
}


/* ==========================================================================
   INSTRUMENT METRICS
   ========================================================================== */

function yearOf(
  instrument
) {
  const year =
    Number(
      first(
        instrument?.year,

        instrument
          ?.installYear,

        instrument
          ?.builtYear,

        instrument
          ?.originalYear
      )
    );

  return (
    Number.isFinite(
      year
    ) &&
    year > 1000 &&
    year < 2200
      ? year
      : 0
  );
}

function metric(
  object,
  keys
) {
  const wanted =
    new Set(
      keys.map(
        (key) =>
          key.toLowerCase()
      )
    );

  let result = 0;

  walk(
    object,
    (
      key,
      value
    ) => {
      if (
        result ||
        !wanted.has(
          key.toLowerCase()
        )
      ) {
        return;
      }

      const n =
        Number(
          Array.isArray(
            value
          )
            ? value.length
            : value
        );

      if (
        Number.isFinite(n) &&
        n >= 0 &&
        n < 100000
      ) {
        result = n;
      }
    },
    0,
    4
  );

  return result;
}


/* ==========================================================================
   FIREBASE ADMIN
   ========================================================================== */

async function adminDb() {
  if (
    getApps().length
  ) {
    return getFirestore(
      getApps()[0]
    );
  }

  const projectId =
    process.env
      .NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ?.trim() ||
    process.env
      .GOOGLE_CLOUD_PROJECT
      ?.trim();

  const servicePath =
    process.env
      .FIREBASE_SERVICE_ACCOUNT_PATH
      ?.trim();

  const raw =
    process.env
      .FIREBASE_SERVICE_ACCOUNT_JSON
      ?.trim();

  /*
   * Supports a file-path credential if
   * present, but does NOT require you to
   * change your existing setup.
   */
  if (servicePath) {
    const service =
      JSON.parse(
        await fs.readFile(
          path.resolve(
            servicePath
          ),
          "utf8"
        )
      );

    return getFirestore(
      initializeApp({
        credential:
          cert(service),

        projectId:
          projectId ||
          service.project_id,
      })
    );
  }

  /*
   * Your existing
   * FIREBASE_SERVICE_ACCOUNT_JSON setup.
   */
  if (raw) {
    const service =
      parseServiceJson(
        raw
      );

    return getFirestore(
      initializeApp({
        credential:
          cert(service),

        projectId:
          projectId ||
          service.project_id,
      })
    );
  }

  return getFirestore(
    initializeApp({
      credential:
        applicationDefault(),

      projectId,
    })
  );
}

function parseServiceJson(
  raw
) {
  let value =
    raw.trim();

  if (
    (
      value.startsWith(
        "'"
      ) &&
      value.endsWith(
        "'"
      )
    ) ||
    (
      value.startsWith(
        '"'
      ) &&
      value.endsWith(
        '"'
      ) &&
      !value.startsWith(
        "{"
      )
    )
  ) {
    value =
      value.slice(
        1,
        -1
      );
  }

  try {
    return JSON.parse(
      value
    );
  } catch (firstError) {
    /*
     * Repair the exact multiline-private-key
     * format that caused the earlier
     * Bad control character error.
     */
    const repaired =
      value.replace(
        /("private_key"\s*:\s*")([\s\S]*?)("\s*,\s*"client_email")/,
        (
          _match,
          prefix,
          key,
          suffix
        ) =>
          `${
            prefix
          }${
            key.replace(
              /\r\n|\r|\n/g,
              "\\n"
            )
          }${
            suffix
          }`
      );

    if (
      repaired === value
    ) {
      throw firstError;
    }

    return JSON.parse(
      repaired
    );
  }
}


/* ==========================================================================
   FIRESTORE WRITES
   ========================================================================== */

async function writeBatches(
  db,
  records
) {
  for (
    let i = 0;
    i < records.length;
    i += 400
  ) {
    const batch =
      db.batch();

    for (
      const record
      of records.slice(
        i,
        i + 400
      )
    ) {
      const {
        id,
        ...data
      } = record;

      /*
       * Correct Firebase Admin SDK:
       *
       * db.collection(...)
       *
       * NOT:
       *
       * db.getCollection(...)
       */
      const ref =
        db
          .collection(
            "organs"
          )
          .doc(id);

      batch.set(
        ref,
        {
          ...data,

          updatedAt:
            FieldValue
              .serverTimestamp(),

          createdAt:
            FieldValue
              .serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    }

    await batch.commit();
  }
}

async function deleteBatches(
  db,
  refs
) {
  for (
    let i = 0;
    i < refs.length;
    i += 400
  ) {
    const batch =
      db.batch();

    for (
      const ref
      of refs.slice(
        i,
        i + 400
      )
    ) {
      batch.delete(ref);
    }

    await batch.commit();
  }
}

function isPodRecord(
  data
) {
  return (
    data?.sourceType ===
      "pipe_organ_database" ||

    data?.source
      ?.provider ===
      "pipe_organ_database" ||

    String(
      data?.sourceKey ||
        ""
    ).startsWith(
      "ohs-"
    )
  );
}


/* ==========================================================================
   NETWORK
   ========================================================================== */

async function requestJson(
  url,
  options = {}
) {
  const response =
    await request(
      url,
      options
    );

  const body =
    await response.text();

  try {
    return JSON.parse(
      body
    );
  } catch {
    throw new Error(
      `Expected JSON from ${url}: ${
        body.slice(
          0,
          200
        )
      }`
    );
  }
}

async function requestJsonStream(
  url,
  options = {}
) {
  const response =
    await request(
      url,
      options
    );

  const body =
    await response.text();

  try {
    return JSON.parse(
      body
    );
  } catch {
    const rows =
      body
        .split(/\r?\n/)
        .map(
          (line) =>
            line.trim()
        )
        .filter(Boolean)
        .map(
          (line) => {
            try {
              return JSON.parse(
                line
              );
            } catch {
              return null;
            }
          }
        )
        .filter(Boolean);

    if (rows.length) {
      return rows;
    }

    throw new Error(
      `Expected JSON stream from ${url}: ${
        body.slice(
          0,
          200
        )
      }`
    );
  }
}

async function request(
  url,
  options = {}
) {
  const {
    retries = 2,
    timeoutMs = 12000,
    ...fetchOptions
  } = options;

  let lastError;

  for (
    let attempt = 0;
    attempt <= retries;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        timeoutMs
      );

    try {
      const response =
        await fetch(
          url,
          {
            ...fetchOptions,

            signal:
              controller.signal,
          }
        );

      if (
        response.ok
      ) {
        return response;
      }

      const body =
        await response
          .text()
          .catch(
            () => ""
          );

      lastError =
        new Error(
          `${response.status} ${response.statusText}: ${
            body.slice(
              0,
              260
            )
          }`
        );

      if (
        response.status <
          500 &&
        response.status !==
          429
      ) {
        throw lastError;
      }
    } catch (error) {
      lastError =
        error;

      if (
        attempt === retries
      ) {
        throw error;
      }
    } finally {
      clearTimeout(
        timer
      );
    }

    await sleep(
      250 *
        (attempt + 1)
    );
  }

  throw lastError;
}


/* ==========================================================================
   GENERIC CONCURRENCY
   ========================================================================== */

async function mapLimit(
  items,
  limit,
  fn
) {
  const output =
    new Array(
      items.length
    );

  let cursor = 0;

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            limit,
            items.length ||
              1
          ),
      },

      async () => {
        while (true) {
          const index =
            cursor++;

          if (
            index >=
            items.length
          ) {
            return;
          }

          output[index] =
            await fn(
              items[index],
              index
            );
        }
      }
    )
  );

  return output;
}


/* ==========================================================================
   GENERIC DATA HELPERS
   ========================================================================== */

function idOf(
  value
) {
  if (
    value == null
  ) {
    return null;
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    return value;
  }

  return first(
    value.id,
    value.locationId,
    value.instrumentId,
    value.organId
  );
}

function uniqueById(
  items
) {
  const map =
    new Map();

  for (
    const item
    of items || []
  ) {
    const id =
      idOf(item);

    if (
      id != null
    ) {
      map.set(
        String(id),
        item
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function unique(
  items
) {
  return [
    ...new Set(
      items.filter(
        (item) =>
          item != null &&
          item !== ""
      )
    ),
  ];
}

function walk(
  value,
  fn,
  depth = 0,
  maxDepth = 4
) {
  if (
    depth > maxDepth ||
    value == null ||
    typeof value !==
      "object"
  ) {
    return;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item
      of value
    ) {
      walk(
        item,
        fn,
        depth + 1,
        maxDepth
      );
    }

    return;
  }

  for (
    const [
      key,
      child,
    ]
    of Object.entries(
      value
    )
  ) {
    fn(
      key,
      child
    );

    walk(
      child,
      fn,
      depth + 1,
      maxDepth
    );
  }
}


/* ==========================================================================
   GOOGLE ADDRESS PARSER
   ========================================================================== */

function googleAddress(
  parts
) {
  const get =
    (
      type,
      short = false
    ) => {
      const part =
        parts.find(
          (item) =>
            item.types?.includes(
              type
            )
        );

      if (!part) {
        return "";
      }

      return (
        short
          ? part.shortText ||
            part.longText

          : part.longText ||
            part.shortText
      ) || "";
    };

  return {
    city:
      get("locality") ||
      get("postal_town") ||
      get(
        "administrative_area_level_2"
      ),

    region:
      get(
        "administrative_area_level_1",
        true
      ),

    postalCode:
      get(
        "postal_code"
      ),

    country:
      get(
        "country"
      ),
  };
}


/* ==========================================================================
   SMALL HELPERS
   ========================================================================== */

function first(
  ...values
) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function text(
  value
) {
  if (
    value == null
  ) {
    return "";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    return String(
      value
    ).trim();
  }

  if (
    typeof value ===
      "object"
  ) {
    return text(
      first(
        value.name,
        value.text,
        value.label,
        value.description,
        value.code
      )
    );
  }

  return "";
}

function reject(
  id,
  reason,
  detail = ""
) {
  rejected.push({
    sourceLocationId:
      String(
        id ?? ""
      ),

    reason,

    detail:
      String(
        detail ?? ""
      ),
  });
}

function printRejections() {
  const counts =
    new Map();

  for (
    const item
    of rejected
  ) {
    counts.set(
      item.reason,
      (
        counts.get(
          item.reason
        ) || 0
      ) + 1
    );
  }

  if (
    !counts.size
  ) {
    return;
  }

  console.log(
    "\nRejection summary:"
  );

  for (
    const [
      reason,
      count,
    ]
    of [
      ...counts.entries(),
    ].sort(
      (a, b) =>
        b[1] - a[1]
    )
  ) {
    console.log(
      `  ${
        String(
          count
        ).padStart(4)
      }  ${reason}`
    );
  }
}

function printTypeSummary(
  rows
) {
  const counts =
    new Map();

  for (
    const row
    of rows
  ) {
    const type =
      row.sourceType ||
      "Unknown";

    counts.set(
      type,
      (
        counts.get(
          type
        ) || 0
      ) + 1
    );
  }

  console.log(
    "Source location types (top):"
  );

  for (
    const [
      type,
      count,
    ]
    of [
      ...counts.entries(),
    ]
      .sort(
        (a, b) =>
          b[1] - a[1]
      )
      .slice(
        0,
        12
      )
  ) {
    console.log(
      `  ${
        String(
          count
        ).padStart(4)
      }  ${type}`
    );
  }
}

async function writeJson(
  name,
  value
) {
  await fs.writeFile(
    path.join(
      OUT_DIR,
      name
    ),

    JSON.stringify(
      value,
      null,
      2
    ),

    "utf8"
  );
}

function parseArgs(
  argv
) {
  const map =
    new Map();

  for (
    const arg
    of argv
  ) {
    if (
      !arg.startsWith(
        "--"
      )
    ) {
      continue;
    }

    const token =
      arg.slice(2);

    const index =
      token.indexOf(
        "="
      );

    map.set(
      index < 0
        ? token
        : token.slice(
            0,
            index
          ),

      index < 0
        ? true
        : token.slice(
            index + 1
          )
    );
  }

  return map;
}

function positiveInt(
  value
) {
  const n =
    Number(value);

  return (
    Number.isInteger(n) &&
    n > 0
      ? n
      : null
  );
}

function positiveNumber(
  value
) {
  const n =
    Number(value);

  return (
    Number.isFinite(n) &&
    n > 0
      ? n
      : null
  );
}

function elapsed(
  start
) {
  const seconds =
    (
      performance.now() -
      start
    ) / 1000;

  if (
    seconds < 60
  ) {
    return (
      `${seconds.toFixed(
        1
      )}s`
    );
  }

  return (
    `${Math.floor(
      seconds / 60
    )}m ${
      (
        seconds % 60
      ).toFixed(0)
    }s`
  );
}

function sleep(
  ms
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


/* ==========================================================================
   .ENV / .ENV.LOCAL LOADER

   Supports your existing multiline:
   FIREBASE_SERVICE_ACCOUNT_JSON={...}
   ========================================================================== */

async function loadEnv() {
  for (
    const file
    of [
      ".env.local",
      ".env",
    ]
  ) {
    let raw;

    try {
      raw =
        await fs.readFile(
          path.resolve(
            file
          ),
          "utf8"
        );
    } catch {
      continue;
    }

    const lines =
      raw.split(
        /\r?\n/
      );

    for (
      let i = 0;
      i < lines.length;
    ) {
      const match =
        lines[i].match(
          /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
        );

      if (!match) {
        i += 1;
        continue;
      }

      const key =
        match[1];

      let value =
        match[2];

      i += 1;

      /*
       * Your service-account JSON can span
       * multiple physical lines.
       */
      if (
        value
          .trim()
          .startsWith(
            "{"
          ) &&
        !value
          .trim()
          .endsWith(
            "}"
          )
      ) {
        while (
          i < lines.length
        ) {
          value +=
            `\n${lines[i]}`;

          i += 1;

          if (
            value
              .trim()
              .endsWith(
                "}"
              )
          ) {
            break;
          }
        }
      }

      value =
        value.trim();

      if (
        (
          value.startsWith(
            '"'
          ) &&
          value.endsWith(
            '"'
          )
        ) ||
        (
          value.startsWith(
            "'"
          ) &&
          value.endsWith(
            "'"
          )
        )
      ) {
        value =
          value.slice(
            1,
            -1
          );
      }

      if (
        process.env[
          key
        ] == null
      ) {
        process.env[
          key
        ] =
          value;
      }
    }
  }
}