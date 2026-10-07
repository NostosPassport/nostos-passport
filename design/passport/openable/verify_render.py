import bpy, os, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('export/passport.glb'))
# glTF import leaves an empty root; rotate the root, not the mesh
exec(open('render_preview.py').read().replace("ob=next(o for o in bpy.data.objects if o.type=='MESH')","ob=next(o for o in bpy.data.objects if o.parent is None and o.type in ('MESH','EMPTY'))"))
