export type PlayType = 'insideRun' | 'outsideRun' | 'shortPass' | 'longPass' | 'qbScramble' | 'fieldGoal' | 'punt';

export interface CardRow {
  /** Inclusive min roll for 3d6 */
  min: number;
  /** Inclusive max roll for 3d6 */
  max: number;
  /** A result code, e.g., 'gain:4', 'TD', 'INT', 'INC', 'SACK:-7', 'PEN:5:def-holding' */
  result: string;
}

export interface PlayerCard {
  id: string;
  name: string;
  position: string;
  teamId: string;
  year: number;
  tables: Record<PlayType, CardRow[]>;
}

export interface DefenseCall {
  box: 'base' | 'run-heavy' | 'pass-heavy';
  blitz: boolean;
  coverage: 'man' | 'zone';
}

export interface Situation {
  down: 1 | 2 | 3 | 4;
  distance: number; // yards to first down
  yardLine: number; // offense perspective: 1-99 (own 1 to opp 1)
  quarter: 1 | 2 | 3 | 4 | 'OT';
  clockSeconds: number;
}

export interface Resolution {
  yards: number;
  turnover: null | 'INT' | 'FUM';
  sackYards?: number;
  penalty?: { yards: number; type: string; on: 'off' | 'def'; };
  complete?: boolean;
  touchdown?: boolean;
  firstDown?: boolean;
  outOfBounds?: boolean;
  clockRunoffSec?: number;
  description: string;
}
