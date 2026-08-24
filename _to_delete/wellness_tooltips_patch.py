# -*- coding: utf-8 -*-
"""Legenda per colonna: passando il mouse sul nome si vede la scala 1-5."""
import io
import os

for base in ['trainmind-app/apps/web/src', 'trainmind-mobile/web/src']:
    p = os.path.join(base, 'app/dashboard/wellness/page.tsx')
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw

    def sub(old, new, label):
        global s
        assert s.count(old) == 1, '%s: ancora "%s" trovata %d volte' % (p, label, s.count(old))
        s = s.replace(old, new)

    # helper
    sub("""  const selectClass =""",
        """  // Legenda della singola voce: la scala 1-5 con le sue etichette, mostrata
  // passando il mouse sul nome della colonna. Su tutte le voci 5 è il migliore.
  const scaleHint = (labelsKey: string, colLabel: string) => {
    let labels: string[] | null = null;
    try {
      const raw = t.raw(labelsKey);
      if (Array.isArray(raw)) labels = raw as string[];
    } catch {
      labels = null;
    }
    if (!labels) return colLabel;
    return `${colLabel}\\n${labels.map((l, i) => `${i + 1} — ${l}`).join('\\n')}`;
  };

  const headClass =
    'pb-3 text-center font-medium text-slate-500 dark:text-slate-400 cursor-help underline decoration-dotted decoration-slate-300 underline-offset-4';

  const selectClass =""",
        'helper scaleHint')

    # intestazioni con tooltip
    sub("""                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('sleepCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('fatigueCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('sorenessCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('stressCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('moodCol')}</th>""",
        """                  <th className={headClass} title={scaleHint('sleepLabels', t('sleepCol'))}>{t('sleepCol')}</th>
                  <th className={headClass} title={scaleHint('fatigueLabels', t('fatigueCol'))}>{t('fatigueCol')}</th>
                  <th className={headClass} title={scaleHint('sorenessLabels', t('sorenessCol'))}>{t('sorenessCol')}</th>
                  <th className={headClass} title={scaleHint('stressLabels', t('stressCol'))}>{t('stressCol')}</th>
                  <th className={headClass} title={scaleHint('moodLabels', t('moodCol'))}>{t('moodCol')}</th>""",
        'intestazioni con tooltip')

    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    print('  patched', p)

print('fatto')
