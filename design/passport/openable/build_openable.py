"""STEP 1 of 2 (then run export_openable.py): build the OPENABLE passport from scene_v2_realtime.blend.

Run inside Blender (live MCP session or `Blender -b -P build_openable.py`). Reads v2, writes ONLY
source/scene_v3_openable.blend; the original v2 file and export/passport.glb are never modified.

The v2 passport is one mesh made of four closed shells: front cover board, back cover board, spine, page block.
We split the front board off as `CoverFront` (rigid, hinged at the spine edge) and keep everything else as `Body`,
parent both under an empty `Passport`, and key one clip, `open`, of:
  * CoverFront rotating -180 deg about the vertical spine-edge axis (swings toward the viewer, ends flat, coplanar
    with the back cover), eased in/out
  * the Passport root sliding +44 mm so the opened two-page spread ends centred
The close animation is the same clip played backwards.
"""
import math
import os
from collections import defaultdict

import bmesh
import bpy
from mathutils import Matrix

HERE = os.environ.get("NOSTOS_BLENDER") or os.path.expanduser("~/nostos-blender")  # folder that holds source/, tex/, export/
SRC = f"{HERE}/source/scene_v2_realtime.blend"
DST = f"{HERE}/source/scene_v3_openable.blend"
HINGE_X = -0.044          # spine edge of the front board (metres)
OPEN_ANGLE = math.radians(180)
FPS = 24
F_START, F_END = 0, 48    # 2.0 s at 24 fps; frame 0 = closed so the clip starts at t=0

bpy.ops.wm.open_mainfile(filepath=SRC)
bpy.ops.wm.save_as_mainfile(filepath=DST)  # from here on we only ever write v3
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = F_START, F_END

src = bpy.data.objects["Passport"]
src_me = src.data
mats = list(src_me.materials)

# ---- split the single mesh into shells
bm = bmesh.new()
bm.from_mesh(src_me)
bm.verts.ensure_lookup_table()
parent = list(range(len(bm.verts)))


def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]
        a = parent[a]
    return a


for f in bm.faces:
    vs = [v.index for v in f.verts]
    for v in vs[1:]:
        parent[find(v)] = find(vs[0])
shells = defaultdict(list)
for f in bm.faces:
    shells[find(f.verts[0].index)].append(f.index)
bm.free()


def shell_max_y(face_ids):
    return max((src.matrix_world @ src_me.vertices[vi].co).y for fi in face_ids for vi in src_me.polygons[fi].vertices)


front_ids = next(ids for ids in shells.values() if shell_max_y(ids) < -0.0015)  # the board entirely on the viewer's side
front_set = set(front_ids)


def make_part(name, keep_front):
    b = bmesh.new()
    b.from_mesh(src_me)
    b.faces.ensure_lookup_table()
    drop = [f for f in b.faces if (f.index in front_set) != keep_front]
    bmesh.ops.delete(b, geom=drop, context="FACES")
    b.verts.ensure_lookup_table()
    bmesh.ops.delete(b, geom=[v for v in b.verts if not v.link_faces], context="VERTS")
    me = bpy.data.meshes.new(name)
    b.to_mesh(me)
    b.free()
    for m in mats:  # same slot order, so the baked material_index values stay valid
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


cover = make_part("CoverFront", True)
body = make_part("Body", False)

# ---- hinge pivot at the spine edge: move the origin there without moving the geometry
cover.data.transform(Matrix.Translation((-HINGE_X, 0, 0)))
cover.location = (HINGE_X, 0, 0)

# ---- root empty named Passport (the old single mesh is retired)
src.name = "Passport_v2_single_mesh"
root = bpy.data.objects.new("Passport", None)
root.empty_display_type = "PLAIN_AXES"
scene.collection.objects.link(root)
cover.parent = root
body.parent = root
for ob in (cover, body):
    ob.matrix_parent_inverse = Matrix.Identity(4)
for ob in (cover, body):
    for p in ob.data.polygons:
        p.use_smooth = src_me.polygons[0].use_smooth  # keep v2 shading mode
bpy.data.objects.remove(src, do_unlink=True)

# ---- interior: two thin planes so the opened spread looks like the app's 2D pages (textures from make_interior_textures.py)
# They sit 0.1 mm proud of the inner surfaces: inside the book (hidden) when closed, visible once the cover swings open.
PAGE_W, PAGE_H = 0.043, 0.062   # half sizes: 86 x 124 mm
LIFT = 0.0001


def paper_material(name, image_path):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(image_path)
    tex.image.colorspace_settings.name = "sRGB"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.88
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def make_plane(name, parent, location, facing_plus_y, mirror_u, material):
    me = bpy.data.meshes.new(name)
    w, h = PAGE_W, PAGE_H
    verts = [(-w, 0, -h), (w, 0, -h), (w, 0, h), (-w, 0, h)]
    faces = [(0, 3, 2, 1)] if facing_plus_y else [(0, 1, 2, 3)]   # (0,1,2,3) winds toward -Y
    me.from_pydata(verts, [], faces)
    me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    for loop in me.loops:
        x, _, z = me.vertices[loop.vertex_index].co
        u = 0.5 + x / (2 * w)
        uv[loop.index].uv = (1 - u if mirror_u else u, 0.5 + z / (2 * h))
    me.materials.append(material)
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.location = location
    return ob


lining_mat = paper_material("InsideLining", f"{HERE}/tex/interior_left.png")
bearer_mat = paper_material("BearerPage", f"{HERE}/tex/interior_right.png")
# CoverFront's origin is the hinge (x=-44 mm), so its inner face centre (world x=0, y=-1.6 mm) is at local (+44, -1.6+lift)
lining = make_plane("InsideLining", cover, (-HINGE_X, -0.0016 + LIFT, 0), facing_plus_y=True, mirror_u=True, material=lining_mat)
bearer = make_plane("BearerPage", body, (0, -0.0016 - LIFT, 0), facing_plus_y=False, mirror_u=False, material=bearer_mat)
for ob, want in ((lining, 1), (bearer, -1)):   # sanity: each plane must face the way we think
    n = ob.data.polygons[0].normal
    assert n.y * want > 0.99, f"{ob.name} faces the wrong way: {tuple(n)}"

# ---- keyframes: one clip named "open"
for ob in (cover, root):
    ob.animation_data_create()


def key(ob, path, index, frame, value):
    setattr_target = getattr(ob, path)
    setattr_target[index] = value
    ob.keyframe_insert(data_path=path, index=index, frame=frame)


cover.rotation_mode = "XYZ"
key(cover, "rotation_euler", 2, F_START, 0.0)
key(cover, "rotation_euler", 2, F_END, -OPEN_ANGLE)
key(root, "location", 0, F_START, 0.0)
key(root, "location", 0, F_END, -HINGE_X)  # +44 mm: centres the opened spread (spans x -132..44 mm)

for ob in (cover, root):
    ad = ob.animation_data
    ad.action.name = f"open_{ob.name}"
    track = ad.nla_tracks.new()
    track.name = "open"                       # same track name on both objects -> ONE glTF animation called "open"
    track.strips.new("open", F_START, ad.action)
    ad.action = None

scene.frame_set(F_START)
bpy.ops.wm.save_mainfile()

print("BUILT", DST, "| cover verts", len(cover.data.vertices), "body verts", len(body.data.vertices))
