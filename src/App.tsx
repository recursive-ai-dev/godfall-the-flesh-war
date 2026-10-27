import type { Difficulty } from './game/warfare';
import { useState } from "react";
import { GameView } from "./components/GameView";
import { HowToPlay, TitleScreen } from "./components/TitleScreen";
import type { Faction } from "./game/types";
import "./media";

type Screen = "title" | "how" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [faction, setFaction] = useState<Faction>("human");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [gameKey, setGameKey] = useState(0);

  if (screen === "how") return <HowToPlay onBack={() => setScreen("title")} />;
  if (screen === "game") {
    return (
      <GameView
        key={gameKey}
        faction={faction}
        difficulty={difficulty}
        onQuit={() => setScreen("title")}
        onRematch={() => setGameKey((k) => k + 1)}
      />
    );
  }
  return (
    <TitleScreen
      faction={faction}
      onFaction={setFaction}
      difficulty={difficulty}
      onDifficulty={setDifficulty}
      onStart={() => setScreen("game")}
      onHow={() => setScreen("how")}
    />
  );
}
