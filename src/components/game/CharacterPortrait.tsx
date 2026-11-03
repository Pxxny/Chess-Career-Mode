import { useMemo } from 'react';
import { renderPortraitSvg } from '@/game/appearance/portraitSvg';
import type { Appearance } from '@/types';
import { cn } from '@/utils/cn';

interface CharacterPortraitProps {
  appearance: Partial<Appearance> | undefined;
  label?: string;
  className?: string;
}

/** Renders the saved appearance. The SVG is generated from fixed option tables, never from free text. */
export function CharacterPortrait({ appearance, label = 'Character portrait', className }: CharacterPortraitProps) {
  const svg = useMemo(() => renderPortraitSvg(appearance, label), [appearance, label]);
  return <span className={cn('block aspect-square overflow-hidden rounded-full', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
