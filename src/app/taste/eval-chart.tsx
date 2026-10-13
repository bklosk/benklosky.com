/** Held-out AUC against swipes, one small chart per domain. Server-rendered SVG. */

export type Stat = { mean: number; se: number; n: number };
export type EvalResult = {
  domain: string;
  users: number;
  checkpoints: number[];
  auc: Record<string, Record<string, Stat>>;
  popularity_auc: Stat;
  dense: { model: string; dims: number; rank: number };
  qa: { features: number; rank: number };
  profile: Record<
    string,
    {
      claims_per_user: Stat;
      personal_claims_per_user: Stat;
      precision: Stat | null;
      strong_precision: Stat | null;
      personal_precision: Stat | null;
      shared_precision: Stat | null;
    }
  >;
  prior_claims: number;
  prior_precision: Stat | null;
};

const SERIES = [
  { key: "qa/active", label: "QA features, picked cards", className: "s-qa-active" },
  { key: "qa/random", label: "QA features, random cards", className: "s-qa-random" },
  { key: "dense/active", label: "Embeddings, picked cards", className: "s-dense-active" },
  { key: "dense/random", label: "Embeddings, random cards", className: "s-dense-random" },
];

const W = 320;
const H = 180;
const PAD = { left: 34, right: 8, top: 8, bottom: 24 };

export function EvalChart({ result, title }: { result: EvalResult; title: string }) {
  const ks = result.checkpoints;
  const values = SERIES.flatMap((s) => ks.map((k) => result.auc[s.key][String(k)].mean)).concat(result.popularity_auc.mean);
  const lo = Math.floor(Math.min(...values) * 50) / 50;
  const hi = Math.ceil(Math.max(...values) * 50) / 50;
  const x = (k: number) => PAD.left + ((W - PAD.left - PAD.right) * k) / ks[ks.length - 1];
  const y = (v: number) => PAD.top + ((H - PAD.top - PAD.bottom) * (hi - v)) / (hi - lo);
  const ticks = Array.from({ length: Math.round((hi - lo) / 0.02) + 1 }, (_, i) => lo + 0.02 * i).filter((_, i, a) => a.length < 7 || i % 2 === 0);

  return (
    <figure className="taste-chart">
      <figcaption>
        {title} · {result.users} held-out users
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: held-out AUC by number of swipes`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 4} y={y(t) + 3} textAnchor="end">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {ks.map((k) => (
          <text key={k} x={x(k)} y={H - 8} textAnchor="middle">
            {k}
          </text>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(result.popularity_auc.mean)} y2={y(result.popularity_auc.mean)} className="s-pop" />
        {SERIES.map((s) => (
          <polyline key={s.key} className={s.className} points={ks.map((k) => `${x(k)},${y(result.auc[s.key][String(k)].mean)}`).join(" ")} />
        ))}
      </svg>
    </figure>
  );
}

export function Legend() {
  return (
    <ul className="taste-legend">
      {SERIES.map((s) => (
        <li key={s.key}>
          <svg width="18" height="8" aria-hidden="true">
            <line x1="0" x2="18" y1="4" y2="4" className={s.className} />
          </svg>
          {s.label}
        </li>
      ))}
      <li>
        <svg width="18" height="8" aria-hidden="true">
          <line x1="0" x2="18" y1="4" y2="4" className="s-pop" />
        </svg>
        Popularity (no swipes)
      </li>
    </ul>
  );
}
