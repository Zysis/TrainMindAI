'use client';

import { useEffect } from 'react';

/**
 * Comparsa progressiva degli elementi `.rv` allo scroll (stile LAB21).
 *
 * Osserva tutti i nodi con classe `.rv` dentro il container indicato e,
 * quando entrano nel viewport, aggiunge `.in` che fa scattare la
 * transizione definita in landing.css.
 *
 * L'observer smette di osservare ogni nodo appena rivelato: l'animazione
 * parte una volta sola, non si ripete scrollando avanti e indietro.
 *
 * Con "riduci animazioni" attivo salta tutto e mostra subito il contenuto,
 * cosi la pagina resta leggibile anche senza transizioni.
 */
export function useReveal(rootRef?: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef?.current ?? document;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.rv'));
    if (nodes.length === 0) return;

    // Preferenze di accessibilita': niente animazioni, contenuto visibile.
    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      nodes.forEach((n) => n.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [rootRef]);
}
