/**
 * Genera il seed SQL dei protocolli RTP di sistema da packages/types/src/rtp-library.ts.
 *
 * La libreria e' la fonte unica: questo script riscrive il blocco di seed dentro
 * la migration, cosi' TypeScript e SQL non possono divergere.
 *
 *   node --experimental-strip-types scripts/gen-rtp-seed.mjs > /tmp/seed.sql
 *
 * Gli id sono deterministici (`sys_<code>`, `sys_<code>_p<n>`, `sys_<code>_p<n>_c<m>`):
 * e' quello che rende il seed idempotente e che permette di ri-applicarlo senza
 * spezzare i protocolli gia' avviati, che puntano al template per id.
 */
import { RTP_SYSTEM_TEMPLATES } from '../packages/types/src/rtp-library.ts';

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? 'NULL' : String(v));
const b = (v) => (v ? 'TRUE' : 'FALSE');

const tpl = [], phs = [], crs = [];

for (const t of RTP_SYSTEM_TEMPLATES) {
  const tid = `sys_${t.code}`;
  tpl.push(`  (${q(tid)}, NULL, ${q(t.code)}, ${q(t.name)}, ${q(t.description ?? null)}, ${q(t.bodyZone ?? null)}, ${q(t.bodyRegion ?? null)}, ${q(t.injuryType ?? null)}, ${n(t.severityMin)}, ${n(t.severityMax)}, TRUE, TRUE)`);
  for (const p of t.phases) {
    const pid = `${tid}_p${p.order}`;
    phs.push(`  (${q(pid)}, ${q(tid)}, ${p.order}, ${q(p.name)}, ${q(p.goal ?? null)}, ${n(p.minDays)}, ${n(p.typicalDays)})`);
    for (const c of p.criteria) {
      crs.push(`  (${q(`${pid}_c${c.order}`)}, ${q(pid)}, ${c.order}, ${q(c.description)}, ${q(c.testCode ?? null)}, ${q(c.comparator ?? null)}, ${n(c.targetValue)}, ${q(c.unit ?? null)}, ${b(c.mandatory)})`);
    }
  }
}

const out = [];
out.push(`-- ${RTP_SYSTEM_TEMPLATES.length} template di sistema, ${phs.length} fasi, ${crs.length} criteri.`);
out.push('-- Generato da scripts/gen-rtp-seed.mjs: non modificare a mano, si rigenera.');
out.push('');
out.push('INSERT INTO rtp_templates (id, "organizationId", code, name, description, "bodyZone", "bodyRegion", "injuryType", "severityMin", "severityMax", "isSystem", "isActive") VALUES');
out.push(tpl.join(',\n') + `
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  "bodyZone" = EXCLUDED."bodyZone", "bodyRegion" = EXCLUDED."bodyRegion",
  "injuryType" = EXCLUDED."injuryType",
  "severityMin" = EXCLUDED."severityMin", "severityMax" = EXCLUDED."severityMax",
  "isSystem" = TRUE, "updatedAt" = NOW();`);
out.push('');
out.push('INSERT INTO rtp_template_phases (id, "templateId", "order", name, goal, "minDays", "typicalDays") VALUES');
out.push(phs.join(',\n') + `
ON CONFLICT (id) DO UPDATE SET
  "order" = EXCLUDED."order", name = EXCLUDED.name, goal = EXCLUDED.goal,
  "minDays" = EXCLUDED."minDays", "typicalDays" = EXCLUDED."typicalDays";`);
out.push('');
out.push('INSERT INTO rtp_template_criteria (id, "phaseId", "order", description, "testCode", comparator, "targetValue", unit, mandatory) VALUES');
out.push(crs.join(',\n') + `
ON CONFLICT (id) DO UPDATE SET
  "order" = EXCLUDED."order", description = EXCLUDED.description,
  "testCode" = EXCLUDED."testCode", comparator = EXCLUDED.comparator,
  "targetValue" = EXCLUDED."targetValue", unit = EXCLUDED.unit,
  mandatory = EXCLUDED.mandatory;`);
out.push('');
out.push('-- Righe di sistema non piu' + "'" + ` previste dalla libreria: via, cosi' una ri-esecuzione
-- lascia esattamente i template della libreria e nient'altro.`);
out.push(`DELETE FROM rtp_template_criteria c
  USING rtp_template_phases p, rtp_templates t
  WHERE c."phaseId" = p.id AND p."templateId" = t.id AND t."isSystem" AND c.id NOT IN (${crs.map((r) => r.trim().slice(1).split(',')[0]).join(', ')});`);
out.push(`DELETE FROM rtp_template_phases p
  USING rtp_templates t
  WHERE p."templateId" = t.id AND t."isSystem" AND p.id NOT IN (${phs.map((r) => r.trim().slice(1).split(',')[0]).join(', ')});`);
out.push(`DELETE FROM rtp_templates t
  WHERE t."isSystem" AND t.id NOT IN (${tpl.map((r) => r.trim().slice(1).split(',')[0]).join(', ')});`);

process.stdout.write(out.join('\n') + '\n');
