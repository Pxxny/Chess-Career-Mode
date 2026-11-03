import type { Appearance, AppearanceField, AppearanceOption } from '@/types';

const o = (id: string, label: string, color?: string): AppearanceOption => ({ id, label, color });

export const APPEARANCE_OPTIONS: Record<AppearanceField, AppearanceOption[]> = {
  facePreset: [o('classic', 'Classic'), o('round', 'Round'), o('square', 'Square'), o('long', 'Long'), o('soft', 'Soft'), o('angular', 'Angular')],
  skinTone: [
    o('porcelain', 'Porcelain', '#f8dccb'), o('fair', 'Fair', '#f1c9a5'), o('light', 'Light', '#e6b48a'), o('tan', 'Tan', '#cf9363'),
    o('olive', 'Olive', '#b97a4b'), o('brown', 'Brown', '#8f5a35'), o('deep', 'Deep', '#6a402a'), o('ebony', 'Ebony', '#4b2d1f'),
  ],
  hairStyle: [
    o('bald', 'Bald'), o('buzz', 'Buzz cut'), o('short', 'Short'), o('sidepart', 'Side part'), o('curly', 'Curly'),
    o('afro', 'Afro'), o('bob', 'Bob'), o('long', 'Long'), o('ponytail', 'Ponytail'), o('bun', 'Bun'), o('mohawk', 'Mohawk'),
  ],
  hairColor: [
    o('black', 'Black', '#1c1816'), o('darkbrown', 'Dark brown', '#3b2a20'), o('brown', 'Brown', '#6a4430'), o('auburn', 'Auburn', '#8a3f25'),
    o('ginger', 'Ginger', '#c0602a'), o('blond', 'Blond', '#d9b25f'), o('platinum', 'Platinum', '#ece3c8'), o('grey', 'Grey', '#9a9ca3'),
    o('white', 'White', '#f1f1f1'), o('blue', 'Blue', '#3d6bd6'),
  ],
  eyeColor: [
    o('brown', 'Brown', '#6b4125'), o('darkbrown', 'Dark brown', '#3a2416'), o('hazel', 'Hazel', '#8a6a2f'), o('green', 'Green', '#4d8a52'),
    o('blue', 'Blue', '#4a7fc0'), o('grey', 'Grey', '#7f8c99'), o('amber', 'Amber', '#b9812a'),
  ],
  facialHair: [o('none', 'None'), o('stubble', 'Stubble'), o('mustache', 'Mustache'), o('goatee', 'Goatee'), o('beard', 'Full beard')],
  clothing: [o('tshirt', 'T-shirt'), o('hoodie', 'Hoodie'), o('sweater', 'Sweater'), o('shirt', 'Shirt and tie'), o('blazer', 'Blazer'), o('polo', 'Polo')],
  clothingColor: [
    o('navy', 'Navy', '#27406f'), o('charcoal', 'Charcoal', '#3b4049'), o('burgundy', 'Burgundy', '#7a2c3d'), o('forest', 'Forest', '#2f5a45'),
    o('teal', 'Teal', '#2a6f78'), o('mustard', 'Mustard', '#b98b2e'), o('slate', 'Slate', '#7b8599'), o('cream', 'Cream', '#e7dcc3'),
  ],
  glasses: [o('none', 'None'), o('round', 'Round'), o('square', 'Square'), o('sunglasses', 'Sunglasses')],
  accessory: [o('none', 'None'), o('earring', 'Earring'), o('headband', 'Headband'), o('cap', 'Cap'), o('headphones', 'Headphones'), o('scarf', 'Scarf'), o('pin', 'Knight pin')],
};

export const DEFAULT_APPEARANCE: Appearance = {
  facePreset: 'classic', skinTone: 'light', hairStyle: 'short', hairColor: 'darkbrown', eyeColor: 'brown',
  facialHair: 'none', clothing: 'sweater', clothingColor: 'navy', glasses: 'none', accessory: 'none',
};

export const APPEARANCE_FIELDS = Object.keys(APPEARANCE_OPTIONS) as AppearanceField[];

export function getOption(field: AppearanceField, id: string): AppearanceOption {
  const list = APPEARANCE_OPTIONS[field];
  return list.find((opt) => opt.id === id) ?? list.find((opt) => opt.id === DEFAULT_APPEARANCE[field])!;
}

/** Replaces any unknown value (for example from an old or edited save) with a valid one. */
export function sanitizeAppearance(value: Partial<Appearance> | undefined): Appearance {
  const out = { ...DEFAULT_APPEARANCE };
  for (const field of APPEARANCE_FIELDS) {
    const id = value?.[field];
    if (id && APPEARANCE_OPTIONS[field].some((opt) => opt.id === id)) out[field] = id;
  }
  return out;
}

export function randomAppearance(random: () => number = Math.random): Appearance {
  const pick = (field: AppearanceField) => {
    const list = APPEARANCE_OPTIONS[field];
    return list[Math.floor(random() * list.length)].id;
  };
  const result = { ...DEFAULT_APPEARANCE };
  for (const field of APPEARANCE_FIELDS) result[field] = pick(field);
  // Keep the extremes rare so random looks stay natural.
  if (random() < 0.6) result.glasses = 'none';
  if (random() < 0.6) result.accessory = 'none';
  if (random() < 0.7) result.hairColor = ['black', 'darkbrown', 'brown', 'blond', 'auburn'][Math.floor(random() * 5)];
  return result;
}

/** Plain-language summary of a look, e.g. for the confirmation screen. */
export function describeAppearance(value: Appearance): string {
  const a = sanitizeAppearance(value);
  const label = (field: AppearanceField) => getOption(field, a[field]).label.toLowerCase();
  const parts = [
    `${label('facePreset')} face, ${label('skinTone')} skin`,
    a.hairStyle === 'bald' ? 'bald' : `${label('hairColor')} ${label('hairStyle')} hair`,
    `${label('eyeColor')} eyes`,
  ];
  if (a.facialHair !== 'none') parts.push(label('facialHair'));
  parts.push(`${label('clothingColor')} ${label('clothing')}`);
  if (a.glasses !== 'none') parts.push(`${label('glasses')} glasses`);
  if (a.accessory !== 'none') parts.push(label('accessory'));
  return parts.join(', ');
}
