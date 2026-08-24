# -*- coding: utf-8 -*-
"""Infortuni: cinque tipi, nuovo campo Insorgenza, Localizzazione editabile."""
import io
import json
import os

# ─────────────────────────────────────────────────────────────
# 1. schema Prisma
# ─────────────────────────────────────────────────────────────
p = 'trainmind-app/packages/db/prisma/schema.prisma'
s = io.open(p, encoding='utf-8').read()
old = """model Injury {
  id           String       @id @default(cuid())
  athleteId    String
  type         String
  location     String // body part"""
new = """model Injury {
  id           String       @id @default(cuid())
  athleteId    String
  type         String // muscular, tendon, ligament, bone, joint
  onset        String? // contusive, overuse, traumatic, non_traumatic
  location     String // body part: codice predefinito oppure testo libero"""
assert s.count(old) == 1, 'model Injury'
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('  patched', p)

# ─────────────────────────────────────────────────────────────
# 2. API
# ─────────────────────────────────────────────────────────────
p = 'trainmind-app/apps/api/src/routes/injuries.ts'
s = io.open(p, encoding='utf-8').read()


def sub(old, new, label):
    global s
    assert s.count(old) == 1, 'ancora "%s" non trovata o non unica' % label
    s = s.replace(old, new)


sub("""    const body = request.body as {
      type: string;
      location: string;
      severity: number;
      dateOccurred: string;
      notes?: string;
    };""",
    """    const body = request.body as {
      type: string;
      onset?: string;
      location: string;
      severity: number;
      dateOccurred: string;
      notes?: string;
    };""",
    'POST body type')

sub("""        athleteId,
        type: body.type,
        location: body.location,""",
    """        athleteId,
        type: body.type,
        onset: body.onset || null,
        location: body.location,""",
    'POST create data')

sub("""    const body = request.body as {
      type?: string;
      location?: string;
      severity?: number;""",
    """    const body = request.body as {
      type?: string;
      onset?: string;
      location?: string;
      severity?: number;""",
    'PATCH body type')

sub("""        ...(body.type && { type: body.type }),
        ...(body.location && { location: body.location }),""",
    """        ...(body.type && { type: body.type }),
        ...(body.onset !== undefined && { onset: body.onset || null }),
        ...(body.location && { location: body.location }),""",
    'PATCH update data')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  patched', p)

