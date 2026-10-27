import { useState } from "react";
import { DOCTRINE, FACTIONS, RELIC } from '../game/warfare';
import { TEAM, type Faction, type HudState } from '../game/types';

export function WarStatus({hud,faction,onRelic,onIdle}:{hud:HudState;faction:Faction;onRelic:()=>void;onIdle:()=>void}) {
  const [expanded,setExpanded]=useState(false);
  return <aside className={`war-status ${expanded?"expanded":""}`}>
    <button className="ritual-toggle" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>Ritual status {expanded?"−":"+"}</button>
    <div className="flex items-center justify-between gap-3"><span className="eyebrow">THE DEAD GOD</span><button onClick={onRelic} title="Center camera on the remains (R)">Locate [R]</button></div>
    <p className="mt-2 text-xs text-stone-300">{hud.ritual.contested?'Contested — all rituals paused':hud.ritual.owner?`${TEAM[hud.ritual.owner].name} holds the remains`:'Bring soldiers inside the ritual circle'}</p>
    {FACTIONS.map(f=><div key={f} className="ritual-row">
      <div className="flex justify-between gap-3" style={{color:TEAM[f].light}}><span>{DOCTRINE[f].ritual}{f===faction?' · YOU':''}</span><b>{hud.empowered[f]?'AWAKENED':`${Math.floor(hud.ritual.progress[f])}/${RELIC.goal}s`}</b></div>
      <div className="ritual-track"><div style={{width:`${hud.ritual.progress[f]/RELIC.goal*100}%`,background:TEAM[f].light}}/></div>
    </div>)}
    <p className="text-[10px] leading-relaxed text-stone-400">180 uncontested seconds grant 2× health, 1.8× damage, and +20% movement. Your own ritual can match their power. Raze both rivals to win.</p>
    <button className="idle-alert" onClick={onIdle} disabled={!hud.idleWorkers}>{hud.idleWorkers} idle workers · Select [I]</button>
  </aside>;
}

export function BattleResults({hud}: {hud:HudState}) {
  const time=`${Math.floor(hud.time/60)}:${String(Math.floor(hud.time%60)).padStart(2,'0')}`;
  return <div className="battle-results"><p className="mb-3 text-xs text-stone-400">Battle duration {time} · {hud.difficulty} difficulty</p>
    <table><thead><tr><th>Host</th><th>Trained</th><th>Kills</th><th>Lost</th><th>Razed</th><th>Gold / wood</th><th>Ritual</th></tr></thead>
      <tbody>{FACTIONS.map(f=><tr key={f}><th style={{color:TEAM[f].light}}>{TEAM[f].name}</th><td>{hud.stats[f].trained}</td><td>{hud.stats[f].kills}</td><td>{hud.stats[f].losses}</td><td>{hud.stats[f].buildings}</td><td>{hud.stats[f].gold} / {hud.stats[f].lumber}</td><td>{hud.empowered[f]?'Awakened':`${Math.floor(hud.ritual.progress[f])}s`}</td></tr>)}</tbody></table>
  </div>;
}
