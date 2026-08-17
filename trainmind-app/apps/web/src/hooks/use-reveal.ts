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
 *
 * ── Perche' c'e' un MutationObserver ──────────────────────────
 * `.rv` parte da `opacity: 0`: se un nodo sfugge all'osservazione resta
 * invisibile per sempre, e il contenuto sparisce dalla pagina senza errori
 * in console. E' successo davvero con la fascia numeri: il cambio di lingua
 * dopo l'hydration ricreava quei nodi (erano keyed sul testo tradotto) e
 * l'IntersectionObserver restava agganciato a quelli buttati via.
 *
 * La causa e' stata corretta, ma qui teniamo comunque una rete di sicurezza:
 * ogni `.rv` che compare nel DOM dopo il primo giro viene agganciato
 * automaticamente. Meglio un'animazione di troppo che una sezione invisibile.
 */
export function useReveal(rootRef?: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const root: ParentNode = rootRef?.current ?? document;

    // Preferenze di accessibilita': niente animazioni, contenuto visibile.
    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      root.querySelectorAll<HTMLElement>('.rv').forEach((n) => n.classList.add('in'));
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

    /** Aggancia i nodi non ancora rivelati (ri-osservare e' innocuo). */
    const observeAll = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>('.rv').forEach((n) => {
        if (!n.classList.contains('in')) io.observe(n);
      });
    };

    observeAll(root);

    // Rete di sicurezza: intercetta i `.rv` aggiunti al DOM piu' tardi
    // (re-render che ricreano nodi, contenuto condizionale, liste keyed).
    const mo = new MutationObserver((records) => {
      records.forEach((r) => {
        r.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList.contains('in')) return;
          if (node.classList.contains('rv')) io.observe(node);
          observeAll(node);
        });
      });
    });
    mo.observe(root instanceof Document ? root.body : (root as HTMLElement), {
      childList: true,
      subtree: true,
    });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [rootRef]);
}
