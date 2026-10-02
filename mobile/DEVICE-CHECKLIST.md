# Device checklist: social layer

Things tests and bundling can't prove. Run them on a real iPhone in Expo Go against the local backend, freshly
seeded (`cd backend && pnpm db:seed && pnpm dev`; `cd mobile && npx expo start`). Password for every seed account:
`lastcall-dev` (or `DEV_SEED_PASSWORD` if you set it; the App Review account uses `APP_REVIEW_PASSWORD` if set).

Useful seed accounts. The seed prints the social ones at the end (`[seed] social: ...`); the handles below are what a
seed prints with the default data, so check that output if yours differ.
- `avaa@lastcall.dev`: private, 4 follow requests waiting, a Regular at Lantern & Lark, featured last month, likes and
  a recent featured photo in Activity.
- The private author (@elik) has a shared photo at The Velvet Anchor tonight. The seed prints which account follows
  them; `moth_hopeful@lastcall.dev` follows no one.
- Verified and Regular accounts: see the seed output.
- `mod_morgan@lastcall.dev` (moderator), `owner_velvet@lastcall.dev` (owner of The Velvet Anchor).

## Profiles and privacy
- [ ] Your profile (avatar on the map's top bar): photo, name, handle, bio, counts, "Private account", Edit profile,
      Follow requests with the "4" pill, Activity. Gear opens Settings with plans, blocked users, legal, sign out.
- [ ] Tap Followers and Following: lists open; on your own followers, Remove asks first and the row goes.
- [ ] Posts tab: 3-column grid, rating in the corner, the slashed eye on unshared posts; scroll to the end loads more.
- [ ] Places tab: small dark map framing every venue, not interactive; list rows open the venue.
- [ ] Open a private account you don't follow: handle, badge (if verified), generic avatar, "This account is private",
      Follow. Nothing else. Tap Follow: it becomes Requested, and a toast says "Request sent". Tap again to cancel.
- [ ] A public account: Follow becomes Following at once, and your Following count goes up when you go back.
- [ ] Verified badge: a small champagne diamond after the handle on profiles, search, lists, comments and the photo
      viewer; never on "Anonymous". VoiceOver says "verified".
- [ ] Regular chips ("Regular at Lantern & Lark") open the venue; "Featured at Copper Fox Tavern, <last month>" opens
      that month's gallery.

## Edit profile
- [ ] Change the photo (system picker, not the camera), then remove it: the profile and top bar update.
- [ ] Name and bio (the counter stops at 150). Save is off until something changes; Cancel with changes asks first.
- [ ] Toggle Private off: the explanation changes to mention your handle on past venue photos. Save: "Approve 4
      pending requests?". "Not now" closes the screen and leaves them pending; do it again with "Approve" and the
      requests list empties.

## Follow requests and Activity
- [ ] Approve and Decline each remove the row at once; the pill on your profile updates.
- [ ] "Approve all" appears with 2+ requests and asks first.
- [ ] Activity shows requests, new followers, likes (with the post's thumbnail, opening it) and "You were featured at".

## Posting
- [ ] At a venue (or as @appreview, which may post from anywhere), the camera opens straight away. The composer has
      no Library button anywhere.
- [ ] Rating row: 1-10 fit across the screen and are easy to hit with a thumb, with a light tap on each. With
      VoiceOver it's one control: swipe up and down to change it.
- [ ] Without a rating the button reads "Post live photo"; with one, "Post", and the Share to venue page toggle
      appears: on for a public account, off for a private one.
- [ ] Post from outside the venue (location simulator, not @appreview): the tile shows the server's distance message.
- [ ] A rated, shared post shows in the venue's photos and on your profile; unshared only on your profile.

## Posts, likes and the venue page
- [ ] Post detail: photo, author (tap opens profile), venue, big rating, caption, heart with count.
- [ ] Double-tap the photo: it likes (never unlikes), with a haptic. Heart toggles. Your own posts show the count but
      can't be liked.
- [ ] Your post's menu: Edit (rating locked after 5am, with a note), Delete from profile (asks, then gone for good).
- [ ] Someone else's post: Report and Block; for an Anonymous author, "Block this person".
- [ ] Venue page: "This month's best" tiles with like counts, "See all N", Past months ("<last month>'s best"). The month
      gallery opens above the venue sheet (not behind it) with Done, grouped by night.
- [ ] Photo viewer: a single tap hides and shows the controls, and a double-tap likes without flickering them. The
      author line shows the badge and "Regular". Tapping a handle opens the profile above the viewer.
- [ ] As `moth_hopeful`, @elik's photo at The Velvet Anchor reads "Anonymous" with no link; as the follower the seed
      printed, it reads "@elik" and opens the profile.
- [ ] Comments show the verified badge and "Regular" next to handles.

## General
- [ ] No console warnings in Expo Go while going through the above.
- [ ] Dynamic Type at the largest size: profile header, rating row and lists don't clip.
- [ ] Pull to refresh on profile, lists, requests, activity and the month gallery.
