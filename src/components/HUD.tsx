import { DOCTRINE } from '../game/warfare';
import { selectionCommands } from '../game/commands';
import { BUILDING, UNIT, buildingName, unitName } from "../game/data";
import type { BuildingClass, Faction, HudState, UnitClass } from "../game/types";
import { TEAM } from "../game/types";
import type { PointerEvent, ReactNode, RefObject } from "react";
import { IMG, spriteUrl } from "../media";

const BUILD_BTNS: BuildingClass[] = [
  "farm",
  "barracks",
  "mill",
  "blacksmith",
  "stables",
  "tower",
  "hall",
];

export function HUD({
  hud,
  faction,
  miniRef,
  buildOpen,
  muted,
  onTrain,
  onBuild,
  onToggleBuild,
  onStop,
  onHold,
  onAbility,
  onAttackMove,
  onCancelQueue,
  onMinimapDown,
  onMute,
  onMenu,
  children,
}: {
  hud: HudState;
  faction: Faction;
  miniRef: RefObject<HTMLCanvasElement | null>;
  buildOpen: boolean;
  muted: boolean;
  onTrain: (t: UnitClass) => void;
  onBuild: (t: BuildingClass) => void;
  onToggleBuild: () => void;
  onStop: () => void;
  onHold: () => void;
  onAbility: () => void;
  onAttackMove: () => void;
  onCancelQueue: (i: number) => void;
  onMinimapDown: (e: PointerEvent) => void;
  onMute: () => void;
  onMenu: () => void;
  children: ReactNode;
}) {
  const mm = Math.floor(hud.time / 60);
  const ss = Math.floor(hud.time % 60)
    .toString()
    .padStart(2, "0");
  const foodTight = hud.food >= hud.foodMax;
  const sel = hud.selected;
  const own = !sel || sel.faction === faction || sel.faction === null;
  const cmds = selectionCommands(sel, faction);
  const isWorker = cmds.worker;
  const isHall = cmds.hall;
  const isBarracks = cmds.barracks;
  const building = cmds.constructing ? "Constructing" : undefined;
  const crest = IMG[`${faction}Crest`];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="hud-top panel-wood relative z-20 flex h-12 shrink-0 items-center justify-between gap-3 px-3">
        <div className="flex items-center gap-3">
          <img src={crest} alt="" className="h-9 w-9 object-contain" />
          <span className="font-cinzel hidden text-sm tracking-[0.2em] text-amber-200 sm:block">
            GODFALL
          </span>
          <span className="hidden text-xs text-amber-200/60 lg:block">{TEAM[faction].name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="res-chip">
            <GoldIcon />
            <span className="font-semibold tabular-nums text-amber-200">{hud.gold}</span>
          </div>
          <div className="res-chip">
            <WoodIcon />
            <span className="font-semibold tabular-nums text-amber-100">{hud.lumber}</span>
          </div>
          <div className={`res-chip ${foodTight ? "border-red-500/60" : ""}`}>
            <FoodIcon />
            <span className={`font-semibold tabular-nums ${foodTight ? "text-red-300" : "text-lime-200"}`}>
              {hud.food}/{hud.foodMax}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-cinzel text-sm tabular-nums text-amber-100">
            {mm}:{ss}
          </span>
          <button
            className="border border-amber-700/50 bg-black/30 px-2 py-1 text-[11px] tracking-widest text-amber-200"
            onClick={onMute}
          >
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
          <button
            className="border border-amber-700/50 bg-black/30 px-2 py-1 text-[11px] tracking-widest text-amber-200"
            onClick={onMenu}
          >
            MENU
          </button>
        </div>
      </div>

      {children}

      <div className="pointer-events-none absolute right-4 bottom-52 z-20 flex max-w-md flex-col gap-1">
        {hud.messages.map((m, i) => (
          <div key={i} className="msg-toast pointer-events-none" style={{ opacity: Math.min(1, m.t / 1.2) }}>
            {m.text}
          </div>
        ))}
      </div>

      <div className="hud-bottom panel-wood relative z-20 flex h-[196px] shrink-0 gap-3 p-2">
        <canvas
          ref={miniRef}
          width={180}
          height={180}
          className="hud-mini h-[180px] w-[180px] shrink-0 cursor-pointer"
          onPointerDown={onMinimapDown}
          onContextMenu={(e) => e.preventDefault()}
        />

        <div className="hud-selection flex min-w-0 flex-1 gap-3">
          <div className="portrait-box shrink-0">
            <Portrait sel={sel} />
          </div>
          <div className="min-w-0 flex-1 py-1">
            {sel ? (
              <>
                <div className="font-cinzel text-base text-amber-100">
                  {sel.types.join(", ")}
                  {sel.count > 1 ? `  ×${sel.count}` : ""}
                </div>
                {sel.kind === "mine" ? (
                  <p className="mt-1 text-sm text-amber-200">Gold remaining: {sel.goldLeft}</p>
                ) : (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-[11px] text-stone-300">
                      <span>Health</span>
                      <span>
                        {Math.max(0, sel.hp) | 0} / {sel.maxHp | 0}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-black/50">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, (sel.hp / Math.max(1, sel.maxHp)) * 100))}%`,
                          background: "linear-gradient(90deg,#3d8b40,#8fd16a)",
                        }}
                      />
                    </div>
                  </div>
                )}
                {own && sel.unitType && sel.unitType !== "worker" && <p className="mt-2 text-[11px] leading-relaxed text-stone-300">{DOCTRINE[faction].description}</p>}
                {sel.kind === "building" && !sel.complete && (
                  <p className="mt-2 text-xs text-amber-200">
                    Constructing… {Math.round(sel.progress * 100)}%
                  </p>
                )}
                {sel.queue.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {sel.queue.map((q, i) => (
                      <button
                        key={i}
                        title={`${unitName(q.type, faction)}: cancel (75% refund)`}
                        aria-label={`Cancel ${unitName(q.type, faction)} (75% refund)`}
                        onClick={() => onCancelQueue(i)}
                        className="relative flex h-9 w-9 items-center justify-center border border-amber-700/60 bg-black/40 p-1.5 text-amber-100"
                      >
                        <UnitGlyph type={q.type} />
                        {i === 0 && (
                          <span
                            className="absolute bottom-0 left-0 h-0.5 bg-sky-400"
                            style={{ width: `${(q.t / q.max) * 100}%` }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-stone-400">
                <p className="font-cinzel text-amber-200/80">No selection</p>
                <p className="mt-2 text-xs leading-relaxed">
                  Select workers to gather. Build a barracks and send soldiers to the central remains. Q: attack-move · X: hold · E: ability · R: remains.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="hud-commands flex w-[340px] shrink-0 flex-wrap content-start justify-end gap-1">
          {isWorker && !buildOpen && (
            <>
              <Cmd label="Build" onClick={onToggleBuild}>
                <HammerIcon />
              </Cmd>
              <Cmd label="Stop" onClick={onStop}>
                <StopIcon />
              </Cmd>
              <Cmd label="Attack [Q]" active={hud.attackMove} onClick={onAttackMove}>
                <SwordIcon />
              </Cmd>
            </>
          )}
          {isWorker && buildOpen && (
            <>
              {BUILD_BTNS.map((t) => {
                const st = BUILDING[t];
                const poor = hud.gold < st.gold || hud.lumber < st.lumber;
                return (
                  <Cmd
                    key={t}
                    label={buildingName(t, faction)}
                    disabled={poor}
                    active={hud.buildMode === t}
                    onClick={() => onBuild(t)}
                    cost={`${st.gold}g ${st.lumber}w`}
                  >
                    <BuildGlyph type={t} />
                  </Cmd>
                );
              })}
              <Cmd label="Cancel" onClick={onToggleBuild}>
                <StopIcon />
              </Cmd>
            </>
          )}
          {isHall && (
            <Cmd
              label={unitName("worker", faction)}
              cost={building ?? `${UNIT.worker.gold}g`}
              disabled={!!building || hud.gold < UNIT.worker.gold || hud.food + UNIT.worker.food > hud.foodMax}
              onClick={() => onTrain("worker")}
            >
              <WorkerIcon />
            </Cmd>
          )}
          {isBarracks && (
            <>
              <TrainBtn hud={hud} faction={faction} type="melee" onTrain={onTrain} locked={!!building} lock={building} />
              <TrainBtn hud={hud} faction={faction} type="ranged" onTrain={onTrain} locked={!!building} lock={building} />
              <TrainBtn
                hud={hud}
                faction={faction}
                type="cavalry"
                onTrain={onTrain}
                locked={!!building || !hud.hasStables}
                lock={building ?? "Need Stables"}
              />
              <TrainBtn
                hud={hud}
                faction={faction}
                type="siege"
                onTrain={onTrain}
                locked={!!building || !hud.hasBlacksmith}
                lock={building ?? "Need Blacksmith"}
              />
            </>
          )}
          {cmds.military && (
            <>
              <Cmd label="Attack [Q]" active={hud.attackMove} onClick={onAttackMove}>
                <SwordIcon />
              </Cmd>
              <Cmd label="Hold [X]" active={hud.holding} onClick={onHold}><StopIcon /></Cmd>
              <Cmd label={`${DOCTRINE[faction].ability} [E]`} disabled={!hud.abilityReady} cost={hud.abilityReady ? `${hud.abilityReady} ready` : `${hud.abilityCooldown}s`} onClick={onAbility}><span>✦</span></Cmd>
              <Cmd label="Stop" onClick={onStop}><StopIcon /></Cmd>
              <p className="w-full text-right text-[10px] text-stone-400" title={DOCTRINE[faction].description}>Shift-click to queue · {hud.queuedOrders} orders queued</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TrainBtn({
  hud,
  faction,
  type,
  onTrain,
  locked,
  lock,
}: {
  hud: HudState;
  faction: Faction;
  type: UnitClass;
  onTrain: (t: UnitClass) => void;
  locked?: boolean;
  lock?: string;
}) {
  const st = UNIT[type];
  const poor = hud.gold < st.gold || hud.lumber < st.lumber || hud.food + st.food > hud.foodMax;
  return (
    <Cmd
      label={unitName(type, faction)}
      cost={locked ? lock : `${st.gold}g${st.lumber ? ` ${st.lumber}w` : ""}`}
      disabled={!!locked || poor}
      onClick={() => onTrain(type)}
    >
      <UnitGlyph type={type} />
    </Cmd>
  );
}

function UnitGlyph({ type }: { type: UnitClass }) {
  return type === "worker" ? <WorkerIcon /> : type === "melee" ? <SwordIcon /> : type === "ranged" ? <BowIcon /> : type === "cavalry" ? <HorseIcon /> : <SiegeIcon />;
}

function Cmd({
  label,
  cost,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string;
  cost?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`cmd-btn ${active ? "active" : ""}`} disabled={disabled} onClick={onClick} title={label}>
      <span className="h-6 w-6 shrink-0">{children}</span>
      <span className="cmd-label">{label}</span>
      {cost && <span className="cost">{cost}</span>}
    </button>
  );
}

function Portrait({ sel }: { sel: HudState["selected"] }) {
  if (!sel) {
    return (
      <div className="flex h-full items-center justify-center text-[10px] tracking-widest text-stone-500">
        NONE
      </div>
    );
  }
  const col = sel.faction ? TEAM[sel.faction].primary : "#c9a227";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1" style={{ color: col }}>
      {sel.faction && (sel.unitType || sel.buildingType) ?
        <img className="h-16 w-16" style={{imageRendering: "pixelated"}} alt=""
          src={spriteUrl(`${sel.faction}-${sel.unitType ? sel.unitType + '-0' : sel.buildingType}`)} /> :
        <div className="text-4xl">◆</div>}
      <div className="font-cinzel px-1 text-center text-[10px] leading-tight text-amber-100">
        {sel.types[0]}
      </div>
      {sel.count > 1 && <div className="text-xs text-white">{sel.count}</div>}
      <div className="absolute inset-0 ring-1 ring-inset ring-black/40" />
    </div>
  );
}

function GoldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-400">
      <circle cx="12" cy="12" r="8" fill="#e8c84a" stroke="#8a6a18" strokeWidth="2" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#6a4a10">
        G
      </text>
    </svg>
  );
}
function WoodIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <rect x="4" y="7" width="16" height="5" rx="1" fill="#8a5a28" />
      <rect x="6" y="13" width="14" height="5" rx="1" fill="#6a4018" />
    </svg>
  );
}
function FoodIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M7 20c4-8 2-14 5-16 3 2 1 8 5 16H7z" fill="#8bc34a" />
      <path d="M12 4v6" stroke="#5a3a10" strokeWidth="1.5" />
    </svg>
  );
}
function HammerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18l9-9 3 3-9 9H3v-3zm11.5-12l3 3 3-3-3-3-3 3z" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}
function SwordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 4l6 6-8 8-3-1-1-3 8-8zm-8 12l2 2-5 1 1-5 2 2z" />
    </svg>
  );
}
function BowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 19c8-2 12-8 14-14-6 2-12 6-14 14z" />
      <path d="M5 19L19 5" />
    </svg>
  );
}
function HorseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 18l2-7 4-2 2-4 4 2 4 3-2 4-3-1-2 5H8l-4 2z" />
    </svg>
  );
}
function SiegeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 16h18v3H3zM6 12h12l-2-6h-8z" />
    </svg>
  );
}
function WorkerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="7" r="3" />
      <path d="M6 20v-2c0-3 3-5 6-5s6 2 6 5v2z" />
    </svg>
  );
}
function BuildGlyph({ type }: { type: BuildingClass }) {
  const map: Record<BuildingClass, string> = {
    hall: "♜",
    farm: "🌾",
    barracks: "⚔",
    mill: "✸",
    blacksmith: "⚒",
    stables: "♞",
    tower: "▲",
  };
  return <span className="text-lg leading-none">{map[type]}</span>;
}
