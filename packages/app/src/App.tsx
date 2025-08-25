import React, { useState } from 'react';
import IndexPage from './pages/IndexPage';
import GamePage from './pages/GamePage';
import './styles.css';

export default function App(){
  const [match, setMatch] = useState<{home:string, away:string}|null>(null);
  return (
    <div className="app-root">
      {!match && <IndexPage onStart={(home,away)=>setMatch({home,away})}/>}
      {match && <GamePage home={match.home} away={match.away} onExit={()=>setMatch(null)}/>}
    </div>
  )
}