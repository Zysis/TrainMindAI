#!/usr/bin/env python3
"""
Costruisce il video della vetrina TrainMind (sezione "01 — Il laboratorio")
montando foto e schermate dell'app con zoom lenti e dissolvenze. Colore guida: il verde LAB21 (--acc).

  foto      → a tutta inquadratura, virate sul verde, con lenta carrellata
  schermate → appoggiate su fondo scuro come schede, con etichetta mono

Uso:
    python3 tools/build-showcase-video.py

Produce:
    public/assets/video/trainmind-showcase.mp4   (video)
    public/assets/img/trainmind-showcase.jpg     (immagine di anteprima)

Serve ffmpeg. Le immagini sorgente stanno in public/assets/img/coach*.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__))
RAD = os.path.dirname(QUI)
IMG = os.path.join(RAD, 'public', 'assets', 'img')
VID = os.path.join(RAD, 'public', 'assets', 'video')

W, H, FPS = 1280, 960, 25
SS = 2            # supercampionamento: le schermate si compongono a 2x
ACC = np.array([0, 201, 167], dtype=float)
INK = np.array([7, 16, 14], dtype=float)

DUR_FOTO, DUR_SHOT, OVER = 2.8, 2.7, 0.55   # secondi

# Ordine del montaggio: si alternano foto e schermate, mai più di due
# schermate di fila. Si apre sul coach col tablet — è anche il fotogramma
# che diventa l'immagine di anteprima.
CLIP = [
    ('foto', 'coach11.jpg', None),      # coach e atleta sul tablet
    ('shot', 'coach1.png',  'DASHBOARD'),
    ('shot', 'coach2.png',  'ANALYTICS'),
    ('foto', 'coach10.jpg', None),      # tiro in sospensione
    ('shot', 'coach3.png',  'ACWR'),
    ('shot', 'coach4.png',  'CALENDAR'),
    ('foto', 'coach9.webp', None),      # spinta della slitta
    ('shot', 'coach5.png',  'DRILLS'),
    ('foto', 'coach8.jpg',  None),      # sala pesi
    ('shot', 'coach6.png',  'MEASURES'),
    ('foto', 'coach7.avif', None),      # manubri
]
# come si passa da un clip al successivo
TRANS = ['dissolve'] * len(CLIP)   # zoom lento e poi dissolvenza, sempre

FONT_MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'


def mono(size):
    try:
        return ImageFont.truetype(FONT_MONO, size)
    except OSError:
        return ImageFont.load_default()


def carica(nome):
    return Image.open(os.path.join(IMG, nome)).convert('RGB')


def duotone(arr):
    """Da immagine a bicromia ink → verde LAB21, mantenendo le luci."""
    lum = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]) / 255.
    lum = np.clip(lum ** 0.92, 0, 1)[..., None]
    return INK + (ACC * 1.12 - INK) * lum


def cover(im, w, h, zoom, dx=0.5, dy=0.5):
    s = max(w / im.width, h / im.height) * zoom
    nw, nh = max(w, int(im.width * s)), max(h, int(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    x = int((nw - w) * dx)
    y = int((nh - h) * dy)
    return im.crop((x, y, x + w, y + h))


def sfondo_scuro(w=W, h=H):
    """Fondo delle schermate: ink con un alone verde in alto a destra."""
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx / w - .74) / .8) ** 2 + ((yy / h - .18) / .7) ** 2)
    g = np.clip(1 - r / .9, 0, 1)[..., None] * .30
    return INK * (1 - g) + ACC * g


def frame_foto(im, u):
    """Carrellata lenta: zoom da 1.05 a 1.14 con leggero spostamento."""
    z = 1.05 + 0.09 * u
    return duotone(np.asarray(cover(im, W, H, z, 0.5 + 0.04 * (u - .5), 0.45)).astype(float))


def scheda(im, label):
    """
    Schermata appoggiata su fondo scuro, con angoli tondi e ombra.

    Viene composta UNA VOLTA SOLA al doppio della risoluzione finale (SS=2).
    Ogni fotogramma poi ritaglia da qui e rimpicciolisce: il dimezzamento
    media i pixel invece di ricampionare il testo dell'originale, ed è
    l'unico modo per far muovere una schermata piena di testo piccolo senza
    che tremoli. Ricomporre la scheda a ogni fotogramma, invece, la fa
    "brillare" per un pixel di arrotondamento.
    """
    w, h = W * SS, H * SS
    base = Image.fromarray(sfondo_scuro(w, h).astype('uint8'))

    mw = int(w * 0.86)
    mh = int(mw * im.height / im.width)
    if mh > h * 0.72:
        mh = int(h * 0.72); mw = int(mh * im.width / im.height)
    card = im.resize((mw, mh), Image.LANCZOS)

    # angoli arrotondati
    maschera = Image.new('L', (mw, mh), 0)
    ImageDraw.Draw(maschera).rounded_rectangle([0, 0, mw - 1, mh - 1], radius=16 * SS, fill=255)

    x = (w - mw) // 2
    y = int(h * 0.16)

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


def rendi(clip, u, cache, comp, indice=0):
    """u = avanzamento nel clip, da 0 a 1."""
    tipo, nome, label = clip
    if nome not in cache:
        cache[nome] = carica(nome)
    if tipo == 'foto':
        return frame_foto(cache[nome], u)
    if nome not in comp:
        comp[nome] = scheda(cache[nome], label)
    # zoom continuo e lento; alterna avvicinamento e allontanamento
    a, b = (1.00, 1.055) if indice % 2 == 0 else (1.055, 1.00)
    return zoom(comp[nome], a + (b - a) * u)


def spinta(a, b, u):
    """Il fotogramma successivo spinge fuori il precedente, con lama verde."""
    off = int(W * u)
    out = np.empty_like(a)
    if off > 0:
        out[:, :W - off] = a[:, off:]
        out[:, W - off:] = b[:, :off]
    else:
        out[:] = a
    x = W - off
    if 0 <= x < W:
        out[:, max(0, x - 3):min(W, x + 3)] = ACC
    return out


def dip(a, b, u):
    """Stacco che passa dal nero-verde."""
    if u < .5:
        k = u * 2
        return a * (1 - k) + INK * k
    k = (u - .5) * 2
    return INK * (1 - k) + b * k


def dissolvenza(a, b, u):
    return a * (1 - u) + b * u


MISCELA = {'push': spinta, 'dip': dip, 'dissolve': dissolvenza}


def costruisci():
    inizi, t, durate = [], 0.0, []
    for c in CLIP:
        d = DUR_FOTO if c[0] == 'foto' else DUR_SHOT
        inizi.append(t); durate.append(d)
        t += d - OVER
    totale = t + OVER          # l'ultima transizione richiude sul primo clip

    yy, xx = np.mgrid[0:H, 0:W]
    vign = np.clip(1 - 1.15 * (((xx / W - .5) * 1.25) ** 2 + ((yy / H - .5) * 1.25) ** 2), .35, 1)[..., None]
    rng = np.random.default_rng(21)
    cache, comp = {}, {}
    n_frame = int(totale * FPS)

    ff = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p',
         '-movflags', '+faststart', '-an', os.path.join(VID, 'trainmind-showcase.mp4')],
        stdin=subprocess.PIPE)

    primo = None
    for i in range(n_frame):
        t = i / FPS

        # Clip corrente: l'ultimo che è già iniziato. I clip si sovrappongono
        # di OVER secondi, quindi nei primi OVER secondi di un clip il
        # precedente è ancora in dissolvenza sotto.
        k = 0
        for j in range(len(CLIP)):
            if t >= inizi[j]:
                k = j
        u = (t - inizi[k]) / durate[k]
        frame = rendi(CLIP[k], min(u, 1.0), cache, comp, k)

        if k > 0 and t < inizi[k] + OVER:
            p = (t - inizi[k]) / OVER
            prec = rendi(CLIP[k - 1], min((t - inizi[k - 1]) / durate[k - 1], 1.0), cache, comp, k - 1)
            frame = MISCELA[TRANS[k - 1]](prec, frame, min(p, 1.0))

        # coda: l'ultimo clip si richiude in dissolvenza sul primo
        fine = inizi[-1] + durate[-1]
        if t > fine - OVER:
            p = (t - (fine - OVER)) / OVER
            frame = MISCELA[TRANS[-1]](frame, rendi(CLIP[0], 0.0, cache, comp, 0), min(p, 1.0))

        frame = frame * vign
        if CLIP[k][0] == 'foto':
            frame += rng.normal(0, 2.2, (H, W, 1))     # grana solo sulle foto
        # barra di avanzamento verde in basso
        larg = int(W * (t / totale))
        frame[H - 4:, :larg] = ACC
        frame[H - 4:, larg:] = INK

        frame = np.clip(frame, 0, 255).astype('uint8')
        if primo is None:
            primo = frame.copy()
        ff.stdin.write(frame.tobytes())
        if i % 50 == 0:
            print(f'  {i}/{n_frame}', end='\r', flush=True)

    ff.stdin.close()
    ff.wait()
    Image.fromarray(primo).save(os.path.join(IMG, 'trainmind-showcase.jpg'), quality=82)
    peso = os.path.getsize(os.path.join(VID, 'trainmind-showcase.mp4')) / 1024
    print(f'\nvideo: {totale:.1f}s, {n_frame} fotogrammi, {peso:.0f} KB')


if __name__ == '__main__':
    os.makedirs(VID, exist_ok=True)
    if subprocess.call(['which', 'ffmpeg'], stdout=subprocess.DEVNULL):
        sys.exit('serve ffmpeg')
    costruisci()
