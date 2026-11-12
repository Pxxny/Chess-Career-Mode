import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { LanguageContext } from "@/i18n/context";
import { translateUI } from "@/i18n/translate";
import { cn } from "@/utils/cn";

export interface SelectOption {
  id: string;
  label: string;
  description?: string;
  leading?: string;
  /** Keep city names and user-defined labels in their original spelling. */
  originalLabel?: boolean;
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
  /** Window long lists without truncating the available choices. */
  virtualized?: boolean;
}

export function SearchSelect({
  label,
  placeholder,
  options,
  selected,
  onQueryChange,
  onSelect,
  loading,
  disabled,
  listHeading,
  emptyMessage = "No matches",
  hint,
  virtualized = false,
}: SearchSelectProps) {
  const id = useId();
  const language = useContext(LanguageContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLLIElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 64,
    viewportHeight = 256,
    overscan = 4;
  const headingHeight = listHeading ? 32 : 0;
  const first = Math.max(
    0,
    Math.floor((scrollTop - headingHeight - 4) / rowHeight),
  );
  const start = virtualized ? Math.max(0, first - overscan) : 0;
  const end = virtualized
    ? Math.min(
        options.length,
        first + Math.ceil(viewportHeight / rowHeight) + overscan + 1,
      )
    : options.length;

  useEffect(() => {
    setActive(0);
    if (virtualized) {
      setScrollTop(0);
      if (listRef.current) listRef.current.scrollTop = 0;
    }
  }, [options, virtualized]);
  useEffect(() => {
    // New browsers can return a Promise from scrolling; React effects may only
    // return a cleanup function, so do not return the DOM method's result.
    if (!virtualized) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, open, virtualized]);

  const close = () => {
    setOpen(false);
    setQuery("");
    onQueryChange("");
    if (virtualized) {
      setScrollTop(0);
      setActive(0);
    }
  };
  const moveActive = (next: number) => {
    next = Math.max(0, Math.min(next, options.length - 1));
    setActive(next);
    const list = listRef.current;
    if (!virtualized || !list) return;
    const top = headingHeight + 4 + next * rowHeight;
    if (top < list.scrollTop + headingHeight)
      list.scrollTop = top - headingHeight;
    else if (top + rowHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = top + rowHeight - list.clientHeight;
    setScrollTop(list.scrollTop);
  };
  const choose = (option: SelectOption) => {
    onSelect(option);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      moveActive(active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(active - 1);
    } else if (
      virtualized &&
      open &&
      (e.key === "PageDown" || e.key === "PageUp")
    ) {
      e.preventDefault();
      moveActive(active + (e.key === "PageDown" ? 4 : -4));
    } else if (
      virtualized &&
      open &&
      (!query || e.ctrlKey) &&
      (e.key === "Home" || e.key === "End")
    ) {
      e.preventDefault();
      moveActive(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (e.key === "Escape") {
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
        aria-activedescendant={
          open && options[active] && active >= start && active < end
            ? `${id}-opt-${active}`
            : undefined
        }
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={
          open
            ? query
            : selected
              ? `${selected.leading ? `${selected.leading} ` : ""}${selected.originalLabel ? selected.label : translateUI(selected.label, language)}`
              : ""
        }
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
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
          ref={listRef}
          aria-label={label}
          data-total-options={options.length}
          onScroll={
            virtualized
              ? (e) => {
                  const top = e.currentTarget.scrollTop;
                  setScrollTop(top);
                  const visible = Math.max(
                    0,
                    Math.floor((top - headingHeight - 4) / rowHeight),
                  );
                  setActive((previous) =>
                    previous < visible ||
                    previous >= visible + Math.ceil(viewportHeight / rowHeight)
                      ? Math.min(visible, options.length - 1)
                      : previous,
                  );
                }
              : undefined
          }
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-navy-800 py-1 shadow-xl"
        >
          {listHeading && (
            <li
              role="presentation"
              style={virtualized ? { height: headingHeight } : undefined}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold text-ink-faint",
                virtualized && "sticky top-0 z-10 bg-navy-800",
              )}
            >
              {listHeading}
            </li>
          )}
          {loading && options.length === 0 && (
            <li
              role="presentation"
              className="px-3 py-2 text-sm text-ink-muted"
            >
              Loading…
            </li>
          )}
          {!loading && options.length === 0 && (
            <li
              role="presentation"
              className="px-3 py-2 text-sm text-ink-muted"
            >
              {emptyMessage}
            </li>
          )}
          {virtualized && start > 0 && (
            <li
              role="presentation"
              aria-hidden
              style={{ height: start * rowHeight }}
            />
          )}
          {options.slice(start, end).map((option, offset) => {
            const i = start + offset;
            return (
              <li
                key={option.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-posinset={virtualized ? i + 1 : undefined}
                aria-setsize={virtualized ? options.length : undefined}
                style={
                  virtualized
                    ? { height: rowHeight, boxSizing: "border-box" }
                    : undefined
                }
                aria-selected={selected?.id === option.id}
                ref={i === active ? activeRef : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                  i === active && "bg-navy-600",
                )}
              >
                {option.leading && (
                  <span aria-hidden className="text-lg">
                    {option.leading}
                  </span>
                )}
                <span className="min-w-0">
                  <span
                    translate={option.originalLabel ? "no" : undefined}
                    className="block truncate font-semibold text-ink"
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="block truncate text-xs text-ink-muted">
                      {option.description}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {virtualized && end < options.length && (
            <li
              role="presentation"
              aria-hidden
              style={{ height: (options.length - end) * rowHeight }}
            />
          )}
        </ul>
      )}
    </div>
  );
}
