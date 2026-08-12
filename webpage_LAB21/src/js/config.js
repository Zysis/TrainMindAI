/* ============================================================
   LAB21 — configurazione del sito
   Unico punto in cui cambiare contatti, link esterni e social.
   Tutti i link nell'HTML usano data-link="<chiave>".
   ============================================================ */
export const site = {
  email: 'info@lab21.it',
  emailSubject: 'Richiesta informazioni — LAB21',
  vat: '00000000000',

  links: {
    // Ingresso all'app TrainMind (landing con login e registrazione).
    // In sviluppo punta al Next del monorepo, che `pnpm dev` avvia
    // insieme a questo sito; in produzione TrainMind vive in un
    // sottopercorso dello stesso dominio, quindi basta un path relativo.
    // Per puntare altrove: VITE_TRAINMIND_URL in un file .env locale.
    trainmind: import.meta.env.VITE_TRAINMIND_URL
      || (import.meta.env.DEV ? 'http://localhost:3000' : '/app'),

    // Fase 1: l'unica azione della pagina è l'iscrizione alla lista d'attesa.
    // TODO: sostituire con l'URL del modulo appena è collegato al database.
    waitlist: '#',
    // TODO: handle social da registrare (@lab21.sport)
    instagram: '#',
    linkedin: '#',
    youtube: '#'
  }
}
