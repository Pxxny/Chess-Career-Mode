import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';

export interface SelectOption {
  id: string;
  label: string;
  description?: string;
  leading?: string;
}

interface SearchSelectProps {
  label: string;
  placeholder?: string;
  /** Options already filtered for the current query (the parent owns the search logic) */
  options: SelectOption[];
  selected: SelectOption | null;
  onQueryChange: (query: string) => void;
  onSelect: (option: SelectOption) => void;
  loading?: boolean;
  disabled?: boolean;
  listHeading?: string;
  emptyMessage?: string;
  hint?: string;
}

export function SearchSelect({
  label, placeholder, options, selected, onQueryChange, onSelect, loading, disabled, listHeading, emptyMessage = 'No matches', hint,
}: SearchSelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => setActive(0), [options]);
  useEffect(() => activeRef.current?.scrollIntoView({ block: 'nearest' }), [active, open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    onQueryChange('');
  };
  const choose = (option: SelectOption) => {
    onSelect(option);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="text-sm text-ink-muted">
        {label}
      </label>
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : selected ? `${selected.leading ? `${selected.leading} ` : ''}${selected.label}` : ''}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
          onQueryChange(e.target.value);
        }}
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2.5 text-ink outline-none placeholder:text-ink-faint focus:border-gold-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-navy-800 py-1 shadow-xl"
        >
          {listHeading && (
            <li role="presentation" className="px-3 py-1.5 text-xs font-semibold text-ink-faint">
              {listHeading}
            </li>
          )}
          {loading && options.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-sm text-ink-muted">Loading…</li>
          )}
          {!loading && options.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-sm text-ink-muted">{emptyMessage}</li>
          )}
          {options.map((option, i) => (
            <li
              key={option.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={selected?.id === option.id}
              ref={i === active ? activeRef : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm', i === active && 'bg-navy-600')}
            >
              {option.leading && <span aria-hidden className="text-lg">{option.leading}</span>}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{option.label}</span>
                {option.description && <span className="block truncate text-xs text-ink-muted">{option.description}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
