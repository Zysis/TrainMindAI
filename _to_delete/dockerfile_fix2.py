# -*- coding: utf-8 -*-
"""Il symlink chromium-browser -> se stesso rompeva il launcher: si toglie."""
import io

p = 'trainmind-app/apps/api/Dockerfile'
s = io.open(p, encoding='utf-8').read()

old = """RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont \\
    && ln -sf "$(command -v chromium-browser || command -v chromium)" /usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true \\
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser"""

new = """# Il pacchetto installa sia `chromium` sia `chromium-browser`: NON creare
# symlink, si finisce per sovrascrivere il launcher con un link a se stesso.
# `--version` in coda serve da verifica: se il nome cambiasse, il build
# fallisce qui invece di produrre un'immagine senza browser.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont \\
    && chromium-browser --version
ENV PUPPETEER_SKIP_DOWNLOAD=true \\
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser"""

assert s.count(old) == 1, 'blocco chromium non trovato (già corretto?)'
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('patched', p)
