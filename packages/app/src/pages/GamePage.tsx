// src/pages/GamePage.tsx
import React, { useState, useEffect } from "react";
import fieldImg from "../assets/img/field.png";
import cardsData from "../data/cards.json";

type PlayerCard = {
  id: string;
  name: string;
  position: string;
  team: string;
  offense: boolean;
  stats: { [key: string]: number | string };
};

type Team = {
  name: string;
  roster: PlayerCard[];
};

const positionsOffense = ["QB", "RB", "WR1", "WR2", "WR3", "TE"];
const positionsDefense = ["DT", "DE1", "DE2", "LB1", "LB2", "LB3", "CB1", "CB2", "FS", "SS"];

const GamePage: React.FC<{ homeTeam: string; awayTeam: string }> = ({ homeTeam, awayTeam }) => {
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [hoverPlayer, setHoverPlayer] = useState<PlayerCard | null>(null);
  const [resultText, setResultText] = useState<string>("Game Start!");
  const [ballPos, setBallPos] = useState<number>(25); // yard line (0–100)

  useEffect(() => {
    // Load rosters from cards.json
    const loadTeam = (teamName: string): Team => {
      const roster = (cardsData as PlayerCard[]).filter((p) => p.team === teamName);
      return { name: teamName, roster };
    };
    setHome(loadTeam(homeTeam));
    setAway(loadTeam(awayTeam));
  }, [homeTeam, awayTeam]);

  const resolvePlay = (offense: PlayerCard, defense: PlayerCard) => {
    const roll = Math.random();
    let yards = 0;
    let note = "";
    if (roll < 0.1) {
      note = "Incomplete / Stuffed";
      yards = 0;
    } else if (roll < 0.4) {
      note = "Short gain";
      yards = 3 + Math.floor(Math.random() * 4);
    } else if (roll < 0.7) {
      note = "Medium gain";
      yards = 7 + Math.floor(Math.random() * 6);
    } else if (roll < 0.9) {
      note = "Big play!";
      yards = 15 + Math.floor(Math.random() * 10);
    } else {
      note = "Breakaway!";
      yards = 30 + Math.floor(Math.random() * 20);
    }
    const newPos = Math.min(100, ballPos + yards);
    setBallPos(newPos);
    setResultText(`${offense.name} vs ${defense.name}: ${note} (${yards} yards). Ball at ${newPos}`);
  };

  const handlePlayClick = (pos: string) => {
    if (!home || !away) return;
    const offensePlayer = home.roster.find((p) => p.position === pos);
    const defensePlayer = away.roster[Math.floor(Math.random() * away.roster.length)];
    if (offensePlayer && defensePlayer) {
      resolvePlay(offensePlayer, defensePlayer);
    }
  };

  if (!home || !away) return <div>Loading rosters...</div>;

  return (
    <div className="game-page">
      {/* Result Box */}
      <div className="result-box" style={{ textAlign: "center", marginBottom: "1em", fontSize: "1.2em", fontWeight: "bold" }}>
        {resultText}
      </div>

      {/* Field with rosters */}
      <div className="field-container" style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
        {/* Home Team (left) */}
        <div className="home-team" style={{ width: "20%", display: "flex", flexDirection: "column" }}>
          {positionsOffense.map((pos) => {
            const player = home.roster.find((p) => p.position === pos);
            return (
              <div
                key={pos}
                className="player-card"
                style={{ padding: "0.5em", margin: "0.2em", border: "1px solid #ccc", background: "#eee", cursor: "pointer" }}
                onMouseEnter={() => setHoverPlayer(player || null)}
                onMouseLeave={() => setHoverPlayer(null)}
              >
                {player ? player.name : pos}
              </div>
            );
          })}
        </div>

        {/* Field Graphic */}
        <div className="field" style={{ width: "60%", position: "relative" }}>
          <img src={fieldImg} alt="Field" style={{ width: "100%" }} />
          {/* Ball marker */}
          <div
            className="ball-marker"
            style={{
              position: "absolute",
              top: "50%",
              left: `${ballPos}%`,
              transform: "translate(-50%, -50%)",
              background: "brown",
              color: "#fff",
              padding: "0.2em 0.5em",
              borderRadius: "50%",
            }}
          >
            🏈
          </div>
        </div>

        {/* Away Team (right) */}
        <div className="away-team" style={{ width: "20%", display: "flex", flexDirection: "column" }}>
          {positionsDefense.map((pos) => {
            const player = away.roster.find((p) => p.position === pos);
            return (
              <div
                key={pos}
                className="player-card"
                style={{ padding: "0.5em", margin: "0.2em", border: "1px solid #ccc", background: "#eee" }}
                onMouseEnter={() => setHoverPlayer(player || null)}
                onMouseLeave={() => setHoverPlayer(null)}
              >
                {player ? player.name : pos}
              </div>
            );
          })}
        </div>
      </div>

      {/* Play Selection */}
      <div className="play-selection" style={{ textAlign: "center", marginTop: "1em" }}>
        <h3>Select Play</h3>
        {positionsOffense.map((pos) => (
          <button key={pos} onClick={() => handlePlayClick(pos)} style={{ margin: "0.5em", padding: "0.5em 1em" }}>
            {pos}
          </button>
        ))}
      </div>

      {/* Hover Player Card */}
      {hoverPlayer && (
        <div
          className="hover-card"
          style={{
            position: "fixed",
            bottom: "1em",
            right: "1em",
            background: "#fff",
            border: "2px solid #333",
            padding: "1em",
            zIndex: 1000,
            width: "250px",
          }}
        >
          <h4>{hoverPlayer.name}</h4>
          <p>{hoverPlayer.position}</p>
          <pre style={{ fontSize: "0.8em" }}>{JSON.stringify(hoverPlayer.stats, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default GamePage;
