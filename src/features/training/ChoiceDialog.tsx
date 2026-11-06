import { Button, Modal } from '@/components/ui';

export interface ChoiceOption {
  id: string;
  label: string;
  detail: string;
}

interface Props {
  open: boolean;
  title: string;
  description: string;
  options: ChoiceOption[];
  emptyText: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** A secondary menu: pick one thing (opponent, tournament, master) before a session starts. */
export function ChoiceDialog({ open, title, description, options, emptyText, onPick, onClose }: Props) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">{description}</p>
      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => onPick(o.id)} className="min-h-12 w-full rounded-lg border border-white/10 bg-navy-700 px-3 py-2 text-left hover:border-gold-500/50">
                <span className="block font-semibold text-ink">{o.label}</span>
                <span className="block text-xs text-ink-muted">{o.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
