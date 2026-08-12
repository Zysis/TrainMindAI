#!/usr/bin/env python3
"""
Genera le immagini segnaposto LAB21 in public/assets/img/.
Rilanciare con:  python3 tools/gen-placeholders.py
Sostituire poi i file con le foto definitive mantenendo gli stessi nomi.
"""
import math, os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'img')
os.makedirs(OUT, exist_ok=True)

INK  = (7, 16, 14)
INK2 = (14, 26, 24)
ACC  = (0, 201, 167)

IMAGES = [
    ('hero-athlete.jpg',     1920, 1080, 'HERO — foto atleta'),
    ('trainmind-coach.jpg',  1400, 1000, 'TRAINMIND AI — coach con tablet'),
    ('product-02.jpg',        800,  500, 'PRODOTTO 02'),
    ('product-03.jpg',        800,  500, 'PRODOTTO 03'),
    ('product-04.jpg',        800,  500, 'PROGETTI SU MISURA'),
    ('lab-reel-poster.jpg',  1200,  900, 'REEL — poster video lab'),
    ('team-01.jpg',           600,  700, 'RITRATTO 01'),
    ('team-02.jpg',           600,  700, 'RITRATTO 02'),
    ('team-03.jpg',           600,  700, 'RITRATTO 03'),
    ('team-04.jpg',           600,  700, 'RITRATTO 04'),
    ('cta-gym.jpg',          1920,  900, 'CTA — ambiente palestra'),
]

FONTS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]

def font(size):
    for p in FONTS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def make(name, w, h, label):
    img = Image.new('RGB', (w, h), INK)
    d = ImageDraw.Draw(img, 'RGBA')

    # sfondo: gradiente diagonale ink -> verde
    step = 4
    for y in range(0, h, step):
        for x in range(0, w, step * 24):
            t = (x / w * .55 + y / h * .45)
            r = int(INK[0] + (ACC[0] - INK[0]) * t * .55)
            g = int(INK[1] + (ACC[1] - INK[1]) * t * .55)
            b = int(INK[2] + (ACC[2] - INK[2]) * t * .55)
            d.rectangle([x, y, x + step * 24, y + step], fill=(r, g, b))

    # trama di linee diagonali
    gap = max(18, w // 46)
    for i in range(-h, w + h, gap):
        d.line([(i, 0), (i + h, h)], fill=(255, 255, 255, 12), width=1)

    # arco decorativo
    d.arc([w * .58, -h * .35, w * 1.5, h * 1.1], 0, 360, fill=(0, 201, 167, 70), width=max(2, w // 400))

    # etichetta
    fs = max(16, int(min(w, h) * .055))
    f = font(fs)
    fm = font(max(11, int(fs * .42)))
    tw = d.textlength(label, font=f)
    x = (w - tw) / 2
    y = h / 2 - fs * .8
    d.line([(x, y + fs * 1.5), (x + tw, y + fs * 1.5)], fill=(0, 201, 167, 200), width=2)
    d.text((x, y), label, font=f, fill=(255, 255, 255, 235))
    sub = f'{w}×{h} · placeholder LAB21'
    sw = d.textlength(sub, font=fm)
    d.text(((w - sw) / 2, y + fs * 1.9), sub, font=fm, fill=(255, 255, 255, 130))

    img.save(os.path.join(OUT, name), quality=82, optimize=True)
    print('  ', name)

print('Genero i placeholder in public/assets/img/')
for args in IMAGES:
    make(*args)
print('Fatto.')
