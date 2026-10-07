# Builds the real-time Nostos passport. Run: Blender -b -P build_passport.py -- out.blend
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix
out=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
mmu=0.001
W,Hh,R=88*mmu,125*mmu,3.5*mmu
TC=0.9*mmu; BLK=3.2*mmu           # cover plate thickness, page block thickness
ZT=2.5*mmu
def rrect_pts(w,h,r,seg=6,cx=0,cy=0):
    pts=[]
    for (sx,sy,a0) in ((1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)):
        ccx=cx+sx*(w/2-r); ccy=cy+sy*(h/2-r)
        for i in range(seg+1):
            a=math.radians(a0+90*i/seg); pts.append((ccx+r*math.cos(a),ccy+r*math.sin(a)))
    return pts
def prism(name,pts,z0,z1):
    me=bpy.data.meshes.new(name); bm=bmesh.new()
    vs=[bm.verts.new((x,y,z0)) for x,y in pts]
    f=bm.faces.new(vs)
    if f.normal.z<0: f.normal_flip()
    r=bmesh.ops.extrude_face_region(bm,geom=[f])
    vv=[e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]
    bmesh.ops.translate(bm,verts=vv,vec=(0,0,z1-z0))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); return ob
def apply_mod(ob,m):
    bpy.context.view_layer.objects.active=ob
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True); bpy.ops.object.modifier_apply(modifier=m.name)
def bevel(ob,width):
    m=ob.modifiers.new('bv','BEVEL'); m.width=width; m.segments=1; m.limit_method='ANGLE'; m.angle_limit=math.radians(35)
    apply_mod(ob,m)
