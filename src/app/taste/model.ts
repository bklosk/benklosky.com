/**
 * The taste model, ported from scripts/taste/model.py. Keep the two in step.
 *
 * Weights w have a population prior N(mu, U Uᵀ + diag(d)). Swipes are logistic
 * observations of x·w; profile edits are Gaussian observations of a trait
 * t_j = (C w)_j. The Laplace posterior is computed in observation space, so a
 * refit costs O(n²D) for n observations, cheap enough to run on every swipe.
 */

export type Layout = { X: [number, number, string]; C: [number, number, string]; U: [number, number, string] };

export type Feature = {
  question: string;
  option: string | null;
  kind: "score" | "choice";
  group: string;
  text: string;
  pos: string;
  neg: string;
  topic: string;
  levels: string[] | null;
};

export type Item = {
  id: string;
  title: string;
  creator: string | null;
  year: number | null;
  subtitle: string;
  blurb: string;
  tags: string[];
  link: string;
  credit: string;
  alt?: string | null;
  image: boolean;
};

export type Readout = { z: number; min: number; strong: number; dedupe: number; pinSd: number };

export type Artifact = {
  domain: string;
  version: number;
  answerer: string;
  items: Item[];
  features: Feature[];
  mean: number[];
  std: number[];
  mu: number[];
  d: number[];
  rank: number;
  layout: Layout;
  readout: Readout;
  stats: Record<string, unknown>;
};

/** One observation: a row a, and either a like/dislike or a target value for a·w. */
export type Observation =
  | { kind: "swipe"; item: number; like: boolean }
  | { kind: "pin"; feature: number; value: number };

type Cached = {
  logistic: boolean;
  target: number;
  noise: number;
  /** a, the observation row (length D). */
  a: Float64Array;
  /** Σ0 a (length D). */
  b: Float64Array;
  /** X Σ0 a (length N). */
  xb: Float64Array;
  /** C (Σ0 a)[1:] (length F). */
  cb: Float64Array;
};

export type Posterior = {
  /** Posterior mean of w (length D). */
  m: Float64Array;
  /** Latent mean and variance of x·w for every item. */
  itemMean: Float64Array;
  itemVar: Float64Array;
  /** Posterior mean and sd of each trait. */
  traitMean: Float64Array;
  traitSd: Float64Array;
  /** Pieces needed to explain one item's uncertainty. */
  obs: Cached[];
  G: Float64Array;
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, x))));
const LAMBDA = Math.sqrt(Math.PI / 8);
const BALD_C = Math.sqrt((Math.PI * Math.LN2) / 2);

export function predictive(mean: number, variance: number) {
  return sigmoid(mean / Math.sqrt(1 + (Math.PI * variance) / 8));
}

/** Mutual information between a swipe and the weights, in bits (Houlsby et al. 2011). */
export function bald(mean: number, variance: number) {
  const m = LAMBDA * mean;
  const v = LAMBDA * LAMBDA * variance;
  const p = Math.min(1 - 1e-12, Math.max(1e-12, predictive(mean, variance)));
  const entropy = -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  const expected = (BALD_C / Math.sqrt(v + BALD_C * BALD_C)) * Math.exp(-(m * m) / (2 * (v + BALD_C * BALD_C)));
  return entropy - expected;
}

/** In-place Cholesky of an n×n SPD matrix (row-major); returns the lower factor. */
function cholesky(A: Float64Array, n: number) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) L[i * n + i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i * n + j] = s / L[j * n + j];
    }
  }
  return L;
}

function cholSolve(L: Float64Array, n: number, rhs: Float64Array) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = rhs[i];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
    y[i] = s / L[i * n + i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * y[k];
    y[i] = s / L[i * n + i];
  }
  return y;
}

function cholInverse(L: Float64Array, n: number) {
  const inv = new Float64Array(n * n);
  const e = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    e.fill(0);
    e[j] = 1;
    const col = cholSolve(L, n, e);
    for (let i = 0; i < n; i++) inv[i * n + j] = col[i];
  }
  return inv;
}

export class TasteModel {
  readonly N: number;
  readonly F: number;
  readonly D: number;
  readonly K: number;
  /** Standardized features with a bias column, N × D. */
  readonly X: Float32Array;
  /** Catalog correlation of the standardized features, F × F. */
  readonly C: Float32Array;
  readonly U: Float64Array;
  readonly mu: Float64Array;
  readonly d: Float64Array;
  private readonly XU: Float64Array;
  private readonly priorItemVar: Float64Array;
  private readonly priorTraitVar: Float64Array;
  readonly priorTraitMean: Float64Array;
  readonly priorTraitSd: Float64Array;
  private cache = new Map<string, Cached>();

