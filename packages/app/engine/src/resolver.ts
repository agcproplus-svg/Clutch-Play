import { CardRow, DefenseCall, PlayerCard, Resolution } from './types';
import { roll3d6 } from './dice';

function findRow(rows: CardRow[], roll: number): CardRow | null {
  for (const r of rows) {
    if (roll >= r.min && roll <= r.max) return r;
  }
  return null;
}

function parseResult(result: string): Partial<Resolution> {
  // Examples: 'gain:4', 'TD', 'INT', 'INC', 'SACK:-7', 'PEN:5:def-holding'
  const out: Partial<Resolution> = {};
  if (result === 'TD') { out.touchdown = true; out.yards = 999; out.description = 'Touchdown'; return out; }
  if (result === 'INT') { out.turnover = 'INT'; out.yards = 0; out.description = 'Intercepted'; return out; }
  if (result === 'INC') { out.complete = false; out.yards = 0; out.description = 'Incomplete'; return out; }
  if (result.startsWith('gain:')) { out.yards = parseInt(result.split(':')[1]); out.description = `Gain of ${out.yards}`; return out; }
  if (result.startsWith('SACK:')) { out.sackYards = parseInt(result.split(':')[1]); out.yards = -Math.abs(out.sackYards!); out.description = `Sack for ${-out.yards} yards`; return out; }
  if (result.startsWith('PEN:')) {
    const [, rest] = result.split(':'); // e.g., "5:def-holding"
    const [yardsStr, type] = rest.split(':'); // May have colon-separated type
    out.penalty = { yards: parseInt(yardsStr), type: type || 'penalty', on: type?.startsWith('def') ? 'def' : 'off' };
    out.yards = 0; out.description = `Penalty ${out.penalty?.type} ${out.penalty?.yards}`;
    return out;
  }
  // fallback
  out.yards = 0;
  out.description = result;
  return out;
}

export function resolvePlay(opts: {
  offense: PlayerCard;
  playType: keyof PlayerCard['tables'];
  defense: DefenseCall;
  situationalMods?: string[];
}): Resolution {
  const roll = roll3d6();
  const rows = opts.offense.tables[opts.playType];
  const row = findRow(rows, roll) || { min: 3, max: 18, result: 'gain:0' };
  const base = parseResult(row.result);

  // Simple modifiers from defense call
  let yardsMod = 0;
  if (opts.playType === 'insideRun' || opts.playType === 'outsideRun') {
    if (opts.defense.box === 'run-heavy') yardsMod -= 2;
    if (opts.defense.blitz) yardsMod -= 1;
  } else if (opts.playType === 'shortPass' || opts.playType === 'longPass') {
    if (opts.defense.coverage === 'zone') yardsMod -= 1;
    if (opts.defense.blitz) yardsMod += 1; // pressure leads to quicker throws, small swing
  }

  const yards = (base.yards ?? 0) + yardsMod;
  const desc = `${base.description ?? ''}${yardsMod ? ` (${yardsMod >= 0 ? '+' : ''}${yardsMod} adj)` : ''}`.trim();

  return {
    yards,
    turnover: base.turnover ?? null,
    sackYards: base.sackYards,
    penalty: base.penalty,
    complete: base.complete,
    touchdown: base.touchdown,
    firstDown: yards >= 10,
    outOfBounds: false,
    clockRunoffSec: base.complete === false ? 0 : 35,
    description: desc
  };
}
