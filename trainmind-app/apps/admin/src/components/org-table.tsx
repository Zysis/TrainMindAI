'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { OrgRow } from '@/lib/queries/orgs';
import { Badge, Table, TierBadge } from '@/components/ui';
import { fmtAgo, fmtDate, fmtUsd } from '@/lib/format';

type SortKey = 'createdAt' | 'lastSeen' | 'athletes' | 'aiCost' | 'name';

export function OrgTable({ rows }: { rows: OrgRow[] }) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [sort, setSort] = useState<SortKey>('createdAt');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (tier && r.tier !== tier) return false;
      if (!needle) return true;
      return r.name.toLowerCase().includes(needle) || r.slug.toLowerCase().includes(needle);
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name, 'it');
        case 'athletes':
          return b.athletes - a.athletes;
        case 'aiCost':
          return b.aiCost - a.aiCost;
        case 'lastSeen':
          // Chi non si e' mai visto va in fondo, non in cima.
          return (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '');
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [rows, search, tier, sort]);

  const control =
    'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome"
          className={`${control} min-w-[12rem] flex-1`}
          aria-label="Cerca società"
        />
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={control} aria-label="Filtra per piano">
          <option value="">Tutti i piani</option>
          <option value="STARTER">Starter</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="ULTRA">Ultra</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className={control}
          aria-label="Ordina"
        >
          <option value="createdAt">Più recenti</option>
          <option value="lastSeen">Ultima attività</option>
          <option value="athletes">Più atleti</option>
          <option value="aiCost">Costo AI</option>
          <option value="name">Nome</option>
        </select>
        <span className="text-sm text-slate-500">
          {visible.length} società
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          {rows.length === 0
            ? 'Nessuna società registrata: al momento tutte le organizzazioni nel database sono account di prova, esclusi dalle statistiche.'
            : 'Nessuna società corrisponde ai filtri.'}
        </p>
      ) : (
        <Table
          head={['Società', 'Piano', 'Iscritta', 'Ultima attività', 'Utenti', 'Squadre', 'Atleti', 'Costo AI']}
        >
          {visible.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link href={`/societa/${o.id}`} className="text-teal-700 hover:underline">
                  {o.name}
                </Link>
                {o.isDemo ? (
                  <span className="ml-2">
                    <Badge tone="warning">prova</Badge>
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2"><TierBadge tier={o.tier} /></td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(o.createdAt)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtAgo(o.lastSeen)}</td>
              <td className="px-3 py-2 tabular-nums text-slate-900">{o.users}</td>
              <td className="px-3 py-2 tabular-nums text-slate-900">{o.teams}</td>
              <td className="px-3 py-2 tabular-nums text-slate-900">{o.athletes}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-900">{fmtUsd(o.aiCost)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
