/**
 * Animation timeline constants and helper functions.
 * Shared by every chart renderer (pictogram, waffle, and later bar/line/pie).
 *
 * Timeline shape (D1):
 *   [0 ───lead-in (300ms)───][───animMs (user-picked 1/2/3s)───][───hold (3000ms)───]
 *
 * `progressAt` gives overall 0→1 progress through the "animMs" window only;
 * it is 0 during lead-in and 1 during hold, so callers can draw the "finished"
 * state without any extra branching.
 */

/** Lead-in duration (ms) before any data marks appear — frame is static. */
export const LEAD_IN_MS = 300;

/** Hold duration (ms) on the finished chart after the animation completes. */
export const HOLD_MS = 3000;

/** User-selectable animation durations (ms). Default is index 1 (2s). */
export const DURATION_OPTIONS_MS = [1000, 2000, 3000] as const;

/** Default index into DURATION_OPTIONS_MS. */
export const DEFAULT_DURATION_INDEX = 1;

/** Frames per second for both preview and export. */
export const FPS = 30;

/** Clamp a number to the 0–1 range. */
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Cubic ease-out: fast start, slow finish. */
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

/** Cubic ease-in-out: slow-fast-slow. */
export const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** Ease-out-back: slight overshoot then settle — good for "pop" effects. */
export const easeOutBack = (x: number, c = 1.2): number =>
  1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);

/**
 * Overall progress 0→1 across the animation window.
 * Lead-in clamps to 0; hold clamps to 1.
 */
export function progressAt(tMs: number, animMs: number): number {
  return clamp01((tMs - LEAD_IN_MS) / animMs);
}

/** Total clip duration (ms) for a given animation length. */
export function totalMs(animMs: number): number {
  return LEAD_IN_MS + animMs + HOLD_MS;
}

/**
 * Local 0→1 progress for item `i` of `n` with overlapping ("staggered") windows,
 * so a sequence of items reads as a wave rather than popping all at once.
 *
 * @param p overall progress (0–1)
 * @param i index of this item (0-based)
 * @param n total item count
 * @param maxStagger maximum fractional offset between the first and last item
 */
export function staggered(p: number, i: number, n: number, maxStagger = 0.15): number {
  if (n <= 1) return p;
  const s = Math.min(maxStagger, 0.6 / (n - 1));
  const window = 1 - s * (n - 1); // always >= 0.4
  return clamp01((p - i * s) / window);
}
