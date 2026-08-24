# -*- coding: utf-8 -*-
"""Chromium di sistema nell'immagine API: senza, Puppeteer non genera PDF su Alpine."""
import io

p = 'trainmind-app/apps/api/Dockerfile'
s = io.open(p, encoding='utf-8').read()

if 'PUPPETEER_EXECUTABLE_PATH' in s:
    print('OK (già patchato)', p)
else:
    old = """RUN apk add --no-cache openssl libc6-compat

RUN npm install -g pnpm"""
    new = """RUN apk add --no-cache openssl libc6-compat

# Chromium di sistema per Puppeteer (report PDF). Il browser che Puppeteer
# scarica da solo è compilato per glibc e su Alpine (musl) non parte: si
# installa quello dei pacchetti e si salta il download.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont \\
    && ln -sf "$(command -v chromium-browser || command -v chromium)" /usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true \\
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN npm install -g pnpm"""
    assert s.count(old) == 1, 'blocco apk non trovato'
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('patched', p)
