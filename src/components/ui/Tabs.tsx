import {
  useRef,
  useEffect,
  useId,
  type KeyboardEvent,
  type ReactNode,
} from "react";

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
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  children,
}: TabsProps<T>) {
  const id = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const compact = tabs.length > 4;
  const visibleTabs = compact ? tabs.filter((tab, index) => index < 2 || tab.id === active) : tabs;

  useEffect(() => {
    const el = refs.current[active],
      parent = el?.parentElement;
    if (!el || !parent) return;
    const item = el.getBoundingClientRect(),
      box = parent.getBoundingClientRect();
    if (item.left < box.left) parent.scrollLeft += item.left - box.left;
    else if (item.right > box.right)
      parent.scrollLeft += item.right - box.right;
  }, [active]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === active);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    requestAnimationFrame(() => refs.current[tabs[next].id]?.focus());
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-navy-900/70 p-1.5">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            id={`${id}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            aria-controls={`${id}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className="section-tab"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {compact && <select data-section-overflow value="" aria-label={`${label}: more sections`} onChange={(event) => onChange(event.target.value as T)} className="min-h-11 w-28 shrink-0 rounded-lg border border-white/10 bg-navy-800 px-2 text-xs font-semibold text-ink-muted sm:w-36 sm:text-sm">
        <option value="" disabled>More sections</option>
        {tabs.slice(2).map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
      </select>}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${active}`}
        aria-labelledby={`${id}-tab-${active}`}
      >
        {children}
      </div>
    </div>
  );
}
