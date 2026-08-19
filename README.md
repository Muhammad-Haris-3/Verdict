# Verdict

**Checking an A/B test while it runs turns a 5% error rate into 29%.**

A single page that measures the cost of peeking at an experiment before it
finishes, and derives the correction rather than quoting it.

**This is a short piece, not a platform.** No dataset, no accounts, no API, no
database — none of them would do anything. Every figure is simulated in the
visitor's browser from a fixed seed.

---

## What it found

Simulating **A/A tests** — both arms with the identical true conversion rate, so
every "winner" is false by construction:

| How you read it | Looks | False positives |
|---|---|---|
| Once, at the end | 1 | **4.9%** |
| Every 14 days | 2 | 8.4% |
| Every 7 days | 4 | 12.9% |
| Every 4 days | 7 | 17.2% |
| Every 2 days | 14 | 23.2% |
| **Every day** | **28** | **28.6%** |

The 5% you were promised only holds for a single look at a sample size fixed in
advance. Checking daily for four weeks, **more than one in four "wins" is
nothing at all.**

### The correction was measured, not looked up

If you insist on looking often, the threshold has to get stricter. The page finds
that level empirically — the point at which only 5% of null experiments would
*ever* have crossed, at any look — and then compares it to the published answer:

| Looks | Measured here | Pocock, published |
|---|---|---|
| 4 | **0.0183** | 0.0182 |
| 7 | 0.0121 | 0.0135 |
| 14 | 0.0085 | 0.0090 |

Close, and wandering either side. The measured value is a 5th percentile
estimated from 4,000 experiments, so roughly 200 of them determine it — it
carries real sampling error. A *large* gap would mean something is wrong; a small
one is what correctness looks like.

---

## How it works

One pass records the **smallest p-value each experiment ever showed**. Everything
else falls out of that: the false-positive rate at any threshold is the share of
experiments whose minimum fell below it, and the corrected threshold is a
percentile of the same distribution. No search, no repeated simulation.

- Visitors are drawn one at a time as actual Bernoulli trials — no normal
  approximation.
- Two-proportion z-test with pooled variance at each look.
- Seeded PRNG, so the figures quoted here are the figures a visitor sees.
- Runs in a Web Worker; a 4,000-experiment daily-check run does not freeze
  the page.

Verified against three things with known answers: a single look returns ~5%
across seeds, the rate rises monotonically with the number of looks, and the
measured correction tracks Pocock.

---

## What it does not show

- **That every early stop is wrong.** A large real effect can be found honestly
  at an early look. The problem is you cannot tell which case you are in from the
  p-value alone — which is what the guarantee was for.
- **That this replaces an experimentation platform.** GrowthBook, Statsig and
  Optimizely solve the whole problem, including always-valid intervals that hold
  for unlimited looks. This explains one part of it.
- **Anything about real company data.** There is none. Simulation is the honest
  way to demonstrate a claim about method rather than about one company — and it
  is also the only way, since firms do not publish their experiments.

---

## Run it

```bash
npm install
npm run dev
```

Next.js, TypeScript, one page, no dependencies beyond the framework. No backend,
by design — see [`SPEC.md`](SPEC.md) §9 for why adding one would have been
padding.
