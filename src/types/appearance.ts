export interface Appearance {
  facePreset: string;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  facialHair: string;
  clothing: string;
  clothingColor: string;
  glasses: string;
  accessory: string;
}

export type AppearanceField = keyof Appearance;

export interface AppearanceOption {
  id: string;
  label: string;
  /** Colour swatch for colour options */
  color?: string;
}
