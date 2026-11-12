export type Side = "w" | "b";

/**
 * A two-sided chess clock. Only the side to move loses time. Time is counted at a `rate`, which is 1 for a
 * person (real time) and larger for a simulated player whose thinking time is played back faster than it
 * is charged. Increment is added after every move. The first move of White starts the clock at once.
 */
export class MatchClock {
  private left: Record<Side, number>;
  private active: Side | null = null;
  private since = 0;
  /** Milliseconds charged to the side to move before `since` (kept when the rate changes or the clock pauses) */
  private carried = 0;
  private rate = 1;
  private running = false;
  private readonly base: number;
  private readonly increment: number;
  private readonly now: () => number;

  constructor(baseMs: number, incrementMs: number, now: () => number) {
    this.base = baseMs;
    this.increment = incrementMs;
    this.now = now;
    this.left = { w: baseMs, b: baseMs };
  }

  get hasTime(): boolean {
    return this.base > 0;
  }

  /** Starts (or resumes) counting for `side`. */
  start(side: Side, rate = 1): void {
    if (this.running && this.active === side) {
      this.setRate(rate);
      return;
    }
    this.fold();
    this.active = side;
    this.carried = 0;
    this.since = this.now();
    this.rate = rate;
    this.running = true;
  }

  private fold(): void {
    if (this.running) this.carried += (this.now() - this.since) * this.rate;
    this.since = this.now();
  }

  /** Changes how fast the running clock counts without losing the time already used. */
  setRate(rate: number): void {
    this.fold();
    this.rate = rate;
  }

  pause(): void {
    if (!this.running) return;
    this.fold();
    this.running = false;
  }

  resume(): void {
    if (this.running || this.active === null) return;
    this.since = this.now();
    this.running = true;
  }

  /** Time charged to the side to move on the current move so far. */
  used(): number {
    if (this.active === null) return 0;
    return (
      this.carried + (this.running ? (this.now() - this.since) * this.rate : 0)
    );
  }

  /** Milliseconds left for a side, including the move in progress. */
  remaining(side: Side): number {
    if (!this.hasTime) return Infinity;
    const base = this.left[side];
    return this.active === side ? base - this.used() : base;
  }

  /**
   * The side to move has moved. Charges the time used (or `spentMs` when a simulated player's thinking time is
   * given), adds the increment and hands the clock to the other side. Returns false when the flag had already
   * fallen: the move then arrived too late and the increment is not added.
   */
  press(side: Side, spentMs?: number): boolean {
    if (this.active !== side) return true;
    const spent = this.hasTime
      ? spentMs === undefined
        ? this.used()
        : Math.max(spentMs, this.used())
      : 0;
    const after = this.left[side] - spent;
    if (this.hasTime && after <= 0) {
      this.left[side] = 0;
      this.active = null;
      this.running = false;
      return false;
    }
    this.left[side] = this.hasTime ? after + this.increment : this.left[side];
    this.active = side === "w" ? "b" : "w";
    this.carried = 0;
    this.since = this.now();
    this.running = true;
    return true;
  }

  /** Freezes both clocks, charging the running side up to now. */
  stop(): void {
    if (this.active !== null && this.hasTime)
      this.left[this.active] = Math.max(
        0,
        this.left[this.active] - this.used(),
      );
    this.active = null;
    this.carried = 0;
    this.running = false;
  }

  /** Sets a side's flag as fallen. */
  flag(side: Side): void {
    this.left[side] = 0;
    this.active = null;
    this.running = false;
  }

  restore(left: { white: number; black: number }): void {
    this.stop();
    this.left = { w: Math.max(0, left.white), b: Math.max(0, left.black) };
  }

  activeSide(): Side | null {
    return this.active;
  }

  isRunning(): boolean {
    return this.running;
  }
}
