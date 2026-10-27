import { useRef, type PointerEvent } from 'react';
export type PanDirections = { left: boolean; right: boolean; up: boolean; down: boolean };
export function TouchNavigation({canPan,onPan,command,onCommand,onCancel}:{canPan:PanDirections;onPan:(x:number,y:number)=>void;command:boolean;onCommand:()=>void;onCancel:()=>void}) {
  const held=useRef<number|null>(null);
  const stop=()=>{held.current=null;onPan(0,0);};
  const arrows=[['left','‹',-1,0],['right','›',1,0],['up','⌃',0,-1],['down','⌄',0,1]] as const;
  function press(e:PointerEvent<HTMLButtonElement>,x:number,y:number) {
    e.preventDefault();e.stopPropagation();held.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);onPan(x,y);
  }
  return <div className="touch-navigation" aria-label="Touch battlefield controls">
    {arrows.map(([direction,glyph,x,y])=>canPan[direction]&&<button key={direction} className={`pan-arrow pan-${direction}`} aria-label={`Pan ${direction}`} onPointerDown={e=>press(e,x,y)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={()=>{if(held.current!==null) stop();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPan(x,y);}}} onKeyUp={stop} onBlur={stop}>{glyph}</button>)}
    <div className="touch-orders"><button className={command?'active':''} aria-pressed={command} onClick={onCommand}>{command?'Tap destination':'Give order'}</button><button onClick={onCancel}>Cancel</button></div>
  </div>;
}
