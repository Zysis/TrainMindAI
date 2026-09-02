import * as React from 'react';
import { cn } from '../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /**
   * Intestazione sotto cui raggruppare la voce (`<optgroup>`).
   *
   * Serve quando in una tendina convivono cose di natura diversa — una
   * modalita' e un elenco di oggetti, per esempio — e non si capisce a colpo
   * d'occhio che la prima riga non e' un elemento come gli altri. I gruppi
   * seguono l'ordine in cui arrivano le opzioni; se nessuna opzione ha
   * `group`, la tendina resta piatta esattamente come prima.
   */
  group?: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

function renderOption(opt: SelectOption) {
  return (
    <option key={opt.value} value={opt.value}>
      {opt.label}
    </option>
  );
}

/** Blocchi consecutivi di opzioni con la stessa intestazione. */
function groupOptions(options: SelectOption[]): Array<{ group?: string; items: SelectOption[] }> {
  const blocks: Array<{ group?: string; items: SelectOption[] }> = [];
  for (const opt of options) {
    const last = blocks[blocks.length - 1];
    if (last && last.group === opt.group) last.items.push(opt);
    else blocks.push({ group: opt.group, items: [opt] });
  }
  return blocks;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full appearance-none rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-900 dark:text-white transition-colors',
              'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
              'disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-900 disabled:opacity-50',
              error ? 'border-danger-500' : 'border-slate-300 dark:border-slate-600',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {groupOptions(options).map((block, i) =>
              block.group ? (
                <optgroup key={block.group} label={block.group}>
                  {block.items.map(renderOption)}
                </optgroup>
              ) : (
                <React.Fragment key={`plain-${i}`}>{block.items.map(renderOption)}</React.Fragment>
              ),
            )}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        </div>
        {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
