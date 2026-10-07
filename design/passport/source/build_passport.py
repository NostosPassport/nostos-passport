"""Nostos M1. Run in Blender 5.2; builds a separate scene, retaining all prior scenes.
All dimensions are centimeters. Geometry, materials, text, lights and cameras stay editable.
No external assets; fonts are the same OFL families already used in the app.
"""
import bpy, math, random, os, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
FONTROOT=ROOT.parents[1]/'mobile/node_modules/@expo-google-fonts'
PREFIX='Nostos M1'
SCENE=None
COL=None
M={}

def enum(obj,prop,value):
    allowed=[i.identifier for i in obj.bl_rna.properties[prop].enum_items]
    if value not in allowed: raise ValueError(f'{prop}: {value}, allowed {allowed}')
    setattr(obj,prop,value)

def rgba(hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)

def newcol(name):
    global COL
    COL=bpy.data.collections.new(PREFIX+' / '+name)
    SCENE.collection.children.link(COL)
    return COL

def obj(name,data):
    o=bpy.data.objects.new(name,data); COL.objects.link(o); return o

def mat(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value=rgba(color)
    b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    m.diffuse_color=rgba(color)
    return m,b,m.node_tree.nodes,m.node_tree.links

def ramp(nodes,colors,positions=None):
    n=nodes.new('ShaderNodeValToRGB')
    for i,c in enumerate(colors):
        e=n.color_ramp.elements[i] if i<2 else n.color_ramp.elements.new(i/(len(colors)-1))
        e.position=positions[i] if positions else i/(len(colors)-1)
        e.color=rgba(c)
    return n

def materials():
    global M
    m,b,n,l=mat('Nostos | pebbled black calfskin','111112',.49)
    tc=n.new('ShaderNodeTexCoord')
    v=n.new('ShaderNodeTexVoronoi'); enum(v,'voronoi_dimensions','3D'); enum(v,'feature','DISTANCE_TO_EDGE')
    v.inputs['Scale'].default_value=21
    l.new(tc.outputs['Object'],v.inputs['Vector'])
    r=ramp(n,['0B0B0C','171718','121213'],[0,.17,.48]); l.new(v.outputs['Distance'],r.inputs['Fac']); l.new(r.outputs['Color'],b.inputs['Base Color'])
    bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.45; bump.inputs['Distance'].default_value=.013
    l.new(v.outputs['Distance'],bump.inputs['Height'])
    noise=n.new('ShaderNodeTexNoise'); enum(noise,'noise_dimensions','3D'); noise.inputs['Scale'].default_value=130; noise.inputs['Detail'].default_value=2
    l.new(tc.outputs['Object'],noise.inputs['Vector'])
    micro=n.new('ShaderNodeBump'); micro.inputs['Strength'].default_value=.19; micro.inputs['Distance'].default_value=.003
    l.new(noise.outputs[0],micro.inputs['Height']); l.new(bump.outputs['Normal'],micro.inputs['Normal']); l.new(micro.outputs['Normal'],b.inputs['Normal'])
    b.inputs['Coat Weight'].default_value=.035; b.inputs['Coat Roughness'].default_value=.38
    b.inputs['Specular IOR Level'].default_value=.2
    M['leather']=m
    M['edge']=mat('Nostos | burnished leather edge','24201A',.52)[0]
    M['deboss']=mat('Nostos | impression shadow','070707',.65)[0]
    m,b,n,l=mat('Nostos | warm brass foil','C9A24B',.28,.85)
    noise=n.new('ShaderNodeTexNoise'); enum(noise,'noise_dimensions','3D'); noise.inputs['Scale'].default_value=170
    bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.15; bump.inputs['Distance'].default_value=.002
    l.new(noise.outputs[0],bump.inputs['Height']); l.new(bump.outputs['Normal'],b.inputs['Normal'])
    M['gold']=m
    M['thread']=mat('Nostos | quiet binding thread','776747',.88)[0]
    M['table']=mat('Nostos | charcoal studio','191A1B',.8)[0]
    M['ribbon']=mat('Nostos | woven brass bookmark','8F7434',.83)[0]
    M['paper']=paper('Nostos | warm uncoated paper')

def paper(name,art=None):
    m,b,n,l=mat(name,'E8E4DC',.88)
    tc=n.new('ShaderNodeTexCoord')
    noise=n.new('ShaderNodeTexNoise'); enum(noise,'noise_dimensions','3D'); noise.inputs['Scale'].default_value=120; noise.inputs['Detail'].default_value=2
    l.new(tc.outputs['Object'],noise.inputs['Vector'])
    r=ramp(n,['DDD7C9','E8E4DC'],[.1,.85]); l.new(noise.outputs[0],r.inputs['Fac'])
    if art:
        img=n.new('ShaderNodeTexImage'); img.image=bpy.data.images.load(str(art),check_existing=True); img.image.pack()
        mix=n.new('ShaderNodeMixRGB'); enum(mix,'blend_type','MIX')
        l.new(img.outputs['Alpha'],mix.inputs[0]); l.new(r.outputs['Color'],mix.inputs[1]); l.new(img.outputs['Color'],mix.inputs[2]); l.new(mix.outputs[0],b.inputs['Base Color'])
    else: l.new(r.outputs['Color'],b.inputs['Base Color'])
    bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.2; bump.inputs['Distance'].default_value=.004
    l.new(noise.outputs[0],bump.inputs['Height']); l.new(bump.outputs['Normal'],b.inputs['Normal'])
    b.inputs['Subsurface Weight'].default_value=.025
    b.inputs['Specular IOR Level'].default_value=.16
    return m

def mesh(name,verts,faces,material,uv=None,smooth=False):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=obj(name,me); me.materials.append(material)
    if uv:
        layer=me.uv_layers.new(name='Page UV')
        for poly in me.polygons:
            for li in poly.loop_indices: layer.data[li].uv=uv[me.loops[li].vertex_index]
    for p in me.polygons: p.use_smooth=smooth
    return o

def outline(w,h,r,steps=12):
    pts=[]
    for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(steps+1):
            a=math.radians(start+i*90/steps); pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return pts

def slab(name,cx,cy,w,h,z,t,r,material):
    pts=outline(w,h,r)
    N=len(pts); verts=[(cx+x,cy+y,z+s*t/2) for s in [-1,1] for x,y in pts]
    faces=[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    o=mesh(name,verts,faces,material)
    mod=o.modifiers.new('Soft turned edge','BEVEL'); mod.width=min(t*.22,.035); mod.segments=3
    return o

def line(name,points,material,width=.008,closed=False):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.bevel_depth=width; cu.bevel_resolution=3
    s=cu.splines.new('POLY'); s.points.add(len(points)-1)
    for p,co in zip(s.points,points): p.co=(*co,1)
    s.use_cyclic_u=closed
    o=obj(name,cu); cu.materials.append(material)
    if name.startswith('Foil |') or name.startswith('Cover |'):
        o.scale.z=.2; o.location.z=points[0][2]*.8
    return o

def lettering(name,string,x,y,z,size,material,font='serif',tracking=1):
    cu=bpy.data.curves.new(name,'FONT'); cu.body=string; cu.size=size; cu.align_x='CENTER'; cu.space_character=tracking
    cu.extrude=.0018; cu.bevel_depth=.0007; cu.bevel_resolution=2
    cu.font=FONTS[font]
    o=obj(name,cu); o.location=(x,y,z); cu.materials.append(material); return o

def circle(cx,cy,z,r,n=160): return [(cx+r*math.cos(i*math.tau/n),cy+r*math.sin(i*math.tau/n),z) for i in range(n)]

def emblem(cx,cy,z,r):
    for radius,width in [(1,.011),(.9,.006)]: line('Foil | compass ring',circle(cx,cy,z,r*radius),M['gold'],r*width,True)
    for i in range(48):
        a=i*math.tau/48
        line('Foil | radial tick',[(cx+r*d*math.cos(a),cy+r*d*math.sin(a),z) for d in [.9,.97]],M['gold'],r*.005)
    pts=[]
    for i in range(16):
        a=i*math.pi/8+math.pi/2
        rad=(.8 if i%4==0 else .5) if i%2==0 else .17
        pts.append((cx+r*rad*math.cos(a),cy+r*rad*math.sin(a),z))
    mesh('Foil | original eight-point star',pts,[tuple(range(16))],M['gold'])
    arch=[(cx-r*.07,cy-r*.1,z+.004),(cx+r*.07,cy-r*.1,z+.004),(cx+r*.07,cy+r*.02,z+.004)]
    arch += [(cx+r*.07*math.cos(a),cy+r*.02+r*.07*math.sin(a),z+.004) for a in [i*math.pi/24 for i in range(25)]]
    mesh('Emblem | doorway cutout',arch,[tuple(range(len(arch)))],M['deboss'])

def closed_book():
    newcol('01 Closed passport')
    cx=-22; w=9; h=12.78
    slab('Closed | back leather board',cx,0,w,h,.16,.19,.3,M['leather'])
    slab('Closed | page block',cx+.065,0,w-.35,h-.32,.465,.41,.22,M['paper'])
    for k in range(22):
        z=.282+k*.0168
        pts=outline(w-.35+(k%3)*.005,h-.32,.22)
        line('Closed | individual paper edge',[(cx+.065+x,y,z) for x,y in pts],M['thread'],.0024,True)
    start=set(COL.objects)
    slab('Closed | front leather board',cx,0,w,h,.77,.19,.3,M['leather'])
    # Blind pressed border under the narrower foil line.
    for inset,width in [(.48,.012),(.62,.0045)]:
        pts=outline(w-2*inset,h-2*inset,.2)
        line('Cover | blind impression',[(cx+x,y,.866) for x,y in pts],M['deboss'],width*2,True)
        line('Cover | brass inset rule',[(cx+x,y,.871) for x,y in pts],M['gold'],width,True)
    line('Cover | flexible spine crease',[(cx-4.04,-6.06,.868),(cx-4.11,-3,.868),(cx-4.12,0,.868),(cx-4.11,3,.868),(cx-4.04,6.06,.868)],M['deboss'],.023)
    emblem(cx,.97,.878,2.05)
    lettering('Cover | NOSTOS','NOSTOS',cx,-2.85,.873,1.08,M['gold'],tracking=1.3)
    lettering('Cover | PASSPORT','P A S S P O R T',cx,-3.65,.875,.205,M['gold'],'mono')
    lettering('Cover | NEW YORK','N E W   Y O R K',cx,4.75,.875,.185,M['gold'],'mono')
    lettering('Cover | small edition','A RECORD OF RETURN',cx,-5.15,.875,.145,M['gold'],'mono')
    # Restrained corner burnishing; not scratches through readable foil.
    rng=random.Random(48)
    for side in [-1,1]:
        for i in range(7):
            y=side*(5.96+i*.033)
            line('Cover | corner patina',[(cx+4.13+j*.013,y+side*.02*math.sin(j),.869) for j in range(8)],M['edge'],.003)
    hinge=obj('RIG | cover hinge',None); hinge.location=(cx-w/2,0,.77)
    hinge['open_progress']=0.0; hinge['notes']='0 closed; future motion study rotates about local Y. No keyframes approved yet.'
    bpy.context.view_layer.update()
    for o in set(COL.objects)-start-{hinge}:
        mw=o.matrix_world.copy(); o.parent=hinge; o.matrix_world=mw
    # Rounded spine joins front and back rather than a disconnected slab.
    slab('Closed | soft leather spine',cx-4.39,0,.25,12.55,.46,.62,.1,M['leather'])

def page_z(u,v):
    return .55+.14*math.sin(math.pi*u)-.16*math.exp(-u*16)+.025*(u**5)*(math.cos(v*math.pi)**4)

def page(name,center,sign,material,layer=0):
    nx,ny=64,72; verts=[]; uv=[]
    for j in range(ny+1):
        v=j/ny
        for i in range(nx+1):
            u=i/nx; x=center+sign*(.065+8.65*u); y=(v-.5)*12.48
            # Outer rounded corners on a dense, UV-mapped sheet.
            if u>.97 and abs(y)>6.05:
                y=math.copysign(min(abs(y),6.05+math.sqrt(max(0,.19**2-(8.65*u-8.46)**2))),y)
            verts.append((x,y,page_z(u,v)-layer*.012))
            uv.append((u if sign==1 else 1-u,v))
    faces=[]
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i; q=(a,a+1,a+nx+2,a+nx+1)
            faces.append(q if sign==1 else tuple(reversed(q)))
    o=mesh(name,verts,faces,material,uv,True)
    mod=o.modifiers.new('Real paper thickness','SOLIDIFY'); mod.thickness=.009
    o['page_width_cm']=8.65; o['curl_progress']=0.0; o['notes']='UV mapped deformable sheet; reserve analytic curl for motion study.'
    return o

def open_book():
    newcol('02 Open spread')
    cx=6
    for sign in [-1,1]:
        slab('Open | leather board',cx+sign*4.46,0,8.95,12.79,.14,.16,.23,M['leather'])
        slab('Open | page block',cx+sign*4.42,0,8.7,12.48,.33,.24,.16,M['paper'])
        for layer in range(12,0,-1):
            page(f'Open | {sign} sheet edge {layer:02d}',cx,sign,M['paper'],layer)
        art=ROOT/'source/textures'/f'page-{1 if sign==-1 else 2:02d}-ink.png'
        page(f'Open | printed page {1 if sign==-1 else 2}',cx,sign,paper(f'Nostos | page {sign} printed ink',art))
    # Visible binding channel, tiny signatures and restrained book cloth.
    line('Binding | gutter',[(cx,y,.36) for y in [-6.12,-3,0,3,6.12]],M['deboss'],.021)
    for y in [-4.8,-2.4,0,2.4,4.8]:
        line('Binding | sewn signature',[(cx-.065,y-.06,.392),(cx,y,.403),(cx+.065,y+.06,.392)],M['thread'],.007)

def camera(name,at,target,scale):
    ca=bpy.data.cameras.new(name); ca.type='ORTHO'; ca.ortho_scale=scale
    o=obj(name,ca); o.location=at; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler(); return o

def light(name,at,target,power,size,color):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; enum(d,'shape','DISK'); d.size=size; d.color=color
    o=obj(name,d); o.location=at; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def studio():
    newcol('03 Lighting and cameras')
    slab('Studio | matte charcoal sweep',-7,0,100,90,-.15,.2,1,M['table'])
    for cx in [-22,6]:
        light('Studio | broad key', (cx-7,6,17),(cx,0,0),2100,12,(1,.93,.82))
        light('Studio | soft fill', (cx+9,-3,12),(cx,0,0),1300,10,(.85,.9,1))
        light('Studio | foil strip', (cx-1,9,8),(cx,0,0),950,6,(1,.97,.88))
    cameras={
      'closed':camera('CAM | closed beauty',(-16,-12,28),(-22,0,.4),18),
      'open':camera('CAM | open beauty',(7,-12,31),(6,0,.3),23),
      'closed-front':camera('CAM | closed phone',(-22,0,32),(-22,0,0),15.8),
      'open-front':camera('CAM | open phone',(6,0,32),(6,0,0),20),
      'detail':camera('CAM | foil detail',(-19,0,16),(-22,.7,.75),8.3),
    }
    SCENE.camera=cameras['closed']
    SCENE['render_cameras']=json.dumps({k:v.name for k,v in cameras.items()})

def build():
    global SCENE,FONTS
    if bpy.data.scenes.get(PREFIX): raise RuntimeError('Scene already exists; preserve it before rebuilding.')
    SCENE=bpy.data.scenes.new(PREFIX); bpy.context.window.scene=SCENE
    SCENE.unit_settings.scale_length=.01
    SCENE.render.engine='CYCLES'; SCENE.cycles.samples=48; SCENE.cycles.use_denoising=True
    SCENE.render.resolution_x=1400; SCENE.render.resolution_y=1600; SCENE.render.resolution_percentage=100
    SCENE.render.image_settings.file_format='PNG'
    SCENE.world=bpy.data.worlds.new('Nostos | studio world'); SCENE.world.use_nodes=True
    bg=next(n for n in SCENE.world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs[0].default_value=(.12,.12,.12,1); bg.inputs[1].default_value=.35
    FONTS={
      'serif':bpy.data.fonts.load(str(FONTROOT/'cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf')),
      'mono':bpy.data.fonts.load(str(FONTROOT/'courier-prime/400Regular/CourierPrime_400Regular.ttf'))}
    for f in FONTS.values(): f.pack()
    materials(); closed_book(); open_book(); studio()
    # Keep the source in the .blend too, so provenance survives moving the file.
    t=bpy.data.texts.new('READ ME | Nostos milestone 1')
    t.write('Editable visual study. Original Scene is retained. Cameras: closed/open/front/detail.\nNo motion or app integration is claimed. Assets are original deterministic fixture art.\nRebuild source: design/passport/source/build_passport.py and make_artwork.py.\n')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/nostos-passport-m1.blend'))
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA'
    print('Built',SCENE.name,len(SCENE.objects),'objects; original Scene retained.')

if __name__=='__main__': build()
