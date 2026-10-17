"use client";

import { useState } from "react";

type Branch = {
  /** What is left of the dictionary on this branch. */
  pool: string;
  count: number;
  /** The two contrasting guesses made here. The closer one picks the child. */
  split?: [string, string];
  kids?: [Branch, Branch];
};

const leaf = (pool: string): Branch => ({ pool, count: 125 });

const TREE: Branch = {
  pool: "every word",
  count: 1000,
  split: ["pizza", "running"],
  kids: [
    {
      pool: "food",
      count: 500,
      split: ["pizza", "banana"],
      kids: [
        { pool: "meals", count: 250, split: ["lasagna", "cake"], kids: [leaf("savory"), leaf("sweet")] },
        { pool: "produce", count: 250, split: ["banana", "carrot"], kids: [leaf("fruit"), leaf("vegetables")] },
      ],
    },
    {
      pool: "everything else",
      count: 500,
      split: ["dog", "running"],
      kids: [
        { pool: "animals", count: 250, split: ["dog", "salmon"], kids: [leaf("mammals"), leaf("fish")] },
        { pool: "actions and things", count: 250, split: ["running", "hammer"], kids: [leaf("actions"), leaf("objects")] },
      ],
    },
  ],
};

type Placed = {
  id: string;
  branch: Branch;
  depth: number;
  x: number;
  y: number;
  parent: Placed | null;
  /** Which of the parent's two guesses won to get here. */
  winner?: string;
};

const COLUMN = 136;
const ROW = 38;
const LEFT = 26;
const TOP = 30;
const WIDTH = LEFT + COLUMN * 3 + 96;

function place(): Placed[] {
  const out: Placed[] = [];
  let row = 0;
  const walk = (branch: Branch, depth: number, parent: Placed | null, id: string, winner?: string): Placed => {
    const node: Placed = { id, branch, depth, x: LEFT + depth * COLUMN, y: 0, parent, winner };
    out.push(node);
    if (branch.kids) {
      const kids = branch.kids.map((kid, i) => walk(kid, depth + 1, node, `${id}${i}`, branch.split?.[i]));
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

const radius = (count: number) => 2.5 + Math.sqrt(count) * 0.22;

function curve(from: Placed, to: Placed) {
  const x1 = from.x + radius(from.branch.count);
  const x2 = to.x - radius(to.branch.count);
  const mid = (x1 + x2) / 2;
  return `M${x1},${from.y} C${mid},${from.y} ${mid},${to.y} ${x2},${to.y}`;
}

export function GuessTree() {
  const height = TOP * 2 + ROW * 7;
  const [selectedId, setSelectedId] = useState("r100");
  const selected = NODES.find((node) => node.id === selectedId)!;

  const path: Placed[] = [];
  for (let node: Placed | null = selected; node; node = node.parent) path.unshift(node);
  const onPath = new Set(path.map((node) => node.id));

  return (
    <figure className="windborne-figure">
      <div className="windborne-tree-scroll">
        <svg
          className="windborne-tree"
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="group"
          aria-label="A tree of guesses that halves the dictionary each time"
        >
          <g fill="none" strokeLinecap="round">
            {NODES.filter((node) => node.parent).map((node) => (
              <path
                key={node.id}
                d={curve(node.parent!, node)}
                className={onPath.has(node.id) ? "is-path" : undefined}
              />
            ))}
          </g>
          {NODES.map((node) => {
            const r = radius(node.branch.count);
            const isLeaf = !node.branch.kids;
            const anchor = node.depth === 0 ? "start" : "middle";
            return (
              <g
                key={node.id}
                className={`windborne-tree-node${onPath.has(node.id) ? " is-path" : ""}${node.id === selectedId ? " is-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${node.branch.pool}, ${node.branch.count} words left`}
                aria-pressed={node.id === selectedId}
                onClick={() => setSelectedId(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(node.id);
                  }
                }}
              >
                <circle cx={node.x} cy={node.y} r={Math.max(r + 7, 11)} fill="transparent" />
                <circle cx={node.x} cy={node.y} r={r} />
                {isLeaf ? (
                  <text x={node.x + r + 8} y={node.y} dominantBaseline="central">
                    {node.branch.pool}
                  </text>
                ) : (
                  <>
                    <text className="windborne-tree-guess" x={node.x} y={node.y - r - 7} textAnchor={anchor}>
                      {node.branch.split![0]} vs {node.branch.split![1]}
                    </text>
                    <text x={node.x} y={node.y + r + 14} textAnchor={anchor}>
                      {node.branch.pool}
                      <tspan className="windborne-tree-count"> {node.branch.count.toLocaleString("en-US")}</tspan>
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="windborne-caption">
        Each guess is a contrast, and the closer word picks a half. Click a branch to follow it:{" "}
        {path.length === 1 ? (
          "all 1,000 words are still in play."
        ) : (
          <>
            {path.slice(1).map((node, i) => {
              const [a, b] = path[i].branch.split!;
              return (
                <span key={node.id}>
                  {a} vs {b}, <strong>{node.winner}</strong>
                  {i < path.length - 2 ? "; " : ". "}
                </span>
              );
            })}
            {selected.branch.count.toLocaleString("en-US")} words left.
          </>
        )}
      </figcaption>
    </figure>
  );
}
