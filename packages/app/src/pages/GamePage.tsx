import React, { useEffect, useMemo, useState } from 'react';
import meta from '../../../data/2008/team-meta.json';
import sampleTeams from '../../../data/2008/sample-teams.json';
import sampleCards from '../../../data/2008/sample-cards.json';
import { startGame, GameState, applyPlay } from '@nfl/strat-engine';
import { DefenseCall } from '@nfl/strat-engine';
import { PlayerCard } from '@nfl/strat-engine';

function formatTime(s:number){
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}

export default function GamePage({ home, away, onExit }:{ home:string, away:string, onExit:()=>void }){
  const [state, setState] = useState<GameState>(()=> startGame(home,away));
  const [logTick, setLogTick] = useState(0);

  useEffect(()=> {
    // reset if teams change
    setState(startGame(home,away));
  }, [home,away]);

  const homeMeta = meta.find(m=>m.id===home)!;
  const awayMeta = meta.find(m=>m.id===away)!;

  // simple helpers to get cards for offense depending on possession
  function getCardFor(teamId:string, pos:'QB'|'RB') {
    return sampleCards.find(c=>c.teamId===teamId && c.position===pos) as PlayerCard;
  }

  function pickOffenseCard(): PlayerCard {
    return state.possession === 'home' ? getCardFor(home,'RB') : getCardFor(away,'RB');
  }
  function pickQBCard(): PlayerCard {
    return state.possession === 'home' ? getCardFor(home,'QB') : getCardFor(away,'QB');
  }

  function runPlay(type:'insideRun'|'outsideRun'|'shortPass'|'longPass'|'punt'|'fieldGoal'){
    const offenseCard = (type==='shortPass' || type==='longPass') ? pickQBCard() : pickOffenseCard();
    const defense: DefenseCall = { box: 'base', blitz: Math.random()<0.2, coverage: 'zone' };
    const res = applyPlay(state, offenseCard, (type as any), defense);
    // force react update by cloning
    setState({...state});
    setLogTick(t=>t+1);
  }

  return (
    <div className="game-page">
      <div className="topbar">
        <div className="scoreboard">
          <div className="team">
            <img src={homeMeta.logo} alt="" width={48}/>
            <div>{homeMeta.abbr}</div>
            <div className="score">{state.homeScore}</div>
          </div>
          <div className="gameinfo">
            <div>Q{state.quarter} • {formatTime(state.clockSeconds)}</div>
            <div>Poss: {state.possession}</div>
            <div>Down: {state.down} & {state.distance}</div>
            <div>YardLine: {state.yardLine}</div>
          </div>
          <div className="team">
            <img src={awayMeta.logo} alt="" width={48}/>
            <div>{awayMeta.abbr}</div>
            <div className="score">{state.awayScore}</div>
          </div>
        </div>
        <div style={{marginLeft:16}}>
          <button onClick={onExit}>Exit</button>
        </div>
      </div>

      <div className="main-grid">
        <div className="field-panel">
          <div className="field-visual">
            <div className="yardline">Ball on: {state.yardLine}</div>
          </div>
        </div>
        <div className="controls-panel">
          <h3>Play Calls</h3>
          <div className="buttons-grid">
            <button onClick={()=>runPlay('insideRun')}><img src="/assets/ui/btn-run.svg" alt="run" width={140}/></button>
            <button onClick={()=>runPlay('outsideRun')}><img src="/assets/ui/btn-sweep.svg" alt="sweep" width={140}/></button>
            <button onClick={()=>runPlay('shortPass')}><img src="/assets/ui/btn-pass.svg" alt="pass" width={140}/></button>
            <button onClick={()=>runPlay('longPass')}><img src="/assets/ui/btn-bomb.svg" alt="bomb" width={140}/></button>
            <button onClick={()=>runPlay('punt')}><img src="/assets/ui/btn-punt.svg" alt="punt" width={140}/></button>
            <button onClick={()=>runPlay('fieldGoal')}><img src="/assets/ui/btn-fg.svg" alt="fg" width={140}/></button>
          </div>
        </div>
      </div>

      <div className="log-panel">
        <h4>Play Log</h4>
        <div className="play-log">
          {state.playLog.map((l,i)=> <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  )
}