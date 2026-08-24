# -*- coding: utf-8 -*-
"""Filtri data su Analisi: props dateFrom/dateTo nei componenti + lookback ACWR nell'API."""
import io

BASES = [
    'trainmind-app/apps/web/src/components/analytics/',
    'trainmind-mobile/web/src/components/analytics/',
]

COMPONENTS = [
    ('performance-charts.tsx', 'PerformanceChartsProps', 'PerformanceCharts', '30'),
    ('wellness-heatmap.tsx', 'WellnessHeatmapProps', 'WellnessHeatmap', '14'),
    ('acwr-chart.tsx', 'AcwrChartProps', 'AcwrChart', '60'),
]

for base, (filename, props_name, fn_name, default_days) in [
    (b, c) for b in BASES for c in COMPONENTS
]:
    path = base + filename
    s = io.open(path, encoding='utf-8').read()

    # 1. props
    old = 'interface %s {\n  athleteId?: string;\n  teamId?: string | null;\n  days?: number;\n}' % props_name
    new = ('interface %s {\n  athleteId?: string;\n  teamId?: string | null;\n'
           '  days?: number;\n  /** yyyy-mm-dd: quando presenti hanno la precedenza su days */\n'
           '  dateFrom?: string;\n  dateTo?: string;\n}' % props_name)
    assert s.count(old) == 1, 'props %s' % filename
    s = s.replace(old, new)

    # 2. signature
    old = 'export function %s({ athleteId, teamId, days = %s }: %s) {' % (fn_name, default_days, props_name)
    new = 'export function %s({ athleteId, teamId, days = %s, dateFrom, dateTo }: %s) {' % (
        fn_name, default_days, props_name)
    assert s.count(old) == 1, 'signature %s' % filename
    s = s.replace(old, new)

    # 3. query params
    old = "        const params = new URLSearchParams({ days: days.toString() });\n"
    new = ("        const params = new URLSearchParams({ days: days.toString() });\n"
           "        if (dateFrom) params.set('from', dateFrom);\n"
           "        if (dateTo) params.set('to', dateTo);\n")
    assert s.count(old) == 1, 'params %s' % filename
    s = s.replace(old, new)

    # 4. effect deps
    old = '  }, [athleteId, teamId, days]);'
    new = '  }, [athleteId, teamId, days, dateFrom, dateTo]);'
    assert s.count(old) == 1, 'deps %s' % filename
    s = s.replace(old, new)

    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('patched', path)

# ── API: ACWR legge 28 giorni prima dell'inizio richiesto ──────────────
api = 'trainmind-app/apps/api/src/routes/analytics.ts'
s = io.open(api, encoding='utf-8').read()

old = """    const to = query.to ? new Date(query.to) : new Date();
    const from = new Date(to.getTime() - Math.max(query.days, 28) * 86400000);

    const acwrSessionWhere: Record<string, unknown> = {"""
new = """    const to = query.to ? new Date(query.to) : new Date();
    // Inizio richiesto (filtro date) oppure finestra `days`.
    const displayFrom = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - Math.max(query.days, 28) * 86400000);
    // Il carico cronico guarda indietro 21 giorni: si leggono 28 giorni in più
    // prima dell'inizio, così il primo punto del grafico è già calcolabile.
    const from = new Date(displayFrom.getTime() - 28 * 86400000);

    const acwrSessionWhere: Record<string, unknown> = {"""
assert s.count(old) == 1, 'blocco date acwr'
s = s.replace(old, new)

old = "      const startDate = new Date(from.getTime() + 21 * 86400000);"
new = "      const startDate = new Date(displayFrom.getTime());"
assert s.count(old) == 1, 'startDate acwr'
s = s.replace(old, new)

io.open(api, 'w', encoding='utf-8', newline='').write(s)
print('patched', api)
