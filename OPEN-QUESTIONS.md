# Open questions

Product decisions the social layer needs from you. Each has a default already built, so nothing is blocked; change
the default if you disagree.

| # | Question | Default built | Where |
|---|---|---|---|
| 1 | **Venue average ratings.** Ratings (1-10) are stored on every post, but no average is shown anywhere. When should one appear, and with what minimum number of ratings? | Not shown. Ratings are stored per post (`photo.rating`) so an average can be added later. | `backend/prisma/schema.prisma` |
| 2 | **Who counts toward featuring?** The spec's bar (USER account 7+ days old, reputation 0.5+) lets any week-old account count, because every account starts at 0.5. A ring of sock puppets made a week ahead could feature a post. Raise the bar (reputation above 0.5, some reporting history, a phone check)? | The spec's rule as written, in one module (`src/lib/likes.ts`) so it's a one-line change. | `backend/src/lib/likes.ts` |
| 3 | **Anonymous authors and blocking.** Most people are private, so most photos and comments read "Anonymous" to strangers. Blocking an Anonymous author works by content ("Block this person") without revealing who they are; the block list then shows them as "Someone you blocked from a photo". Is that what you want, or should blocked Anonymous authors show their handle to the blocker? | Blocking by content, handle never revealed. | `backend/src/server/services/blocks.ts` |
| 4 | **Venue accounts start private** like everyone else, so their replies read "Anonymous" to non-followers in the data (the app labels venue replies with the venue name, so it looks right). Should venue accounts default to public when a claim is approved? | Private like everyone; owners can switch. | `backend/src/server/services/admin.ts#reviewClaim` |
| 5 | **Follow requests show requesters in the limited view** (handle and badge, no name or photo) when they're private and you don't follow them. Instagram shows the requester's name and photo. Show them? | Limited, per the privacy rules. | `backend/src/server/services/people.ts#listFollowRequests` |
| 6 | **GPS spoofing and earned status.** Posts (and so Regular badges and featuring) are only as trustworthy as the phone's reported location, the same as live reports. Worth adding a server-side signal later (a same-night presence check-in, velocity checks)? | Geofence on the upload's coordinates only, as for reports. | `backend/src/server/services/photos.ts` |
