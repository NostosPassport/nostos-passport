"""Deterministic original page art; editable Pillow drawing source, no external images.
These fixture page maps are Blender review art, not production user-content assets.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import math, random, json

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'source' / 'textures'
ASSETS.mkdir(exist_ok=True)
FONTS = ROOT.parents[1] / 'mobile/node_modules/@expo-google-fonts'
SERIF = str(FONTS / 'cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf')
MONO = str(FONTS / 'courier-prime/400Regular/CourierPrime_400Regular.ttf')
W,H = 1536,2182
INK=(47,43,35,245)
LIGHT=(128,115,83,80)

def font(size, mono=False): return ImageFont.truetype(MONO if mono else SERIF, size)
def text(draw,xy,s,size,fill=INK,mono=False):
    draw.text(xy,s,font=font(size,mono),fill=fill,anchor='mm')

def stamp(name,area,date,kind,seed):
    rng=random.Random(seed)
    im=Image.new('RGBA',(720,650)); d=ImageDraw.Draw(im)
    if kind=='round':
        d.ellipse((66,34,654,622),outline=INK,width=9)
        d.ellipse((82,50,638,606),outline=INK,width=3)
        for i in range(48):
            a=i*math.tau/48
            d.line([(360+271*math.cos(a),328+271*math.sin(a)),(360+281*math.cos(a),328+281*math.sin(a))],fill=INK,width=2)
        text(d,(360,135),'N O S T O S',27,mono=True)
        text(d,(360,498),date,25,mono=True)
        text(d,(360,547),area.upper(),22,mono=True)
    elif kind=='ticket':
        d.rounded_rectangle((30,98,690,552),radius=18,outline=INK,width=10)
        d.rounded_rectangle((44,112,676,538),radius=9,outline=INK,width=3)
        d.line((46,178,674,178),fill=INK,width=3)
        text(d,(360,148),'N O S T O S   /   NEW YORK',25,mono=True)
        d.line((46,464,674,464),fill=INK,width=3)
        text(d,(360,499),date+'  /  '+area.upper(),20,mono=True)
    else:
        d.ellipse((22,109,698,550),outline=INK,width=8)
        d.ellipse((40,125,680,534),outline=INK,width=3)
        text(d,(360,172),'NEW YORK  /  NOSTOS',24,mono=True)
        text(d,(360,462),area.upper(),23,mono=True)
        text(d,(360,496),date,23,mono=True)
    # Doorway or compass from original Nostos visual vocabulary.
    cx,cy=360,245
    if seed%2:
        pts=[]
        for i in range(16):
            a=i*math.pi/8-math.pi/2
            r=(36 if i%4==0 else 24) if i%2==0 else 8
            pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
        d.polygon(pts,fill=INK)
    else:
        d.arc((cx-23,cy-33,cx+23,cy+13),180,360,fill=INK,width=5)
        d.line((cx-23,cy-10,cx-23,cy+26,cx+23,cy+26,cx+23,cy-10),fill=INK,width=5)
    lines=name.split('|')
    for i,s in enumerate(lines): text(d,(360,325+i*64-(len(lines)-1)*18),s,64)
    # Patchy ink coverage, deliberately restrained around the name.
    alpha=Image.new('L',im.size,255); ad=ImageDraw.Draw(alpha)
    for _ in range(2500):
        x,y=rng.randrange(720),rng.randrange(650)
        r=rng.choice([.5,.7,1,1.4,2])
        ad.ellipse((x-r,y-r,x+r,y+r),fill=rng.randrange(35,155))
    im.putalpha(ImageChops.multiply(im.getchannel('A'),alpha))
    return im

DATA=[
 [('WASHINGTON|SQUARE','Greenwich Village','12 SEP 2026','round',1,-7),('THE STRAND','Union Square','18 SEP 2026','ticket',2,5),('CAFFE REGGIO','Greenwich Village','20 SEP 2026','oval',3,-4)],
 [('CENTRAL PARK','Manhattan','24 SEP 2026','oval',4,6),('THE MET','Upper East Side','28 SEP 2026','round',5,-6),('THE HIGH LINE','Chelsea','02 OCT 2026','ticket',6,4)]
]
for page,items in enumerate(DATA,1):
    im=Image.new('RGBA',(W,H)); d=ImageDraw.Draw(im)
    # Print-like fine rules and subdued guilloche.
    d.rectangle((80,85,W-80,H-85),outline=(117,102,70,62),width=2)
    for k in range(9):
        pts=[]
        for i in range(720):
            t=i/719*math.tau*3
            r=330+25*math.cos(17*t+k*.13)
            pts.append((W/2+r*math.cos(t),H/2+r*math.sin(t)))
        d.line(pts,fill=(157,144,108,23),width=1)
    text(d,(W/2,135),'P L A C E S   T O   R E T U R N   T O',25,(111,99,75,180),True)
    for idx,(name,area,date,kind,seed,rot) in enumerate(items):
        mark=stamp(name,area,date,kind,seed)
        mark.save(ASSETS/f'stamp-{seed:02d}.png')
        mark=mark.rotate(rot,resample=Image.Resampling.BICUBIC,expand=True)
        cx=[610,890,635][idx] if page==1 else [875,640,890][idx]
        cy=[500,1110,1730][idx]
        im.alpha_composite(mark,(int(cx-mark.width/2),int(cy-mark.height/2)))
    text(d,(W/2,H-135),'NOSTOS  /  NEW YORK',23,(111,99,75,175),True)
    text(d,(130 if page==1 else W-130,H-135),f'{page:02d}',30,(85,73,51,220),True)
    im.save(ASSETS/f'page-{page:02d}-ink.png')
(ROOT/'source/fixture-data.json').write_text(json.dumps(DATA,indent=2))
print('Created two original transparent page maps and six separate stamp masters.')
