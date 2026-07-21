'use client';

import { cn } from '@trainmind/ui';
import type { HTMLAttributes, TableHTMLAttributes } from 'react';

/**
 * Wraps a <table> with horizontal scroll on mobile.
 * Visual identity (borders, paddings) untouched — wrapper is invisible.
 *
 * Usage:
 *   <ResponsiveTable>
 *     <table>...</table>
 *   </ResponsiveTable>
 *
 * For card-stack on mobile, add data-mobile="cards" on the <table> and
 * data-label="…" on each <td>. CSS in globals.css handles transformation.
 */
export function ResponsiveTable({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('table-scroll', className)} {...rest}>
      {children}
    </div>
  );
}

/** Drop-in <Table> replacing raw <table> when you also want min-width auto. */
export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full min-w-full', className)} {...rest} />;
}