# ─────────────────────────────────────────────────────────────
# 3. pagina Infortuni (entrambe le app)
# ─────────────────────────────────────────────────────────────
for base in ['trainmind-app/apps/web/src', 'trainmind-mobile/web/src']:
    p = os.path.join(base, 'app/dashboard/injuries/page.tsx')
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw

    def sub2(old, new, label):
        global s
        assert s.count(old) == 1, '%s: ancora "%s" trovata %d volte' % (p, label, s.count(old))
        s = s.replace(old, new)

    # 3a. tipi + insorgenza
    sub2("""const INJURY_TYPE_DEFS: { value: string; labelKey: string }[] = [
  { value: 'muscular', labelKey: 'typeMuscular' },
  { value: 'ligament', labelKey: 'typeLigament' },
  { value: 'tendon', labelKey: 'typeTendon' },
  { value: 'bone', labelKey: 'typeBone' },
  { value: 'joint', labelKey: 'typeJoint' },
  { value: 'contusion', labelKey: 'typeContusion' },
  { value: 'overuse', labelKey: 'typeOveruse' },
  { value: 'other', labelKey: 'typeOther' },
];""",
         """const INJURY_TYPE_DEFS: { value: string; labelKey: string }[] = [
  { value: 'muscular', labelKey: 'typeMuscular' },
  { value: 'tendon', labelKey: 'typeTendon' },
  { value: 'ligament', labelKey: 'typeLigament' },
  { value: 'bone', labelKey: 'typeBone' },
  { value: 'joint', labelKey: 'typeJoint' },
];

/** Tipi non più selezionabili: restano per leggere gli infortuni storici */
const LEGACY_TYPE_DEFS: { value: string; labelKey: string }[] = [
  { value: 'contusion', labelKey: 'typeContusion' },
  { value: 'overuse', labelKey: 'typeOveruse' },
  { value: 'other', labelKey: 'typeOther' },
];

const INJURY_ONSET_DEFS: { value: string; labelKey: string }[] = [
  { value: 'contusive', labelKey: 'onsetContusive' },
  { value: 'overuse', labelKey: 'onsetOveruse' },
  { value: 'traumatic', labelKey: 'onsetTraumatic' },
  { value: 'non_traumatic', labelKey: 'onsetNonTraumatic' },
];""",
         'INJURY_TYPE_DEFS')

    # 3b. form
    sub2("""interface InjuryForm {
  athleteId: string;
  type: string;
  location: string;""",
         """interface InjuryForm {
  athleteId: string;
  type: string;
  onset: string;
  location: string;""",
         'InjuryForm')

    sub2("""    athleteId: '', type: 'muscular', location: 'knee_r', severity: 3, dateOccurred: new Date().toISOString().slice(0, 10), notes: '',""",
         """    athleteId: '', type: 'muscular', onset: '', location: 'knee_r', severity: 3, dateOccurred: new Date().toISOString().slice(0, 10), notes: '',""",
         'valori iniziali')

    # 3c. elenchi tradotti + helper di etichettatura
    sub2("""  const BODY_LOCATIONS = useMemo<{ value: string; label: string }[]>(
    () => BODY_LOCATION_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),""",
         """  const INJURY_ONSETS = useMemo<{ value: string; label: string }[]>(
    () => INJURY_ONSET_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t],
  );
  /** Etichetta di un tipo, compresi quelli storici non più selezionabili */
  const typeLabelOf = useMemo(
    () => {
      const all = [...INJURY_TYPE_DEFS, ...LEGACY_TYPE_DEFS];
      return (value: string) => {
        const def = all.find((d) => d.value === value);
        return def ? t(def.labelKey) : value;
      };
    },
    [t],
  );
  const BODY_LOCATIONS = useMemo<{ value: string; label: string }[]>(
    () => BODY_LOCATION_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),""",
         'INJURY_ONSETS + typeLabelOf')

    # 3d. tipo mostrato tradotto invece che grezzo
    sub2("{rtpDetail.athlete.position} — {rtpDetail.injury.type} (",
         "{rtpDetail.athlete.position} — {typeLabelOf(rtpDetail.injury.type)} (",
         'tipo nel dettaglio RTP')
    sub2("<span className=\"text-slate-500 dark:text-slate-400\">{p.injury.type} — ",
         "<span className=\"text-slate-500 dark:text-slate-400\">{typeLabelOf(p.injury.type)} — ",
         'tipo nella lista RTP')

    # 3e. il modale: tipo + insorgenza, poi localizzazione editabile
    sub2("""          <div className="grid grid-cols-2 gap-4">
            <Select label={t('typeLabel')} options={INJURY_TYPES} value={injuryForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, type: e.target.value }))} />
            <Select label={t('locationLabel')} options={BODY_LOCATIONS} value={injuryForm.location} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, location: e.target.value }))} />
          </div>""",
         """          <div className="grid grid-cols-2 gap-4">
            <Select label={t('typeLabel')} options={INJURY_TYPES} value={injuryForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, type: e.target.value }))} />
            <Select
              label={t('onsetLabel')}
              options={[{ value: '', label: t('onsetNone') }, ...INJURY_ONSETS]}
              value={injuryForm.onset}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, onset: e.target.value }))}
            />
          </div>
          {/* Localizzazione: elenco di suggerimenti ma testo libero, per le sedi
              che non rientrano nell'elenco. Se il testo coincide con una voce
              nota si salva il suo codice, così resta tradotta. */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('locationLabel')}</label>
            <input
              list="injury-locations"
              value={BODY_LOCATIONS.find((l) => l.value === injuryForm.location)?.label ?? injuryForm.location}
              placeholder={t('locationPlaceholder')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const typed = e.target.value;
                const match = BODY_LOCATIONS.find((l) => l.label.toLowerCase() === typed.trim().toLowerCase());
                setInjuryForm((f: InjuryForm) => ({ ...f, location: match ? match.value : typed }));
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <datalist id="injury-locations">
              {BODY_LOCATIONS.map((l) => (
                <option key={l.value} value={l.label} />
              ))}
            </datalist>
          </div>""",
         'modale tipo/insorgenza/localizzazione')

    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched', p)

# ─────────────────────────────────────────────────────────────
# 4. invio dell'insorgenza al server
# ─────────────────────────────────────────────────────────────
for base in ['trainmind-app/apps/web/src', 'trainmind-mobile/web/src']:
    p = os.path.join(base, 'app/dashboard/injuries/page.tsx')
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw
    old = """            type: injuryForm.type,
            location: injuryForm.location,"""
    new = """            type: injuryForm.type,
            onset: injuryForm.onset || undefined,
            location: injuryForm.location,"""
    assert s.count(old) == 1, '%s: corpo della POST' % p
    s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched invio onset →', p)

# ─────────────────────────────────────────────────────────────
# 5. etichette
# ─────────────────────────────────────────────────────────────
KEYS = {
    'it': [('onsetLabel', 'Insorgenza'),
           ('onsetNone', 'Non specificata'),
           ('onsetContusive', 'Contusivo'),
           ('onsetOveruse', 'Da sovraccarico'),
           ('onsetTraumatic', 'Traumatico'),
           ('onsetNonTraumatic', 'Non traumatico'),
           ('locationPlaceholder', 'Scegli o scrivi la sede')],
    'en': [('onsetLabel', 'Onset'),
           ('onsetNone', 'Not specified'),
           ('onsetContusive', 'Contusive'),
           ('onsetOveruse', 'Overuse'),
           ('onsetTraumatic', 'Traumatic'),
           ('onsetNonTraumatic', 'Non-traumatic'),
           ('locationPlaceholder', 'Pick or type the site')],
    'es': [('onsetLabel', 'Aparición'),
           ('onsetNone', 'No especificada'),
           ('onsetContusive', 'Contusiva'),
           ('onsetOveruse', 'Por sobrecarga'),
           ('onsetTraumatic', 'Traumática'),
           ('onsetNonTraumatic', 'No traumática'),
           ('locationPlaceholder', 'Elige o escribe la zona')],
}

for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src).get('injuries')
        anchor = next((l for l in src.split(nl) if '"typeMuscular"' in l), None)
        if ns is None or anchor is None:
            print('  SKIP', path)
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
