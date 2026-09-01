import { redirect } from 'next/navigation';

/**
 * La lista atleti vive in fondo alla scheda Squadre: una lista sola, un posto
 * solo. Questa rotta resta per non rompere i link vecchi e i preferiti.
 * Il dettaglio del singolo atleta (`/dashboard/athletes/[id]`) non e' toccato.
 */
export default function AthletesPage() {
  redirect('/dashboard/teams');
}
