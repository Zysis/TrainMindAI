# -*- coding: utf-8 -*-
"""Quattro misure antropometriche in più: reach, altezza da seduto, piede, mano."""
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
    # ── 1. definizioni delle metriche ───────────────────────
    edit(os.path.join(base, 'components/metrics/metrics-form.tsx'),
         """  { key: 'height', labelKey: 'mt_height', unit: 'cm', descKey: 'mtDesc_height', min: 100, max: 250, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'body_weight', labelKey: 'mt_body_weight', unit: 'kg', descKey: 'mtDesc_body_weight', min: 30, max: 180, step: 0.1, higherIsBetter: false, category: 'anthropometric' },
  { key: 'wing_span', labelKey: 'mt_wing_span', unit: 'cm', descKey: 'mtDesc_wing_span', min: 100, max: 280, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'body_fat', labelKey: 'mt_body_fat', unit: '%', descKey: 'mtDesc_body_fat', min: 3, max: 40, step: 0.1, higherIsBetter: false, category: 'anthropometric' },""",
         """  { key: 'height', labelKey: 'mt_height', unit: 'cm', descKey: 'mtDesc_height', min: 100, max: 250, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'sitting_height', labelKey: 'mt_sitting_height', unit: 'cm', descKey: 'mtDesc_sitting_height', min: 60, max: 130, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'standing_reach', labelKey: 'mt_standing_reach', unit: 'cm', descKey: 'mtDesc_standing_reach', min: 150, max: 320, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'body_weight', labelKey: 'mt_body_weight', unit: 'kg', descKey: 'mtDesc_body_weight', min: 30, max: 180, step: 0.1, higherIsBetter: false, category: 'anthropometric' },
  { key: 'wing_span', labelKey: 'mt_wing_span', unit: 'cm', descKey: 'mtDesc_wing_span', min: 100, max: 280, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'hand_length', labelKey: 'mt_hand_length', unit: 'cm', descKey: 'mtDesc_hand_length', min: 10, max: 30, step: 0.1, higherIsBetter: true, category: 'anthropometric' },
  { key: 'foot_length', labelKey: 'mt_foot_length', unit: 'cm', descKey: 'mtDesc_foot_length', min: 15, max: 40, step: 0.1, higherIsBetter: true, category: 'anthropometric' },
  { key: 'body_fat', labelKey: 'mt_body_fat', unit: '%', descKey: 'mtDesc_body_fat', min: 3, max: 40, step: 0.1, higherIsBetter: false, category: 'anthropometric' },""",
         'metricTypeDefs')

    # ── 2. scheda "Profilo fisico" dell'atleta ──────────────
    edit(os.path.join(base, 'app/dashboard/athletes/[id]/page.tsx'),
         "const ANTHROPOMETRIC_KEYS = ['height', 'body_weight', 'wing_span', 'body_fat'];",
         "const ANTHROPOMETRIC_KEYS = ['height', 'sitting_height', 'standing_reach', 'body_weight', 'wing_span', 'hand_length', 'foot_length', 'body_fat'];",
         'ANTHROPOMETRIC_KEYS')

# ── 3. etichette e descrizioni ──────────────────────────────
KEYS = {
    'it': [
        ('mt_sitting_height', 'Altezza da seduto'),
        ('mtDesc_sitting_height', 'Da seduto, dalla seduta alla sommità del capo'),
        ('mt_standing_reach', 'Reach'),
        ('mtDesc_standing_reach', 'In piedi, altezza raggiunta dalla punta delle dita a braccio alzato'),
        ('mt_hand_length', 'Lunghezza mano'),
        ('mtDesc_hand_length', 'Dalla piega del polso alla punta del dito medio'),
        ('mt_foot_length', 'Lunghezza piede'),
        ('mtDesc_foot_length', "Dal tallone alla punta dell'alluce"),
    ],
    'en': [
        ('mt_sitting_height', 'Sitting height'),
        ('mtDesc_sitting_height', 'Seated, from the seat to the top of the head'),
        ('mt_standing_reach', 'Standing reach'),
        ('mtDesc_standing_reach', 'Standing, fingertip height with the arm raised'),
        ('mt_hand_length', 'Hand length'),
        ('mtDesc_hand_length', 'From the wrist crease to the tip of the middle finger'),
        ('mt_foot_length', 'Foot length'),
        ('mtDesc_foot_length', 'From the heel to the tip of the big toe'),
    ],
    'es': [
        ('mt_sitting_height', 'Altura sentado'),
        ('mtDesc_sitting_height', 'Sentado, del asiento a la parte superior de la cabeza'),
        ('mt_standing_reach', 'Alcance de pie'),
        ('mtDesc_standing_reach', 'De pie, altura de la punta de los dedos con el brazo levantado'),
        ('mt_hand_length', 'Longitud de la mano'),
        ('mtDesc_hand_length', 'Del pliegue de la muñeca a la punta del dedo medio'),
        ('mt_foot_length', 'Longitud del pie'),
        ('mtDesc_foot_length', 'Del talón a la punta del dedo gordo'),
    ],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('metrics')
        if ns is None:
            print('  SKIP (no metrics ns)', path)
            continue
        anchor = next((l for l in src.split(nl) if '"mt_body_fat"' in l), None)
        if anchor is None:
            print('  SKIP (no anchor)', path)
            continue
        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in ns]
        if not added:
            print('  OK (already patched)', path)
            continue
        out = src.replace(anchor, anchor + nl + nl.join(added), 1)
        json.loads(out)
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('  patched %-2s %s (+%d)' % (loc, path, len(added)))

print('fatto')
