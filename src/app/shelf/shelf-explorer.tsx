"use client";

import { useState } from "react";
import { ShelfModel } from "./shelf-model";
import type { Game, Selection } from "./types";

const noMatches = new Set<number>();

export function ShelfExplorer({ games }: { games: Game[] }) {
  const [selection, setSelection] = useState<Selection | null>(null);

  return (
    <main className="shelf-page">
      <section className="shelf-exhibit" aria-label="The game shelf">
        <ShelfModel games={games} selectedId={selection?.game?.id} matchedIds={noMatches} searching={false} onSelect={setSelection} />
      </section>
    </main>
  );
}
