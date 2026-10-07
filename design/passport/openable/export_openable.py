"""STEP 2 of 2: export source/scene_v3_openable.blend to export/passport-openable.glb (with the `open` clip).

Live Blender / MCP:   exec(open(".../export_openable.py").read())   (run as its own call, after build_openable.py)
Command line:         Blender -b source/scene_v3_openable.blend -P export_openable.py
export/passport.glb (the original static model) is never touched.
"""
import os

import bpy

HERE = os.environ.get("NOSTOS_BLENDER") or os.path.expanduser("~/nostos-blender")  # folder that holds source/, tex/, export/
OUT = f"{HERE}/export/passport-openable.glb"
root = bpy.data.objects["Passport"]
parts = [root, *root.children_recursive]   # includes the interior planes (grandchildren)
for ob in bpy.data.objects:
    ob.select_set(ob in parts)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True, export_draco_mesh_compression_enable=False,
    export_image_format="AUTO", export_apply=True, export_yup=True, export_materials="EXPORT",
    export_cameras=False, export_lights=False,
    export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
)
print("EXPORTED", OUT, os.path.getsize(OUT) // 1024, "KB")
