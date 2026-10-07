# Nostos — refined five-screen editorial review

CURRENT DELIVERY: page61:19, “09 · REFINEMENT · Printed travel journal”. Original page55:9 remains unchanged for comparison. Current links:

- [Refined Passport](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=61-20)
- [Refined Map](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=61-303)
- [Refined New Stamp](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=61-591)
- [Refined Memory](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=61-848)
- [Refined Sign In](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=61-1103)

Instrument Serif Regular replaces heavy Bodoni Moda Bold for naturally narrower, lighter headlines. No distorted text. Libre Bodoni masthead reduced; statistics ink; Stamp circle outlined. Blue reserved for identity, selected state and primary actions. Fine rules, warm gradient paper, stronger subtle editable grain, square controls and ruled filters. Closer crop of existing Greek eye gives one prominent cultural moment. Fields use fine bottom rules. Actual Nearby/Visited frame heights are44 points; primary actions48. Passport center remains blank. Original assets, native text/vectors and component instances reused.

All five refined screens visually inspected at393×852 against the approved mockup. One targeted rule-placement correction followed the first composition check; affected Map/New Stamp/Sign In inspected afterward. Passport and Memory needed no further correction. Explicit heading font read-back matched Instrument Serif Regular. These are static designs; implementation limitations below still apply.

Current contact sheet: previews/refined/five-screens.png. Comparison: previews/refined/passport-before-after.png. Current frame manifest: refinement-manifest.json. Construction provenance: refinement-source/clone-five.js, refine-passport.js, refine-other-four.js and visual-fixes.js. These scripts use recorded IDs; remap IDs when cloning again. No app/Blender changes, commits or pushes.

The following section records the original five-screen draft and shared implementation notes. Its frame links and Bold typography are historical; use the refined links above.

2026-10-05. Ivory #F5F1E8, ultramarine #123BFF, ink #171714, secondary #5A5A55. Oversized Bodoni Moda Bold headlines, Libre Bodoni masthead, Barlow Condensed Medium archive labels, Inter controls. These are chosen font matches, not identification of the generated reference's original fonts. Styles exist in Figma; many nodes set typography directly rather than binding to style IDs.

## Review links

- [Passport](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=55-19)
- [Map](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=55-302)
- [New Stamp](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=55-590)
- [Memory](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=55-851)
- [Sign In](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=55-1106)

Page 55:9. Editable text, frames, native vector icons, thin rules, buttons and field components. Raster assets are art and photo fixtures only. Prior pages and the user's manually edited original 2:2 remain intact. Passport center is deliberately blank. All five supplied screenshots were visually inspected against the approved mockup; no further layout changes were required. previews/five-screens.png is the review contact sheet.

## Implementation notes for Claude

Design delivery only. Do not infer app integration permission from this folder. Use the existing React Native / Expo / Skia / Reanimated / Gesture Handler stack; these frames need no new 3D renderer. Implement layouts with safe-area insets and scrolling where needed, rather than fixed screen coordinates. Baseline is 393 × 852; keyboard, narrow widths, large text and VoiceOver must be checked on-device. Controls were designed around 44-point targets. Screenshots do not establish native hit testing or Dynamic Type behavior.

Keep private collection and Passport / Stamp / Map navigation. Blank Passport stage reserves future book work and is not an implemented book. Bind counts and last visit to real state. The Map artwork is schematic and must be replaced by the existing native map; coordinates, distance and eligibility must come from location/server data. Search and Nearby/Visited filters are proposed local UI behavior, not features demonstrated by these frames.

New Stamp preserves geofence eligibility, maximum six camera-only photos, 280-character caption, optional song metadata and at least one content item. Remove dispatches existing draft removal. Submit succeeds only after server acceptance; preserve retry/draft errors. Song is metadata: no playback. Memory retains photo viewer/paging, pin maximum four, edit/remove through existing actions; the decorative record disc is not a play control. Sign In uses existing auth validation; signup links to the existing route, not an invented form.

Final animation belongs in app code: continuous gesture progress, interrupt/reverse/cancel, spring release, source-to-memory continuity and short stamp feedback. Reduce Motion should use stationary fades and remove decorative transforms. No interactive prototype, animation study, or phone-performance verification is claimed here. No app code or Blender scene was changed for this delivery.

## Asset provenance and reconstruction

assets/greek-eye-collage.png is original generated Greek engraving collage; cafe-table.png and cafe-exterior.png are fictional cafe fixture photographs, not verified depictions of Via Carota. Replace photos with user content at runtime. Original imagegen prompts are in asset-prompts.json. Generation may vary; retain the delivered PNGs for exact reproduction. Do not imply licensed historical artifacts or actual business photography.

screen-manifest.json records exact Figma IDs and selected fonts. build-five-screens.js retains initial native construction code; image placements were uploaded afterward. Rebuilding creates another page and requires these three PNG assets to be re-uploaded to the recorded target layers. It is not a one-step exact reconstruction. See CURRENT-SCOPE.md before resuming work so older black/silver pages are not mistaken for this delivery.
