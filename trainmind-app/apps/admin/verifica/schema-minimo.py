# Genera il DDL minimo (solo le tabelle che la console interroga) leggendo
# schema.prisma. Serve a montare un Postgres vuoto identico a quello vero su
# cui far girare i controlli, senza toccare il database di produzione.
#
# Uso:  python3 schema-minimo.py     (con schema.prisma nella stessa cartella)

import re, io

src = io.open('schema.prisma', encoding='utf-8').read()

# Solo le tabelle lette dalla console. Se una query nuova ne tocca un'altra,
# va aggiunta qui, altrimenti il controllo fallisce con "relation does not exist".
WANT = {'Organization', 'User', 'ConsentRecord', 'AuditLog', 'AiUsageLog',
        'AthleteInvite', 'Athlete', 'Team', 'TrainingSession', 'WellnessLog'}

TYPE = {'String': 'text', 'Int': 'integer', 'Float': 'double precision',
        'Boolean': 'boolean', 'DateTime': 'timestamptz', 'Json': 'jsonb',
        'Decimal': 'numeric', 'BigInt': 'bigint'}

enums = {}
for m in re.finditer(r'^enum\s+(\w+)\s*\{([^}]*)\}', src, re.M):
    name, body = m.group(1), m.group(2)
    vals = [l.split('//')[0].strip() for l in body.splitlines()
            if l.strip() and not l.strip().startswith('/')]
    enums[name] = [v for v in vals if v]

models = {}
for m in re.finditer(r'^model\s+(\w+)\s*\{(.*?)^\}', src, re.M | re.S):
    models[m.group(1)] = m.group(2)

out = ['CREATE TYPE "%s" AS ENUM (%s);' % (n, ', '.join("'%s'" % v for v in vals))
       for n, vals in enums.items()]

for name in sorted(WANT):
    body = models[name]
    table = re.search(r'@@map\("([^"]+)"\)', body)
    table = table.group(1) if table else name.lower()
    cols = []
    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith('//') or s.startswith('@@'):
            continue
        mm = re.match(r'^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$', s)
        if not mm:
            continue
        fname, ftype, arr, opt, rest = mm.groups()
        if ftype in models:      # e' una relazione, non una colonna
            continue
        if ftype in TYPE:
            pg = TYPE[ftype]
            d = re.search(r'@db\.Decimal\((\d+),\s*(\d+)\)', rest)
            if d:
                pg = 'numeric(%s,%s)' % (d.group(1), d.group(2))
        elif ftype in enums:
            pg = '"%s"' % ftype
        else:
            continue
        if arr:
            pg += '[]'
        col = '"%s" %s' % (fname, pg)
        if '@id' in rest:
            col += ' PRIMARY KEY'
        elif not opt:
            col += ' NOT NULL'
        cols.append(col)
    out.append('CREATE TABLE "%s" (\n  %s\n);' % (table, ',\n  '.join(cols)))

io.open('ddl.sql', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('scritto ddl.sql —', len(WANT), 'tabelle,', len(enums), 'enum')
