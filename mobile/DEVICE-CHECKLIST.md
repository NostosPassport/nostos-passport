# Device checklist

Things tests and bundling can't prove. Run them on a real iPhone in Expo Go against the local backend, freshly seeded
(`cd backend && pnpm db:seed && pnpm dev`; `cd mobile && npx expo start`). Password for every seed account:
`lastcall-dev` (or `DEV_SEED_PASSWORD`; the App Review account uses `APP_REVIEW_PASSWORD` if set).

Seed accounts: `avaa` (private, four requests waiting), `maya_r` (public, verified, most stamps), `theo_k`, `nia_s`,
`kofi_b` (private), `moth_hopeful` (private, follows no one), `blocker_blake` and `blocked_bea` (a blocked pair),
`mod_morgan` (moderator, one report in the queue), `admin`, `appreview` (stamps from anywhere, visible only to itself).

> Session 2 made Nostos strictly personal (`SOCIAL_ENABLED` off). The sections below about the feed, likes, follows, requests,
> other people's passports and Blocked users apply only when you run with the social layer on (backend `SOCIAL_ENABLED=1` and
> `EXPO_PUBLIC_SOCIAL_ENABLED=1`). With it off, start at "Book (session 2): phone checks" at the end of this file.

## First launch and the age gate
- [ ] Welcome screen: "Go somewhere. Get a stamp." with Create account, Sign in, Look around first. No mention of bars,
      vibes or venues.
- [ ] Look around first: asks your birthdate. Typing digits adds the slashes. A birthdate under 21 shows "Nostos is for
      people 21 and older." with no Continue button. Force-quit and reopen: it asks again (nothing was remembered).
- [ ] A birthdate that is 21 today lets you in. A guest sees Home with "A passport for New York" and Find people; the
      Stamp, Activity and Passport tabs ask to sign in.
- [ ] Create account: a Birthdate field replaces the old "I'm 21" checkbox. An under-21 birthdate stops on the phone.

## "Checking account" (known device bug)
- [ ] Sign in, then turn on Airplane Mode and relaunch: Passport and the Stamp screen say "Couldn't check your account"
      with Try again, never "Sign in". With the network back, Try again loads them.
- [ ] While signing in on a slow connection, the screens say "Checking your account", not "Sign in".

## Home feed
- [ ] As `maya_r`: stamps from people she follows, newest first. Pull to refresh. Scroll to the end: more load.
- [ ] As `moth_hopeful`: "Nothing here yet" and Find people. No stamps from strangers, no suggestions.
- [ ] Like a stamp: the heart fills at once and the count goes up; tap again to unlike. Your own stamps show the count
      but you can't like them.
- [ ] The "..." on someone else's stamp: Report stamp and Block @handle. On your own stamp there is no menu in the feed.
- [ ] Nothing anywhere says "Anonymous".

## Passport
- [ ] Your own: photo, name, handle, bio, Stamps / Places / Followers / Following counts, Edit profile, Follow requests
      (with the waiting count), a gear for Settings.
- [ ] Stamps view: a 3-column grid, newest first; photo tiles, and plain tiles with the caption or a note icon for
      stamps without a photo. Each tile names its place. Scrolling to the end loads more.
- [ ] Places view: a small dark map with a dot for every place, and a list with the stamp count; tapping a row opens the
      latest stamp there. Distances anywhere over 1000 m read in km ("1.8 km", never "1815 m").
- [ ] Another person's public passport: Follow becomes Following at once.
- [ ] A private passport you don't follow: handle, badge if verified, generic avatar, "This account is private" and
      Follow. Nothing else. Follow becomes Requested; tap again to cancel. A pending request still shows nothing.
- [ ] Verified badge: a small champagne diamond after the handle on `maya_r` (passport, feed, search, lists).
- [ ] The blocked pair: as `blocker_blake`, search for `blocked_bea`: no result; her passport is "not available".

## Making a stamp
- [ ] Tap Stamp (the middle tab). In Settings > Location make sure location is allowed. Near a place, it is listed with
      "You're here"; with exactly one place around, it is chosen for you.
- [ ] Add a photo (camera or library), a caption (the counter stops at 280), a song (search "bowie": results with art,
      title, artist; pick one; it shows with a remove button). Any one of the three is enough; with none, Stamp is off and
      the screen says what is missing.
- [ ] Stamp: it opens the new stamp. It appears at the top of your Stamps view and in your followers' feeds.
- [ ] Try a place that is not near you (in development, pick one from "pretend to be at" and then another):
      the server's message appears as written: "You need to be within 100 m of this place to stamp it (you're 140 m away)".
