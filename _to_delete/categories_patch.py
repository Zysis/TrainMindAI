# -*- coding: utf-8 -*-
"""Categorie esercizi: fusione Resistenza+Condizionamento, nuove Mobilità e Release."""
import io
import json
import os

APPS = ['trainmind-app/apps/web/src', 'trainmind-mobile/web/src']


def edit(path, old, new, label):
    raw = io.open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw
    assert s.count(old) == 1, '%s: ancora "%s" trovata %d volte' % (path, label, s.count(old))
    s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched', label, '→', path)


for base in APPS:
    # ── 1. elenco canonico ──────────────────────────────────
    edit(os.path.join(base, 'lib/constants.ts'),
         """  'Forza',
  'Potenza',
  'Resistenza',
  'Velocita',
  'Agilita',
  'Flessibilita',
  'Propriocezione',
  'Core',
  'Pliometria',
  'Prevenzione',
  'Riabilitazione',
  'Condizionamento',
  'Basket-Specifico',""",
         """  'Forza',
  'Potenza',
  'Condizionamento-Metabolico',
  'Velocita',
  'Agilita',
  'Flessibilita',
  'Mobilita',
  'Release',
  'Propriocezione',
  'Core',
  'Pliometria',
  'Prevenzione',
  'Riabilitazione',
  'Basket-Specifico',""",
         'EXERCISE_CATEGORIES')

    # ── 2. libreria esercizi: varianti dei badge ────────────
    edit(os.path.join(base, 'app/dashboard/exercises/page.tsx'),
         """  Flessibilita: 'teal',
  Resistenza: 'warning',
  Riabilitazione: 'danger',
  Condizionamento: 'warning',
  'Basket-Specifico': 'teal',""",
         """  Flessibilita: 'teal',
  'Condizionamento-Metabolico': 'warning',
  Mobilita: 'teal',
  Release: 'info',
  Riabilitazione: 'danger',
  'Basket-Specifico': 'teal',""",
         'categoryColors (libreria)')

    # ── 3. le tre mappe di colori identiche ─────────────────
    for rel in ['app/dashboard/sessions/[id]/page.tsx',
                'app/dashboard/training/session/[id]/page.tsx',
                'components/training/live-session-recorder.tsx']:
        edit(os.path.join(base, rel),
             """  Resistenza: 'bg-pink-100 text-pink-700',
  Riabilitazione:""",
             """  'Condizionamento-Metabolico': 'bg-pink-100 text-pink-700',
  Mobilita: 'bg-teal-100 text-teal-700',
  Release: 'bg-indigo-100 text-indigo-700',
  Riabilitazione:""",
             'categoryColors')

# ── 4. prompt dell'AI (solo lato API) ───────────────────────
edit('trainmind-app/apps/api/src/lib/openai-fallback.ts',
     'Forza/Potenza/Pliometria/Velocita/Agilita/Core/Propriocezione/Prevenzione/Flessibilita/Resistenza/Riabilitazione',
     'Forza/Potenza/Pliometria/Velocita/Agilita/Core/Propriocezione/Prevenzione/Flessibilita/Mobilita/Release/Condizionamento-Metabolico/Riabilitazione',
     'prompt categorie AI')

# ── 5. esercizi predefiniti importabili ─────────────────────
p = 'trainmind-app/seed/exercises.json'
data = json.load(io.open(p, encoding='utf-8'))
moved = 0
for ex in data:
    if ex.get('category') in ('Condizionamento', 'Resistenza'):
        ex['category'] = 'Condizionamento-Metabolico'
        moved += 1
io.open(p, 'w', encoding='utf-8', newline='').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('  seed/exercises.json: %d esercizi spostati su Condizionamento-Metabolico' % moved)

# ── 6. etichette ────────────────────────────────────────────
KEYS = {
    'it': [('cat_Condizionamento-Metabolico', 'Condizionamento metabolico'),
           ('cat_Mobilita', 'Mobilità'),
           ('cat_Release', 'Release')],
    'en': [('cat_Condizionamento-Metabolico', 'Metabolic conditioning'),
           ('cat_Mobilita', 'Mobility'),
           ('cat_Release', 'Release')],
    'es': [('cat_Condizionamento-Metabolico', 'Acondicionamiento metabólico'),
           ('cat_Mobilita', 'Movilidad'),
           ('cat_Release', 'Release')],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('exercises')
        if ns is None:
            print('  SKIP (no exercises ns)', path)
            continue
        anchor = next((l for l in src.split(nl) if '"cat_Basket-Specifico"' in l), None)
        if anchor is None:
            print('  SKIP (no anchor)', path)
            continue
        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in ns]
        if not added:
            print('  OK (already patched)', path)
            continue
        # inserisce PRIMA di Basket-Specifico, così l'ordine resta leggibile
        out = src.replace(anchor, nl.join(added) + nl + anchor, 1)
        json.loads(out)
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('  patched %-2s %s (+%d)' % (loc, path, len(added)))

print('fatto')
