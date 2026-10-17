# Design, directory coverage, and route search

OpenOrgan now uses a detailed vector organ facade, ivory keyboard navigation and dividers, burgundy and brass accents, short entrance animations, and restrained hover/press feedback. The About layout remains simple. Reduced-motion preferences disable decorative motion, and public content remains visible without animation support.

## Coverage and map repair

The live page contained only 20 public organ listings. Its map also received only the visible list page, and selection rebuilt markers and reset the bounds.

The new committed catalogue was built from a complete paginated audit of 1,192 Pipe Organ Database locations across 47 municipality searches. It contains 246 distinct church references with instruments reported current and playable by the source, covering 42 normalized municipalities. Only approved records with explicit street addresses and source coordinates are accepted. Historical/nonplayable records and physical aliases are excluded; missing instrument facts remain unknown.

243 records have usable map coordinates. Three Hingham churches shared a source coordinate despite having different street addresses; these remain searchable and routable by their published addresses, with their pins held for review. No replacement coordinates were guessed.

The website merges this catalogue with institution-owned Firebase listings. Claimed listings take precedence, including draft/archived listings that must suppress a duplicate reference. Old unclaimed imports are rechecked against the current catalogue. No bulk Firebase write is needed to publish the expanded directory. A verified institution can materialize a trusted reference when submitting a claim; publication still requires ownership approval and the exact Places selection in the existing editor.

All matching pins are shown independently of list pagination, with geographic grouping, a Fit all results action, and stable selection. Mobile map activation handles the initially hidden container. Selecting a pin reveals its result even when it was beyond the previous list page.

A weekly GitHub refresh checks the public source without new credentials, preserves the verified catalogue on temporary source failures, and stops accepting that fallback after 30 days. Rebuild guards prevent publishing incomplete regional scans.

## Driving routes

Organs and events share an ID-validated server route service. Visitors can use GPS or choose a starting address. Event locations use their published full addresses where Place IDs are unavailable. Repeated venues are grouped before Google requests; route matrices run in bounded batches and results are cached for 15 minutes. The old 100-destination truncation is removed. Failed routes remain unranked rather than receiving invented zero distances, and stale requests are cancelled.

## Verification

- Production build, import/structure checks, and SEO/rendered HTML checks.
- 25 content tests including regional coverage, physical deduplication, coordinate conflicts, claimed-draft suppression, map grouping, more than 100 route destinations, cache reuse, shared venue routing, partial matrix failures, and prior calendar/import safeguards.
- All new text/surface pairs checked exceed 4.5:1; the source contains no emoji.
- Organ facade SVG rendered and visually inspected.
- The existing live Google Routes service returned HTTP 200 with a real driving distance and duration.

Browser automation is unavailable here, so the new browser map, Places input, sign-in/claim mutations, and pointer/keyboard interactions still require browser verification after deployment. The bulk production Firebase collection was not rewritten.
