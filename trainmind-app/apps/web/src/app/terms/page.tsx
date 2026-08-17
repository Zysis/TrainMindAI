import { LegalPage } from '@/components/legal/legal-page';

// Metadati in italiano: sono statici e non seguono lo switcher di lingua,
// mentre il testo del documento sì (v. components/legal/legal-page.tsx).
export const metadata = {
  title: 'Termini di Servizio — TrainMind',
  description:
    'Condizioni di utilizzo della piattaforma TrainMind: account, abbonamenti, uso consentito, trasparenza sull’intelligenza artificiale e responsabilità.',
};

export default function TermsPage() {
  return <LegalPage doc="terms" />;
}
