export function clampYardLine(yardLine: number): number {
  return Math.max(1, Math.min(99, yardLine));
}
