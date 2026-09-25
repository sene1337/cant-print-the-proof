"""Turns public-domain museum photos into textures for the film.

Sources (all public domain or CC0, from Wikimedia Commons; see tex/CREDITS.md):
  stater.jpg        gold stater of Philip II, The Met (CC0)
  denarius.jpg      silver denarius of Octavian, The Met (CC0)
  double_eagle.jpg  1907 Saint-Gaudens double eagle (public domain)
  moon.jpg          full moon (public domain)
  mingnote.jpg      Da Ming Tongxing Baochao paper note (public domain)
  rai.jpg           rai stone, Smithsonian NMNH (CC0)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    '~/media/projects/history-of-money-song/video/pow/sources')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tex')
os.makedirs(OUT, exist_ok=True)


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


def coin_box(im, mode):
    a = np.asarray(im).astype(np.float32) / 255
    if mode == 'sat':
        mx, mn = a.max(2), a.min(2)
        mask = (mx - mn) / (mx + 1e-4) > 0.28
    else:
        border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
        bg = np.median(border, 0)
        mask = np.linalg.norm(a - bg, axis=2) > 0.09
    rows = mask.mean(1)
    cols = mask.mean(0)
    ys = np.where(rows > 0.18 * rows.max())[0]
    xs = np.where(cols > 0.18 * cols.max())[0]
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = max(x1 - x0, y1 - y0) / 2
    return cx, cy, r


def circle_mask(n, frac=1.0, soft=3):
    y, x = np.mgrid[0:n, 0:n]
    d = np.hypot(x - (n - 1) / 2, y - (n - 1) / 2) / (n / 2)
    return np.clip((frac - d) * n / (2 * soft), 0, 1)


def coin(name, src, mode, size=1024):
    im = load(src)
    cx, cy, r = coin_box(im, mode)
    r *= 1.01
    crop = im.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))).resize((size, size), Image.LANCZOS)
    g = ImageOps.grayscale(crop)
    g = ImageOps.autocontrast(g, cutoff=1)
    g = g.filter(ImageFilter.GaussianBlur(1.2))
    m = circle_mask(size, 0.985)
    h = np.asarray(g).astype(np.float32) / 255
    # Flatten large-scale lighting so the bump map is mostly relief, not the photo's light falloff.
    low = np.asarray(g.filter(ImageFilter.GaussianBlur(size / 10))).astype(np.float32) / 255
    rel = np.clip(0.5 + (h - low) * 1.6, 0, 1)
    rel = rel * m + 0.5 * (1 - m)
    Image.fromarray((rel * 255).astype(np.uint8)).save(os.path.join(OUT, f'{name}_height.png'))
    # Cavity map: darkens recesses, used to modulate colour.
    cav = np.clip(0.55 + 0.45 * h, 0, 1) * m + (1 - m)
    Image.fromarray((cav * 255).astype(np.uint8)).save(os.path.join(OUT, f'{name}_cavity.png'))
    crop.save(os.path.join(OUT, f'{name}_photo.jpg'), quality=90)
    print(name, 'ok', (round(cx), round(cy), round(r)))


coin('stater', 'stater.jpg', 'sat')
coin('eagle', 'double_eagle.jpg', 'sat')
coin('denarius', 'denarius.jpg', 'bg')

# Moon disc on black.
moon = load('moon.jpg')
cx, cy, r = coin_box(moon, 'bg')
mc = moon.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))).resize((1024, 1024), Image.LANCZOS)
mm = circle_mask(1024, 0.995)[..., None]
Image.fromarray((np.asarray(mc) * mm).astype(np.uint8)).save(os.path.join(OUT, 'moon.jpg'), quality=90)
print('moon ok')

# Paper note: keep as is, trimmed and levelled.
note = load('mingnote.jpg')
note = ImageOps.autocontrast(note, cutoff=0.5)
note.resize((640, 978), Image.LANCZOS).save(os.path.join(OUT, 'mingnote.jpg'), quality=90)
print('mingnote ok')

# Stone surface patch from the rai photo (upper-left of the disc, away from the hole and the label).
rai = load('rai.jpg')
W, H = rai.size
patch = rai.crop((int(W * 0.30), int(H * 0.16), int(W * 0.62), int(H * 0.36))).resize((1024, 640), Image.LANCZOS)
patch.save(os.path.join(OUT, 'stone.jpg'), quality=88)
print('stone ok')

man = json.load(open(os.path.join(SRC, 'manifest.json')))
with open(os.path.join(OUT, 'CREDITS.md'), 'w') as f:
    f.write('# Texture credits\n\nAll source photos are public domain or CC0, from Wikimedia Commons.\n\n')
    for key in ['stater', 'double_eagle', 'denarius', 'moon', 'mingnote', 'rai']:
        m = man[key]
        f.write(f"- `{key}`: [{m['title']}]({m['page']}) ({m.get('license', '')})\n")
print('credits ok')
