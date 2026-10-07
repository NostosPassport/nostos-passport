"""Original 96 BPM instrumental; no samples or external music. Deterministic synthesis."""
import numpy as np, wave
from pathlib import Path
sr=44100; duration=20; beat=60/96
mix=np.zeros((sr*duration,2),dtype=np.float64)
def note(midi,start,length,amp,pan=0):
 n=int(length*sr); t=np.arange(n)/sr; f=440*2**((midi-69)/12)
 # Warm struck tine: soft FM attack, rounded harmonic tail.
 env=(1-np.exp(-t*80))*np.exp(-t*2.0/length)
 v=(np.sin(2*np.pi*f*t+.85*np.exp(-t*3)*np.sin(2*np.pi*f*2*t))+.18*np.sin(2*np.pi*f*3*t))*env*amp
 i=int(start*sr);n=min(n,len(mix)-i)
 if n>0:mix[i:i+n,0]+=v[:n]*(1-pan*.35);mix[i:i+n,1]+=v[:n]*(1+pan*.35)
chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,60]]
for bar in range(8):
 st=bar*4*beat; chord=chords[bar%4]
 for j,m in enumerate(chord):note(m+12,st+j*.035,2.45,.052,(-1)**j*.7)
 note(chord[0]-12,st,1.5,.08)
 for j in range(4):note(chord[[1,2,3,2][j]]+24,st+j*beat,1.15,.04,(-1)**j*.6)
for k in range(32):
 start=k*beat;i=int(start*sr);t=np.arange(int(.17*sr))/sr
 v=.075*np.sin(2*np.pi*(48*t+30*(1-np.exp(-t*25))/25))*np.exp(-t*30)
 if k%2==0:mix[i:i+len(v),:]+=v[:,None]
# Quiet patterned hats; original deterministic synthesized noise.
rng=np.random.default_rng(20261006)
for k in range(64):
 i=int(k*beat/2*sr);t=np.arange(int(.065*sr))/sr
 v=rng.normal(0,.012 if k%2 else .018,len(t))*np.exp(-t*90)
 mix[i:i+len(v),:]+=v[:,None]
# Small stereo echoes and a gentle beginning/end.
original=mix.copy()
for delay,gain in [(0.19,.12),(.38,.065)]:
 n=int(delay*sr);mix[n:]+=original[:-n,::-1]*gain
fadein=np.minimum(np.arange(len(mix))/sr/.25,1)
fadeout=np.clip((duration-np.arange(len(mix))/sr)/1.4,0,1)
mix*=fadein[:,None]*fadeout[:,None]
mix=np.tanh(mix*1.3);mix*=.55/max(np.max(np.abs(mix)),1e-6)
p=Path(__file__).parent/'composition/assets/audio/nostos-original.wav'
with wave.open(str(p),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((mix*32767).astype('<i2').tobytes())
print(p)
