# Decisions (backend)

Judgment calls made while building Nostos from the Last Call social layer. The Last Call history (consensus, accuracy,
owners, promos, featuring) is in the archive repo and is not repeated here. Open product and legal questions are in
`../OPEN-QUESTIONS.md`.

## Data model

- **Stamp = `photo`, place = `venue`.** The tables keep their names to avoid migration churn; the API, contract and
  UI say stamp and place. Migrations are forward-only (`strip_to_nostos`, `stamps`, `flag_category`), so the
  hand-written trigger history stays valid. No `migrate reset` outside development.
- **`ContentType` keeps its COMMENT and REPORT values.** The append-only moderation log may reference them, so the enum is
  not rewritten. The API only accepts STAMP and USER and maps STAMP to the database's PHOTO.
- **Stamps are immutable except caption, song, moderation state and `removed_at`** (a trigger). The optional `rating` is
  stored but immutable and never shown in v1.
- **A stamp needs a photo, a caption or a song** (CHECK, and a service check with a clear message). A photo has both key
  and type or neither. A song needs title and artist; art must be an https link (the service narrows it to Apple's
  `mzstatic.com` CDN so a stamp can't embed a tracking pixel).
- **Per-place geofence** (`geofence_meters`, default 100). The server checks the place's own radius.
- **Cooldown**: one stamp per person per place per 15 minutes, plus 20 stamps an hour. Likes 200 an hour, song search 120 an hour.

## Privacy

- **Visibility is the account's privacy, nothing else.** No per-stamp toggle, so the `shared` column is gone.
- **A stamp you may not see is a 404, never a 403,** so existence isn't revealed. Lists of a private account's stamps,
  places and followers answer 403 `private_account` (the account exists and is findable by handle anyway).
- **Reporting and liking require visibility.** A stranger can't probe a private account's stamps through `/api/flags` or
  the like endpoint.
- **A pending follow request grants nothing.** Staff see everything, including blocked pairs and hidden stamps.
- **The limited profile** is handle, verified badge and a Follow button. Search matches a private account's display name
  only for people who may see it.
- **No "Anonymous" anywhere.** A stamp is only returned with its author's full profile view, because it is only returned
  to people who may see that profile. Block-by-content is gone; blocks are by handle.
- **Reputation** stays as a column (default 0.5), visible only to the user and moderators. Nothing recomputes it now; it
  gates eligibility for the 3-flag auto-hide.

## Safety

- **The 21+ gate is read-once.** The signup body carries a birthdate; `signup` checks it first (before any database access),
  throws 403 `underage` if needed, and the value goes out of scope. There is no birthdate column. A refused attempt writes
  nothing, and the refusal precedes the duplicate-email check so it reveals nothing about accounts. "Today" is the New York
  date. The mobile app also checks and never sends an under-21 birthdate.
- **Report categories** (`flag.category`): underage and stalking reports sort to the top of the queue. The reason text is
  still free (3 to 300 characters).
- **Song search** (`/api/songs/search`) is a proxy to Apple's iTunes Search API: signed-in only, rate limited, 3 second
  timeout, only the search term goes upstream (no cookies, no user id), results with objectionable text are dropped, and a
  failure is a 503. The terms question is open (OPEN-QUESTIONS L1).
- **Moderation** keeps its rules: three flags from three eligible accounts auto-hide a stamp, the log is append-only,
  nothing is deleted. Stamps of deleted accounts stay hidden for good.
- **No error-reporting SDK on the backend.** Unhandled errors log to the console. Sentry is wired only in the app, off by
  default.

## Web

The web side keeps only what the iPhone app and App Review need: sign-in, signup (with the birthdate field), the legal
pages (drafts, rewritten to describe Nostos, banner says so), account deletion, `/mod` and `/admin` (verified badge tools).
The Last Call web map, venue pages, owner dashboards and people pages are gone, and so is Leaflet.

## Seed

`prisma/seed.ts` exports `seed(db, options)` so tests can run it. Song seeds carry title and artist only (no art URL and no
source id), so no made-up links exist. Seeded stamps use generated placeholder images through the configured storage driver.
