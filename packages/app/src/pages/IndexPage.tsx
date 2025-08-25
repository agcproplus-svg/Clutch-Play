import React, { useMemo, useState } from 'react';
import meta from '../../../data/2008/team-meta.json';

export default function IndexPage({ onStart }:{ onStart:(home:string,away:string)=>void }){
  const [home, setHome] = useState('NYG');
  const [away, setAway] = useState('DAL');
  const [q, setQ] = useState('');

  const teams = useMemo(()=> meta.filter(t=> (t.abbr+t.name).toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <div className="index-page">
      <header><h1>Clutch Play — Play Demo</h1></header>
      <div className="team-select">
        <div>
          <h3>Home</h3>
          <input placeholder="search teams..." value={q} onChange={e=>setQ(e.target.value)} />
          <select value={home} onChange={e=>setHome(e.target.value)}>
            {teams.map(t=> <option key={t.id} value={t.id}>{t.abbr} — {t.name}</option>)}
          </select>
          <img src={ (meta.find(m=>m.id===home)||meta[0]).logo } alt="home logo" width={96} />
        </div>
        <div>
          <h3>Away</h3>
          <select value={away} onChange={e=>setAway(e.target.value)}>
            {teams.map(t=> <option key={t.id} value={t.id}>{t.abbr} — {t.name}</option>)}
          </select>
          <img src={ (meta.find(m=>m.id===away)||meta[1]).logo } alt="away logo" width={96} />
        </div>
      </div>
      <div style={{marginTop:16}}>
        <button className="primary" onClick={()=>onStart(home,away)}>Start Game</button>
      </div>
      <footer style={{marginTop:24,fontSize:12}}>Demo uses placeholder logos and sample cards. Replace data/2008 to add full rosters.</footer>
    </div>
  )
}