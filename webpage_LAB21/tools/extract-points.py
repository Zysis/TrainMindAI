#!/usr/bin/env python3
"""
Estrae due nuvole di punti dalle immagini dell'hero e le salva in
src/data/hero-points.json, usato dall'animazione di morphing.

  hero3.jpg -> incroci della maglia (rilevamento angoli Shi-Tomasi)
  hero4.jpg -> particelle della sfera (centroidi delle macchie scure)

I due insiemi hanno lo stesso numero di punti e vengono ordinati con una
curva di Hilbert: punti vicini in una figura restano vicini nell'altra,
così il movimento risulta ordinato invece che caotico.

Uso:
    python3 tools/extract-points.py
"""
import json, os
import numpy as np
import cv2

QUI = os.path.dirname(os.path.abspath(__file__))
RAD = os.path.dirname(QUI)
N_PUNTI = 5200        # nuvola densa: la maglia si riconosce anche a punti
LATO_HILBERT = 256          # risoluzione della curva di ordinamento

def carica(nome, larghezza=1800):
    p = os.path.join(RAD, 'sorgenti', nome)
    im = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
    if im is None:
        raise SystemExit(f'immagine non trovata: {p}')
    h = round(larghezza * im.shape[0] / im.shape[1])
    return cv2.resize(im, (larghezza, h), interpolation=cv2.INTER_AREA)

def punti_maglia(img, n):
    """Incroci delle linee: angoli su immagine invertita (linee chiare)."""
    inv = cv2.bitwise_not(img)
    inv = cv2.GaussianBlur(inv, (0, 0), 1.0)
    c = cv2.goodFeaturesToTrack(inv, maxCorners=n, qualityLevel=0.0035,
                                minDistance=4, blockSize=5, useHarrisDetector=False)
    return c.reshape(-1, 2)

def punti_particelle(img, n):
    """
    Centroidi delle particelle scure sul fondo bianco.

    Le macchie distinte non bastano a riempire una nuvola densa (l'anello
    centrale è un ammasso unico), quindi se mancano punti si completa
    pescandoli dentro la maschera, tenendoli distanziati con una griglia
    di occupazione: la forma resta quella, la densità sale.
    """
    _, mask = cv2.threshold(img, 205, 255, cv2.THRESH_BINARY_INV)
    _, _, stats, cent = cv2.connectedComponentsWithStats(mask, connectivity=8)
    aree = stats[1:, cv2.CC_STAT_AREA]
    cen = cent[1:]
    punti = list(cen[np.argsort(-aree)][:n])
    print(f'  particelle distinte: {len(punti)}')

    if len(punti) < n:
        passo = max(2, int(img.shape[1] / 420))       # distanza minima, in pixel
        presi = {(int(x / passo), int(y / passo)) for x, y in punti}
        ys, xs = np.nonzero(mask)
        idx = np.random.default_rng(21).permutation(len(xs))
        for i in idx:
            if len(punti) >= n:
                break
            x, y = float(xs[i]), float(ys[i])
            cella = (int(x / passo), int(y / passo))
            if cella in presi:
                continue
            presi.add(cella)
            punti.append(np.array([x, y]))
        print(f'  completati a: {len(punti)}')
    return np.array(punti)

def hilbert_d(x, y, ordine=LATO_HILBERT):
    """Indice lungo la curva di Hilbert per una coppia di interi."""
    rx = ry = 0; d = 0; s = ordine // 2
    x = int(x); y = int(y)
    while s > 0:
        rx = 1 if (x & s) > 0 else 0
        ry = 1 if (y & s) > 0 else 0
        d += s * s * ((3 * rx) ^ ry)
        if ry == 0:
            if rx == 1:
                x = s - 1 - x; y = s - 1 - y
            x, y = y, x
        s //= 2
    return d

def normalizza(p, w, h):
    """Coordinate 0..1 nello spazio dell'immagine."""
    q = p.astype(float).copy()
    q[:, 0] /= w; q[:, 1] /= h
    return np.clip(q, 0, 1)

def ordina_hilbert(p):
    idx = [hilbert_d(min(int(x * LATO_HILBERT), LATO_HILBERT - 1),
                     min(int(y * LATO_HILBERT), LATO_HILBERT - 1)) for x, y in p]
    return p[np.argsort(idx)]

def main():
    a_img = carica('hero3.jpg')
    b_img = carica('hero4.jpg', 3200)   # più risoluzione = più particelle distinte

    a = punti_maglia(a_img, N_PUNTI)
    b = punti_particelle(b_img, N_PUNTI)
    n = min(len(a), len(b), N_PUNTI)
    print(f'punti trovati: maglia {len(a)}, particelle {len(b)} -> uso {n}')

    a = normalizza(a[:n], a_img.shape[1], a_img.shape[0])
    b = normalizza(b[:n], b_img.shape[1], b_img.shape[0])
    a = ordina_hilbert(a); b = ordina_hilbert(b)

    S = 2048
    q = lambda p: [[int(round(x * S)), int(round(y * S))] for x, y in p]
    dati = {
        'n': n,
        'scala': S,
        'a': {'ratio': round(a_img.shape[1] / a_img.shape[0], 5), 'p': q(a)},
        'b': {'ratio': round(b_img.shape[1] / b_img.shape[0], 5), 'p': q(b)}
    }
    out = os.path.join(RAD, 'src', 'data', 'hero-points.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w') as f:
        json.dump(dati, f, separators=(',', ':'))
    print('scritto', out, round(os.path.getsize(out) / 1024), 'KB')

    # anteprima di controllo
    for nome, pts, im in (('a', a, a_img), ('b', b, b_img)):
        c = np.zeros((im.shape[0], im.shape[1], 3), np.uint8)
        for x, y in pts:
            cv2.circle(c, (int(x * im.shape[1]), int(y * im.shape[0])), 2, (167, 201, 0), -1)
        cv2.imwrite(f'/sessions/awesome-brave-cerf/mnt/outputs/punti-{nome}.png', c)

if __name__ == '__main__':
    main()
