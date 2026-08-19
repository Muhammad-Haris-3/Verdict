/**
 * The simulation. Everything the page claims is computed here.
 *
 * The experiment simulated is an A/A test: both arms have the IDENTICAL true
 * conversion rate. Every "winner" it reports is therefore false by
 * construction — there is no effect to detect, so nothing has to be assumed
 * about what a real effect would look like.
 */

/** Seeded PRNG (mulberry32). Determinism is a requirement, not a nicety: the
 *  figures quoted in the write-up have to be the figures a visitor sees. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal CDF via Abramowitz & Stegun 7.1.26. Max error ~1.5e-7 — far tighter
 *  than anything that matters at the thresholds used here. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Inverse normal CDF (Acklam). Used only by the sample-size calculator. */
export function normalQuantile(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
             3.754408661907416];
  const pl = 0.02425;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -normalQuantile(1 - p);
  q = p - 0.5;
  r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Two-proportion z-test, pooled variance. Returns a two-sided p-value. */
export function twoProportionP(x1: number, n1: number, x2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 1;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pool = (x1 + x2) / (n1 + n2);
  if (pool <= 0 || pool >= 1) return 1;
  const se = Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  const z = (p1 - p2) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

export type SimParams = {
  experiments: number;
  rate: number;              // true conversion rate, identical in both arms
  visitorsPerDayPerArm: number;
  days: number;
  checkEveryDays: number;    // 1 = daily, 7 = weekly
  seed: number;
  trajectories: number;      // how many p-value paths to keep for the chart
};

export type SimResult = {
  params: SimParams;
  looks: number;
  /** Smallest p-value each experiment ever showed. The whole result set is
   *  derivable from this: the false-positive rate at any threshold t is simply
   *  the share of experiments whose minimum p fell below t. One pass gives the
   *  entire curve, and the corrected threshold is a percentile of it. */
  minP: Float64Array;
  /** p-value paths for the first few experiments, for the trajectory chart. */
  paths: { p: number[]; stoppedAtLook: number | null }[];
  /** Share of experiments that would have been stopped, checking every look. */
  falsePositiveRatePeeking: number;
  /** Share significant when looked at ONCE, at the end. The honest baseline. */
  falsePositiveRateFixedHorizon: number;
  /** Per-look threshold that returns the peeking rate to 5%, measured. */
  correctedThreshold: number;
  /** Rate achieved by that corrected threshold, as a check on the search. */
  correctedRate: number;
};

/** Pocock's nominal per-look significance levels for an overall two-sided 5%,
 *  equally spaced looks. Included so the measured threshold can be checked
 *  against the published answer rather than asserted to be right. */
export const POCOCK: Record<number, number> = {
  1: 0.05, 2: 0.0294, 3: 0.0221, 4: 0.0182, 5: 0.0158,
  6: 0.0145, 8: 0.0126, 10: 0.0106, 12: 0.0097, 15: 0.0086, 20: 0.0075,
};

export function pocockFor(looks: number): number | null {
  if (POCOCK[looks] !== undefined) return POCOCK[looks];
  const keys = Object.keys(POCOCK).map(Number).sort((a, b) => a - b);
  if (looks < keys[0] || looks > keys[keys.length - 1]) return null;
  let lo = keys[0], hi = keys[keys.length - 1];
  for (const k of keys) {
    if (k <= looks) lo = k;
    if (k >= looks) { hi = k; break; }
  }
  if (lo === hi) return POCOCK[lo];
  const f = (looks - lo) / (hi - lo);
  return POCOCK[lo] + f * (POCOCK[hi] - POCOCK[lo]);
}

export function simulate(
  params: SimParams,
  onProgress?: (done: number, total: number) => void
): SimResult {
  const { experiments, rate, visitorsPerDayPerArm, days, checkEveryDays, seed } = params;
  const rand = rng(seed);
  const minP = new Float64Array(experiments);
  const paths: SimResult["paths"] = [];

  const lookDays: number[] = [];
  for (let d = checkEveryDays; d <= days; d += checkEveryDays) lookDays.push(d);
  if (lookDays[lookDays.length - 1] !== days) lookDays.push(days);
  const looks = lookDays.length;

  let stoppedPeeking = 0;
  let significantAtEnd = 0;

  for (let e = 0; e < experiments; e++) {
    let xA = 0, xB = 0, n = 0;
    let best = 1;
    let li = 0;
    const keepPath = e < params.trajectories;
    const path: number[] = [];
    let stoppedAtLook: number | null = null;

    for (let d = 1; d <= days; d++) {
      // one Bernoulli draw per visitor per arm — no normal approximation
      for (let v = 0; v < visitorsPerDayPerArm; v++) {
        if (rand() < rate) xA++;
        if (rand() < rate) xB++;
      }
      n += visitorsPerDayPerArm;

      if (li < looks && lookDays[li] === d) {
        const p = twoProportionP(xA, n, xB, n);
        if (p < best) best = p;
        if (keepPath) {
          path.push(p);
          if (stoppedAtLook === null && p < 0.05) stoppedAtLook = li;
        }
        li++;
      }
    }

    minP[e] = best;
    if (best < 0.05) stoppedPeeking++;
    // the fixed-horizon comparison: the final look only
    const finalP = twoProportionP(xA, n, xB, n);
    if (finalP < 0.05) significantAtEnd++;
    if (keepPath) paths.push({ p: path, stoppedAtLook });

    if (onProgress && e % 200 === 0) onProgress(e, experiments);
  }

  // The corrected threshold is the 5th percentile of the minimum-p
  // distribution: by definition, the level at which only 5% of null
  // experiments would ever have crossed it at any look.
  const sorted = Float64Array.from(minP).sort();
  const idx = Math.max(0, Math.floor(0.05 * experiments) - 1);
  const correctedThreshold = sorted[idx];
  let correctedHits = 0;
  for (let i = 0; i < experiments; i++) if (minP[i] <= correctedThreshold) correctedHits++;

  return {
    params, looks, minP, paths,
    falsePositiveRatePeeking: stoppedPeeking / experiments,
    falsePositiveRateFixedHorizon: significantAtEnd / experiments,
    correctedThreshold,
    correctedRate: correctedHits / experiments,
  };
}

/** Required sample per arm for a two-proportion test. */
export function sampleSizePerArm(
  baseline: number, absoluteLift: number, alpha = 0.05, power = 0.8
): number {
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  const p2 = baseline + absoluteLift;
  const pbar = (baseline + p2) / 2;
  return Math.ceil((2 * Math.pow(za + zb, 2) * pbar * (1 - pbar)) / Math.pow(absoluteLift, 2));
}

/** The smallest effect a given sample can reliably detect — the inverse of
 *  sampleSizePerArm.
 *
 *  Solved by iteration rather than in closed form. The variance term uses the
 *  average of the two arms' rates, which depends on the lift being solved for,
 *  so a single closed-form pass disagrees with sampleSizePerArm by a few
 *  percent — asking for +0.5pp and inverting the answer returned +0.486pp.
 *  Three iterations converge to well under a thousandth of a point, and the
 *  two functions now agree. */
export function detectableLift(
  baseline: number, nPerArm: number, alpha = 0.05, power = 0.8
): number {
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  const k = (2 * Math.pow(za + zb, 2)) / nPerArm;
  let delta = Math.sqrt(k * baseline * (1 - baseline));
  for (let i = 0; i < 3; i++) {
    const pbar = baseline + delta / 2;
    delta = Math.sqrt(k * pbar * (1 - pbar));
  }
  return delta;
}
