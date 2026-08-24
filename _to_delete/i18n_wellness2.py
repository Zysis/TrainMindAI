# -*- coding: utf-8 -*-
import io, json, os
KEYS = {
    'it': [('noLogsInRange', 'Nessun log nel periodo selezionato'),
           ('clearDateFilter', 'Mostra tutte le date')],
    'en': [('noLogsInRange', 'No logs in the selected period'),
           ('clearDateFilter', 'Show all dates')],
    'es': [('noLogsInRange', 'Ningún registro en el periodo seleccionado'),
           ('clearDateFilter', 'Mostrar todas las fechas')],
}
for d in ['trainmind-app/apps/web/src/messages', 'trainmind-mobile/web/src/messages']:
    for loc, pairs in KEYS.items():
        path = os.path.join(d, loc + '.json')
        src = io.open(path, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in src else '\n'
        ns = json.loads(src)['wellness']
        anchor = next((l for l in src.split(nl) if '"recentLogs"' in l), None)
        added = ['    %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                 for k, v in pairs if k not in ns]
        if not added:
            print('OK (already patched)', path); continue
        out = src.replace(anchor, anchor + nl + nl.join(added), 1)
        json.loads(out)
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
        print('patched %-2s %s (+%d)' % (loc, path, len(added)))
