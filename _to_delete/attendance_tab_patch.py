# -*- coding: utf-8 -*-
"""Sotto-scheda 'Presenze' dentro Analisi."""
import io, os

ROOTS = [
    ('trainmind-app', 'apps/web/src'),
    ('trainmind-mobile', 'web/src'),
]


def patch(root, base):
    idx = os.path.join(root, base, 'components/analytics/index.ts')
    page = os.path.join(root, base, 'app/dashboard/analytics/page.tsx')
    if not os.path.exists(page):
        print('  skip (assente)', page)
        return

    # ── barrel ──────────────────────────────────────────────────────────
    s = io.open(idx, encoding='utf-8').read()
    if 'attendance-panel' not in s:
        s = s.rstrip('\n') + "\nexport { AttendancePanel } from './attendance-panel';\n"
        io.open(idx, 'w', encoding='utf-8', newline='').write(s)
        print('  patched', idx)

    # ── pagina ──────────────────────────────────────────────────────────
    s = io.open(page, encoding='utf-8').read()

    def sub(old, new, label):
        assert s.count(old) == 1, '%s: "%s" non trovata o non unica (%d)' % (page, label, s.count(old))
        return s.replace(old, new)

    s = sub("import { Activity, Users, Heart, TrendingUp, Info, RotateCcw } from 'lucide-react';",
            "import { Activity, Users, Heart, TrendingUp, Info, RotateCcw, ClipboardCheck } from 'lucide-react';",
            'import icone')

    s = sub("import { PerformanceCharts, WellnessHeatmap, AcwrChart, TeamOverview } from '@/components/analytics';",
            "import { PerformanceCharts, WellnessHeatmap, AcwrChart, TeamOverview, AttendancePanel } from '@/components/analytics';",
            'import componenti')

    s = sub("type Tab = 'team' | 'performance' | 'wellness' | 'acwr';",
            "type Tab = 'team' | 'performance' | 'wellness' | 'acwr' | 'attendance';",
            'tipo Tab')

    s = sub("""  { key: 'acwr', labelKey: 'tabAcwr', icon: Activity },
];""",
            """  { key: 'acwr', labelKey: 'tabAcwr', icon: Activity },
  { key: 'attendance', labelKey: 'tabAttendance', icon: ClipboardCheck },
];""",
            'voce tab')

    s = sub("""      {activeTab === 'acwr' && (
        <AcwrChart athleteId={athleteId} teamId={teamId} dateFrom={dateFrom} dateTo={dateTo} />
      )}""",
            """      {activeTab === 'acwr' && (
        <AcwrChart athleteId={athleteId} teamId={teamId} dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === 'attendance' && (
        <AttendancePanel athleteId={athleteId} teamId={teamId} dateFrom={dateFrom} dateTo={dateTo} />
      )}""",
            'contenuto tab')

    io.open(page, 'w', encoding='utf-8', newline='').write(s)
    print('  patched', page)


for root, base in ROOTS:
    patch(root, base)
