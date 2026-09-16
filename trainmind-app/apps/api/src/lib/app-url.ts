/**
 * Indirizzi pubblici delle due app, per i link che escono da qui: email di
 * invito, link di reset password, ritorni da Stripe.
 *
 * Perche' un file solo. La variabile giusta e' `APP_PUBLIC_URL`, che il
 * compose di produzione valorizza con dominio e sottopercorso
 * (https://<dominio>/app). Alcune rotte pero' leggevano `APP_URL`, che in
 * produzione non e' definita: ripiegavano quindi su `http://localhost:3000` e
 * spedivano agli utenti link che sulla loro macchina non portano da nessuna
 * parte. Capitava agli inviti allo staff e ai ritorni da Stripe.
 *
 * Il ripiego su localhost resta, ma solo come ultima spiaggia per lo
 * sviluppo: in produzione la variabile c'e' sempre.
 */

/** Base dell'app preparatori. Include gia' l'eventuale sottopercorso. */
export function appPublicUrl(): string {
  return process.env.APP_PUBLIC_URL || process.env.APP_URL || 'http://localhost:3000';
}

/** Base della PWA atleti, che sta su un dominio suo. */
export function athleteAppUrl(): string {
  return process.env.ATHLETE_APP_URL || 'http://localhost:3003';
}
