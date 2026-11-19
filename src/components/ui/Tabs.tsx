import { Check, ChevronDown, LayoutList } from "lucide-react";
import { Modal } from "./Modal";
import {
  useRef,
  useState,
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
  const [open, setOpen] = useState(false);
  const activeLabel = tabs.find(tab => tab.id === active)?.label;
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
      {compact && <>
        <div className="mb-4 sm:hidden">
          <button type="button" aria-haspopup="dialog" aria-expanded={open} data-section-picker
            aria-label={`${label}: choose section`} aria-controls={`${id}-panel-${active}`}
            className="phone-section-trigger" onClick={() => setOpen(true)}>
            <LayoutList size={18} aria-hidden className="shrink-0 text-gold-300" />
            <span className="min-w-0 flex-1 break-words text-left">{activeLabel}</span>
            <ChevronDown size={18} aria-hidden className="shrink-0 text-ink-muted" />
          </button>
        </div>
        {open && <Modal open title={label} presentation="sheet" onClose={() => setOpen(false)}>
          <ul className="divide-y divide-navy-600/70" data-section-options>
            {tabs.map(tab => <li key={tab.id}>
              <button type="button" aria-current={tab.id === active ? "page" : undefined}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm aria-[current=page]:bg-gold-500/10 aria-[current=page]:text-gold-300"
                onClick={() => { onChange(tab.id); setOpen(false); }}>
                <span>{tab.label}</span>{tab.id === active && <Check size={17} aria-hidden />}
              </button>
            </li>)}
          </ul>
        </Modal>}
      </>}
      <div className={`mb-6 items-center gap-2 rounded-xl border border-white/[0.07] bg-navy-900/70 p-1.5 ${compact ? "hidden sm:flex" : "flex"}`}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="phone-tab-list flex min-w-0 flex-1 gap-1 overflow-x-auto"
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
        aria-label={activeLabel}
      >
        {children}
      </div>
    </div>
  );
}
