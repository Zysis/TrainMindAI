#!/usr/bin/env python3
"""
Costruisce il reel del blocco "02 — Metodo": il campo da cui parte il metodo,
raccontato per immagini.

Nessuna parola dentro il video, perché la pagina è in tre lingue. Restano i
numeri 01/02/03, che si leggono uguali ovunque e richiamano i tre passaggi
del metodo scritti di fianco al riquadro.

Stile (vedi video_common.py): bicromia verso il verde LAB21, carrellata lenta
alternata avanti/indietro, dissolvenze, grana e vignettatura leggere, barra di
avanzamento verde sul fondo.

Uso:
    python3 tools/build-method-video.py

Produce:
    public/assets/video/lab-method.mp4
    public/assets/img/lab-method.jpg     (immagine di anteprima)
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

from video_common import (ACC, FPS, H, IMG, INK, VID, W, apri_ffmpeg, carica,
                          chiudi, dissolvenza, frame_foto, mono, vignettatura)

DUR, OVER = 2.6, 0.6        # secondi per inquadratura e sovrapposizione

# Ordine del montaggio (quello indicato: si apre sul campo da basket) e
# passaggio del metodo a cui ogni immagine viene associata. Il numero grande
# in sovrimpressione tiene il ritmo e richiama i tre passaggi scritti di fianco.
CLIP = [
    ('video8.jpg',  '01'),   # canestro, tiro in sospensione
    ('video1.jpg',  '01'),   # coach e atleta al bilanciere
    ('video2.jpg',  '01'),   # coach che segue la seduta alla macchina
    ('video3.jpg',  '02'),   # sala pesi, le rastrelliere
    ('video4.jpg',  '02'),   # tapis roulant
    ('video5.webp', '02'),   # sala funzionale
    ('video6.jpg',  '03'),   # panca con manubri, spotter
    ('video7.jpg',  '03'),   # lavoro di gruppo
]


def numero(frame, testo, opac):
    """Numero del passaggio in basso a sinistra, con la lineetta verde."""
    if opac <= 0.01:
        return frame
    livello = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(livello)
    f = mono(150)
    x, y = 64, H - 250
    d.text((x, y), testo, font=f, fill=(255, 255, 255, int(235 * opac)))
    d.rectangle([x + 4, y + 178, x + 4 + 96, y + 184], fill=(0, 201, 167, int(230 * opac)))
    a = np.asarray(livello).astype(float)
    alfa = a[..., 3:4] / 255.
    return frame * (1 - alfa) + a[..., :3] * alfa


def costruisci():
    inizi, t = [], 0.0
    for _ in CLIP:
        inizi.append(t); t += DUR - OVER
    totale = t + OVER

    vign = vignettatura()
    rng = np.random.default_rng(21)
    cache = {}
    n_frame = int(totale * FPS)

    dest = os.path.join(VID, 'lab-method.mp4')
    ff = apri_ffmpeg(dest, crf=26)

    def rendi(i, u):
        nome = CLIP[i][0]
        if nome not in cache:
            cache[nome] = carica(nome)
        # una si avvicina, la successiva si allontana: il montaggio respira
        z0, z1 = (1.04, 1.14) if i % 2 == 0 else (1.14, 1.04)
        return frame_foto(cache[nome], u, z0, z1)

    primo = None
    for i in range(n_frame):
        t = i / FPS
        k = 0
        for j in range(len(CLIP)):
            if t >= inizi[j]:
                k = j
        frame = rendi(k, min((t - inizi[k]) / DUR, 1.0))
        num = CLIP[k][1]

        # il clip precedente è ancora in dissolvenza sotto
        if k > 0 and t < inizi[k] + OVER:
            p = (t - inizi[k]) / OVER
            prec = rendi(k - 1, min((t - inizi[k - 1]) / DUR, 1.0))
            frame = dissolvenza(prec, frame, p)
            if CLIP[k - 1][1] != num:      # cambio di passaggio: cambia il numero
                frame = numero(frame, CLIP[k - 1][1], 1 - p)
                frame = numero(frame, num, p)
            else:
                frame = numero(frame, num, 1.0)
        else:
            frame = numero(frame, num, 1.0)

        # coda: si richiude sulla prima immagine, così il loop non stacca
        fine = inizi[-1] + DUR
        if t > fine - OVER:
            p = (t - (fine - OVER)) / OVER
            frame = dissolvenza(frame, numero(rendi(0, 0.0), CLIP[0][1], 1.0), min(p, 1.0))

        frame = frame * vign
        frame += rng.normal(0, 2.2, (H, W, 1))
        larg = int(W * (t / totale))
        frame[H - 4:, :larg] = ACC
        frame[H - 4:, larg:] = INK

        frame = np.clip(frame, 0, 255).astype('uint8')
        if primo is None:
            primo = frame.copy()
        ff.stdin.write(frame.tobytes())
        if i % 50 == 0:
            print(f'  {i}/{n_frame}', end='\r', flush=True)

    print(f'\nreel del metodo: {totale:.1f}s, {n_frame} fotogrammi')
    chiudi(ff, primo, os.path.join(IMG, 'lab-method.jpg'), dest)


if __name__ == '__main__':
    os.makedirs(VID, exist_ok=True)
    if subprocess.call(['which', 'ffmpeg'], stdout=subprocess.DEVNULL):
        sys.exit('serve ffmpeg')
    costruisci()
