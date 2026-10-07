# Bakes engraving art -> normal map + roughness(ORM) atlas 2048x2048, plus page-edge texture. Original artwork only.
import numpy as np, math
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter
W_MM,H_MM=88.0,125.0
SS=2; PY=2048*SS; S=PY/H_MM; PX=int(round(W_MM*S))
FONT=('/System/Library/Fonts/Avenir Next.ttc',5)
def mm(x): return x*S
def art(mirror):
    im=Image.new('L',(PX,PY),0); d=ImageDraw.Draw(im)
    cx=46.5 if not mirror else W_MM-46.5   # centre of the panel right of the hinge groove
    L,R=(9,84) if not mirror else (W_MM-84,W_MM-9)
    lw=0.32
    def rr(x0,y0,x1,y1,r,w):
        d.rounded_rectangle([mm(x0),mm(y0),mm(x1),mm(y1)],radius=mm(r),outline=255,width=max(2,int(mm(w))))
    rr(L,4,R,121,2.6,lw)
    def ring(x,y,r,w): d.ellipse([mm(x-r),mm(y-r),mm(x+r),mm(y+r)],outline=255,width=max(2,int(mm(w))))
    def emblem(x,y,k):
        ring(x,y,13*k,0.55); ring(x,y,11*k,0.25)
        pts=[]
        for i in range(32):
            a=math.pi*2*i/32-math.pi/2; r=(9.2 if i%2==0 else 4.2)*k
            if i%8==0: r=10.4*k
            pts.append((mm(x+r*math.cos(a)),mm(y+r*math.sin(a))))
        d.polygon(pts,fill=255)
        d.ellipse([mm(x-2.4*k),mm(y-2.4*k),mm(x+2.4*k),mm(y+2.4*k)],fill=0)
        d.ellipse([mm(x-1.1*k),mm(y-1.1*k),mm(x+1.1*k),mm(y+1.1*k)],fill=255)
        # horizon arc under the star: a rising-sea line
        d.arc([mm(x-17*k),mm(y-5*k),mm(x+17*k),mm(y+29*k)],200,340,fill=255,width=max(2,int(mm(0.3))))
    if not mirror:
        emblem(cx,46,1.0)
        f=ImageFont.truetype(FONT[0],int(mm(5.4)),index=FONT[1])
        t='NOSTOS'; track=mm(1.3)
        ws=[d.textlength(c,font=f) for c in t]; tot=sum(ws)+track*(len(t)-1)
        x=mm(cx)-tot/2
        for c,w in zip(t,ws):
            d.text((x,mm(76)),c,font=f,fill=255,stroke_width=int(mm(0.12))); x+=w+track
        # chip glyph: plain circle in rounded rectangle
        rr(cx-5.5,100,cx+5.5,108.5,1.8,0.3); ring(cx,104.25,2.3,0.3)
    else:
        emblem(cx,62.5,1.5)
    return np.asarray(im.resize((1024,2048),Image.LANCZOS),dtype=np.float32)/255
front=art(False); back=art(True)   # row 0 = top of cover in view
mask=np.hstack([front,back])       # image top half = front (v 0.5..1), bottom half = back
# height in mm (engraved = lower), chamfered edge from smoothing
h=-0.07*gaussian_filter(mask,1.6)
pxmm_u=1024/W_MM; pxmm_v=2048/H_MM
dhdu=np.gradient(h,axis=1)*pxmm_u
dhdv=-np.gradient(h,axis=0)*pxmm_v      # v up
k=3.0
n=np.dstack([-dhdu*k,-dhdv*k,np.ones_like(h)])
n/=np.linalg.norm(n,axis=2,keepdims=True)
nm=((n*0.5+0.5)*255).round().astype(np.uint8)
# ORM: R=1 (unused), G=roughness, B=metallic. mirror 0.045, engraved satin 0.42
m=gaussian_filter(mask,0.9)
rough=0.045+(0.42-0.045)*np.clip(m*1.2,0,1)
orm=np.dstack([np.full_like(h,255),rough*255,np.full_like(h,0.25*255)]).round().astype(np.uint8)
Image.fromarray(nm).save('tex/passport_normal.png',optimize=True)
Image.fromarray(orm).save('tex/passport_orm.png',optimize=True)
# page block edge: fine page layers, #3D3933 .. #817D78
rng=np.random.default_rng(3)
Hh=256; lines=rng.random(Hh); lines=gaussian_filter(lines,0.8)
lines=(lines-lines.min())/(lines.max()-lines.min())
lo=np.array([0x3D,0x39,0x33],float); hi=np.array([0x81,0x7D,0x78],float)
col=lo+(hi-lo)*(0.25+0.6*lines[:,None])
page=np.repeat(col[:,None,:],64,axis=1)
Image.fromarray(page.round().astype(np.uint8)).save('tex/page_edge.png')
print('ok')
