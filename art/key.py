# 緑背景を抜いて webp(透過) にする。~/tools/pyimg/bin/python art/key.py（Pillow と numpy が要る）
import numpy as np, glob, os
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'; RAW = D + '/../../_art_raw/wedding-speech/raw'  # 生成元はリポジトリの外
def key(src, size=None):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = 1 - np.clip((k - 2) / (40 - 2), 0, 1)
    lim = np.maximum(r, b); g = np.where(g > lim, lim, g)
    spill = (k > -6) | (al < 0.98); g = np.where(spill, np.minimum(g, 0.72 * r + 0.28 * b), g)
    im = Image.fromarray(np.dstack([r, g, b, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    A = im.split()[3].filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.9)); im.putalpha(A)
    return im.resize(size, Image.LANCZOS) if size else im
def save(im, n, q=80):
    im.save(OUT + n + '.webp', quality=q, method=6); print(n, im.size, os.path.getsize(OUT + n + '.webp') // 1024, 'KB')
SKIP = {'bg', 'items_a', 'items_b', 'me', 'centerpiece', 'garland', 'flowerwall'}
for f in sorted(glob.glob(RAW + '/*.png')):
    n = os.path.basename(f)[:-4]
    if n in SKIP: continue
    save(key(f, (560, 840)), n, 76)
if os.path.exists(RAW + '/me.png'):
    me = key(RAW + '/me.png'); me = me.crop(me.getbbox()); me.thumbnail((620, 620)); save(me, 'me', 80)
if os.path.exists(RAW + '/bg.png'):
    bg = Image.open(RAW + '/bg.png').convert('RGB'); bg.thumbnail((1536, 1024)); save(bg, 'bg', 74)
def cells(sheet, cols, rows, names, mx=260):
    if not os.path.exists(RAW + '/' + sheet + '.png'): return
    it = key(RAW + '/' + sheet + '.png'); W, H = it.size
    for i, n in enumerate(names):
        c = it.crop((i % cols * W // cols, i // cols * H // rows, (i % cols + 1) * W // cols, (i // cols + 1) * H // rows))
        bb = c.getbbox(); c = c.crop(bb); c.thumbnail((mx, mx)); save(c, n, 82)
cells('items_a', 4, 3, ['i_hanky', 'i_tissue', 'i_beer', 'i_phone', 'i_card', 'i_ticket', 'i_photo', 'i_medicine', 'i_nose', 'i_seat', 'i_letter', 'i_camera'])
cells('items_b', 4, 1, ['i_knife', 'i_mic', 'i_flute', 'i_rose'], 320)
for n, mx in [('centerpiece', 700), ('garland', 1100)]:
    if os.path.exists(RAW + '/' + n + '.png'): c = key(RAW + '/' + n + '.png'); c = c.crop(c.getbbox()); c.thumbnail((mx, mx)); save(c, n, 78)
if os.path.exists(RAW + '/flowerwall.png'):
    fw = Image.open(RAW + '/flowerwall.png').convert('RGB'); fw.thumbnail((900, 600)); save(fw, 'flowerwall', 72)
