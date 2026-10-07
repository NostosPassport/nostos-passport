# Blender -b source/scene_v3_openable.blend -P preview_app_framing.py -- outdir aspect res_x [opens comma list 0..1]
# Reproduces the app's stage camera (three.js: fov 30 vertical, y-up, camera (0,0.03,d) looking at (0,-0.01,0), d eased from 0.42
# to the distance that makes the spread fill 86% of the canvas width) so a phone-shaped canvas can be checked without a phone.
import bpy, math, sys, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
outdir, aspect, rx = a[0], float(a[1]), int(a[2])
opens = [float(x) for x in a[3].split(',')] if len(a) > 3 else [0, .25, .5, .75, 1]
os.makedirs(outdir, exist_ok=True)
FOV, CLOSED, SPREAD_W, FILL = 30.0, 0.42, 0.176, 0.86
smooth = lambda x: (lambda t: t * t * (3 - 2 * t))(max(0, min(1, x)))
def cam_dist(o):
    fit = SPREAD_W / (FILL * 2 * math.tan(math.radians(FOV) / 2) * max(0.2, aspect)); fit = min(1.4, max(0.2, fit))
    return CLOSED + (fit - CLOSED) * smooth(o)
sc = bpy.context.scene
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
w = bpy.data.worlds.new('studio'); sc.world = w; w.use_nodes = True; nt = w.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.abspath('export/studio-env.jpg'))
bg = nt.nodes.new('ShaderNodeBackground'); out = nt.nodes.new('ShaderNodeOutputWorld')
mp = nt.nodes.new('ShaderNodeMapping'); tc = nt.nodes.new('ShaderNodeTexCoord'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(90))
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
lp = nt.nodes.new('ShaderNodeLightPath'); mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs[7].default_value = (0.96, 0.95, 0.91, 1)  # app background (cream) seen by the camera
nt.links.new(lp.outputs['Is Camera Ray'], mx.inputs[0]); nt.links.new(env.outputs['Color'], mx.inputs[6]); nt.links.new(mx.outputs[2], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
cd = bpy.data.cameras.new('c'); cd.sensor_fit = 'VERTICAL'; cd.angle = math.radians(FOV)
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e: print('gpu', e)
sc.render.resolution_x = rx; sc.render.resolution_y = int(rx / aspect)
sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = 1.2
for o in opens:
    sc.frame_set(int(round(o * 48)))
    d = cam_dist(o)
    cam.location = Vector((0, -d, 0.03))                      # three (0, 0.03, d) -> blender (0, -d, 0.03)
    cam.rotation_euler = (Vector((0, 0, -0.01)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{outdir}/f_{int(round(o*100)):03d}.png'; bpy.ops.render.render(write_still=True)
print('FRAMING DONE', aspect, [round(cam_dist(o), 3) for o in opens])
