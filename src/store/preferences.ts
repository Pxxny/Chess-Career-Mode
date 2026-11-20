import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export type Currency = "USD" | "THB";
export type Theme = 'dark'|'light'|'system';
export const usePreferences = create(persist<{
  currency:Currency; setCurrency:(currency:Currency)=>void;
  theme:Theme; board:'green'|'wood'|'ice'|'royal'; pieces:'classic'|'ivory'|'midnight'|'geometric';
  setTheme:(theme:Theme)=>void; setBoard:(board:'green'|'wood'|'ice'|'royal')=>void; setPieces:(pieces:'classic'|'ivory'|'midnight'|'geometric')=>void;
}>(set=>({currency:'USD',setCurrency:currency=>set({currency}),theme:'dark',board:'green',pieces:'classic',setTheme:theme=>set({theme}),setBoard:board=>set({board}),setPieces:pieces=>set({pieces})}),{name:'chess-career-appearance'}));
export function applyTheme() {
  if (typeof document === 'undefined') return;
  const {theme,board,pieces} = usePreferences.getState();
  document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') : theme;
  document.documentElement.dataset.board = board;
  document.documentElement.dataset.pieces = pieces;
}
if (typeof window !== 'undefined') {
  applyTheme(); usePreferences.subscribe(applyTheme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
}
