import React, { useState } from 'react';
import meta from '../../../data/2008/team-meta.json';

export default function IndexPage({ onStart }:{ onStart:(home:string,away:string)=>void }){
  const [home, setHome] = useState('NYG');
  const [away, setAway] = useState('DAL');
  const h = meta.find(m=>m.id===home) || meta[0];
  const a = meta.find(m=>m.id===away) || meta[1];

  return (
    <div className="index-page">
      <header><h1>NFL Strat 2008 — Team Select</h1></header>
      <div className="team-select">
        <div>
          <h3>Home</h3>
          <select value={home} onChange={e=>setHome(e.target.value)}>
            {meta.map(t=> <option key={t.id} value={t.id}>{t.abbr} — {t.name}</option>)}
          </select>
          <img src={h.logo} alt="home logo" width={96} />
        </div>
        <div>
          <h3>Away</h3>
          <select value={away} onChange={e=>setAway(e.target.value)}>
            {meta.map(t=> <option key={t.id} value={t.id}>{t.abbr} — {t.name}</option>)}
          </select>
          <img src={a.logo} alt="away logo" width={96} />
        </div>
      </div>
      <div style={{marginTop:16}}>
        <button className="primary" onClick={()=>onStart(home,away)}>Start Game</button>
      </div>
    </div>
  )
}