"use client";

/* The cover URLs come from the supplied BGG export. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { Clock3, ExternalLink, Users, X } from "lucide-react";
import { ShelfModel } from "./shelf-model";
import { range, type Game, type Selection } from "./types";

const noMatches = new Set<number>();

export function ShelfExplorer({ games }: { games: Game[] }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function select(next: Selection) {
    triggerRef.current = document.activeElement as HTMLElement;
    setSelection(next);
    const docked = window.matchMedia("(max-width: 640px)").matches;
    if (!docked && window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => detailsRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "nearest",
      }));
    }
  }

  const game = selection?.game;

  return (
    <div className="shelf-page">
      <section className={`shelf-exhibit${selection ? " has-selection" : ""}`} aria-label="The game shelf">
        <ShelfModel games={games} selectedId={game?.id} matchedIds={noMatches} searching={false} onSelect={select} />
        {selection && (
          <aside className="shelf-selection" ref={detailsRef} aria-label="Selected board game" aria-live="polite">
            <button className="shelf-selection-close" aria-label="Close game details" onClick={() => {
              setSelection(null);
              if (triggerRef.current?.isConnected) triggerRef.current.focus();
            }}><X size={18} /></button>
            {game ? (
              <>
                {game.image && <img className="shelf-selection-cover" src={game.image} alt={`${game.name} box cover`} />}
                <h2>{game.name}</h2>
                {game.designers.length > 0 && <p className="shelf-selection-designer">by {game.designers.join(" & ")}</p>}
                <p className="shelf-selection-summary">{game.summary || game.description.split("\n\n")[0]}</p>
                <div className="shelf-selection-facts">
                  <span><Users size={15} /> {range(game.minPlayers, game.maxPlayers)} players</span>
                  <span><Clock3 size={15} /> {range(game.minMinutes, game.maxMinutes)} min</span>
                </div>
                <p className="shelf-selection-plays">{game.plays} logged {game.plays === 1 ? "play" : "plays"}{game.rating ? ` · ${game.rating.toFixed(1)} BGG rating` : ""}</p>
                <details><summary>More about this game</summary>{game.description.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</details>
                <a className="shelf-selection-link" href={game.url} target="_blank" rel="noreferrer">View on BoardGameGeek <ExternalLink size={15} /></a>
              </>
            ) : (
              <>
                <h2>{selection.label ?? "Unidentified box"}</h2>
                <p>This box could not be confidently matched to a game in the supplied collection.</p>
              </>
            )}
          </aside>
        )}
      </section>
    </div>
  );
}
