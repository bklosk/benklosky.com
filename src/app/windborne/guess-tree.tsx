"use client";

import { useState } from "react";

type Branch = {
  word: string;
  /** Words still in play once this guess wins. */
  count: number;
  kids?: [Branch, Branch];
};

const TREE: Branch = {
  word: "start",
  count: 1000,
  kids: [
    { word: "pizza", count: 500, kids: [{ word: "pasta", count: 250 }, { word: "salad", count: 250 }] },
    { word: "running", count: 500, kids: [{ word: "dog", count: 250 }, { word: "swimming", count: 250 }] },
  ],
};

type Placed = { id: string; branch: Branch; depth: number; x: number; y: number; parent: Placed | null };

const COLUMN = 104;
const ROW = 30;
const LEFT = 14;
const TOP = 18;
const WIDTH = LEFT + COLUMN * 2 + 72;
const HEIGHT = TOP * 2 + ROW * 3;

function place(): Placed[] {
  const out: Placed[] = [];
  let row = 0;
  const walk = (branch: Branch, depth: number, parent: Placed | null, id: string): Placed => {
    const node: Placed = { id, branch, depth, x: LEFT + depth * COLUMN, y: 0, parent };
    out.push(node);
    if (branch.kids) {
      const kids = branch.kids.map((kid, i) => walk(kid, depth + 1, node, `${id}${i}`));
      node.y = (kids[0].y + kids[1].y) / 2;
    } else {
      node.y = TOP + row++ * ROW;
    }
    return node;
  };
  walk(TREE, 0, null, "r");
  return out;
}

const NODES = place();
const R = 4;

function curve(from: Placed, to: Placed) {
  const x1 = from.x + R;
  const x2 = to.x - R;
  const mid = (x1 + x2) / 2;
  return `M${x1},${from.y} C${mid},${from.y} ${mid},${to.y} ${x2},${to.y}`;
}

export function GuessTree() {
  const [selectedId, setSelectedId] = useState("r10");

  const path: Placed[] = [];
  for (let node: Placed | null = NODES.find((n) => n.id === selectedId)!; node; node = node.parent) path.unshift(node);
  const onPath = new Set(path.map((node) => node.id));

  return (
    <figure className="windborne-figure">
      <svg
        className="windborne-tree"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label="A tree of guesses that halves the dictionary each time"
      >
        <g fill="none" strokeLinecap="round">
          {NODES.filter((node) => node.parent).map((node) => (
            <path key={node.id} d={curve(node.parent!, node)} className={onPath.has(node.id) ? "is-path" : undefined} />
          ))}
        </g>
        {NODES.map((node) => {
          const isLeaf = !node.branch.kids;
          return (
            <g
              key={node.id}
              className={`windborne-tree-node${onPath.has(node.id) ? " is-path" : ""}${node.id === selectedId ? " is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${node.branch.word}, ${node.branch.count} words left`}
              aria-pressed={node.id === selectedId}
              onClick={() => setSelectedId(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(node.id);
                }
              }}
            >
              <circle cx={node.x} cy={node.y} r={11} fill="transparent" />
              <circle cx={node.x} cy={node.y} r={R} />
              {isLeaf ? (
                <text x={node.x + R + 6} y={node.y} dominantBaseline="central">
                  {node.branch.word}
                </text>
              ) : (
                node.parent && (
                  <text x={node.x} y={node.y - R - 6} textAnchor="middle">
                    {node.branch.word}
                  </text>
                )
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
