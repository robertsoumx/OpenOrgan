# OpenOrgan update — October 7, 2026

This update was compared with robertsoumx/OpenOrgan's main branch at ce01b273d837ce564f17c3898dd13b6f78e8a60c. Existing Firebase project identity, App Hosting backend settings and credential bindings are preserved. Uploading the branch does not deploy it or rebuild production Firestore.

## What changed

- Events now come from Trinity Church Boston’s explicitly dated official organ-recital schedule. The initial snapshot contains 32 recent/upcoming recitals. Upcoming events appear first; recently held events have their own filter. Cards show the official series image, date, venue, performer and admission information.
- The server pulls the calendar on a six-hour cache cycle. A GitHub Actions workflow also verifies the official calendar every six hours and updates the committed fallback when facts change, or once daily for verification freshness. An optional Firebase scheduler can call the protected refresh endpoint. Failed pulls preserve the verified snapshot and disclose that status. No weekly dates or concert end times are invented.
- Organ discovery uses the source’s paginated JSON API, not browser scraping. It reads numeric extant/playable flags, excludes unknown, removed and superseded records, chooses one current instrument per source location, verifies addresses through Google Places and deduplicates physical locations by Place ID. The 25 driving-mile radius follows the user's earlier directory constraints; it replaces the repository's conflicting 100-mile default.
- Rebuilds preserve claimed listings, back up the collection locally, write replacements before archiving stale unclaimed records, and check ownership again in transactions. They never delete old records.
- The site uses teal, rose and gold, editorial headings, an illustrated organ panel, responsive event cards, consistent account styling and accessible motion/focus states. Text emoji are absent; ratings and arrows use vector artwork.
- Production canonical URLs, robots and sitemaps default to https://openorgan.org rather than localhost. Directory and event lists are rendered into the initial HTML. Curated event detail pages and URLs enter the sitemap; missing detail pages return 404.

The initial event source is one official church calendar. These are multiple confirmed recitals at Trinity, not an invented selection of different venues. Additional sources need their own explicit-date parser and verification before being enabled.

## Verification already completed

- All 9 content tests passed, including DST changes, holidays, expired/cancelled items, numeric source flags, complete pagination and incorrect-address rejection.
- Structure and local imports passed.
- The production Next.js build passed.
- Generated production HTML includes the first three upcoming recital performers before JavaScript runs.
- Generated canonical, robots and sitemap URLs point to openorgan.org and contain no localhost URLs.
- The scheduler module loads and declares a six-hour cron schedule.
- An emoji scan of source UI and public assets returned zero matches.
- A complete source-only audit across 47 municipalities found 1,194 locations, 810 church locations and 554 current/playable instrument candidates, with zero API failures.

The 554 rows are candidates, not 554 finalized public listings. Source locations can still refer to the same physical church. Google address matching, Place ID deduplication and the existing 25-mile driving-route threshold determine the final accepted count. The source audit did not write to Firestore.

Browser visual QA, production authentication/reservations, the scheduled cloud invocation and Google address/route verification were not exercised in this environment. A live deployment and those checks remain necessary.

## Validate the source

From the repository's `the-openorgan-project` directory, use Node 22 or a newer supported Node version:

~~~powershell
npm ci
npm run events:refresh
npm run test:content
npm run check
npm run build
npm run check:seo
~~~

The event refresh command requires internet access. It fails instead of replacing the verified snapshot with an empty or undated schedule.

## Background calendar refresh

The repository's `.github/workflows/refresh-organ-events.yml` runs on the default branch every six hours, with manual dispatch available. It needs GitHub Actions enabled and uses the repository's built-in GITHUB_TOKEN with contents write access. It writes only the verified event snapshot. It runs content tests before committing; failed pulls preserve the existing file and fail the workflow. Merge this workflow to the default branch to activate its schedule. Scheduled runs can be delayed by GitHub.

The website also pulls official dates directly with six-hour caching. If Firebase automatic rollouts are enabled on main, snapshot commits should trigger the existing backend's normal rollouts. Confirm this integration in Firebase after the first scheduled run.

### Optional Firebase scheduler

Keep NEXT_PUBLIC_SITE_URL=https://openorgan.org in both Firebase’s backend environment and apphosting.yaml. Firebase console environment overrides take precedence over YAML, so remove any localhost override.

The scheduler and App Hosting endpoint must use the same EVENT_REFRESH_SECRET from the same Firebase project. Create a strong random value in your password manager, then use Firebase’s interactive secret prompts; never place it in source or a NEXT_PUBLIC variable.

