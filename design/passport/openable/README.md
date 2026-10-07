# The openable Blender passport

Source for `mobile/assets/3d/passport-openable.glb`: a hinged cover and one `open` clip (2.0 s, 24 fps), plus a cream inside cover and
bearer page that match the app's 2D pages. The app scrubs the clip to open and close the passport (see `mobile/src/features/lab3d/open-motion.ts`).

## Rebuild
Needs Blender 5.x. These scripts expect to run with the files in this folder (set `NOSTOS_BLENDER` to this folder if it lives elsewhere).

1. `make_interior_textures.py` writes `tex/interior_left.png` and `tex/interior_right.png` from the app's fonts and page colors
   (run `python3` with Pillow and numpy; needs `npm install` in `mobile/`; set `NOSTOS_REPO` to the repo root if it is not `~/nostos-codex`).
2. In Blender: run `build_openable.py` (reads `source/scene_v2_realtime.blend`, writes only `source/scene_v3_openable.blend`).
3. In a separate Blender call: run `export_openable.py` (writes `export/passport-openable.glb`). Two steps because the glTF exporter fails if it
   runs in the same call that opened the file.
4. Copy the `.glb` to `mobile/assets/3d/passport-openable.glb`.

`preview_open.py` and `preview_app_framing.py` render lit previews headless; see the top of each file. `BLENDER-NOTES.md` is the working log.
`build_passport.py`, `make_env.py`, `make_textures.py`, `export_glb.py` and `verify_*.py` are the original static-model pipeline (v2).
The interior right page is a specimen with placeholder values.
