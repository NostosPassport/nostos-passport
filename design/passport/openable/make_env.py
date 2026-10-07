# studio-env.jpg: equirect 1024x512 dark warm studio. Image centre = direction behind the viewer ("front"), edges = behind the object.
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
W,H=1024,512
u=(np.arange(W)+.5)/W; v=(np.arange(H)+.5)/H
az=(u-0.5)*360          # degrees, 0 = centre
el=(0.5-v)*180
AZ,EL=np.meshgrid(az,el)
room=np.array([21,17,11],float)/255
img=np.ones((H,W,3))*room
# faint vertical room gradient: slightly lighter walls near horizon, darker floor
g=np.clip(1-np.abs(EL)/70,0,1)[...,None]*(0.5+0.5*np.cos(np.radians(AZ)))[...,None]
img+= g*np.array([34,28,20])/255
img*=np.where(EL<0,0.55+0.45*np.exp(EL/25),1.0)[...,None]
def add(mask,col,soft):
    m=gaussian_filter(mask.astype(float),soft,mode='wrap')[...,None]
    global img
    img=img*(1-m)+np.array(col)/255*m
white=np.array([213,209,203],float)
# overhead softbox (large)
add((EL>34)&(np.abs(AZ)<110),white*1.0,7)
# strip lights left/right (long vertical)
for a in (-85,85): add((np.abs(AZ-a)<9)&(EL>-35)&(EL<65),white*0.9,9)
# thin rim behind (at image edges)
add(((np.abs(AZ)>172))&(EL>-10)&(EL<55),white*0.95,2)
# low warm kicker, front-left low
add((np.abs(AZ+35)<14)&(EL>-18)&(EL<2),np.array([200,150,95]),4)
img=np.clip(img,0,1)
out=(img*255).round().astype(np.uint8)
out=np.minimum(out,246)
Image.fromarray(out).save('export/studio-env.jpg',quality=88)
print(out.max(),out.reshape(-1,3).mean(0))
