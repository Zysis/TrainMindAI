import { LegalPage } from '@/components/legal/legal-page';

export const metadata = {
  title: 'Informativa Privacy — TrainMind',
  description:
    'Come TrainMind tratta i dati personali: dati di account, dati sanitari e di fitness, elaborazione tramite IA, conservazione e diritti degli interessati.',
};

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
