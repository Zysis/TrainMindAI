# -*- coding: utf-8 -*-
"""Tipi infortunio dei seed allineati ai cinque codici del form, con insorgenza."""
import io
import os

# etichetta libera → (type, onset)
MAP = {
    'Distorsione': ('ligament', 'traumatic'),
    'Stiramento': ('muscular', 'non_traumatic'),
    'Tendinopatia': ('tendon', 'overuse'),
}

SEEDS = [
    'trainmind-app/packages/db/prisma/seed.ts',
    'trainmind-app/packages/db/prisma/seed-team14.ts',
    'trainmind-app/packages/db/prisma/seed-demo.ts',
]

for path in SEEDS:
    if not os.path.exists(path):
        print('  SKIP', path)
        continue
    raw = io.open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw
    n = 0
    for label, (typ, onset) in MAP.items():
        old = "type: '%s'," % label
        new = "type: '%s',\n      onset: '%s'," % (typ, onset)
        # indentazione: si adatta a quella della riga trovata
        while old in s:
            idx = s.index(old)
            line_start = s.rindex('\n', 0, idx) + 1
            indent = s[line_start:idx]
            s = s[:idx] + ("type: '%s',\n%sonset: '%s'," % (typ, indent, onset)) + s[idx + len(old):]
            n += 1
    if n:
        io.open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  %s: %d tipi convertiti' % (path, n))

# Il tipo InjuryCfg di seed-team14 deve conoscere il campo nuovo
p = 'trainmind-app/packages/db/prisma/seed-team14.ts'
raw = io.open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n') if crlf else raw
if 'onset: string' not in s and 'interface InjuryCfg' in s:
    old = 'interface InjuryCfg {\n  athleteIdx: number;\n  type: string;'
    new = 'interface InjuryCfg {\n  athleteIdx: number;\n  type: string;\n  onset: string;'
    if s.count(old) == 1:
        s = s.replace(old, new)
        print('  aggiunto onset a InjuryCfg')
    else:
        print('  ATTENZIONE: interface InjuryCfg non trovata nella forma attesa, controllare a mano')

# e la create deve passarlo
old = """        athleteId: athlete.id,
        type: cfg.type,
        location: cfg.location,"""
new = """        athleteId: athlete.id,
        type: cfg.type,
        onset: cfg.onset,
        location: cfg.location,"""
if old in s:
    s = s.replace(old, new)
    print('  aggiunto onset alla create di seed-team14')
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)

print('fatto')
