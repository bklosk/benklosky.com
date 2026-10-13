"""The taste model: hierarchical Bayesian logistic regression on item features.

A user's weights w (one per feature, plus a bias in slot 0) have a population
prior N(mu, U U^T + diag(d)), learned by EM from training users. Each swipe
is a logistic observation of x_i . w. A profile edit is a Gaussian observation
of a linear function of w (a trait, below). Inference is a Laplace
approximation done in observation space, so its cost grows with the number of
observations, not the number of features:

    B = Sigma0 A^T          (D x n)
    K = A Sigma0 A^T        (n x n)
    posterior mean  m = mu + B c
    posterior cov   S = Sigma0 - B G B^T,   G = (K + W^-1)^-1

The browser runs the same algorithm (src/app/taste/model.ts); keep the two in
step.

Traits. C is the catalog correlation matrix of the standardized features. The
trait for feature j is t_j = (C w)_j: the slope of the model's own score
against feature j across the catalog, in logits per standard deviation. It is
linear in w, so its posterior mean and variance are exact under the Laplace
posterior, and the profile can say only what the model actually predicts.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

LAMBDA = np.sqrt(np.pi / 8)  # logistic ~ probit(LAMBDA * f)
BALD_C = np.sqrt(np.pi * np.log(2) / 2)


def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -40, 40)))


@dataclass
class Prior:
    mu: np.ndarray  # (D,)
    U: np.ndarray  # (D, K)
    d: np.ndarray  # (D,)

    def cov_times(self, A: np.ndarray) -> np.ndarray:
        """Sigma0 @ A for A of shape (D, n)."""
        return self.U @ (self.U.T @ A) + self.d[:, None] * A

    def diag_quad(self, X: np.ndarray) -> np.ndarray:
        """diag(X Sigma0 X^T) for rows of X."""
        return ((X @ self.U) ** 2).sum(1) + (X**2) @ self.d

    def dense(self) -> np.ndarray:
        return self.U @ self.U.T + np.diag(self.d)


@dataclass
class Posterior:
    prior: Prior
    A: np.ndarray  # (n, D) observation rows
    B: np.ndarray  # (D, n) Sigma0 A^T
    c: np.ndarray  # (n,)
    G: np.ndarray  # (n, n)

    @property
    def mean(self) -> np.ndarray:
        return self.prior.mu + self.B @ self.c

    def predict(self, X: np.ndarray, XB: np.ndarray | None = None):
        """Latent mean and variance of x . w for each row of X."""
        mean = X @ self.mean
        var = self.prior.diag_quad(X)
        if len(self.c):
            XB = X @ self.B if XB is None else XB
            var = var - ((XB @ self.G) * XB).sum(1)
        return mean, np.maximum(var, 1e-9)


def observations(n: int) -> dict:
    return {"rows": np.zeros((0, n)), "logistic": np.zeros(0, bool), "target": np.zeros(0), "noise": np.zeros(0)}


def fit(
    prior: Prior,
    A: np.ndarray,
    logistic: np.ndarray,
    target: np.ndarray,
    noise: np.ndarray | None = None,
    iters: int = 50,
    c0: np.ndarray | None = None,
) -> Posterior:
    """Laplace posterior given observations.

    Logistic rows: target is 1 (like) or 0 (dislike).
    Gaussian rows: target is the value of a . w, with variance `noise`.
    """
    n = len(target)
    if n == 0:
        return Posterior(prior, A, np.zeros((len(prior.mu), 0)), np.zeros(0), np.zeros((0, 0)))
    noise = np.ones(n) if noise is None else noise
    B = prior.cov_times(A.T)
    K = A @ B
    K = (K + K.T) / 2
    mf = A @ prior.mu
    c = np.zeros(n) if c0 is None or len(c0) != n else c0.copy()
    g = K @ c

    def objective(g, c):
        f = mf + g
        ll = np.where(logistic, target * f - np.logaddexp(0, f), -((target - f) ** 2) / (2 * noise))
        return ll.sum() - 0.5 * c @ g

    obj = objective(g, c)
    for _ in range(iters):
        f = mf + g
        p = sigmoid(f)
        W = np.where(logistic, np.maximum(p * (1 - p), 1e-6), 1 / noise)
        grad = np.where(logistic, target - p, (target - f) / noise)
        rhs = np.where(logistic, g + grad / W, target - mf)
        c_new = np.linalg.solve(K + np.diag(1 / W), rhs)
        step = 1.0
        while True:
            c_try = c + step * (c_new - c)
            g_try = K @ c_try
            obj_try = objective(g_try, c_try)
            if obj_try >= obj - 1e-9 or step < 1e-3:
                break
            step /= 2
        converged = np.max(np.abs(g_try - g)) < 1e-6
        c, g, obj = c_try, g_try, obj_try
        if converged:
            break
    p = sigmoid(mf + g)
    W = np.where(logistic, np.maximum(p * (1 - p), 1e-6), 1 / noise)
    G = np.linalg.inv(K + np.diag(1 / W))
    return Posterior(prior, A, B, c, (G + G.T) / 2)


def predictive(mean: np.ndarray, var: np.ndarray) -> np.ndarray:
    return sigmoid(mean / np.sqrt(1 + np.pi * var / 8))


def bald(mean: np.ndarray, var: np.ndarray) -> np.ndarray:
    """Mutual information between a swipe and the weights, in bits (Houlsby et al. 2011)."""
    m, v = LAMBDA * mean, LAMBDA**2 * var
    p = sigmoid(mean / np.sqrt(1 + np.pi * var / 8))
    p = np.clip(p, 1e-12, 1 - 1e-12)
    entropy = -(p * np.log2(p) + (1 - p) * np.log2(1 - p))
    expected = BALD_C / np.sqrt(v + BALD_C**2) * np.exp(-(m**2) / (2 * (v + BALD_C**2)))
    return entropy - expected


def traits(post: Posterior, C: np.ndarray, CU: np.ndarray, CCd: np.ndarray):
    """Posterior mean and sd of t = C w[1:] (the bias in slot 0 is excluded).

    CU = C @ U[1:] and CCd = (C * C) @ d[1:] are precomputed per prior.
    """
    mean = C @ post.mean[1:]
    var = (CU**2).sum(1) + CCd
    if len(post.c):
        Q = C @ post.B[1:]
        var = var - ((Q @ post.G) * Q).sum(1)
    return mean, np.sqrt(np.maximum(var, 1e-12))


def trait_rows(C: np.ndarray, j: int) -> np.ndarray:
    """The observation row a with a . w = t_j, for pinning a trait."""
    return np.concatenate([[0.0], C[j]])


def fit_prior(
    X: np.ndarray,
    users: list[tuple[np.ndarray, np.ndarray]],
    rank: int,
    iters: int = 24,
    validate=None,
    log=print,
    relax: float = 2.0,
) -> Prior:
    """EM for the population prior. users: (item indices, 0/1 labels) per user.

    E-step: a Laplace posterior per user. M-step: the moment-matched Gaussian,
    projected onto rank-`rank` plus diagonal (probabilistic PCA on the
    covariance, then the diagonal fixed up to match).

    With a few hundred ratings per user and hundreds of features, plain EM
    crawls, so each covariance step is over-relaxed by `relax` (2x the EM
    step), and the iterate with the best validation score is kept.
    """
    D = X.shape[1]
    base = np.mean(np.concatenate([y for _, y in users]))
    mu = np.zeros(D)
    mu[0] = np.log(base / (1 - base))
    d = np.full(D, 1.0 / D)
    d[0] = 1.0
    prior = Prior(mu, np.zeros((D, rank)), d)
    best = (-np.inf, prior)
    for it in range(iters):
        sum_m = np.zeros(D)
        sum_mm = np.zeros((D, D))
        sum_bgb = np.zeros((D, D))
        cs = []
        for items, y in users:
            A = X[items]
            post = fit(prior, A, np.ones(len(y), bool), y.astype(float))
            m = post.mean
            sum_m += m
            sum_mm += np.outer(m, m)
            sum_bgb += post.B @ post.G @ post.B.T
            cs.append(post.c)
        n = len(users)
        mu = sum_m / n
        cov = prior.dense() - sum_bgb / n + sum_mm / n - np.outer(mu, mu)
        cov = prior.dense() + relax * (cov - prior.dense())
        cov = (cov + cov.T) / 2
        vals, vecs = np.linalg.eigh(cov)
        vals, vecs = vals[::-1], vecs[:, ::-1]
        floor = max(vals[rank:].mean(), 0.0)
        U = vecs[:, :rank] * np.sqrt(np.maximum(vals[:rank] - floor, 0))
        d = np.maximum(np.diag(cov) - (U**2).sum(1), 1e-6)
        prior = Prior(mu, U, d)
        score = validate(prior) if validate else 0.0
        log(f"  EM {it + 1}: top eigenvalues {np.round(vals[:4], 3).tolist()}, mean diag {d[1:].mean():.4f}, val {score:.4f}")
        if validate and score > best[0]:
            best = (score, prior)
    return best[1] if validate else prior
