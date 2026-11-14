import { useMemo,useId } from 'react';
import { renderPortraitSvg } from '@/game/appearance/portraitSvg';
import type { Appearance } from '@/types';
import { cn } from '@/utils/cn';

interface CharacterPortraitProps {
  appearance: Partial<Appearance> | undefined;
  label?: string;
  age?:number; gender?:string|null;
  className?: string;
}

/** Renders the saved appearance. The SVG is generated from fixed option tables, never from free text. */
export function CharacterPortrait({ appearance, label = 'Character portrait', className,age,gender }: CharacterPortraitProps) {
  const uid=useId();
  const svg = useMemo(() => renderPortraitSvg(appearance, label,{age,gender,uid}), [appearance, label,age,gender,uid]);
  return <span className={cn('block aspect-square overflow-hidden rounded-full', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
