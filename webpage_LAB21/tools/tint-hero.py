#!/usr/bin/env python3
"""
Vira sul verde LAB21 le parti blu/ciano di un'immagine, lasciando intatti
i toni caldi (arancio, incarnato) che fanno da accento.

Uso:
    python3 tools/tint-hero.py public/assets/img/hero2.webp public/assets/img/hero2-brand.webp

Opzioni utili dentro il file: CONTRASTO, LUMINOSITA, SATURAZIONE e la
finestra di tinte considerate "blu" (H_MIN / H_MAX).
"""
import sys
import numpy as np
from PIL import Image, ImageEnhance

CONTRASTO, LUMINOSITA, SATURAZIONE = 1.12, 1.05, 1.20
H_MIN, H_MAX = 150, 290      # gradi: intervallo blu/ciano da spostare
H_OUT_MIN, H_OUT_SPAN = 155, 30   # gradi: verde LAB21 di destinazione

def main(src, dst):
    im = Image.open(src).convert('RGB')
    im = ImageEnhance.Contrast(im).enhance(CONTRASTO)
    im = ImageEnhance.Brightness(im).enhance(LUMINOSITA)
    im = ImageEnhance.Color(im).enhance(SATURAZIONE)

    a = np.asarray(im).astype(float) / 255.
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn
    m = d > 1e-6

    h = np.zeros_like(mx)
    i = (mx == r) & m; h[i] = ((g - b)[i] / d[i]) % 6
    i = (mx == g) & m; h[i] = ((b - r)[i] / d[i]) + 2
    i = (mx == b) & m; h[i] = ((r - g)[i] / d[i]) + 4
    h *= 60.

    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    v = mx

    sel = (h >= H_MIN) & (h <= H_MAX)
    h = np.where(sel, H_OUT_MIN + (h - H_MIN) * (H_OUT_SPAN / (H_MAX - H_MIN)), h)

    c = v * s
    x = c * (1 - np.abs((h / 60.) % 2 - 1))
    base = v - c
    k = (h / 60.).astype(int) % 6
    z = np.zeros_like(c)
    combos = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)]
    out = np.zeros_like(a)
    for idx, (rr, gg, bb) in enumerate(combos):
        w = k == idx
        out[..., 0] = np.where(w, rr, out[..., 0])
        out[..., 1] = np.where(w, gg, out[..., 1])
        out[..., 2] = np.where(w, bb, out[..., 2])
    out = np.clip(out + base[..., None], 0, 1)

    Image.fromarray((out * 255).astype('uint8')).save(dst, quality=88, method=6)
    print('scritto', dst)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('uso: python3 tools/tint-hero.py <sorgente> <destinazione>')
    main(sys.argv[1], sys.argv[2])
