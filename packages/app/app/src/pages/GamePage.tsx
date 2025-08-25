import React, { useEffect, useState } from 'react';
import meta from '../../../data/2008/team-meta.json';
import rosters from '../../../data/2008/sample-teams.json';
import cards from '../../../data/2008/sample-cards.json';
import { startGame, GameState, applyPlay } from '@nfl/strat-engine';
import { PlayerCard } from '@nfl/strat-engine';

const cardById: Record<string, PlayerCard> = Object.fromEntries((cards as PlayerCard[]).map(c=>[c.id, c]));

function formatTime(s:number){
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}

export default function GamePage({ home, away, onExit }:{ home:string, away:string, onExit:()=>void }){
  const [state, setState] = useState<GameState>(()=> startGame(home,away));

  useEffect(()=> setState(startGame(home,away)), [home,away]);

  const homeMeta = meta.find(m=>m.id===home)!;
  const awayMeta = meta.find(m=>m.id===away)!;

  const homeRoster = (rosters as any)[home] || {};
  const awayRoster = (rosters as any)[away] || {};

  const homeQB = cardById[homeRoster?.offense?.QB] as PlayerCard | undefined;
  const homeRB = cardById[homeRoster?.offense?.RB] as PlayerCard | undefined;
  const awayQB = cardById[awayRoster?.offense?.QB] as PlayerCard | undefined;
  const awayRB = cardById[awayRoster?.offense?.RB] as PlayerCard | undefined;

  function play(type:'insideRun'|'outsideRun'|'shortPass'|'longPass'|'punt'|'fieldGoal'){
    const card = (state.possession==='home')
      ? ((type==='shortPass'||type==='longPass') ? homeQB : homeRB)
      : ((type==='shortPass'||type==='longPass') ? awayQB : awayRB);
    if(!card){
      state.playLog.unshift('No player card for this play type.');
      setState({...state});
      return;
    }
    applyPlay(state, card as any, type as any, {box:'base', blitz:false, coverage:'zone'} as any);
    setState({...state});
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
          <img src="/assets/field.svg" alt="field" style={{width:'100%', borderRadius:12}}/>
        </div>
        <div className="controls-panel">
          <h3>Play Calls</h3>
          <div className="buttons-grid">
            <button onClick={()=>play('insideRun')}><img src="/assets/ui/btn-run.svg" alt="run" width={140}/></button>
            <button onClick={()=>play('outsideRun')}><img src="/assets/ui/btn-sweep.svg" alt="sweep" width={140}/></button>
            <button onClick={()=>play('shortPass')}><img src="/assets/ui/btn-pass.svg" alt="pass" width={140}/></button>
            <button onClick={()=>play('longPass')}><img src="/assets/ui/btn-bomb.svg" alt="bomb" width={140}/></button>
            <button onClick={()=>play('punt')}><img src="/assets/ui/btn-punt.svg" alt="punt" width={140}/></button>
            <button onClick={()=>play('fieldGoal')}><img src="/assets/ui/btn-fg.svg" alt="fg" width={140}/></button>
          </div>
          <div style={{marginTop:8, fontSize:12}}>
            <div><strong>Home QB:</strong> {homeQB?.name || '—'}</div>
            <div><strong>Home RB:</strong> {homeRB?.name || '—'}</div>
            <div><strong>Away QB:</strong> {awayQB?.name || '—'}</div>
            <div><strong>Away RB:</strong> {awayRB?.name || '—'}</div>
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