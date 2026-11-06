export interface CareerStage {
  id: string;
  title: string;
  minRating: number;
  summary: string;
}

export interface CareerProgress {
  current: CareerStage;
  next: CareerStage | null;
  /** 0 to 100 */
  percent: number;
}
