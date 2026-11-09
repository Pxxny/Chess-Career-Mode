import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/utils/cn";
interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "game";
}
const modalStack: HTMLElement[] = [];
let originalOverflow = "";
export function Modal({
  open,
  title,
  onClose,
  children,
  size = "md",
}: ModalProps) {
  const titleId = useId(),
    dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = dialog.current;
    if (!open || !el) return;
    const before =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!modalStack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.push(el);
    const focusable = () =>
      [
        ...el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ].filter((e) => e.getClientRects().length > 0);
    (focusable()[0] ?? el).focus();
    const key = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== el) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          el.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      const i = modalStack.indexOf(el);
      if (i >= 0) modalStack.splice(i, 1);
      if (!modalStack.length) document.body.style.overflow = originalOverflow;
      if (before?.isConnected) before.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "max-h-[88dvh] w-full overflow-y-auto rounded-xl border border-white/15 bg-navy-800 p-4 shadow-xl sm:p-6",
          size === "game"
            ? "max-w-5xl"
            : size === "lg"
              ? "max-w-2xl"
              : "max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-xl text-ink-muted hover:text-ink"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
