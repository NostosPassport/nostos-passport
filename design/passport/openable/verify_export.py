import bpy, json, struct, os, math
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('export/passport.glb'))
ms=[o for o in bpy.data.objects if o.type=='MESH']
from mathutils import Vector
pts=[o.matrix_world@Vector(c) for o in ms for c in o.bound_box]
mn=[min(p[i] for p in pts) for i in range(3)]; mx=[max(p[i] for p in pts) for i in range(3)]
print('IMPORTED dims (blender axes, mm):',[round((mx[i]-mn[i])*1000,3) for i in range(3)])
print('tris',sum(len(p.vertices)-2 for o in ms for p in o.data.polygons),'objects',len(ms),'modifiers',sum(len(o.modifiers) for o in ms))
for m in bpy.data.materials:
    b=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    print(m.name,'rough',round(b.inputs['Roughness'].default_value,3),'metal',round(b.inputs['Metallic'].default_value,3),'coat',round(b.inputs['Coat Weight'].default_value,3),'coatrough',round(b.inputs['Coat Roughness'].default_value,4),'coatNormalLinked',b.inputs['Coat Normal'].is_linked,'normalLinked',b.inputs['Normal'].is_linked,'rough/metal linked',b.inputs['Roughness'].is_linked,b.inputs['Metallic'].is_linked)
print('images',[(i.name,i.size[:]) for i in bpy.data.images])
