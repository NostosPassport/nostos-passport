# Blender -b source/scene_v3_openable.blend -P preview_open.py -- outdir [res_x] [frames comma list]
# Lit preview of the opening using the same studio env + camera as render_preview.py. Never saves the blend.
import bpy, math, sys, os
a = sys.argv[sys.argv.index('--') + 1:]
outdir = a[0]; rx = int(a[1]) if len(a) > 1 else 900
frames = [int(x) for x in a[2].split(',')] if len(a) > 2 else [0, 12, 24, 36, 48]
os.makedirs(outdir, exist_ok=True)
sc = bpy.context.scene
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
root = bpy.data.objects['Passport']
pv = bpy.data.objects.new('pv', None); sc.collection.objects.link(pv)
root.parent = pv
pv.rotation_euler = (math.radians(-12), 0, math.radians(-14))     # slight 3/4 view from the front-left
w = bpy.data.worlds.new('studio'); sc.world = w; w.use_nodes = True; nt = w.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.abspath('export/studio-env.jpg'))
bg = nt.nodes.new('ShaderNodeBackground'); o = nt.nodes.new('ShaderNodeOutputWorld')
mp = nt.nodes.new('ShaderNodeMapping'); tc = nt.nodes.new('ShaderNodeTexCoord')
mp.inputs['Rotation'].default_value = (0, 0, math.radians(90))
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
lp = nt.nodes.new('ShaderNodeLightPath'); mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
mx.inputs[7].default_value = (0.012, 0.009, 0.005, 1)
nt.links.new(lp.outputs['Is Camera Ray'], mx.inputs[0]); nt.links.new(env.outputs['Color'], mx.inputs[6])
nt.links.new(mx.outputs[2], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], o.inputs['Surface'])
cd = bpy.data.cameras.new('c'); cd.lens = 70; cd.sensor_width = 36
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -0.62, 0); cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.engine = 'CYCLES'; sc.cycles.samples = int(os.environ.get('SAMPLES', '48')); sc.cycles.use_denoising = True
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e: print('gpu', e)
sc.render.resolution_x = rx; sc.render.resolution_y = int(rx * 0.8)
sc.view_settings.view_transform = 'Standard'
sc.view_settings.exposure = float(os.environ.get('EXPOSURE', '1.8'))   # the studio env is moody; lift it so shapes read in previews
for f in frames:
    sc.frame_set(f); sc.render.filepath = f'{outdir}/open_{f:02d}.png'; bpy.ops.render.render(write_still=True)
print('PREVIEW DONE', frames)
