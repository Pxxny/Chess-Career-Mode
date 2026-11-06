import { writeFileSync } from 'node:fs';
import { renderPortraitSvg } from '../src/game/appearance/portraitSvg.ts';
import { DEFAULT_APPEARANCE } from '../src/data/appearance.ts';

const looks = [
  {}, { hairStyle: 'sidepart', skinTone: 'tan', facialHair: 'goatee', glasses: 'round', clothing: 'blazer', facePreset: 'square', hairColor: 'black', eyeColor: 'green' },
  { hairStyle: 'long', skinTone: 'fair', hairColor: 'auburn', clothing: 'tshirt', clothingColor: 'teal', accessory: 'earring', facePreset: 'soft', eyeColor: 'blue' },
  { hairStyle: 'afro', skinTone: 'deep', clothing: 'hoodie', clothingColor: 'burgundy', glasses: 'square', facePreset: 'round', accessory: 'headphones' },
  { hairStyle: 'bun', skinTone: 'olive', hairColor: 'black', clothing: 'shirt', facePreset: 'angular', accessory: 'pin', eyeColor: 'darkbrown' },
  { hairStyle: 'bald', skinTone: 'brown', facialHair: 'beard', clothing: 'polo', clothingColor: 'forest', glasses: 'sunglasses', facePreset: 'long' },
  { hairStyle: 'curly', skinTone: 'light', hairColor: 'ginger', facialHair: 'stubble', clothing: 'sweater', accessory: 'scarf' },
  { hairStyle: 'mohawk', skinTone: 'porcelain', hairColor: 'blue', clothing: 'tshirt', clothingColor: 'charcoal', accessory: 'headband', facialHair: 'mustache' },
  { hairStyle: 'ponytail', skinTone: 'ebony', hairColor: 'darkbrown', clothing: 'blazer', clothingColor: 'slate', facePreset: 'classic' },
  { hairStyle: 'bob', skinTone: 'tan', hairColor: 'blond', clothing: 'polo', accessory: 'cap', eyeColor: 'hazel' },
  { hairStyle: 'buzz', skinTone: 'fair', hairColor: 'grey', facialHair: 'beard', glasses: 'round', clothing: 'sweater', clothingColor: 'cream' },
  { hairStyle: 'short', skinTone: 'olive', hairColor: 'white', clothing: 'shirt', clothingColor: 'navy', facePreset: 'long', eyeColor: 'grey' },
];
const cells = looks.map((l, i) => `<div style="width:200px;height:200px;margin:6px;display:inline-block">${renderPortraitSvg({ ...DEFAULT_APPEARANCE, ...l })}</div>`).join('');
writeFileSync('/tmp/portraits.html', `<body style="background:#0b1222;margin:0;width:900px">${cells}</body>`);
