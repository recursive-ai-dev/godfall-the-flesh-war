import { DIFFICULTY, DOCTRINE, type Difficulty } from '../game/warfare';
import type { Faction } from "../game/types";
import { TEAM } from "../game/types";
import { IMG } from "../media";

export function TitleScreen({
  faction,
  onFaction,
  difficulty,
  onDifficulty,
  onStart,
  onHow,
}: {
  faction: Faction;
  difficulty: Difficulty;
  onDifficulty: (difficulty: Difficulty) => void;
  onFaction: (f: Faction) => void;
  onStart: () => void;
  onHow: () => void;
}) {
  const factions: { id: Faction; label: string; lore: string; bonus: string }[] = [
    { id: "human", label: "HUMANS", lore: "The Ashen Crown holds the last mortal cities. Steel, discipline, and a vow to burn the god's remains.", bonus: "Shield wall · Officer support · Fortified towers" },
    { id: "darkelf", label: "DARK ELVES", lore: "The Umbral Court emerges from the deep kingdoms to claim the corpse and the power buried within it.", bonus: "Shadow-step · Forest concealment · Poison" },
    { id: "corrupted", label: "THE CORRUPTED", lore: "Once ordinary people, the God-Eaters consumed a dead god's flesh. Now mad with divine hunger, they feast and wage war.", bonus: "Frenzy · Corpse feasting · Mutation" },
  ];
  return (
    <div className="title-screen">
      <img src={IMG.titleBg} className="title-art" alt="" />
      <div className="title-content">
        <p className="eyebrow">THREE HOSTS. ONE DEAD GOD.</p>
        <h1 className="font-title">GODFALL</h1>
        <p className="subtitle font-cinzel">THE FLESH WAR</p>
        <p className="premise">The god is dead. The hunger is not.</p>
        <div className="faction-grid">
          {factions.map(f => <button key={f.id} aria-pressed={faction === f.id}
            className={`faction-card faction-choice ${faction === f.id ? "active" : ""}`}
            style={{ "--faction-color": TEAM[f.id].light } as import('react').CSSProperties}
            onClick={() => onFaction(f.id)}>
            <span className="eyebrow">{f.label}</span>
            <img src={IMG[`${f.id}Crest`]} alt="" className="faction-portrait" />
            <h2 className="font-cinzel">{TEAM[f.id].name}</h2>
            <p>{f.lore}</p><strong>{f.bonus}</strong>
          </button>)}
        </div>
        <p className="doctrine-note">{DOCTRINE[faction].description}</p>
        <label className="difficulty-select">Enemy commanders <select aria-label="Difficulty" value={difficulty} onChange={e=>onDifficulty(e.target.value as Difficulty)}>{Object.entries(DIFFICULTY).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>
        <div className="flex justify-center gap-4"><button className="menu-btn" onClick={onStart}>Begin the Flesh War</button><button className="menu-btn" onClick={onHow}>Field Manual</button></div>
        <p className="title-footer">FREE-FOR-ALL SKIRMISH · TWO RIVAL COMMANDERS · NO ALLIANCES</p>
      </div>
    </div>
  );
}

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto">
      <img src={IMG.titleBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/75" />
      <div className="how-card relative z-10 my-8 max-h-[90vh] w-full max-w-3xl overflow-auto p-8">
        <h2 className="font-title text-center text-3xl tracking-[0.2em] text-amber-200">COMMANDS OF WAR</h2>
        <div className="gold-line mx-auto mt-3 mb-6 w-48" />
        <div className="grid gap-6 text-sm leading-relaxed text-stone-200 sm:grid-cols-2">
          <section>
            <h3 className="font-cinzel mb-2 text-amber-300">Objective</h3>
            <p>
              Destroy all rival buildings to win. Hold the central remains with soldiers for 180 uncontested seconds to awaken: double unit and building health, 1.8× damage, and 20% faster movement. Progress is retained when you leave. Enemies in the circle pause all rituals. Every host can awaken; completing your own ritual is the answer to a divine enemy.
            </p>
          </section>
          <section>
            <h3 className="font-cinzel mb-2 text-amber-300">Economy</h3>
            <p>
              Select workers and right-click mines or trees. Halls accept gold and lumber; mills shorten timber delivery trips. Farms increase army capacity. Shift-right-click queues up to twelve orders; a gather order continues until the resource is exhausted.
            </p>
          </section>
          <section>
            <h3 className="font-cinzel mb-2 text-amber-300">The Host</h3>
            <p>
              Barracks train infantry and archers. Stables unlock cavalry. A Blacksmith unlocks
              siege engines. Guard towers watch the night.
            </p>
          </section>
          <section>
            <h3 className="font-cinzel mb-2 text-amber-300">Controls</h3>
            <ul className="space-y-1 text-[13px]">
              <li>Left click / drag — select</li>
              <li>Right click — move, attack, gather, rally</li>
              <li>WASD, arrows, screen edge — pan camera</li>
              <li>Mouse wheel — zoom · Space — town hall</li>
              <li>I — idle worker · Ctrl+1–9 control groups</li>
              <li>Q — attack-move · X — hold position · E — faction ability</li>
              <li>R — central remains · H — select hall</li>
              <li>Shift + right click — queue orders</li>
              <li>Esc — cancel placement / attack-move, then pause</li>
              <li>Minimap right-click — command · Middle drag — pan</li>
              <li>Touch: hold edge arrows to pan; Give order, then tap</li>
            </ul>
          </section>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">{(['human','darkelf','corrupted'] as Faction[]).map(f=><section key={f}><h3 style={{color:TEAM[f].light}}>{DOCTRINE[f].ability} [E]</h3><p className="mt-2 text-xs leading-relaxed text-stone-300">{DOCTRINE[f].description} Cooldown: {DOCTRINE[f].cooldown}s.</p></section>)}</div>
        <div className="mt-8 flex justify-center">
          <button className="menu-btn" onClick={onBack}>
            Return
          </button>
        </div>
      </div>
    </div>
  );
}
