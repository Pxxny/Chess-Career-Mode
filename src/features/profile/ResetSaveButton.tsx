import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useGameStore } from '@/store/gameStore';

export function ResetSaveButton() {
  const clearSave = useGameStore((s) => s.clearSave);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Start a new career
      </Button>
      <Modal open={open} title="Start a new career?" onClose={() => setOpen(false)}>
        <p className="text-sm text-ink-muted">
          This replaces your current career and returns you to character creation. The NPC world is rebuilt from its seed. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep current career
          </Button>
          <Button variant="danger" onClick={clearSave}>
            Replace career
          </Button>
        </div>
      </Modal>
    </>
  );
}
