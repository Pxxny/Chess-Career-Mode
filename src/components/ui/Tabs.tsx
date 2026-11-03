import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
  children: ReactNode;
}

/** Accessible tabs with arrow-key support. The tab list scrolls sideways on narrow phones. */
export function Tabs<T extends string>({ tabs, active, onChange, label, children }: TabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-navy-800 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-11 flex-1 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors',
              active === tab.id ? 'bg-navy-600 text-gold-400' : 'text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {children}
      </div>
    </div>
  );
}
