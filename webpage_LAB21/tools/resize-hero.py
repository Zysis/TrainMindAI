#!/usr/bin/env python3
"""
Genera le tre versioni web di un'immagine hero (1280/1920/2560 px) in formato
WebP, da usare con l'attributo srcset: il browser scarica solo quella adatta
allo schermo.

Uso:
    python3 tools/resize-hero.py sorgenti/hero3.jpg public/assets/img/hero3
    -> hero3-1280.webp, hero3-1920.webp, hero3-2560.webp
"""
import os, sys
from PIL import Image

LARGHEZZE = {1280: 84, 1920: 82, 2560: 78}   # larghezza: qualita' WebP

def main(src, prefix):
    im = Image.open(src).convert('RGB')
    w0, h0 = im.size
    for w, q in LARGHEZZE.items():
        h = round(w * h0 / w0)
        out = f'{prefix}-{w}.webp'
        im.resize((w, h), Image.LANCZOS).save(out, quality=q, method=6)
        print(f'  {os.path.basename(out)}  {w}×{h}  {round(os.path.getsize(out)/1024)} KB')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('uso: python3 tools/resize-hero.py <sorgente> <prefisso-destinazione>')
    main(sys.argv[1], sys.argv[2])
