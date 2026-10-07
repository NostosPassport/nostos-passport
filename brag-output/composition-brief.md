# Hyperframes composition brief: Nostos

Deliver locally playable brag.mp4 and brag.jpg, vertical 1080×1920/30fps/20s. Standard full brag workflow with Hyperframes 0.8.137, GSAP seekable HTML composition. No voiceover. Follow brag-plan.md as the creative contract.

Source files read: mobile/src/theme/midnight.ts and typography.ts; mobile/README.md; features/book/Cover.tsx, StampMark.tsx, LandingScene.tsx; app/(app)/stamp/landed.tsx. Design previews/assets from design/editorial/previews/refined and assets; supplied logo from nostos-review/output/nostos-brand/nostos-app-icon-v2.png.

Palette: #F7F4EE/#171714/#123BFF. Two local app fonts: Cormorant Garamond and Courier Prime. Greek editorial identity, large confident serif, fine printed rules, warm paper grain, restrained photography. Original score in assets/audio/nostos-original.wav; data.json contains pre-extracted music bands. SFX are Kenney card-slide-1/card-place-2/drop_001 from brag's CC0 library. One original instrumental bed, sparse tactile accents. Readable holds take priority over beat locks. No bundled ende music because exact redistribution license wasn't supplied.

Five scenes at 0, 3.125, 7.5, 11.25, 16.25, end 20. See plan for copy. Native feature motion may be recreated for clarity; record all simulated UI in handoff. Render authorization is explicit in the incoming request, which requests the finished MP4; no additional preview approval required. Check all runtime/layout/contrast findings, inspect key rendered frames, inspect output audio and bake chosen poster into first frame. No external requests at render time, no runtime clocks or random input, local fonts/scripts/assets only. Do not alter app source, servers or tests.
