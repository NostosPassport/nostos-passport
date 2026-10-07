"""Render review views from the saved .blend using Blender in background mode."""
import bpy, sys, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
scene=bpy.data.scenes['Nostos M1']
views=json.loads(scene['render_cameras'])
def render_view(key):
    scene.camera=bpy.data.objects[views[key]]
    scene.render.resolution_x=1600 if key.startswith('open') else 1200
    scene.render.resolution_y=1200 if key.startswith('open') else 1500
    if key=='detail':
        scene.render.resolution_x=1200; scene.render.resolution_y=1200
    is_front=key.endswith('-front')
    scene.render.film_transparent=is_front
    bpy.data.objects['Studio | matte charcoal sweep'].hide_render=is_front
    formats=[i.identifier for i in scene.render.image_settings.bl_rna.properties['color_mode'].enum_items]
    assert 'RGBA' in formats
    scene.render.image_settings.color_mode='RGBA'
    scene.cycles.samples=48
    scene.render.filepath=str(ROOT/'renders'/f'{key}.png')
    bpy.ops.render.render(write_still=True,scene=scene.name)
    print('RENDERED',key,flush=True)

def queue_views(keys):
    pending=list(keys)
    def tick():
        if not pending:
            scene.render.film_transparent=False
            bpy.data.objects['Studio | matte charcoal sweep'].hide_render=False
            scene.camera=bpy.data.objects[views['closed']]
            bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/nostos-passport-m1.blend'))
            return None
        render_view(pending.pop(0))
        return 1.0
    bpy.app.timers.register(tick,first_interval=1.0)

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['closed','open','detail','closed-front','open-front']
    for key in args: render_view(key)