- [ ] Stamp the same place again within 15 minutes: a "try again in N min" message.
- [ ] Song search with Airplane Mode on shows an error with Try again, not a blank list.

## Stamp detail
- [ ] Photo (if any), caption, a song row, who and where, likes, how long ago. Tapping the author opens their passport.
- [ ] Yours: "..." has Edit and Delete from profile. Edit changes the caption and song only; Save is off until something
      changes; Cancel asks first. Delete asks, then the stamp is gone from your passport and everyone's feed for good.
- [ ] Someone else's: "..." has Report stamp (reasons include "Under 21 or looks underage", "Stalking or unwanted
      contact" and "Not at this place") and Block.
- [ ] A stamp that is not available (removed, hidden, a private account) says "This stamp isn't available" with Close.

## Edit profile and privacy
- [ ] Change the photo, name and bio (counter stops at 150). Save is off until something changes.
- [ ] Switch Private off and Save: an alert "Make your passport public?" lists what changes (all stamps and every place,
      to anyone, signed in or not; follows without asking). "Keep private" does nothing; "Make public" saves, then asks
      "Approve N pending requests?" when requests are waiting.
- [ ] Switch back to private: no alert is needed, and strangers lose access again.

## Follow requests, Activity, lists
- [ ] Approve and Decline remove the row at once; the count on the passport updates; "Approve all" asks first.
- [ ] Activity (its own tab): requests, new followers, and likes with the stamp's thumbnail (opens the stamp). No
      "featured" entries.
- [ ] Followers and Following lists open; on your own followers, Remove asks first.
- [ ] Settings: Following list, Blocked users (with Unblock), Privacy policy, Terms, Support, Sign out, Delete account.
      Moderation appears only for `mod_morgan` and `admin`.

## Moderation (as `mod_morgan`)
- [ ] Moderation: the queue has one stamp report; Hide, Dismiss and Restore each ask for an optional note. The Hidden tab
      lists the hidden stamp with Restore; the Log tab lists actions and says it is permanent. An underage or stalking
      report shows "Urgent" and sits at the top.

## Delete account
- [ ] Settings > Delete account: the list says stamps are removed, follows and likes gone. Needs the password. After
      deleting you land on the welcome screen with "Your account is deleted."

## No blank screens
- [ ] Open every screen above with a slow connection and with Airplane Mode: each shows a skeleton, a message or an error
      with Try again, never an empty screen. Swipe down on each modal to dismiss.

## Book (session 2): phone checks

