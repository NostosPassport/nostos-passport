# Design

Nostos is a literal passport book. You open it, flip through it, and stamps appear on its pages. It is strictly personal in this
version: no feed, no likes, no follows, no sharing, and your passport is visible only to you. The look is black and brass gold
and nothing else.

Every visual decision lives behind the theme (`mobile/src/theme`) and the book components (`mobile/src/features/book`), so any
screen can be swapped for an imported one without touching the look or the logic (see "Swappable screens").

## Principles
- Black and brass only. No other hue, not even for errors: states are told apart by words, icons and shapes, never by color alone.
- Nothing white in the interface. The lightest value is bone (#E8E4DC). User photos and album art are the only exceptions.
- Theme tokens only. A test (`theme/__tests__/midnight.test.ts`) fails on a color literal outside the theme file and on any
  white anywhere; a lint rule (`eslint-rules/`) fails raw sizes and radii in styles. Both are in the gate.
- SF Symbols for icons, no emoji. Original artwork only: the emblem, the stamps and the cover are drawn by Nostos. Never copy
  another app's or country's logo, seal, icons, palette or assets.
- Motion is springs, never linear tweens, quiet everywhere except the foil, the page flip and the stamp landing. Every motion has
  a Reduce Motion form (a crossfade, or a plain fade).
- Honest copy: what the screen says about location and privacy has to be true (see OPEN-QUESTIONS L6, L7).

## The look: Midnight
One theme, `mobile/src/theme/midnight.ts`. It is the only file where a color literal may appear.

| Token | Value | Use |
|---|---|---|
| black | #000000 | screen background (the OLED turns off and the brass glows) |
| ink, inkRaised | #0B0B0D, #141418 | page stock, cards, raised surfaces |
| brass | #C9A24B | the one accent: foil, ink, primary buttons, selection |
| dimBrass | #8F7434 | secondary brass: hairlines, dim pins, labels |
| bone, boneDim, boneFaint | #E8E4DC, #A09C94, #6B6862 | text, three strengths |

Everything else (glow, hairline, scrim, foil highlight, grain, shadow) is one of these with an alpha.

- Type: Cormorant Garamond (serif) for titles, stamp text and plaques; Courier Prime (typewriter) for dates, captions, page
  numbers and the machine lines; the system font (SF Pro) for plain UI. Variants live in `theme/typography.ts`
  (`largeTitle`, `title`, `title2`, `serifLabel`, `typewriter`, `typewriterSmall`, then the iOS scale).
- Space is a 4 pt grid (`space`), shapes are `radius`, fixed sizes are `size`, shadows are layered (`shadows`: contact, soft,
  book, page, glow), motion is `bookMotion` (springs and durations) and `motion.ts` for the small UI.
- Stamp style (`stampStyle`): brass ink, stroke widths and type sizes in a 120 unit box, the largest tilt (11 degrees), the largest
  overlap between neighbors (12 percent).
- Book style (`bookStyle`): line weights for the cover border, emblem, page rules, the fold (`gutterShare`), page edges.

## The book
| Part | Files (`mobile/src/features/book`) | Logic (pure, tested) |
|---|---|---|
| Cover: leather grain, brass foil wordmark and emblem, highlight that follows a drag, the tilt of the phone, or idles | `Cover.tsx`, `use-foil-sweep.ts`, `emblem.ts` | `foil.ts`, `emblem.ts`, `dimensions.ts` |
| Opening: the cover swings on its left edge with live shading | `OpeningCover.tsx` | `open-math.ts` |
| Bearer page: photo, name, handle, a passport number made from the handle, machine lines | `BearerPage.tsx` | `bearer.ts` |
| Pages: two to a spread, fold shading, page edges, numbers, guilloche, three slots with seeded jitter, ribbons for pinned stamps | `PageView.tsx`, `PageStock.tsx`, `Spread.tsx`, `InsideCover.tsx` | `spreads.ts`, `slots.ts`, `guilloche.ts`, `edges.ts`, `lib/layout.ts` |
| Page flip: drag from the outer edge, tap the edge, springs, held halfway wherever the finger stops | `FlipBook.tsx` | `flip-math.ts` |
| Stamps: brass ink, a pure function of the place, border family from the neighborhood, foil stamp for a finished neighborhood | `StampMark.tsx` | `stamp-design.ts` |
| Landing: slam, ink spread, glow, shake, haptic, photos pin on, "Added to page N" | `LandingScene.tsx` | `landing.ts`, `landing-copy.ts` |
| Visa spread: stamp left, scrapbook right (up to six photos, drag to rearrange, saved), typed caption, ticket stub | `VisaSpread.tsx`, `ScrapbookPage.tsx`, `PhotoViewer.tsx`, `TicketStub.tsx` | `scrapbook.ts`, `zoom.ts`, `typewriter.ts`, `visa.ts`, `pin-change.ts` |
| Index: progress rings per neighborhood, jump to a page | `IndexList.tsx`, `ProgressRing.tsx` | `index-data.ts` |
| The whole passport screen | `PassportBook.tsx`, `FirstRunHint.tsx` | `book-state.ts`, `use-passport.ts`, `first-run.ts` |

The book keeps one number, `pos`, the position between spreads (2.37 is 37 percent of the way from spread 2 to 3). Turn k has
progress `clamp(pos - k, 0, 1)`; a finger, a tap and a spring all just move `pos`. Two turning pages are always mounted (one
lying on each side, ready to turn), over the pages they reveal, so nothing is swapped mid-flip.

Math that runs inside worklets (gestures and animated styles) lives in files that start with the `"worklet";` directive:
`foil.ts`, `open-math.ts`, `flip-math.ts`, `landing.ts`, `zoom.ts`. `worklet-files.test.ts` fails if one loses it.

## Other screens
Place page (`app/(app)/place/[id].tsx`), the stamp flow (`app/(app)/stamp/new.tsx`, `camera.tsx`, `landed.tsx`), the map
(`features/map`), settings, welcome, sign in, sign up, the age gate, delete account. Their pure logic is in
`features/stamps/stamp-flow.ts`, `features/map/map-model.ts`, `features/place/place-page.ts`.

## Swappable screens
A screen in Nostos is a route file under `mobile/src/app` that does three things: read data through a hook, put components on
the screen, navigate with `router`. It owns no color, no size and no rule. So a screen imported from a design tool can replace
one of ours if it keeps the same data in and the same actions out.

How to swap one:
1. Replace the default export of the route file (or point the route at the imported screen). Keep the route's name and params:
   other screens link to them (`/stamp/[id]`, `/place/[id]`, `/stamp/new`, `/stamp/camera`, `/stamp/landed`, `/settings`).
2. Read data with the same hook. Do not call `fetch` in a screen.
3. Use the theme: `import { midnight, colors, space, radius, size, type, shadows, bookMotion, stampStyle } from "@/theme"`.
   No hex, rgb, hsl or named colors, no raw sizes in styles, no white: the gate fails on all of these.
4. Reuse the book components where the screen shows a page, a stamp, a cover or a ring; they take plain props and know nothing
   about routes. Reuse the pure logic modules rather than rewriting them (they carry the tests).
5. Keep the accessibility labels the existing tests look for, or update the test in the same commit. Never delete or skip one.
6. Anything that runs in a gesture or an animated style must be a worklet (see above).

| Route | Data in | Actions out | Book parts it uses |
|---|---|---|---|
| `(tabs)/passport` | `usePassport()` (`features/book/use-passport.ts`) | open settings, open a stamp | `PassportBook` (no props) |
| `(tabs)/map` | `usePlaces`, `useUserPlaces`, `useUserCoords` | open the composer, open a place | `MapScreen`, `PinMarker`, `PlaceSheet` |
| `(tabs)/stamp` | none (opens `/stamp/new`) | | |
| `stamp/new` | `useNearbyPlaces`, location, `photoDraft`, `songDraft` | create the stamp, go to `stamp/camera`, `stamp/song`, `stamp/landed` | `stamp-flow.ts` |
| `stamp/camera` | `photoDraft` | add, remove photos | `expo-camera` |
| `stamp/landed` | `landingDraft`, `useUserStamps` | back to the passport | `LandingScene` |
| `stamp/[id]` | `useStamp(id)`, `usePins` | edit, pin, delete from profile | `VisaSpread` |
| `place/[id]` | `usePlacePage(id, position)` | stamp here, open a stamp | `StampMark` |
| `settings/*`, `welcome`, `sign-in`, `sign-up`, `age-gate`, `terms-update`, `connect` | auth and account hooks | | `Cover` (welcome), `EmblemMark`, `FormHeader` |
| `design/*` (development only) | made-up data (`features/gallery/sample.ts`) | | everything |

The Design gallery (`app/design`) shows every piece on made-up data. Open it on a phone in a development build: from the Welcome
screen ("Design gallery (development)"), from Settings under Development, or with the link `nostos://design`. It does not exist
in release builds (`__DEV__` is false: the route is protected and the screen redirects home).

## Chosen reference
None. Nostos is its own design: a passport book. Earlier sessions waited for a reference app; the personal passport book replaced
that plan.

## What has not been seen on a device
All of it. Every effect in this document has been checked by unit tests of its math and by render tests, not by eye on an iPhone.
`mobile/DEVICE-CHECKLIST.md` lists each effect to check; the session reviews say which are unproven.
