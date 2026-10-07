# BLENDER NOTES (resume here if a session is cut off)

## Setup / assumptions
- Source scene: copy of ~/nostos-codex/design/passport/source/nostos-passport-m1.blend -> source/scene.blend (original untouched). Blender 5.2.2 at /Applications/Blender.app.
- The original brief for turntable/gold drop was not available to this session; assumptions: turntable = closed passport upright, spinning 360 deg about vertical axis, 72 frames, transparent RGBA, soft shadow in alpha. Gold drop = static hero pose, brass foil is revealed top-to-bottom with a warm edge glow then a glint sweep, 48 frames, ends on turntable frame_000.
- Render script: nostos_render.py (resumable, skips existing PNGs). Look params in look.json (optional overrides).
- Resume: `/Applications/Blender.app/Contents/MacOS/Blender -b source/scene.blend -P nostos_render.py -- --mode turntable --frames 0-71 --outdir renders/turntable` (same for golddrop with --frames 0-47 --outdir renders/golddrop).
- Mood reference: reference/mood.png (palette #15110B #D5D1CB #817D78 #3D3933 + brass).

## Critique log (11 look rounds, renders/rounds/round_01..11.png; first test render r01 was lying flat/black and is not kept)
1. Foil flat deep orange, leather dead flat, book too small -> brass colour lightened/desaturated, world gradient so metal has something to reflect, camera closer.
2. Leather grey and washed, no tonal gradient -> closer smaller key light for falloff, less ambient.
3. Back cover plastic-smooth (different material) -> back board given the same calfskin as the front.
4. Shadow catcher gave banding and a double shadow -> replaced by one static soft alpha ellipse (clean, no flicker).
5. Scene got dark after catcher removal -> raised all lights, big front softbox for silky gradient on the cover.
6. Cover flashed pale blue-grey at ~66 and ~294 deg (narrow rim strip mirrored in glossy leather) -> rim/strip energy cut by ~4x.
7. Back side unlit -> mirrored softboxes behind the book.
8. Foil star flashed near-white at ~36 deg (strip reflection) -> strip cut again, foil roughness 0.27, colour deepened. Max pixel on book now <= 247.
9. Page-block edge harsh white -> paper tinted 0.7.
Remaining known weakness: back cover is a plain dark leather slab (it has no artwork); silky sheen on it is subtle; foil wordmark is slightly darker than the star at some angles.

## Progress (auto-updated)

## Render plan (written before the 72-frame render)
- Engine Cycles, Metal GPU, 960x1200 RGBA, 128 samples + denoise, look.json frozen. ~11 s/frame measured (3-frame test, 96 spl) => 72 frames ~15 min, well under 2 h.
- Launched: turntable 0-71 -> renders/turntable, then golddrop 0-47 -> renders/golddrop, with --samples 128. If cut off, rerun the same commands (existing PNGs skipped). Then run `python3 stress_test.py`.
- After renders: stress_test.py also makes WebPs in renders/turntable_webp and renders/golddrop_webp (quality tuned to <300 KB).
- PROGRESS turntable: 72/72 frames on disk, updated 2026-10-02 20:38:01
- PROGRESS golddrop: 48/48 frames on disk, updated 2026-10-02 20:47:47

## Status 2026-10-02: DONE
- turntable 72/72, golddrop 48/48, exact360 test frame rendered. stress_test.py: 10/10 PASS (renders/stress/results.json, contact sheets, small_390/200.png).
- WebP: renders/turntable_webp (3.1 MB total), renders/golddrop_webp (4.4 MB), max 100 KB each.
- Not verified: on-phone look, real app playback, reduced-motion handling, WebP alpha decoding in the RN image stack.

## NEW DIRECTION 2026-10-02: real-time passport (frame renders cancelled; 144-frame set NOT started; nothing was rendering)
- New scene version: source/scene_v2_realtime.blend (old source/scene.blend untouched). Pipeline, run in order from ~/nostos-blender:
  make_env.py -> export/studio-env.jpg | make_textures.py -> tex/*.png (normal+ORM 2048, page edge) | build_passport.py -- source/scene_v2_realtime.blend | export_glb.py (run with the blend) | verify_export.py, verify_render.py | r2.sh blend out.png yaw pitch res (preview)
- ASSUMPTION: 125 x 88 mm read as portrait (125 tall = +Y, 88 wide = X, 5 thick = Z), like a real passport. glb bbox: 0.088 x 0.125 x 0.005 m, centered, front +Z, spine at -X (left).
- Geometry: 632 tris, 3 materials (CoverGlass, Trim, PageBlock), no modifiers. Trim = cover chamfers/groove/spine. Atlas UV: front = left half, back = right half (mirrored u so it reads correctly from behind).
- Material: Principled, base #15110B, metallic 0.25 (ORM blue), roughness from ORM green (0.045 mirror, 0.42 engraved satin), coat 1.0, coat roughness 0.0301 (0.03 exactly is Blender's default and the exporter omits it, which glTF reads as 0), normal map also fed to Coat Normal.
- Rounds (renders/rounds/passport_round_01..06.png): 1 landscape by mistake + uniform grey (material slot offset bug) -> portrait, fixed slots; 2 env too bright/hard, art thin -> softer env, camera-ray backdrop; 3 wordmark unreadable (Copperplate) -> Avenir Next Medium; 4 cover pure black, env rotation -> rotate env, metallic 0.75->0.25 (gradient + engraving now read); 5 back/side check (page block face tag bug found: src tag lost at join -> int face attribute); 6 trim lightened, final.
- Export: export/passport.glb 507 KB (no Draco, textures embedded), passport-preview.png, studio-env.jpg 22 KB (max 213).
- Not verified: look in the phone app/its renderer (clearcoat support varies), mip/aliasing of the 0.3 mm lines at small sizes.

## OPENABLE PASSPORT 2026-10-06 (hinged cover + `open` animation) — built, verified in Blender/three.js; NOT yet wired into the app
- Why: export/passport.glb is one welded closed mesh, 0 animations, so the app could only zoom/crossfade into its 2D reader.
- Pipeline (two steps, each its own live-Blender call or CLI): `build_openable.py` (reads v2, writes ONLY source/scene_v3_openable.blend) then
  `export_openable.py` (writes export/passport-openable.glb). v2 and export/passport.glb are untouched.
  Live-session quirk: the exporter fails if run in the same call as open_mainfile (no window/active object); hence two files.
- Structure: empty `Passport` -> `Body` (back board + spine + page block) and `CoverFront` (front board, origin at the spine edge x=-44 mm).
  The v2 mesh was already 4 closed shells, so the split needed no cutting. One clip `open`: 49 keys, 24 fps, 0-2.0 s:
  CoverFront yaw -180 deg (swings toward the viewer, ends flat and coplanar with the back board), Passport +44 mm in X (centres the spread).
  Close = play `open` backwards.
- Size: 499 KB vs 495 KB (3 materials, 3 images unchanged). No network use: the app bundles the .glb.
- Verified: three.js GLTFLoader parses it (clip "open", 2 s, Passport.position + CoverFront.quaternion tracks); world-space BVH test: 0
  intersecting triangles on frames 1-47; frame 0/48 only touch (flat contact / hinge seam). Lit preview: renders/openable/ (contact_sheet.png, open_preview.mp4).
- NOT done: inside-cover lining and a bearer-page texture (opened spread is plain black lining + plain page slab, fine as a handoff
  into the app's 2D pages, not as a final look); app wiring (AnimationMixer, crossfade into FlipBook, Close = reverse); phone testing.
- Preview: `EXPOSURE=1.8 Blender -b source/scene_v3_openable.blend -P preview_open.py -- outdir 540 0,12,24,36,48`
