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
  browStyle: string;
  eyeShape: string;
  noseShape: string;
  expression: string;
  faceDetail: string;
  frameColor: string;
  portraitBackground: string;
}

export type AppearanceField = keyof Appearance;

export interface AppearanceOption {
  id: string;
  label: string;
  /** Colour swatch for colour options */
  color?: string;
}