~~~powershell
firebase apphosting:secrets:set EVENT_REFRESH_SECRET --project YOUR_PROJECT_ID
~~~

Grant the existing App Hosting backend access when prompted. Add the following binding to apphosting.yaml only after this secret exists; the uploaded configuration intentionally keeps existing credential bindings without requiring an unconfigured secret. Firebase stores this in Secret Manager. The functions module uses defineSecret for the same name.

~~~yaml
  - variable: EVENT_REFRESH_SECRET
    secret: EVENT_REFRESH_SECRET
~~~

~~~powershell
cd functions
npm ci
cd ..
firebase deploy --only functions:refreshOrganCalendars --project YOUR_PROJECT_ID
~~~

Preserve any other functions codebases in firebase.json. The included scheduler uses Node 22 in us-east1 and runs at midnight, 6 a.m., noon and 6 p.m. Eastern. The project needs the scheduled-functions prerequisites, including Cloud Scheduler and Firebase’s required billing plan.

Deploy App Hosting after the source commit is pushed to its connected branch. If automatic rollouts are disabled, use the existing backend dashboard’s “Create rollout,” choose the branch/commit and wait for success. Do not create another backend or move the domain.

After rollout, manually run refreshOrganCalendars once from Cloud Scheduler and check for success. The optional function refreshes the server cache while the site is idle; the GitHub schedule independently refreshes the committed fallback.

## Rebuild the organ collection

Keep the existing server Google Maps key in .env.local for the importer, with Places API (New) and Routes enabled. Use authorized Firebase Admin credentials locally or the existing authorized runtime. Do not paste credentials into chat or commit them.

First run the full dry run:

~~~powershell
npm run import:boston
~~~

Review import-output/accepted.json, rejected.json and run-summary.json. Only accepted rows have verified full street addresses and route distances. Missing or conflicting source facts are omitted/held for review; manual and stop counts are never guessed from unrelated historical records. An imported source record’s year can describe a later rebuild, so the public detail page labels it “Source record year.”

Once the accepted set has been reviewed:

~~~powershell
npm run import:boston -- --commit --rebuild
~~~

This reruns the live verification and refreshes the existing organs collection. It preserves claimed source locations and claimed physical Place IDs. Incomplete API/route coverage, debug limits and unexpectedly large count drops stop a rebuild. Inspect the concrete report rather than weakening these checks. The local pre-refresh backup may contain private database information; keep it outside source control.

Run another App Hosting rollout after the data refresh, or allow the directory/sitemap cache to expire (one hour). Check source links, full addresses, map pins and one canonical organ per physical church in the deployed directory. Practice booking remains unavailable on unclaimed reference listings.

The source audit was completed locally and is not committed to the repository. Reproduce it with `npm run import:boston -- --source-only`. The source conditions are database-reported, not an on-site inspection or a promise of practice access.

## Finish SEO on the live domain

1. Open https://openorgan.org/robots.txt. Its host and sitemap must use https://openorgan.org.
2. Open https://openorgan.org/sitemap.xml. Its event and organ URLs must use the same origin and return public content.
3. View the HTML source of the homepage, directory and events page. Confirm correct self-canonical links and actual listing text.
4. Verify the openorgan.org domain property in Google Search Console, preferably through DNS. Submit https://openorgan.org/sitemap.xml and inspect/request indexing for the homepage, /search and /events.
5. Keep www redirected to the canonical apex domain. The live site currently redirects www to the apex; a permanent redirect is preferable to its observed temporary redirect. Manage that at the existing domain/hosting layer.
6. Check Search Console for excluded pages, crawler errors and the selected canonical. Add Bing Webmaster verification if desired; environment placeholders for ownership tokens already exist.

Technical corrections and sitemap submission help discovery; search engines decide indexing and rankings and need time to recrawl. Existing source pages are deliberately attributed, and only public pages are included in the sitemap.

## Primary references

- Official recital dates: https://trinitychurchboston.org/music/organ-recitals/
- Pipe Organ Database: https://pipeorgandatabase.org/
- Google canonical guidance: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Firebase scheduled functions: https://firebase.google.com/docs/functions/schedule-functions
- Firebase secrets/environment: https://firebase.google.com/docs/app-hosting/configure
- Firebase rollouts: https://firebase.google.com/docs/app-hosting/rollouts
