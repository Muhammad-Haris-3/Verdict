# Verdict — Specification

**Project:** Verdict — why most A/B tests are read wrong
**Author:** Muhammad Haris Khokhar
**Date:** 2026-08-20
**Status:** Not started
**Size:** One page. One week. No backend.

---

## 1. What this is, stated honestly

A single page that demonstrates one thing, by measurement rather than assertion:

> **Checking an A/B test as it runs, and stopping when it looks significant,
> turns a 5% false-positive rate into something several times larger.**

**This is a short piece, not a platform.** It has no dataset, no accounts, no
API and no database, because none of those would do anything. Every number on
the page is computed in the visitor's browser while they watch.

The scope is fixed here so it cannot quietly grow: if a feature needs a server,
it is out.

---

## 2. Why it exists

Nothing else in the portfolio shows experimentation, and "design and analyse A/B
tests" appears on nearly every product-analyst job description. The gap is real.

It is also hard to fill honestly: companies do not publish their experiments, so
there is no public A/B dataset worth analysing. Simulation is the only route,
and simulation projects are small. **That ceiling is accepted rather than
disguised.**

---

## 3. The one question

> **How much does peeking actually cost, and does a corrected stopping rule fix
> it?**

Both halves are measured in the browser. Neither is quoted from a textbook.

---

## 4. What the page contains

| # | Section | Substance |
|---|---|---|
| 1 | The claim | One paragraph, the number, no preamble |
| 2 | **The simulator** | Run N A/A experiments live. Controls for traffic, checking frequency, threshold. Reports the measured false-positive rate |
| 3 | **The trajectories** | A handful of individual experiments drawn as p-value paths over time, with the moment each would have been stopped marked. This is the section that makes it click |
| 4 | The fix | Same simulation, corrected threshold, measured back to ~5% |
| 5 | The calculator | Baseline rate + minimum effect + daily traffic → required sample and runtime, and what the planned duration can actually detect |
| 6 | What this does not show | Limits, in the same voice as the rest |

---

## 5. Method

**The simulation is an A/A test: both arms have the identical true conversion
rate.** Every "winner" it finds is therefore false by construction — there is no
real effect to detect, so no assumption is needed about what a true effect looks
like.

- Visitors arrive in daily batches, allocated 50/50.
- At each check, a two-proportion z-test is computed on the totals so far.
- **Naive rule:** stop and declare a winner the first time p < 0.05.
- **Corrected rule:** the same, at a stricter threshold.

**The corrected threshold is found by simulation, not looked up.** The page
searches for the per-look threshold that returns the overall false-positive rate
to 5% for the chosen number of looks, and reports it. The published corrections
(Pocock, alpha-spending, always-valid p-values) do exactly this analytically;
deriving it by measurement demonstrates the mechanism rather than citing it, and
the two are compared so the result can be checked against the literature.

**Determinism:** a seeded PRNG. The same controls produce the same number for
every visitor, and the figure quoted in the write-up is reproducible rather than
whatever the last run happened to give.

---

## 6. Success criteria

| # | Criterion |
|---|---|
| SC-1 | Naive daily checking measurably exceeds 5%, and the page states the measured figure rather than a remembered one |
| SC-2 | The corrected threshold returns the rate to 5% ± 1 point, and is shown next to the published equivalent |
| SC-3 | A visitor can reach the finding without reading any prose — the simulator and trajectory chart carry it |
| SC-4 | Every figure recomputes from a seed in the browser; nothing is hardcoded |
| SC-5 | The simulation does not block the interface |
| SC-6 | The page never describes itself as a platform, tool or product |

---

## 7. What is deliberately absent

- No backend, database, accounts or saved state — nothing to store.
- No CSV upload. Analysing a visitor's real experiment is a different, larger
  project and pretending otherwise inflates this one.
- No claim to replace GrowthBook, Statsig or Optimizely. They solve the whole
  problem; this explains one part of it.

---

## 8. Risks

| # | Risk | Handling |
|---|---|---|
| R-1 | **It reads as thin.** It is small, and dressing it up would be the failure. | Framed as a short piece everywhere it appears, including the portfolio card |
| R-2 | Simulation freezes the page | Web Worker, chunked, progress reported |
| R-3 | The corrected threshold is subtly wrong | Compared against the published Pocock levels; a visible mismatch is reported, not hidden |
| R-4 | Scope creep into a platform | §7 is the fence. Anything needing a server is out |

---

## 9. Stack

Next.js, static export, Vercel. TypeScript. Simulation in a Web Worker. No
dependencies beyond the framework.

**No FastAPI. No PostgreSQL.** They would store nothing and compute nothing that
the browser cannot, and including them to look substantial is the exact
overstatement this project argues against.
