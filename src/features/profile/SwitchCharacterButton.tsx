import { Button } from '@/components/ui';
import { useGameStore } from '@/store/gameStore';

/** Closes the open character (it stays saved) and shows the character slots. */
export function SwitchCharacterButton() {
  const leaveSave = useGameStore((s) => s.leaveSave);
  return (
    <Button variant="secondary" onClick={leaveSave}>
      Switch or create character
    </Button>
  );
}
