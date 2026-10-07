"""Specimen interior textures that match the app's 2D pages (PageStock / InsideCover / BearerPage) so the 3D opened
spread and the 2D reader look like the same book when they cross-fade.

  python3 make_interior_textures.py     ->  tex/interior_left.png (inside of the front cover), tex/interior_right.png (bearer page)

Values come from ~/nostos-codex/mobile/src/theme/midnight.ts and book/PageStock.tsx, BearerPage.tsx, InsideCover.tsx.
The right page is a SPECIMEN (placeholder values); the app's 2D reader shows the real bearer data right after the handoff.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.environ.get("NOSTOS_BLENDER") or os.path.expanduser("~/nostos-blender")  # folder that holds source/, tex/, export/
FONTS = os.path.join(os.environ.get("NOSTOS_REPO") or os.path.expanduser("~/nostos-codex"), "mobile/node_modules/@expo-google-fonts")  # needs `npm install` in mobile/
SERIF = f"{FONTS}/cormorant-garamond/500Medium/CormorantGaramond_500Medium.ttf"
MONO = f"{FONTS}/courier-prime/400Regular/CourierPrime_400Regular.ttf"

# page is 86 x 124 mm; 9 px/mm
W, H = 774, 1116
S = W / 175.0  # the app's page is ~175 dp wide on a phone; all dp values below scale by S

SURFACE = (243, 239, 229)       # colors.surface  #F3EFE5
ELEVATED = (238, 233, 221)      # colors.elevated #EEE9DD
INK = (23, 23, 20)              # textPrimary / hairline base
DIM = (90, 90, 85)              # dimBrass #5A5A55
FAINT = (116, 116, 110)         # boneFaint #74746E
ACCENT = (18, 59, 255)          # brass (cobalt) #123BFF


def over(bg, fg, alpha):
    return tuple(int(round(b * (1 - alpha) + f * alpha)) for b, f in zip(bg, fg))


FS = 0.62  # the app's type is fixed in points (not proportional to the page), so scale type less than layout


def font(path, dp):
    return ImageFont.truetype(path, max(8, int(round(dp * S * FS))))


def text_w(d, text, f, tracking=0.0):
    return sum(f.getlength(c) + tracking for c in text) - tracking


def draw_tracked(d, x, y, text, f, fill, tracking=0.0):
    for c in text:
        d.text((x, y), c, font=f, fill=fill)
        x += f.getlength(c) + tracking


def centered(d, cx, y, text, f, fill, tracking=0.0):
    draw_tracked(d, cx - text_w(d, text, f, tracking) / 2, y, text, f, fill, tracking)


def page_stock(spine):
    """PageStock: surface color, 0.6dp hairline inset 4% of the width, and a soft fold gradient on the spine side."""
    im = Image.new("RGB", (W, H), SURFACE)
    d = ImageDraw.Draw(im)
    m = round(W * 0.04)
    d.rectangle((m, m, W - m, H - m), outline=over(SURFACE, INK, 0.38), width=max(2, round(0.6 * S)))
    gutter = max(5, round(175 * 0.032)) * S
    arr = np.asarray(im).astype(np.float32)
    xs = np.arange(W, dtype=np.float32)
    t = (xs / gutter) if spine == "left" else ((W - 1 - xs) / gutter)   # 0 at the spine edge -> 1 at the gutter's end
    a = np.where(t < 0.45, 0.09 + (0.035 - 0.09) * (t / 0.45), 0.035 * (1 - np.clip((t - 0.45) / 0.55, 0, 1)))
    a = np.where(t >= 1, 0, a)[None, :, None]
    arr = arr * (1 - a) + np.array(INK, np.float32) * a
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


# ---- left: inside of the front cover (InsideCover.tsx)
left = page_stock("right")
d = ImageDraw.Draw(left)
serif_label, typewriter_small = font(SERIF, 18), font(MONO, 12)
cy = H / 2
centered(d, W / 2, cy - 1.2 * serif_label.size, "NOSTOS", serif_label, DIM, tracking=1.5 * S * FS)
centered(d, W / 2, cy + 0.15 * serif_label.size, "the longing to return home", typewriter_small, FAINT, tracking=0.5 * S * FS)

# ---- right: bearer page (BearerPage.tsx), specimen values
right = page_stock("left")
d = ImageDraw.Draw(right)
pad = round(W * 0.09)
accent_label = over(SURFACE, ACCENT, 0.68)
centered(d, W / 2, pad, "NOSTOS PASSPORT", serif_label, accent_label, tracking=1.5 * S * FS)
photo_w = round(W * 0.3)
photo_h = round(photo_w * 1.25)
top = pad + serif_label.size * 1.2 + 24 * S / 4
d.rectangle((pad, top, pad + photo_w, top + photo_h), fill=ELEVATED, outline=DIM, width=max(2, round(1 * S)))
cx, cy_ = pad + photo_w / 2, top + photo_h / 2   # empty portrait frame: a simple bust silhouette, like a specimen
r = photo_w * 0.16
d.ellipse((cx - r, cy_ - photo_h * 0.18 - r, cx + r, cy_ - photo_h * 0.18 + r), fill=over(ELEVATED, DIM, 0.22))
d.ellipse((cx - photo_w * 0.30, cy_ - photo_h * 0.02, cx + photo_w * 0.30, cy_ + photo_h * 0.46), fill=over(ELEVATED, DIM, 0.22))
typewriter = font(MONO, 15)
fx = pad + photo_w + 12 * S
fy = top
for label, value in [("NAME", "Your Name"), ("HANDLE", "@handle"), ("PASSPORT NO.", "N0000 0000"), ("ISSUED", "1 Jan 2026")]:
    d.text((fx, fy), label, font=typewriter_small, fill=DIM)
    d.text((fx, fy + typewriter_small.size * 1.15), value, font=typewriter, fill=over(SURFACE, INK, 0.55))
    fy += typewriter_small.size * 1.15 + typewriter.size * 1.5 + 4 * S
# machine-readable zone, two lines at the bottom, shrunk to fit like adjustsFontSizeToFit
mrz = ["P<NYCYOURNAME<<<<<<<<<<<<<<<<<<<<<<<<<<<<", "N00000000<0NYC260101<<<<<<<<<<<<<<<<<<<<<<<<"]
inner = W - 2 * pad
mz = ImageFont.truetype(MONO, int(inner / (len(mrz[0]) * 0.6)))
for i, line in enumerate(mrz):
    d.text((pad, H - pad - (2 - i) * mz.size * 1.35), line, font=mz, fill=FAINT)

os.makedirs(f"{HERE}/tex", exist_ok=True)
left.save(f"{HERE}/tex/interior_left.png", optimize=True)
right.save(f"{HERE}/tex/interior_right.png", optimize=True)
for n in ("interior_left", "interior_right"):
    print(n, os.path.getsize(f"{HERE}/tex/{n}.png") // 1024, "KB", (W, H))
