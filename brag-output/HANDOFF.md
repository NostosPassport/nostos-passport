# Nostos teaser handoff — 2026-10-06

## Delivery
- `brag.mp4`: 20.000s, 1080×1920 (9:16), 30fps, 600 frames, H.264/yuv420p + AAC stereo/48kHz, fast-start MP4. Approximately 12 MB. Local playback/social-upload file; not published.
- `brag.jpg`: chosen settled hook at 1.2s, full resolution. Its pixels replace only video frame 0; length/frame count remain unchanged.
- `share-copy.txt`: short coming-soon caption with five relevant hashtags.
- `brag-plan.md`, `composition-brief.md`, `ASSET-SOURCES.md`, local editable `composition/`, original music generator and licenses.

## Concept
Greek editorial art direction: warm white paper, electric blue, large serif, classical eye collage and supplied column-N logo. Find a NYC place → capture a memory → keep it as a passport stamp. A physical page turn and stamp landing form the centerpiece. End card: “Coming soon to iPhone.” No date, fake reviews, engagement claims or download button.

## Important truth boundaries
Map and New Stamp images are existing refined design exports, **not live app recordings**. Cafe images/example data are illustrative fixtures, not verified venue photography. Book/page-flip/stamp-landing scene is a source-informed HTML reenactment, not footage of the native runtime. Existing app code contains those feature concepts, but this video does not verify device behavior or fix the backend gate. No invented extra feature is marketed. Existing chosen N logo used unchanged; Hermes and circle variant not used.

## Audio
Original instrumental generated locally from explicit musical notes and synthesis, with no borrowed music or samples. Kenney CC0 card-slide/card-place/drop SFX. Full links/provenance in ASSET-SOURCES.md. Output measured integrated loudness -18.16 LUFS, true peak -0.64 dBTP after AAC encoding. No audible-review claim: audio inspected through synthesis/source review, mix timing, decoding and measured loudness/peaks; human playback taste review remains appropriate. No voiceover. Bundled ende tracks not used because their exact music license was not supplied.

## Actual verification
Hyperframes 0.8.137 full brag workflow. Final `check` **PASS**: zero lint/runtime/layout/motion errors; runtime 0 warnings; contrast **47/47 WCAG AA**. Six lint warnings concern monolithic Studio edit granularity and duplicate static cafe image use. One layout warning is the transient projected bounding-box intersection of two caption lines while the physical page is almost edge-on (12.63–12.88s). Settled text is legible; no contrast bypass. The narrowly marked front/back header overlap is intentional two-sided sheet geometry, visually inspected.

Rendered in 27.0s: screenshot capture, hardware GPU; compile 1.6s, extract 0.0s, audio 0.4s, probe 0.1s, setup 0.3s, capture 17.3s, encode 6.7s, assemble 0.6s. Key frames and page-turn trajectory inspected; final MP4 book/end frames inspected after encode. Poster extracted from final render and baked into first frame. ffprobe confirms dimensions, codecs, 20s and 600 frames. Audio fully decodes and measured as above. Logs in `proof/`.

## Workspace preservation
Application HEAD stays `5485fb4` on `build-codex`. No tracked application changes (`git diff --stat` empty); pre-existing untracked `design/` preserved. All new work under `brag-output/`; tool dependencies under `brag-output/tools/`, no application manifest changes. Backend 3001/Expo 8081 still running, original processes not stopped. No DB commands, app tests/gates, audits, migrations, commit or push. No repository upload, cloud render, publishing or purchase. Hyperframes telemetry disabled.

## Local review / reproduce
Preview: http://localhost:3340/#project/composition (HTTP 200 checked). Open `brag.mp4` in QuickTime for final playback.
From `/Users/charlesjinn/nostos-codex`:
```sh
brag-output/tools/node_modules/.bin/hyperframes preview brag-output/composition --background --port 3340 --no-open
brag-output/tools/node_modules/.bin/hyperframes render brag-output/composition --quality delivery --fps 30 --workers 2 --output /Users/charlesjinn/nostos-codex/brag-output/brag.mp4
```
The last command rerenders the source mix; poster baking and final loudness treatment were applied after rendering. Preserve the supplied final MP4 unless intentionally revising it. Installed brag/Hyperframes skills are available on the next turn.
