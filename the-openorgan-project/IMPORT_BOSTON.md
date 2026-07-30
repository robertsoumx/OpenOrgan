# Greater Boston Pipe Organ Import

The importer automates the public Pipe Organ Database search interface, captures its JSON traffic, resolves venues through Google Places, and uses Google Routes to retain instruments within approximately 25 driving-route miles of central Boston.

It does not use a homemade coordinate-distance formula.

## Requirements

```env
GOOGLE_MAPS_SERVER_API_KEY=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

Install the browser once:

```powershell
npx playwright install chromium
```

## Dry run

```powershell
npm run import:boston
```

Nothing is written to Firestore. Review:

```text
import-output/accepted.json
import-output/captured-network.json
```

If the source interface changes and no results are captured, also inspect:

```text
import-output/source-interface.png
```

## Commit

Only after reviewing the dry run:

```powershell
npm run import:boston -- --commit
```

Imported entries have:

```text
listingOwnership: unclaimed
claimStatus: available
bookingEnabled: false
status: active
verificationStatus: source_imported
```

They display a prominent **UNCLAIMED LISTING** label and cannot accept reservations, payments, reviews, or Q&A until an administrator approves a verified organization’s claim.

The importer deduplicates committed records by `sourceKey` and stores the original source URL. Public databases and venue information can change; review imported names, locations, extant status, and duplicate venue matches before production publication.