  constructor(
    readonly artifact: Artifact,
    bin: ArrayBuffer,
  ) {
    const [N, F] = artifact.layout.X;
    const [, K] = artifact.layout.U;
    const D = F + 1;
    this.N = N;
    this.F = F;
    this.D = D;
    this.K = K;
    const xCodes = new Uint16Array(bin.slice(0, 2 * N * F));
    const cCodes = new Int16Array(bin.slice(2 * N * F, 2 * N * F + 2 * F * F));
    const u32 = new Float32Array(bin.slice(2 * N * F + 2 * F * F, 2 * N * F + 2 * F * F + 4 * D * K));

    this.X = new Float32Array(N * D);
    for (let i = 0; i < N; i++) {
      this.X[i * D] = 1;
      for (let j = 0; j < F; j++) {
        const raw = xCodes[i * F + j] / 65535;
        this.X[i * D + j + 1] = (raw - artifact.mean[j]) / artifact.std[j];
      }
    }
    this.C = new Float32Array(F * F);
    for (let i = 0; i < F * F; i++) this.C[i] = cCodes[i] / 32767;
    this.U = Float64Array.from(u32);
    this.mu = Float64Array.from(artifact.mu);
    this.d = Float64Array.from(artifact.d);

    // Prior predictive variance of each item: rowsum((X U)²) + Σ x² d.
    this.XU = new Float64Array(N * K);
    this.priorItemVar = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let v = 0;
      for (let k = 0; k < K; k++) {
        let s = 0;
        for (let j = 0; j < D; j++) s += this.X[i * D + j] * this.U[j * K + k];
        this.XU[i * K + k] = s;
        v += s * s;
      }
      for (let j = 0; j < D; j++) v += this.X[i * D + j] * this.X[i * D + j] * this.d[j];
      this.priorItemVar[i] = v;
    }
    // Prior trait mean C mu[1:] and variance rowsum((C U[1:])²) + (C∘C) d[1:].
    this.priorTraitVar = new Float64Array(F);
    this.priorTraitMean = new Float64Array(F);
    for (let i = 0; i < F; i++) {
      let v = 0;
      for (let k = 0; k < K; k++) {
        let s = 0;
        for (let j = 0; j < F; j++) s += this.C[i * F + j] * this.U[(j + 1) * K + k];
        v += s * s;
      }
      let m = 0;
      for (let j = 0; j < F; j++) {
        const c = this.C[i * F + j];
        v += c * c * this.d[j + 1];
        m += c * this.mu[j + 1];
      }
      this.priorTraitVar[i] = v;
      this.priorTraitMean[i] = m;
    }
    this.priorTraitSd = this.priorTraitVar.map(Math.sqrt);
  }

  /** Σ0 a for a row a of length D. */
  private covTimes(a: Float64Array) {
    const { D, K, U, d } = this;
    const ua = new Float64Array(K);
    for (let j = 0; j < D; j++) {
      const aj = a[j];
      if (aj === 0) continue;
      for (let k = 0; k < K; k++) ua[k] += U[j * K + k] * aj;
    }
    const b = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      let s = d[j] * a[j];
      for (let k = 0; k < K; k++) s += U[j * K + k] * ua[k];
      b[j] = s;
    }
    return b;
  }

  itemRow(i: number) {
    return Float64Array.from(this.X.subarray(i * this.D, (i + 1) * this.D));
  }

  /** The row a with a·w = t_j. */
  traitRow(j: number) {
    const a = new Float64Array(this.D);
    for (let k = 0; k < this.F; k++) a[k + 1] = this.C[j * this.F + k];
    return a;
  }

  private cached(o: Observation): Cached {
    const id = o.kind === "swipe" ? `s${o.item}` : `p${o.feature}`;
    const hit = this.cache.get(id);
    const logistic = o.kind === "swipe";
    const target = o.kind === "swipe" ? (o.like ? 1 : 0) : o.value;
    const noise = o.kind === "swipe" ? 1 : this.artifact.readout.pinSd ** 2;
    if (hit) return { ...hit, logistic, target, noise };
    const { N, D, F, X, C } = this;
    const a = o.kind === "swipe" ? this.itemRow(o.item) : this.traitRow(o.feature);
    const b = this.covTimes(a);
    const xb = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < D; j++) s += X[i * D + j] * b[j];
      xb[i] = s;
    }
    const cb = new Float64Array(F);
    for (let i = 0; i < F; i++) {
      let s = 0;
      for (let j = 0; j < F; j++) s += C[i * F + j] * b[j + 1];
      cb[i] = s;
    }
    const entry = { logistic, target, noise, a, b, xb, cb };
    this.cache.set(id, entry);
    return entry;
  }

  fit(observations: Observation[]): Posterior {
    const { N, D, F, mu } = this;
    const obs = observations.map((o) => this.cached(o));
    const n = obs.length;

    // K = A Σ0 Aᵀ and the prior mean of each observation.
    const Kmat = new Float64Array(n * n);
    const mf = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < D; j++) s += obs[i].a[j] * mu[j];
      mf[i] = s;
      for (let k = 0; k <= i; k++) {
        let v = 0;
        const ai = obs[i].a;
        const bk = obs[k].b;
        for (let j = 0; j < D; j++) v += ai[j] * bk[j];
        Kmat[i * n + k] = v;
        Kmat[k * n + i] = v;
      }
    }

    const logistic = obs.map((o) => o.logistic);
    const target = obs.map((o) => o.target);
    const noise = obs.map((o) => o.noise);
    let c: Float64Array = new Float64Array(n);
    let g: Float64Array = new Float64Array(n);
    const Kc = (v: Float64Array) => {
      const out = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += Kmat[i * n + k] * v[k];
        out[i] = s;
      }
      return out;
    };
    const objective = (g: Float64Array, c: Float64Array) => {
      let total = 0;
      for (let i = 0; i < n; i++) {
        const f = mf[i] + g[i];
        if (logistic[i]) total += target[i] * f - (Math.max(f, 0) + Math.log1p(Math.exp(-Math.abs(f))));
        else total -= (target[i] - f) ** 2 / (2 * noise[i]);
        total -= 0.5 * c[i] * g[i];
      }
      return total;
    };
    const weights = (g: Float64Array) => {
      const W = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const p = sigmoid(mf[i] + g[i]);
        W[i] = logistic[i] ? Math.max(p * (1 - p), 1e-6) : 1 / noise[i];
      }
      return W;
    };
    const shifted = (W: Float64Array) => {
      const M = Float64Array.from(Kmat);
      for (let i = 0; i < n; i++) M[i * n + i] += 1 / W[i];
      return M;
    };

    let obj = objective(g, c);
    for (let iter = 0; iter < 50 && n > 0; iter++) {
      const W = weights(g);
      const rhs = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const f = mf[i] + g[i];
        if (logistic[i]) rhs[i] = g[i] + (target[i] - sigmoid(f)) / W[i];
        else rhs[i] = target[i] - mf[i];
      }
      const cNew = cholSolve(cholesky(shifted(W), n), n, rhs);
      let step = 1;
      let cTry: Float64Array, gTry: Float64Array, objTry: number;
      for (;;) {
        cTry = c.map((v, i) => v + step * (cNew[i] - v));
        gTry = Kc(cTry);
        objTry = objective(gTry, cTry);
        if (objTry >= obj - 1e-9 || step < 1e-3) break;
        step /= 2;
      }
      let delta = 0;
      for (let i = 0; i < n; i++) delta = Math.max(delta, Math.abs(gTry[i] - g[i]));
      c = cTry;
      g = gTry;
      obj = objTry;
      if (delta < 1e-6) break;
    }
    const G = n ? cholInverse(cholesky(shifted(weights(g)), n), n) : new Float64Array(0);

    const m = Float64Array.from(mu);
    for (let o = 0; o < n; o++) for (let j = 0; j < D; j++) m[j] += obs[o].b[j] * c[o];

    const itemMean = new Float64Array(N);
    const itemVar = Float64Array.from(this.priorItemVar);
    const row = new Float64Array(n);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < D; j++) s += this.X[i * D + j] * m[j];
      itemMean[i] = s;
      for (let o = 0; o < n; o++) row[o] = obs[o].xb[i];
      itemVar[i] = Math.max(itemVar[i] - quad(row, G, n), 1e-9);
    }

    const traitMean = new Float64Array(F);
    const traitSd = new Float64Array(F);
    for (let i = 0; i < F; i++) {
      let s = 0;
      for (let j = 0; j < F; j++) s += this.C[i * F + j] * m[j + 1];
      traitMean[i] = s;
      for (let o = 0; o < n; o++) row[o] = obs[o].cb[i];
      traitSd[i] = Math.sqrt(Math.max(this.priorTraitVar[i] - quad(row, G, n), 1e-12));
    }
    return { m, itemMean, itemVar, traitMean, traitSd, obs, G };
  }

  /**
   * Split item i's predictive variance xᵀSx into per-feature parts x_j (S x)_j.
   * They sum to the variance, so the biggest parts are what the card would teach.
   */
  varianceParts(post: Posterior, i: number) {
    const { D, K } = this;
    const x = this.itemRow(i);
    const ux = this.XU.subarray(i * K, (i + 1) * K);
    const n = post.obs.length;
    const kx = new Float64Array(n);
    for (let o = 0; o < n; o++) kx[o] = post.obs[o].xb[i];
    const gk = new Float64Array(n);
    for (let a = 0; a < n; a++) {
      let s = 0;
      for (let b = 0; b < n; b++) s += post.G[a * n + b] * kx[b];
      gk[a] = s;
    }
    const parts = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      let sx = this.d[j] * x[j];
      for (let k = 0; k < K; k++) sx += this.U[j * K + k] * ux[k];
      for (let o = 0; o < n; o++) sx -= post.obs[o].b[j] * gk[o];
      parts[j] = x[j] * sx;
    }
    return parts;
  }

  /** Split item i's score x·m (relative to the average item) into per-feature parts x_j m_j. */
  scoreParts(post: Posterior, i: number) {
    const parts = new Float64Array(this.D);
    for (let j = 1; j < this.D; j++) parts[j] = this.X[i * this.D + j] * post.m[j];
    return parts;
  }
}

function quad(v: Float64Array, G: Float64Array, n: number) {
  let total = 0;
  for (let a = 0; a < n; a++) {
    let s = 0;
    for (let b = 0; b < n; b++) s += G[a * n + b] * v[b];
    total += v[a] * s;
  }
  return total;
}
