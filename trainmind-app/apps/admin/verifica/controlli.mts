/**
 * Controlli sulle query della console.
 *
 * Girano su un Postgres vuoto popolato con dati-di-prova.sql e verificano che
 * i numeri che escono siano quelli attesi. Istruzioni in LEGGIMI.md.
 */
import * as overview from '@/lib/queries/overview';
import * as acquisition from '@/lib/queries/acquisition';
import * as activation from '@/lib/queries/activation';
import * as usage from '@/lib/queries/usage';
import * as orgs from '@/lib/queries/orgs';
import * as costs from '@/lib/queries/costs';
import * as contacts from '@/lib/queries/contacts';

let bad = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  OK   ${label} = ${a}`);
  else {
    bad++;
    console.log(`  FAIL ${label}\n       atteso   ${e}\n       ottenuto ${a}`);
  }
}

const ov = await overview.getOverview();
check('società reali (A,B,C)', ov.orgs, 3);
check('org di prova esclusa (D)', ov.demoOrgs, 1);
check('utenti staff', ov.staffUsers, 4);
check('atleti', ov.athletes, 1);
check('squadre', ov.teams, 2);
check('nuove in 30 giorni (B,C)', ov.orgsNew30, 2);
check('nuove in 7 giorni (C)', ov.orgsNew7, 1);
check('attive in 30 giorni (A,B,C)', ov.orgsActive30, 3);
check('costo AI 30 giorni: solo A, la demo non conta', Number(ov.aiCost30.toFixed(5)), 0.00123);

check('mix piani in ordine fisso', await overview.getTierBreakdown(), [
  { tier: 'STARTER', count: 1 },
  { tier: 'PROFESSIONAL', count: 1 },
  { tier: 'ULTRA', count: 1 },
]);

const fun = await activation.getActivationFunnel();
check('valutabili: A e B, C troppo recente', fun.eligible, 2);
// La squadra la contano in due: anche B ne aveva creata una, semplicemente non
// ci ha mai messo dentro nessuno. Non e' un errore della query.
check('passi entro 7 giorni', fun.steps.map((s) => s.count), [2, 1, 1, 1, 1]);
check('quota atleta', fun.steps[1].pct, 50);

check(
  'da richiamare: solo B',
  (await activation.getStalledOrgs()).map((o) => o.name),
  ['Basket Beta'],
);

const inv = await usage.getInviteFunnel();
check('inviti (la demo non ne ha)', [inv.sent, inv.accepted], [1, 1]);

check('aree usate, demo esclusa', await usage.getTopResources(), [
  { resource: 'athlete', count: 2 },
  { resource: 'wellness_log', count: 1 },
]);

check(
  'elenco senza demo, dal piu recente',
  (await orgs.listOrgs(false)).map((o) => o.name),
  ['Basket Gamma', 'Basket Beta', 'Basket Alfa'],
);
check('elenco con demo', (await orgs.listOrgs(true)).length, 4);

check(
  'costi per società: la demo da 0,90 $ non compare',
  (await costs.getAiCostByOrg()).map((c) => c.name),
  ['Basket Alfa'],
);

check(
  'contatti: Anna sì, Bruno ha revocato, demo esclusa',
  (await contacts.listMarketingContacts()).map((c) => c.email),
  ['a@reale.it'],
);

const opt = await acquisition.getMarketingOptIn();
check('opt-in marketing: 1 su 3 titolari', [opt.granted, opt.total], [1, 3]);

check('lingue alla registrazione', await acquisition.getSignupLanguages(), [
  { language: 'en', count: 1 },
  { language: 'es', count: 1 },
  { language: 'it', count: 1 },
]);

const detail = await orgs.getOrgDetail('A');
check(
  'scheda A: atleti, sessioni, wellness, membri',
  [detail?.athletes, detail?.sessions, detail?.wellnessLogs, detail?.members.length],
  [1, 1, 1, 2],
);

console.log(bad === 0 ? '\nTUTTI I CONTROLLI PASSANO' : `\n${bad} CONTROLLI FALLITI`);
process.exit(bad === 0 ? 0 : 1);
