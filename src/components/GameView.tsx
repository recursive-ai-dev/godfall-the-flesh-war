import { TouchNavigation } from './TouchNavigation';
import { WarStatus, BattleResults } from './WarStatus';
import type { Difficulty } from '../game/warfare';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { audio } from "../game/audio";
import { GameEngine } from "../game/engine";
import { renderMinimap, renderWorld, worldFromScreen } from "../game/renderer";
import { TEAM, MAP_W, MAP_H, TILE } from "../game/types";
import type { BuildingClass, Faction, HudState } from "../game/types";
import { IMG } from "../media";
import { HUD } from "./HUD";

export function GameView({
  faction,
  difficulty,
  onQuit,
  onRematch,
}: {
  faction: Faction;
  difficulty: Difficulty;
  onQuit: () => void;
  onRematch: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const keysRef = useRef(new Set<string>());
  const edgeRef = useRef({ x: 0, y: 0 });
  const pausedRef = useRef(false);
  const dragRef = useRef<{
    down: boolean;
    x: number;
    y: number;
    wx: number;
    wy: number;
    btn: number;
    lastClick: number;
  }>({ down: false, x: 0, y: 0, wx: 0, wy: 0, btn: 0, lastClick: 0 });
  const midRef = useRef<{ on: boolean; x: number; y: number }>({ on: false, x: 0, y: 0 });

  const [hud, setHud] = useState<HudState | null>(null);
  const [touchCommand, setTouchCommand] = useState(false);
  const [paused, setPaused] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [muted, setMuted] = useState(() => audio.muted);
  const [briefing, setBriefing] = useState(true);
  const miniDragRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setBriefing(false), 3400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const engine = new GameEngine(faction, undefined, difficulty);
    engineRef.current = engine;
    audio.resume();

    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const canvas = canvasRef.current;
      const mini = miniRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const pw = Math.floor(w * dpr);
      const ph = Math.floor(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (!pausedRef.current) {
        engine.update(dt, keysRef.current, edgeRef.current, w, h);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderWorld(ctx, engine.renderView(), w, h);

      if (mini) {
        const mw = 180;
        const mh = 180;
        const mpw = Math.floor(mw * dpr);
        const mph = Math.floor(mh * dpr);
        if (mini.width !== mpw) {
          mini.width = mpw;
          mini.height = mph;
        }
        const mctx = mini.getContext("2d");
        if (mctx) {
          mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderMinimap(mctx, engine.renderView(), mw, mh, w, h);
        }
      }

      const edge=edgeRef.current;
      if((edge.x<0&&engine.cam.x<=0)||(edge.x>0&&engine.cam.x+engine.viewW/engine.cam.zoom>=MAP_W*TILE)) edge.x=0;
      if((edge.y<0&&engine.cam.y<=0)||(edge.y>0&&engine.cam.y+engine.viewH/engine.cam.zoom>=MAP_H*TILE)) edge.y=0;
      hudAcc += dt;
      if (hudAcc > 0.1) {
        hudAcc = 0;
        setHud(engine.hud());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    setHud(engine.hud());

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(k))
        e.preventDefault();
      if (e.repeat && k === "escape") return;
      keysRef.current.add(k);
      audio.resume();

      if (k === "escape") {
        if (engine.buildMode) {
          engine.buildMode = null;
          engine.ghost = null;
          setBuildOpen(false);
        } else if (engine.attackMoveMode) { engine.attackMoveMode=false;
        } else {
          setPaused((p) => !p);
        }
      }
      if(k === 'escape' || pausedRef.current || engine.outcome !== 'playing') return;
      if(!e.repeat && k === 'q') engine.attackMoveMode=!engine.attackMoveMode;
      if(!e.repeat && k === 'x') engine.holdSelected();
      if(!e.repeat && k === 'e') engine.activateAbility();
      if(k === 'r') engine.centerOnRelic();
      if (k === " " || k === "spacebar") engine.centerOnHall();
      if (k === "i" || k === ".") engine.cycleIdleWorker();
      if (k === "h") engine.selectPlayerHall();
      if (k === "f4" || k === "backspace" || k === "delete") {
        engine.stopSelected();
        e.preventDefault();
      }
      if (e.ctrlKey && k >= "1" && k <= "9") {
        engine.assignGroup(Number(k));
        e.preventDefault();
      } else if (k >= "1" && k <= "9" && !e.ctrlKey) {
        engine.recallGroup(Number(k));
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const onBlur = () => { keysRef.current.clear(); edgeRef.current = {x: 0, y: 0}; setPaused(true); };
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      engineRef.current = null;
    };
  }, [faction, difficulty]);

  function toLocal(clientX: number, clientY: number, el: HTMLCanvasElement) {
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, r };
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const { x, y, r } = toLocal(e.clientX, e.clientY, canvas);
    const world = worldFromScreen(engine.cam, x, y);
    engine.updateGhost(world.x, world.y);

    const margin = e.pointerType === "touch" ? -1 : 22;
    edgeRef.current = {
      x: x < margin ? -1 : x > r.width - margin ? 1 : 0,
      y: y < margin ? -1 : y > r.height - margin ? 1 : 0,
    };

    if (midRef.current.on) {
      engine.cam.x -= (e.clientX - midRef.current.x) / engine.cam.zoom;
      engine.cam.y -= (e.clientY - midRef.current.y) / engine.cam.zoom;
      midRef.current.x = e.clientX;
      midRef.current.y = e.clientY;
    }

    const d = dragRef.current;
    if (d.down && d.btn === 0) {
      if (Math.hypot(x - d.x, y - d.y) > 6) {
        engine.box = { x1: d.wx, y1: d.wy, x2: world.x, y2: world.y };
      }
    }
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine || pausedRef.current || engine.outcome !== "playing") return;
    audio.resume();
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = toLocal(e.clientX, e.clientY, canvas);
    const world = worldFromScreen(engine.cam, x, y);
    if (e.button === 1) {
      e.preventDefault();
      midRef.current = { on: true, x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 2 || (e.pointerType === "touch" && touchCommand && !engine.buildMode)) {
      if (engine.buildMode) {
        engine.buildMode = null;
        engine.ghost = null;
        setBuildOpen(false);
        return;
      }
      engine.commandAt(world.x, world.y, e.shiftKey);
      setTouchCommand(false);
      return;
    }
    if (e.button === 0) {
      if (engine.buildMode) {
        engine.updateGhost(world.x, world.y);
        engine.tryPlaceBuilding();
        return;
      }
      if (engine.attackMoveMode) {
        engine.commandAt(world.x, world.y, e.shiftKey, true);
        engine.attackMoveMode = false;
        return;
      }
      const now = performance.now();
      if (now - dragRef.current.lastClick < 280) {
        engine.doubleSelect(world.x, world.y);
        dragRef.current.lastClick = 0;
        return;
      }
      dragRef.current = { down: true, x, y, wx: world.x, wy: world.y, btn: 0, lastClick: now };
    }
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const { x, y } = toLocal(e.clientX, e.clientY, canvas);
    const world = worldFromScreen(engine.cam, x, y);
    if (e.button === 1) midRef.current.on = false;
    const d = dragRef.current;
    if (d.down && e.button === 0) {
      d.down = false;
      engine.box = null;
      if (Math.hypot(x - d.x, y - d.y) > 8) {
        engine.selectBox(d.wx, d.wy, world.x, world.y, e.shiftKey);
      } else {
        engine.selectAt(world.x, world.y, e.shiftKey);
      }
    }
  }

  function onPointerLeave() {
    edgeRef.current = { x: 0, y: 0 };
  }

  function onWheel(e: WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const { x, y } = toLocal(e.clientX, e.clientY, canvas);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    engine.zoomAt(x, y, e.deltaY * unit);
  }

  function onMinimapDown(e: PointerEvent) {
    const mini = miniRef.current;
    const engine = engineRef.current;
    if (!mini || !engine) return;
    if (e.button === 0) {
      miniDragRef.current = true;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
    const r = mini.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    engine.minimapClick(nx, ny, e.button === 2);
  }

  function onMinimapMove(e: PointerEvent) {
    if (!miniDragRef.current) return;
    const mini = miniRef.current;
    const engine = engineRef.current;
    if (!mini || !engine) return;
    const r = mini.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    engine.minimapClick(nx, ny, false);
  }

  function onMinimapUp() {
    miniDragRef.current = false;
  }

  const outcome = hud?.outcome ?? "playing";

  const playfield = (
    <div className="relative min-h-0 flex-1">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{
          cursor: hud?.buildMode ? "cell" : hud?.attackMove ? "crosshair" : "default",
        }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
      />

      {hud && <WarStatus hud={hud} faction={faction} onRelic={()=>engineRef.current?.centerOnRelic()} onIdle={()=>engineRef.current?.cycleIdleWorker()} />}

      {hud && !paused && outcome==='playing' && <TouchNavigation canPan={hud.canPan} command={touchCommand}
        onPan={(x,y)=>{edgeRef.current={x,y};}}
        onCommand={()=>setTouchCommand(v=>!v)}
        onCancel={()=>{setTouchCommand(false);setBuildOpen(false);const e=engineRef.current;if(e){e.buildMode=null;e.ghost=null;e.attackMoveMode=false;}}} />}
      {briefing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
          <div className="text-center">
            <p className="font-cinzel text-sm tracking-[0.4em] text-amber-200/80">THE WAR BEGINS</p>
            <h2 className="font-title mt-2 text-4xl tracking-[0.18em] text-amber-100">
              {TEAM[faction].name}
            </h2>
            <p className="mt-3 text-sm text-stone-300">Gather gold. Raise banners. Burn their halls.</p>
          </div>
        </div>
      )}

      {paused && outcome === "playing" && (
        <Overlay
          title="Paused"
          body="The field waits."
          img={IMG.titleBg}
          actions={[
            { label: "Resume", onClick: () => setPaused(false) },
            {
              label: "Surrender",
              onClick: () => {
                const e = engineRef.current;
                if (!e) return onQuit();
                e.surrender();
                setHud(e.hud());
                setPaused(false);
              },
            },
          ]}
        />
      )}

      {outcome === "victory" && (
        <Overlay
          title="Victory"
          body={hud?.resultReason ?? "Both rivals have fallen."}
          children={hud && <BattleResults hud={hud} />}
          img={IMG.victory}
          actions={[
            { label: "Rematch", onClick: onRematch },
            { label: "Main Menu", onClick: onQuit },
          ]}
        />
      )}
      {outcome === "defeat" && (
        <Overlay
          title="Defeat"
          body={hud?.resultReason ?? "Your stronghold has fallen."}
          children={hud && <BattleResults hud={hud} />}
          img={IMG.defeat}
          actions={[
            { label: "Rematch", onClick: onRematch },
            { label: "Main Menu", onClick: onQuit },
          ]}
        />
      )}
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full flex-col bg-black"
      onContextMenu={(e) => e.preventDefault()}
    >
      {hud ? (
        <HUD
          hud={hud}
          faction={faction}
          miniRef={miniRef}
          buildOpen={buildOpen}
          muted={muted}
          onTrain={(t) => engineRef.current?.train(t)}
          onBuild={(t: BuildingClass) => {
            const e = engineRef.current;
            if (!e) return;
            e.buildMode = t;
            setBuildOpen(true);
            audio.click();
          }}
          onToggleBuild={() => {
            const e = engineRef.current;
            if (!e) return;
            if (buildOpen) {
              e.buildMode = null;
              e.ghost = null;
              setBuildOpen(false);
            } else setBuildOpen(true);
          }}
          onStop={() => engineRef.current?.stopSelected()}
          onHold={() => engineRef.current?.holdSelected()}
          onAbility={() => engineRef.current?.activateAbility()}
          onAttackMove={() => {
            const e = engineRef.current;
            if (!e) return;
            e.attackMoveMode = !e.attackMoveMode;
            audio.click();
          }}
          onCancelQueue={(i) => engineRef.current?.cancelQueue(i)}
          onResearch={(id) => engineRef.current?.research(id)}
          onRecallGroup={(n) => engineRef.current?.recallGroup(n)}
          onCycleSpeed={() => {
            const e = engineRef.current;
            if (!e) return;
            e.gameSpeed = e.gameSpeed === 1 ? 1.5 : e.gameSpeed === 1.5 ? 2 : 1;
            setHud(e.hud());
          }}
          onMinimapDown={onMinimapDown}
          onMinimapMove={onMinimapMove}
          onMinimapUp={onMinimapUp}
          onMute={() => setMuted(audio.toggleMute())}
          onMenu={() => setPaused(true)}
        >
          {playfield}
        </HUD>
      ) : (
        playfield
      )}
    </div>
  );
}

function Overlay({
  title,
  body,
  img,
  actions,
  children,
}: {
  title: string;
  body: string;
  img: string;
  children?: ReactNode;
  actions: { label: string; onClick: () => void }[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-black/60" />
      <div className="how-card relative z-10 w-[min(850px,96vw)] p-10 text-center">
        <h2 className="font-title text-4xl tracking-[0.2em] text-amber-200">{title}</h2>
        <div className="gold-line mx-auto mt-3 mb-5 w-40" />
        <p className="mb-8 text-stone-300">{body}</p>
        {children}
        <div className="flex flex-wrap justify-center gap-3">
          {actions.map((a) => (
            <button key={a.label} className="menu-btn" onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