front=prism('front',rrect_pts(W,Hh,R),ZT-TC,ZT)
back=prism('back',rrect_pts(W,Hh,R),-ZT,-ZT+TC)
spine=prism('spine',[(-W/2,-Hh/2+R),(-W/2+2*mmu,-Hh/2+R),(-W/2+2*mmu,Hh/2-R),(-W/2,Hh/2-R)],-ZT+TC,ZT-TC)
block=prism('block',rrect_pts(86*mmu,123*mmu,2.5*mmu,cx=0,cy=0),-BLK/2,BLK/2)
for o in (front,back): bevel(o,0.32*mmu)
# hinge groove: V cut, 1.0 wide x 0.35 deep, 6 mm from the spine edge
gx=-W/2+6*mmu
for ob,sgn in ((front,1),(back,-1)):
    me=bpy.data.meshes.new('cut'); bm=bmesh.new()
    zt=sgn*ZT; d=0.35*mmu; hw=0.5*mmu; ex=0.2*mmu
    prof=[(gx-hw-ex*.6,zt+sgn*ex),(gx+hw+ex*.6,zt+sgn*ex),(gx,zt-sgn*d)]
    ys=(-Hh/2-mmu,Hh/2+mmu)
    vs=[[bm.verts.new((x,y,z)) for x,z in prof] for y in ys]
    bm.faces.new(vs[0]); bm.faces.new(vs[1][::-1])
    for i in range(3): bm.faces.new((vs[0][i],vs[0][(i+1)%3],vs[1][(i+1)%3],vs[1][i]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); bm.free()
    cut=bpy.data.objects.new('cut',me); bpy.context.collection.objects.link(cut)
    m=ob.modifiers.new('bool','BOOLEAN'); m.operation='DIFFERENCE'; m.object=cut; m.solver='EXACT'
    apply_mod(ob,m); bpy.data.objects.remove(cut)
for o in (spine,block):
    pass
bevel(spine,0.3*mmu)
# materials
def mk(name):
    m=bpy.data.materials.new(name); m.use_nodes=True; return m
def bsdf(m): return next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
def img(path,cs):
    i=bpy.data.images.load(path); i.colorspace_settings.name=cs; i.pack(); return i
glass=mk('CoverGlass'); trim=mk('Trim'); page=mk('PageBlock')
nt=glass.node_tree; b=bsdf(glass); N=nt.nodes; L=nt.links
b.inputs['Base Color'].default_value=(0x15/255,0x11/255,0x0B/255,1)  # set linear below
def srgb2lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
b.inputs['Base Color'].default_value=tuple(srgb2lin(x) for x in (0x15/255,0x11/255,0x0B/255))+(1,)
tn=N.new('ShaderNodeTexImage'); tn.image=img(bpy.path.abspath('//tex/passport_normal.png') if False else __import__('os').path.abspath('tex/passport_normal.png'),'Non-Color')
tr=N.new('ShaderNodeTexImage'); tr.image=img(__import__('os').path.abspath('tex/passport_orm.png'),'Non-Color')
nm=N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=1.0
sep=N.new('ShaderNodeSeparateColor')
L.new(tn.outputs['Color'],nm.inputs['Color']); L.new(nm.outputs['Normal'],b.inputs['Normal'])
L.new(tr.outputs['Color'],sep.inputs['Color']); L.new(sep.outputs['Green'],b.inputs['Roughness']); L.new(sep.outputs['Blue'],b.inputs['Metallic'])
b.inputs['Coat Weight'].default_value=1.0; b.inputs['Coat Roughness'].default_value=0.0301
L.new(nm.outputs['Normal'],b.inputs['Coat Normal'])
b=bsdf(trim); b.inputs['Base Color'].default_value=tuple(srgb2lin(x) for x in (0x34/255,0x2D/255,0x22/255))+(1,)
b.inputs['Metallic'].default_value=1.0; b.inputs['Roughness'].default_value=0.16
b=bsdf(page); pt=page.node_tree.nodes.new('ShaderNodeTexImage'); pt.image=img(__import__('os').path.abspath('tex/page_edge.png'),'sRGB')
page.node_tree.links.new(pt.outputs['Color'],b.inputs['Base Color']); b.inputs['Roughness'].default_value=0.75
# join + material/UV assignment
for i,o in enumerate((front,back,spine,block)):
    at=o.data.attributes.new('src','INT','FACE'); at.data.foreach_set('value',[i]*len(o.data.polygons))
bpy.ops.object.select_all(action='DESELECT')
for o in (front,back,spine,block): o.select_set(True)
bpy.context.view_layer.objects.active=front
bpy.ops.object.join()
ob=front; ob.name='Passport'; ob.data.materials.clear()
for m in (glass,trim,page): ob.data.materials.append(m)
bm=bmesh.new(); bm.from_mesh(ob.data); uv=bm.loops.layers.uv.new('UVMap'); sl=bm.faces.layers.int['src']
for f in bm.faces:
    src=f[sl]; c=f.calc_center_median(); n=f.normal
    if src==3:
        f.material_index=2
        for l in f.loops:
            p=l.vert.co; l[uv].uv=((math.atan2(p.y,p.x)/(2*math.pi))%1.0,(p.z+BLK/2)/BLK)
    elif src==0 and n.z>0.99:
        f.material_index=0
        for l in f.loops: p=l.vert.co; l[uv].uv=(0.5*(p.x+W/2)/W,(p.y+Hh/2)/Hh)
    elif src==1 and n.z<-0.99:
        f.material_index=0
        for l in f.loops: p=l.vert.co; l[uv].uv=(0.5+0.5*(1-(p.x+W/2)/W),(p.y+Hh/2)/Hh)
    else:
        f.material_index=1
        for l in f.loops:
            p=l.vert.co; l[uv].uv=(0.003+0.01*(p.x+W/2)/W,0.003+0.01*(p.y+Hh/2)/Hh)
bm.to_mesh(ob.data); bm.free()
me=ob.data; me.attributes.remove(me.attributes['src'])
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS')
ob.location=(0,0,0)
# orient: front (+z local) -> Blender -Y (exports as glTF +Z), local y -> Blender +Z (glTF +Y)
ob.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bm=bmesh.new(); bm.from_mesh(me)
for f in bm.faces: f.smooth=True
for e in bm.edges:
    if len(e.link_faces)==2 and e.calc_face_angle(0)>math.radians(35): e.smooth=False
bm.to_mesh(me); bm.free()
tris=sum(len(p.vertices)-2 for p in me.polygons)
print('TRIS',tris,'DIM',tuple(round(x*1000,3) for x in ob.dimensions),'MATS',len(me.materials))
bpy.ops.wm.save_as_mainfile(filepath=out)
