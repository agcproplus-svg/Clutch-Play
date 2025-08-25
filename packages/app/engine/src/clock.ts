export function defaultRunoff(play: 'run'|'pass'|'incomplete'|'oob'): number {
  if (play === 'incomplete') return 0;
  if (play === 'oob') return 5;
  return 35; // generic runoff per play if in bounds
}
