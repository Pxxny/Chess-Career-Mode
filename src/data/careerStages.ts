import type { CareerStage } from '@/types';

export const CAREER_STAGES: CareerStage[] = [
  { id: 'newcomer', title: 'Newcomer', minRating: 0, summary: 'Learning the game and playing casual events.' },
  { id: 'club', title: 'Club Player', minRating: 1200, summary: 'Regular member of a local club.' },
  { id: 'regional', title: 'Regional Contender', minRating: 1500, summary: 'Competing in regional opens.' },
  { id: 'national-candidate', title: 'National Candidate', minRating: 1800, summary: 'Chasing national titles.' },
  { id: 'national-master', title: 'National Master', minRating: 2100, summary: 'A recognised master.' },
  { id: 'im', title: 'International Master', minRating: 2300, summary: 'Playing the international circuit.' },
  { id: 'gm', title: 'Grandmaster', minRating: 2500, summary: 'The highest title in chess.' },
  { id: 'elite-gm', title: 'Elite Grandmaster', minRating: 2700, summary: 'Among the best in the world.' },
  { id: 'contender', title: 'World Title Contender', minRating: 2780, summary: 'Fighting for a world championship match.' },
  { id: 'champion', title: 'World Champion', minRating: 2850, summary: 'The pinnacle of the game.' },
];
