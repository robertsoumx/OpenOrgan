# OpenOrgan usability and event update

OpenOrgan returns to burgundy, rose, and cream with simpler wording and task-focused navigation.

- Removed the About page animation and the local-first positioning.
- Increased supporting text contrast, control sizes, and keyboard focus visibility; added a mobile navigation disclosure and reduced-motion support.
- Made institution overview counts actionable, added guide links, and kept organ search usable while travel distances load.
- Added separate organist and institution introductions covering the existing account functions, plus a permanent `/guide` page.
- Introductions appear once per signed-in browser session unless the user opts out; preferences are scoped to the account and role on that browser.
- Added official Harvard Memorial Church, Methuen Memorial Music Hall, and Boston AGO calendars alongside Trinity; the verified snapshot contains 53 events across seven venues as of October 17, 2026.
- Added address search, venue filtering, visible event addresses, map reveals, directions, and address copying; institution event editing continues to use the same Places picker as organ editing.
- Homepage highlights favor different venues while the full calendar stays chronological.

## Calendar refresh

The previous GitHub run failed on Trinity's HTTP 403 response. Sources now refresh independently, with an alternate official Trinity JSON endpoint and a verified snapshot fallback. The alternate endpoint is parsed from its embedded dated program, excluding recurring services and holiday placeholders. Unavailable sources keep their original verification dates and expire after 30 days. No future dates are inferred from weekly recurrence. Refreshes report warnings and source status rather than failing when useful verified dates remain; a completely unusable feed still fails for attention.

The GitHub workflow tests parsing before and after refreshing, records a source summary, and runs on pull requests without committing their snapshots. Scheduled and manual runs save only the snapshot. The authenticated refresh API also reports partial source failures without treating a usable feed as unavailable.

## Validation

- Production build and local import/structure checks.
- 17 content tests covering explicit dates, daylight saving time, cancellations, source outages, alternate feeds, expired cached verification, paid ticket data, location URLs, venue diversity, and existing organ-import safeguards.
- Production HTML, canonical URLs, robots, sitemap, and guide rendering checks.
- 22 text/background palette combinations checked at or above 4.5:1; application source scanned for emoji.
- Live official calendar refresh completed for all four sources.

Browser automation is unavailable in this environment, so signed-in modal behavior, live Firebase mutations, and the Google Places UI were not exercised in a browser. Firebase deployment configuration and organ production data are unchanged. The updated GitHub workflow is separately checked by the pull request's Actions run.
