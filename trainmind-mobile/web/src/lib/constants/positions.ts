/** Ruoli di gioco.
 *
 *  Nel database si salva SEMPRE la sigla (`PG`, `SG`, `SF`, `PF`, `C`): e' la
 *  forma che le card mostrano ed e' quella che i seed demo scrivevano gia'.
 *  I nomi per esteso vivono solo qui, per le etichette.
 *
 *  Questa lista viveva in due posti — qui per esteso e nel database in sigla —
 *  e il filtro per ruolo non trovava mai niente. Se aggiungi un ruolo, aggiungilo
 *  QUI e allinea i seed in `packages/db/prisma/seed*.ts`.
 */
export const BASKETBALL_POSITIONS = [
  { code: 'PG', name: 'Point Guard' },
  { code: 'SG', name: 'Shooting Guard' },
  { code: 'SF', name: 'Small Forward' },
  { code: 'PF', name: 'Power Forward' },
  { code: 'C', name: 'Center' },
] as const;

export type BasketballPosition = (typeof BASKETBALL_POSITIONS)[number]['code'];

/** Le sole sigle, per le validazioni */
export const POSITION_CODES = BASKETBALL_POSITIONS.map((p) => p.code);

/** Opzioni per i Select: valore = sigla, etichetta = "SG — Shooting Guard" */
export const POSITION_OPTIONS = BASKETBALL_POSITIONS.map((p) => ({
  value: p.code,
  label: `${p.code} \u2014 ${p.name}`,
}));

/** Nome per esteso di una sigla. I dati vecchi per esteso restano leggibili. */
export function positionName(value: string | null | undefined): string {
  if (!value) return '';
  const found = BASKETBALL_POSITIONS.find((p) => p.code === value);
  if (found) return found.name;
  const byName = BASKETBALL_POSITIONS.find((p) => p.name === value);
  return byName ? byName.name : value;
}

/** Sigla da mostrare sulle card. Regge anche un dato vecchio per esteso. */
export function positionShort(value: string | null | undefined): string {
  if (!value) return '';
  const byName = BASKETBALL_POSITIONS.find((p) => p.name === value);
  return byName ? byName.code : value;
}
