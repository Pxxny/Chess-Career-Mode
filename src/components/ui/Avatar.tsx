import { CharacterPortrait } from '@/components/game/CharacterPortrait';
import type { Appearance } from '@/types';
import { cn } from '@/utils/cn';
import { getInitials, hashString } from '@/utils/format';

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-20 w-20 text-2xl' } as const;

interface AvatarProps {
  name: string;
  seed: string;
  size?: keyof typeof SIZES;
  /** When given, the player's portrait is shown instead of initials */
  appearance?: Appearance;
}

export function Avatar({ name, seed, size = 'md', appearance }: AvatarProps) {
  if (appearance) {
    return (
      <CharacterPortrait
        appearance={appearance}
        label={`${name} portrait`}
        className={cn('shrink-0 border border-gold-500/60', SIZES[size])}
      />
    );
  }
  const hue = hashString(seed) % 360;
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-gold-500/60 font-bold text-ink', SIZES[size])}
      style={{ background: `hsl(${hue} 35% 22%)` }}
    >
      {getInitials(name)}
    </span>
  );
}
