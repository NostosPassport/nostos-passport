"""Static 390pt layout proposals composed from Blender renders. Not app screenshots."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
R=ROOT/'renders'
S=3
PAPER='#E8E4DC'; BRASS='#C9A24B'; DIM='#A09C94'
SYS='/System/Library/Fonts/SFNS.ttf'
SERIF=str(ROOT.parents[1]/'mobile/node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf')

def font(n,serif=False): return ImageFont.truetype(SERIF if serif else SYS,round(n*S))
def t(d,x,y,string,n=15,color=PAPER,anchor='la',serif=False): d.text((x*S,y*S),string,font=font(n,serif),fill=color,anchor=anchor)
def rect(d,box,fill,outline=None,width=1,r=0):
    d.rounded_rectangle(tuple(round(x*S) for x in box),radius=r*S,fill=fill,outline=outline,width=width*S)
def cutout(name,w):
    im=Image.open(R/name).convert('RGBA'); bounds=im.getchannel('A').getbbox(); im=im.crop(bounds)
    return im.resize((round(w*S),round(im.height*w*S/im.width)),Image.Resampling.LANCZOS)

for state in ['closed','open']:
    im=Image.new('RGB',(390*S,844*S),'#000000');d=ImageDraw.Draw(im)
    t(d,24,20,'9:41',14)
    rect(d,(307,24,312,30),PAPER,r=1);rect(d,(315,21,320,30),PAPER,r=1);rect(d,(323,18,328,30),PAPER,r=1)
    rect(d,(343,20,365,30),None,PAPER,r=3);rect(d,(346,23,361,27),PAPER,r=1)
    t(d,24,76,'Your passport',31,serif=True)
    # Familiar settings gear, rendered as original vector strokes for this mock.
    import math
    for i in range(8):
        a=math.tau*i/8
        d.line([(int((354+7*math.cos(a))*S),int((93+7*math.sin(a))*S)),(int((354+11*math.cos(a))*S),int((93+11*math.sin(a))*S))],fill=BRASS,width=3*S)
    d.ellipse((348*S,87*S,360*S,99*S),outline=BRASS,width=2*S)
    t(d,24,119,'A record of the places you return to.',14,DIM)
    if state=='closed':
        book=cutout('closed-front.png',286); im.paste(book,(52*S,183*S),book)
        t(d,195,621,'Tap to open',14,DIM,'ma')
        for x,num,label in [(76,'6','STAMPS'),(195,'6','PLACES'),(314,'5','NEIGHBORHOODS')]:
            t(d,x,659,num,28,BRASS,'ma',True);t(d,x,696,label,10,DIM,'ma')
    else:
        book=cutout('open-front.png',358);im.paste(book,(16*S,183*S),book)
        t(d,37,463,'‹',29,BRASS,'ma');t(d,195,472,'Index · Pages 1 and 2',14,BRASS,'ma');t(d,353,463,'›',29,BRASS,'ma')
        t(d,24,522,'ON THESE PAGES',11,DIM)
        names=[('Washington Square','Central Park'),('The Strand','The Met'),('Caffe Reggio','The High Line')]
        for row,items in enumerate(names):
            y=553+row*48
            for col,name in enumerate(items):
                x=24+col*181
                t(d,x,y,name,15)
                d.line((x*S,(y+34)*S,(x+157)*S,(y+34)*S),fill='#24201A',width=S)
        t(d,24,710,'Tap a stamp or a place name to open a memory.',12,DIM)
    d.line((0,755*S,390*S,755*S),fill='#24201A',width=S)
    t(d,70,780,'Passport',13,BRASS,'ma')
    rect(d,(173,765,217,809),BRASS,r=22);t(d,195,770,'+',28,'#000000','ma')
    t(d,320,780,'Map',13,DIM,'ma')
    rect(d,(130,830,260,834),PAPER,r=2)
    im.save(R/f'phone-{state}-3x.png')
    im.resize((390,844),Image.Resampling.LANCZOS).save(R/f'phone-{state}-390.png')

# Neutral review plate. Phone panels retain a 390px width at 1x.
board=Image.new('RGB',(846,954),'#171718');d=ImageDraw.Draw(board)
f=ImageFont.truetype(SYS,17)
d.text((24,18),'NOSTOS  /  PHONE-SCALE LAYOUT STUDY',font=f,fill=PAPER)
d.text((24,44),'Static proposal, not a running app. Full names remain outside miniature stamps.',font=ImageFont.truetype(SYS,12),fill=DIM)
for x,state in [(24,'closed'),(432,'open')]: board.paste(Image.open(R/f'phone-{state}-390.png'),(x,82))
board.save(R/'phone-scale-review.png')
print('Created 390px and 3x layout proposals plus phone-scale review plate.')
