#!/usr/bin/env python3
"""
Pezzi condivisi dai video del sito (vetrina TrainMind e reel del metodo).

Regole di stile, valide per tutti i montaggi:
  · foto      → bicromia ink → verde LAB21, carrellata lenta
  · schermate → composte UNA VOLTA SOLA al doppio della risoluzione e poi
                ritagliate: ricomporle a ogni fotogramma le fa tremolare
  · passaggi  → dissolvenze, mai stacchi netti
"""
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1280, 960, 25
SS = 2                      # supercampionamento delle schermate
ACC = np.array([0, 201, 167], dtype=float)
INK = np.array([7, 16, 14], dtype=float)

QUI = os.path.dirname(os.path.abspath(__file__))
RAD = os.path.dirname(QUI)
IMG = os.path.join(RAD, 'public', 'assets', 'img')
VID = os.path.join(RAD, 'public', 'assets', 'video')

FONT_MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'


def mono(size):
    try:
        return ImageFont.truetype(FONT_MONO, int(size))
    except OSError:
        return ImageFont.load_default()


def carica(nome):
    return Image.open(os.path.join(IMG, nome)).convert('RGB')


def duotone(arr):
    """Bicromia ink → verde LAB21, mantenendo le luci dell'originale."""
    lum = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]) / 255.
    lum = np.clip(lum ** 0.92, 0, 1)[..., None]
    return INK + (ACC * 1.12 - INK) * lum


def cover(im, w, h, zoom, dx=0.5, dy=0.5):
    s = max(w / im.width, h / im.height) * zoom
    nw, nh = max(w, int(im.width * s)), max(h, int(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    x, y = int((nw - w) * dx), int((nh - h) * dy)
    return im.crop((x, y, x + w, y + h))


def sfondo_scuro(w=W, h=H):
    """Fondo delle schermate: ink con un alone verde in alto a destra."""
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx / w - .74) / .8) ** 2 + ((yy / h - .18) / .7) ** 2)
    g = np.clip(1 - r / .9, 0, 1)[..., None] * .30
    return INK * (1 - g) + ACC * g


def frame_foto(im, u, z0=1.05, z1=1.14, dy=0.45):
    """Carrellata lenta su una foto, con la virata verde."""
    z = z0 + (z1 - z0) * u
    return duotone(np.asarray(cover(im, W, H, z, 0.5 + 0.04 * (u - .5), dy)).astype(float))


def scheda(im, label=None):
    """Schermata su fondo scuro, angoli tondi, ombra ed etichetta mono.
    Composta a SS volte la risoluzione finale: vedi zoom()."""
    w, h = W * SS, H * SS
    base = Image.fromarray(sfondo_scuro(w, h).astype('uint8'))

    mw = int(w * 0.86)
    mh = int(mw * im.height / im.width)
    if mh > h * 0.72:
        mh = int(h * 0.72); mw = int(mh * im.width / im.height)
    card = im.resize((mw, mh), Image.LANCZOS)

    maschera = Image.new('L', (mw, mh), 0)
    ImageDraw.Draw(maschera).rounded_rectangle([0, 0, mw - 1, mh - 1], radius=16 * SS, fill=255)

    x, y = (w - mw) // 2, int(h * 0.16)

    ombra = Image.new('L', (w, h), 0)
    ImageDraw.Draw(ombra).rounded_rectangle(
        [x + 6 * SS, y + 18 * SS, x + mw - 6 * SS, y + mh + 18 * SS], radius=22 * SS, fill=140)
    ombra = ombra.filter(ImageFilter.GaussianBlur(26 * SS))
    base = Image.composite(Image.new('RGB', (w, h), (0, 0, 0)), base, ombra)
    base.paste(card, (x, y), maschera)

    d = ImageDraw.Draw(base, 'RGBA')
    d.rounded_rectangle([x, y, x + mw - 1, y + mh - 1], radius=16 * SS,
                        outline=(0, 201, 167, 90), width=2 * SS)
    if label:
        f = mono(19 * SS)
        d.text((x + 2 * SS, y - 40 * SS), label, font=f, fill=(0, 201, 167, 235))
        lw = d.textlength(label, font=f)
        d.rectangle([x + 2 * SS, y - 14 * SS, x + 2 * SS + lw, y - 12 * SS], fill=(0, 201, 167, 150))
    return base


def zoom(base, z):
    """Ritaglia dalla composizione grande e riporta alla misura finale."""
    w, h = base.size
    cw, ch = int(w / z), int(h / z)
    x, y = (w - cw) // 2, (h - ch) // 2
    return np.asarray(base.crop((x, y, x + cw, y + ch))
                          .resize((W, H), Image.LANCZOS)).astype(float)


def dissolvenza(a, b, u):
    return a * (1 - u) + b * u


def vignettatura():
    yy, xx = np.mgrid[0:H, 0:W]
    return np.clip(1 - 1.15 * (((xx / W - .5) * 1.25) ** 2 + ((yy / H - .5) * 1.25) ** 2), .35, 1)[..., None]


def apri_ffmpeg(destinazione, crf=25):
    return subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p',
         '-movflags', '+faststart', '-an', destinazione],
        stdin=subprocess.PIPE)


def chiudi(ff, primo, poster, destinazione):
    ff.stdin.close(); ff.wait()
    Image.fromarray(primo).save(poster, quality=82)
    kb = os.path.getsize(destinazione) / 1024
    print(f'  {os.path.basename(destinazione)}  {kb:.0f} KB')