- [ ] Cover: foil highlight follows a finger drag, follows tilt, shimmers when idle, and stops with Reduce Motion on.
- [ ] Open animation: the cover swings on its left edge, shades while turning, and the page under it is shadowed then clears. With Reduce Motion it crossfades.
- [ ] Bearer page: your photo or initial, name, handle, passport number, issue date and the two machine lines sit inside the page rule without clipping, at the smallest and largest text sizes; a long bio stops at three lines.
- [ ] Pages: a spread shows two pages with a dark fold down the middle, thin page edges on the outer sides that grow with the pages on that side, a page number in each bottom outer corner, faint guilloche behind the stamps and wave bands at the top. Stamps sit three to a page, slightly tilted and never colliding. A pinned stamp has a brass ribbon.
- [ ] Passport tab: opens on the closed cover with three counts under it and a gear at the top right. Tap the cover: it swings open on its left edge, the book slides to center and shrinks to fit two pages, and hands over to the bearer spread with no jump.
- [ ] Page flip: drag from the outer edge of a page and it follows the finger, shading as it goes edge-on; stop halfway and it stays halfway; let go past halfway or with a flick and it springs over, with a light haptic; let go before halfway and it springs back. Tap the outer edge to turn one page. Dragging or tapping the left edge of the first spread closes the book. Nothing turns when you drag from the middle of a page, and stamps stay tappable. With Reduce Motion on, pages crossfade.
- [ ] Page flip: Previous, Next and Close under the book work with VoiceOver, and the label reads "Pages 1 and 2".
- [ ] Stamps: each place has its own brass stamp (shape, figure, name on an arc or in lines, neighborhood underneath), the same every time you open the book. Places in one neighborhood share a border style. Ink looks slightly uneven with small gaps. Long names shrink and stay inside the ring. Nothing is any color but brass.
- [ ] Completion stamp: a finished neighborhood has a foil stamp (rays, ring, "COMPLETE", the name) whose gold looks like the cover foil.
- [ ] Stamp landing: the stamp hovers large, falls fast into its slot, the page shakes and a haptic knock lands at the moment of impact, a ring of ink spreads and a brass glow flares then fades. Photos pin on one by one afterwards. "Added to page N" and the neighborhood progress appear. A finished neighborhood shows the foil stamp. With Reduce Motion: a plain fade, no shake or flare.
- [ ] Worklets: the cover foil, the cover swing and the page flip run on the UI thread (the math files carry a "worklet" directive, checked by `worklet-files.test.ts`); if a red screen says "non-worklet function on the UI thread", a math file lost its directive.
- [ ] Visa spread (open any stamp): the stamp inked on the left page, tilted; the photos on the right page stuck down at angles, up to six, none off the page; a typed slip below with date and time (New York time), place, neighborhood, page, caption and, if there is one, the song as a ticket stub with notches.
- [ ] Visa spread: drag a photo (yours only) and it lifts, follows the finger, stays on the page, comes to the top and stays where you leave it after closing and reopening; a stamp of someone else's, if social is on, can't be rearranged.
- [ ] Photo viewer: tap a photo for full screen; pinch to zoom up to 4x, drag when zoomed, double tap to zoom in and out, "n of m" and arrows when there are several, close button.
- [ ] Caption typewriter: the caption types out at a steady pace without the text reflowing; with Reduce Motion it appears at once.
- [ ] Menu (ellipsis): Pin to passport or Unpin, Edit, Delete from profile; a fifth pin is refused with a message.
- [ ] Index: the "Index" row under the open book lists neighborhoods, each with a ring that fills with brass as you visit its places, "visited/total", and "COMPLETE" when finished; started ones are tappable and turn the book to that neighborhood's first page, the others are dimmed and say "Not started" to VoiceOver. An empty passport says what the index is for.
- [ ] Stamp flow: the composer opens with the location note, then "Here" (places you are inside) and "Nearby" with distances in km from 1000 m up. Choose a place far away: the "Not quite there yet" card appears (no alarm), the Stamp button is dimmed, and walking inside the geofence turns it on.
- [ ] In-app camera: "Take a photo" opens the camera inside the app (no library option anywhere), each shot lands in a strip with a remove button, the count reads "n of 6", the shutter turns off at six, Done returns to the composer with the photos. With camera access off, the screen explains why and offers Settings.
- [ ] Stamping: Stamp uploads every photo, then the landing plays (see "Stamp landing"), Done returns to the passport. A refusal from the server shows its own sentence with Try again.
- [ ] Map: dark map; places you have stamped are little brass stamps in a glowing ring, the rest are small dim dots, your position is a small bone ring (no blue dot). Pan and zoom stay smooth with many places (only those in view are drawn, at most 250). Tap a pin: it grows and a bottom sheet rises with the name, neighborhood, "Stamped n times. Last on ..." or "Not stamped yet.", and the distance in m or km; "Stamp here" appears only when you are inside the geofence and opens the composer. Swipe the sheet down or tap the map to close. The OpenStreetMap credit shows for imported places.
- [ ] Welcome: black screen, the closed passport shimmering as a hero (following a finger), the emblem and NOSTOS in brass at the top, "Go somewhere. Get a stamp." and "Only you can see it.", three buttons. No map.
- [ ] Under-21: entering an under-21 birthdate (guest gate) replaces the form with one calm sentence, the dim emblem and Close. Nothing is sent or remembered.
- [ ] Settings: "Your passport" group with Edit profile (name, bio, photo; no Private switch) and "Only you can see your passport"; list headers in dim brass typewriter capitals; Customize row with a lock; legal links open; Sign out; Delete account.
- [ ] Delete account: the warning card lists what happens, needs the password, ends on Welcome with "Your account is deleted."
- [ ] First run: a brand-new account sees "This is your passport" under the closed cover once; "Got it" or opening the cover removes it for good; it does not come back after relaunching the app.
- [ ] Place page (from a pin's sheet, or tap the place name on a stamp): name, neighborhood, address, "You're here" or "n km away", your stamps by night with their little stamps, tap one to open it; "You haven't stamped this place yet." when none.
- [ ] Legal pages in a browser (privacy, terms, support, delete account): black page, brass links, serif titles; the text itself is unchanged and still describes the social layer (OPEN-QUESTIONS L7).
- [ ] Design gallery (development builds only): open it from the Welcome screen ("Design gallery (development)") or from Settings under Development, or with the link `nostos://design` (in Expo Go: `exp://<your Mac's address>:8081/--/design`). Each section opens on made-up data with no account and no server: palette, type, spacing, controls, cover (drag it, tilt the phone), opening cover (button), bearer page, pages and spread, page flip (drag an edge), stamps (shapes, borders, figures), completion stamp, landing (Replay), visa spread (drag a photo, tap for full screen), photo viewer, index, map pins and sheet, ticket stub. In a release build the gallery is not reachable.
