import bpy, os
ob=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath('export/passport.glb'),export_format='GLB',use_selection=True,
  export_draco_mesh_compression_enable=False,export_image_format='AUTO',export_apply=True,export_yup=True,
  export_materials='EXPORT',export_cameras=False,export_lights=False)
