# Nostos black-and-silver UI handoff

2026-10-02. Figma design scope only. Targeted review follow-up added one agreement-error state, bringing the set to75 new frames. This is design coverage, not verified feature completeness or working navigation.

## Focused review clarifications

Signup preserves the current submit-validation behavior: Create account can look active before consent, but submission requires consent and valid fields. The entire agreement row is a345 ×44 tappable region, including a44 ×44 checkbox target. [Agreement error state](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=36-101) shows the inline message after submission, with values preserved and accessibility announcement required. Consent links remain independently accessible. Keyboard-open scrolling and avoidance on signup and narrow composer remain unverified and are integration acceptance requirements.

Composer21:52 now has an explicit88 ×44 Remove control on the draft photo. It dispatches the existing draft removal action before submission and preserves other photos/caption/song. Camera limit stateS09 also shows photo removal; repeat the same remove target for each captured thumbnail. No draft photo-review navigation is claimed or added. Both changed screen examples were visually inspected.

[Open the Figma file](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj). 75 new editable screens/states across six pages, plus the user's preserved primary screen. Navigate with Figma's Pages panel.

## Starting points

- [Original primary screen](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=2-2): unchanged manual edits, fingerprint 7a7d38d5 and49 descendants before and after.
- [Passport and places](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-50): blank open-book stage, separate page controls, neighborhood index/progress, Map and place sheets/history.
- [Make a stamp](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-52): selection, composer, camera, song attachment, success and recovery.
- [Memories](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-10): photo/text memories, viewer, arrangement, editing and owner actions.
- [Account and settings](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-72): signup/sign-in, guest age gate, permissions, settings/profile, terms, sign-out/deletion.
- [Recovery and staff](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-10): validation/loading/error/success/discard and conditional staff moderation.
- [Phone fit and motion](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=27-10):320-point layouts, representative larger text and reduced motion.

## Design and actual scope

Black/silver follows the user's explicit palette change. Gradients create quiet depth; serif headings and restrained monochrome controls preserve the brand. The primary frame's manually edited statistics/navigation spacing is retained. Related new layouts use24-point margins,44-point or larger control regions, centered icon slots and separately centered labels. The future passport area stays blank without visible placeholder copy.

Personal app features remain accessible. Social-flag-only routes are not part of this production design. Staff moderation is a separate conditional family; development gallery remains a diagnostic tool. Terms/Privacy/Support open existing external pages rather than invented app content. Camera and photo-library prompts use native OS UI. Stamp photos remain camera-only; profile avatars may use the library. Song attachment is metadata, with no playback. Preserve maximum6 photos,280-character captions,150-character bio,10-character password minimum, four pinned stamps, geofence checks and server acceptance before success.

New stamp uses progressive selection/content states inside the existing route; this is a proposed interaction arrangement, not a new endpoint. Settings/option sheets can scroll. Destructive operations have named confirmation and a safe cancellation action. Book opening, bearer content, stamp drawing and turning are reserved for future passport work; annotations retain those behavioral contracts.

## Verification and limits

Representative screenshots inspected for every major layout family and narrow/larger-text examples. Final structural check found74 frames,706 editable text nodes, no complete-UI image fills, no heading overlap or content/footer collision in the checks performed. This does not establish all optical details, all Dynamic Type sizes or native behavior. Editable component templates are used for repeated buttons/fields/rows in the newer families; existing primary navigation is cloned into relevant new screens.

Map geometry and photo illustrations are schematic vector fixtures, not real geography, map-provider artwork or user photos. Replace with the native map and runtime photos; retain actual attribution. Figma labels use Inter because SF Pro did not render in MCP previews; the native app uses the system font. Header Cormorant Garamond and wordmark Courier Prime remain. Preview vector icons require native SF Symbol mapping at integration.

These are static, editable design proposals. No clickable prototype or gesture-controlled runtime is claimed. No app source, dependencies, services or purchases changed. No physical-phone tests performed. Existing oversized-screen/corner-button report remains unverified and unfixed; see PHONE-LAYOUT-HANDOFF.md.

## Interaction handoff

