# -*- coding: utf-8 -*-
"""Allinea i nomi dei tipi metrica usati dai seed a quelli canonici del form,
e aggiunge `hand_span` (apertura mano), che i seed producevano senza che
esistesse una definizione corrispondente."""
import io
import json
import os

# seed → canonico
RENAMES = [
    ('agility_t_test', 't_test'),
    ('vo2max', 'vo2_max'),
    ('bench_press_1rm', '1rm_bench'),
    ('squat_1rm', '1rm_squat'),
    ('wingspan', 'wing_span'),
]

SEEDS = [
    'trainmind-app/packages/db/prisma/seed-demo.ts',
    'trainmind-app/packages/db/prisma/seed-team14.ts',
    'trainmind-app/packages/db/prisma/seed.ts',
]

for path in SEEDS:
    if not os.path.exists(path):
        print('  SKIP', path)
        continue
    raw = io.open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw
    total = 0
    for old, new in RENAMES:
        # solo dove è davvero un tipo metrica, cioè fra apici
        for pattern, repl in [("type: '%s'" % old, "type: '%s'" % new),
                              ("'%s'," % old, "'%s'," % new)]:
            n = s.count(pattern)
            if n:
                s = s.replace(pattern, repl)
                total += n
    io.open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched %s (%d sostituzioni)' % (path, total))

# ── hand_span fra le definizioni del form ───────────────────
for base in ['trainmind-app/apps/web/src', 'trainmind-mobile/web/src']:
    p = os.path.join(base, 'components/metrics/metrics-form.tsx')
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw
    old = "  { key: 'foot_length', labelKey: 'mt_foot_length',"
    new = ("  { key: 'hand_span', labelKey: 'mt_hand_span', unit: 'cm', descKey: 'mtDesc_hand_span', "
           "min: 15, max: 30, step: 0.1, higherIsBetter: true, category: 'anthropometric' },\n"
           "  { key: 'foot_length', labelKey: 'mt_foot_length',")
    assert s.count(old) == 1, '%s: ancora foot_length' % p
    s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched hand_span →', p)

    # e nella scheda Profilo fisico
    p2 = os.path.join(base, 'app/dashboard/athletes/[id]/page.tsx')
    raw = io.open(p2, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw
    old = "'wing_span', 'hand_length', 'foot_length'"
    new = "'wing_span', 'hand_span', 'hand_length', 'foot_length'"
    assert s.count(old) == 1, '%s: ancora ANTHROPOMETRIC_KEYS' % p2
    s = s.replace(old, new)
    io.open(p2, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched hand_span →', p2)

# ── etichette ───────────────────────────────────────────────
KEYS = {
    'it': [('mt_hand_span', 'Apertura mano'),
           ('mtDesc_hand_span', 'Mano aperta, dalla punta del pollice a quella del mignolo')],
    'en': [('mt_hand_span', 'Hand span'),
           ('mtDesc_hand_span', 'Hand spread, from thumb tip to little finger tip')],
    'es': [('mt_hand_span', 'Envergadura de la mano'),
           ('mtDesc_hand_span', 'Mano abierta, de la punta del pulgar a la del meñique')],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('metrics')
        anchor = next((l for l in src.split(nl) if '"mt_foot_length"' in l), None)
        if ns is None or anchor is None:
            print('  SKIP', path)
            continue
        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in ns]
        if not added:
            print('  OK (already patched)', path)
            continue
        out = src.replace(anchor, nl.join(added) + nl + anchor, 1)
        json.loads(out)
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('  patched %-2s %s (+%d)' % (loc, path, len(added)))

print('fatto')
