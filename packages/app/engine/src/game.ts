import { PlayerCard, DefenseCall, Situation, Resolution } from './types';
import { resolvePlay } from './resolver';

export type Possession = 'home'|'away';

export interface GameState {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  quarter: 1|2|3|4|'OT';
  clockSeconds: number; // seconds left in quarter
  possession: Possession;
  down: 1|2|3|4;
  distance: number; // yards to go
  yardLine: number; // 1-99 offense perspective (1 = own 1, 99 = opp 1)
  playLog: string[];
  ballOn: 'home'|'away'; // which side currently has ball for display (same as possession)
  gameOver: boolean;
}

export function startGame(homeId: string, awayId: string, startHalfMinutes = 15): GameState {
  return {
    homeTeamId: homeId,
    awayTeamId: awayId,
    homeScore: 0,
    awayScore: 0,
    quarter: 1,
    clockSeconds: startHalfMinutes * 60,
    possession: 'home',
    down: 1,
    distance: 10,
    yardLine: 25,
    playLog: [],
    ballOn: 'home',
    gameOver: false
  };
}

function tickClock(state: GameState, secs: number) {
  state.clockSeconds = Math.max(0, state.clockSeconds - secs);
  if (state.clockSeconds === 0) {
    // advance quarter
    if (state.quarter === 1) { state.quarter = 2; state.clockSeconds = 15*60; }
    else if (state.quarter === 2) { state.quarter = 3; state.clockSeconds = 15*60; }
    else if (state.quarter === 3) { state.quarter = 4; state.clockSeconds = 15*60; }
    else if (state.quarter === 4) { state.gameOver = true; }
  }
}

function teamForPossession(state: GameState, pos: Possession) {
  return pos === 'home' ? state.homeTeamId : state.awayTeamId;
}

export function applyPlay(state: GameState, offenseCard: PlayerCard, playType: keyof PlayerCard['tables'], defense: DefenseCall): Resolution {
  if (state.gameOver) throw new Error('game over');

  const res = resolvePlay({offense: offenseCard, playType, defense});

  // Apply clock runoff if any
  const runoff = res.clockRunoffSec ?? (res.complete === false ? 0 : 35);
  tickClock(state, runoff);

  // Update yardline (offense perspective)
  // yardLine: 1..99 where 50 is midfield (we'll keep simple: +yards moves toward opponent endzone)
  state.yardLine = Math.max(1, Math.min(99, state.yardLine + res.yards));

  // Evaluate touchdown
  if (res.touchdown || state.yardLine >= 99) {
    // Touchdown scored by offense
    if (state.possession === 'home') state.homeScore += 6;
    else state.awayScore += 6;
    state.playLog.unshift(`${teamForPossession(state,state.possession)} TD! ${res.description}`);
    // After TD, reset ball to opposing 25 and change possession after kickoff
    state.yardLine = 25;
    state.possession = state.possession === 'home' ? 'away' : 'home';
    state.down = 1; state.distance = 10;
    return res;
  }

  // Turnovers
  if (res.turnover) {
    state.playLog.unshift(`${teamForPossession(state,state.possession)} turnover: ${res.turnover} (${res.description})`);
    // Flip possession, ball on the same yardline but from other perspective
    state.possession = state.possession === 'home' ? 'away' : 'home';
    state.down = 1; state.distance = 10;
    return res;
  }

  // Sacks: negative yards
  // Update down and distance
  if ((res.yards ?? 0) >= state.distance) {
    state.playLog.unshift(`${teamForPossession(state,state.possession)}: ${res.description} — First down`);
    state.down = 1;
    state.distance = 10;
  } else {
    // not enough for first down
    if (state.down === 4) {
      // Turnover on downs: change possession, ball on opponent yardline (simplified)
      state.playLog.unshift(`${teamForPossession(state,state.possession)} failed on 4th: ${res.description} — Turnover on downs`);
      state.possession = state.possession === 'home' ? 'away' : 'home';
      state.down = 1; state.distance = 10;
    } else {
      state.down = ((state.down as number) + 1) as 1|2|3|4;
      state.distance = Math.max(1, state.distance - (res.yards ?? 0));
      state.playLog.unshift(`${teamForPossession(state,state.possession)}: ${res.description} (${res.yards} yds) — Down ${state.down} & ${state.distance}`);
    }
  }

  // Safety check for clock/game over
  if (state.gameOver) state.playLog.unshift('End of game');

  return res;
}