- Navigate back to the previous book spread and scroll position. Preserve first/final book-face controls and oldest-first3-stamps/page behavior.
- Use one continuous gesture parameter for interactive turns in future passport work; static Figma cannot prove pause/reverse/cancel.
- Stamp acceptance: actual upload progress, disabled repeated submission, draft-preserving errors/retries; success only after server confirmation. Short press/reveal and one subtle haptic are proposals.
- Memory/photo transitions: short fade or source continuity when implemented; viewer preserves paging, pinch1–4x, double-tap2.5x and zoom pan; distinguish photo arrangement from viewer gestures.
- Reduce Motion: stationary surfaces and150–220ms opacity changes, no tilt, moving highlights, shake, page deformation, bounce or delayed typewriter. Keep confirmations and accessibility announcements.
- Layout derives from usable window width and real safe-area insets, not a scaled393×852 canvas. Smaller width examples use320pt; long forms must scroll and avoid keyboard overlap. Large text reflows rather than shrinking. Minimum44pt targets persist despite compact visible chrome.
- Before app integration, map each frame to existing routes/hooks/actions, verify data/error/permission contracts, implement responsive layouts, run appropriate focused checks and perform the agreed real-phone verification. App implementation requires separate authorization.

## Editable source and screen inventory

Figma is the authoritative current design. screen-manifest.json records frame/page IDs and initial creation descriptions. build-screen-set.js contains the Plugin API construction helpers; it runs through use_figma, not Node. To recreate an initial family, append its manifest screen definitions, create a new page and call screen(spec,index,page). Subsequent refinements are recorded below; do not rerun into the user's original page.

Refinements after construction: dynamically space early-family headings/subtitles;44pt header right controls; signup password copy10 and abuse notice; P01 separate pager targets; P02 progress rings and disabled unstarted row; larger-text instance overrides inR02. The manifest is construction input, not a serialized copy of all final Figma geometry.

| Code | Screen/state | Link |
|---|---|---|
| P01 | Your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-10) |
| P02 | Neighborhood index | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-50) |
| P03 | Neighborhood index | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-85) |
| P04 | Your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-105) |
| P05 | Your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-142) |
| P06 | Your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-179) |
| M01 | Your places | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-217) |
| M02 | Your places | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-266) |
| M03 | Your places | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-320) |
| M04 | Via Carota | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-372) |
| M05 | Via Carota | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-402) |
| M06 | Your places | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=20-422) |
| S01 | Stamp a place | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-10) |
| S02 | New stamp | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-52) |
| S03 | New stamp | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-96) |
| S04 | Not quite there yet | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-133) |
| S05 | Adding your stamp | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-156) |
| S06 | Couldn't add your stamp | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-176) |
| S07 | Stamp a place | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-197) |
| S08 | Camera | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-217) |
| S09 | Camera | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-240) |
| S10 | Camera access | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-272) |
| S11 | Camera access is off | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-296) |
| S12 | Add a song | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-317) |
| S13 | Add a song | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-349) |
| S14 | Added to your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=21-372) |
| D01 | Via Carota | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-10) |
| D02 | Via Carota | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-42) |
| D03 | Photo | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-64) |
| D04 | Photo | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-84) |
| D05 | Memory options | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-104) |
| D06 | Edit memory | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-139) |
| D07 | Delete this memory? | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-172) |
| D08 | Stamp unavailable | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-197) |
| D09 | Four stamps are pinned | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-216) |
| D10 | Arrange your photos | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=23-245) |
| A01 | Go somewhere. | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-10) |
| A02 | Welcome back | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-41) |
| A03 | Get your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-72) |
| A04 | Before you look around | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-112) |
| A05 | For adults 21 and over | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-138) |
| A06 | Updated terms | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-157) |
| A07 | Connecting | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-180) |
| A08 | You're offline | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-196) |
| A09 | Settings | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-215) |
| A10 | Edit profile | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-266) |
| A11 | Profile photo | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-299) |
| A12 | Customize | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-320) |
| A13 | Sign out? | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-339) |
| A14 | Delete your account | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-360) |
| A15 | Delete your account? | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-384) |
| A16 | Account deleted | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-405) |
| A17 | Find places near you | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-423) |
| A18 | Location is off | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=24-442) |
| A19 | Signup agreement error | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=36-101) |
| E01 | Welcome back | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-10) |
| E02 | Add a song | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-45) |
| E03 | Add a song | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-72) |
| E04 | Camera | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-97) |
| E05 | Stamp a place | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-122) |
| E06 | Stamp a place | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-141) |
| E07 | Edit profile | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-160) |
| E08 | Discard your changes? | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-192) |
| E09 | Your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-216) |
| E10 | Delete your account | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-256) |
| E11 | Saved | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-282) |
| E12 | Control states | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-305) |
| T01 | Moderation | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-333) |
| T02 | Hidden items | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-363) |
| T03 | Moderation log | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-397) |
| T04 | Hide this stamp? | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=26-422) |
| R01 | New stamp | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=27-10) |
| R02 | Edit profile | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=27-60) |
| R03 | Added to your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=27-97) |
| R04 | Your passport | [Frame](https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=27-121) |
