import { LegalPage } from '@/components/legal/legal-page';

export const metadata = {
  title: 'Cookie Policy — TrainMind',
  description:
    'Quali cookie e tecnologie simili usa TrainMind, come funziona il consenso e come modificare le preferenze in qualsiasi momento.',
};

export default function CookiesPage() {
  return <LegalPage doc="cookies" />;
}
