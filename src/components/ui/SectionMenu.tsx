import { useEffect, useRef, type ReactNode } from "react";
/** Shared visual navigation for secondary views, preserving native button keyboard behavior. */
export function SectionMenu<T extends string>({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: readonly { id: T; label: string; detail?: ReactNode }[];
  active: T;
  onChange: (id: T) => void;
}) {
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
  return (
    <div
      role="group"
      aria-label={label}
      className="mb-4 flex gap-1 overflow-x-auto border-b border-white/15"
    >
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => {
            refs.current[item.id] = el;
          }}
          type="button"
          aria-pressed={active === item.id}
          onClick={() => onChange(item.id)}
          className="section-tab max-w-64 text-left"
        >
          <span className="block whitespace-nowrap">{item.label}</span>
          {item.detail && (
            <span className="block text-xs font-normal text-ink-muted">
              {item.detail}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
