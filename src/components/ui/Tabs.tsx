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
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="mb-5 flex gap-1 overflow-x-auto border-b border-white/15"
      >
        {tabs.map((tab) => (
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
