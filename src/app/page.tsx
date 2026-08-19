"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pocockFor, sampleSizePerArm, detectableLift, type SimParams } from "@/lib/sim";

type Done = {
  type: "done";
  params: SimParams;
  looks: number;
  peeking: number;
  fixed: number;
  corrected: number;
  correctedRate: number;
  paths: { p: number[]; stoppedAtLook: number | null }[];
};

const DEFAULTS: SimParams = {
  experiments: 4000,
  rate: 0.1,
  visitorsPerDayPerArm: 400,
  days: 28,
  checkEveryDays: 1,
  seed: 42,
  trajectories: 8,
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default function Page() {
  const [params, setParams] = useState<SimParams>(DEFAULTS);
  const [res, setRes] = useState<Done | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  const run = useCallback((p: SimParams) => {
    workerRef.current?.terminate();
    const w = new Worker(new URL("../lib/sim.worker.ts", import.meta.url));
    workerRef.current = w;
    setRunning(true);
    setProgress(0);
    w.onmessage = (e: MessageEvent) => {
      if (e.data.type === "progress") setProgress(e.data.done / e.data.total);
      else {
        setRes(e.data as Done);
        setRunning(false);
        w.terminate();
      }
    };
    w.postMessage(p);
  }, []);

  useEffect(() => {
    run(DEFAULTS);
    return () => workerRef.current?.terminate();
  }, [run]);

  const set = (patch: Partial<SimParams>) => setParams((q) => ({ ...q, ...patch }));
  const pocock = res ? pocockFor(res.looks) : null;

  return (
    <>
      <div className="eyebrow">01 — The claim</div>
      <h1>Checking an A/B test while it runs breaks it.</h1>
      <p className="lede">
        Statistics promises you will be fooled 5% of the time. That promise holds only if you
        look <em>once</em>, at a sample size fixed in advance. Look every day and stop when it
        looks good, and the real error rate is several times higher. Below, measured — not quoted.
      </p>

      {res && (
        <div className="panel tight big">
          <div>
            <div className="v good">{pct(res.fixed)}</div>
            <div className="l">looking once, at the end</div>
          </div>
          <div>
            <div className="v bad">{pct(res.peeking)}</div>
            <div className="l">
              {res.params.checkEveryDays === 1
                ? "checking every day, stopping when p < 0.05"
                : `checking every ${res.params.checkEveryDays} days, stopping when p < 0.05`}
            </div>
          </div>
          <div style={{ boxShadow: "none" }}>
            <div className="v acc">{res.looks}</div>
            <div className="l">chances to be fooled</div>
          </div>
        </div>
      )}

      <p className="small" style={{ marginTop: 16 }}>
        Both columns are the <strong>same experiments</strong>, simulated with{" "}
        <strong>no real difference between the two versions</strong>. Every &ldquo;winner&rdquo;
        is false by construction. The only thing that changes is when you are allowed to look.
      </p>

      {/* ---------------------------------------------------------------- */}
      <div className="sechead">
        <span className="n">02</span>
        <h2>Run it yourself</h2>
      </div>

      <div className="panel">
        <div className="ctrl">
          <div>
            <label>Conversion rate (both arms)</label>
            <div className="v">{(params.rate * 100).toFixed(0)}%</div>
            <input type="range" min={2} max={30} step={1} value={params.rate * 100}
                   onChange={(e) => set({ rate: Number(e.target.value) / 100 })} />
          </div>
          <div>
            <label>Visitors per day, per arm</label>
            <div className="v">{params.visitorsPerDayPerArm.toLocaleString()}</div>
            <input type="range" min={50} max={1000} step={50} value={params.visitorsPerDayPerArm}
                   onChange={(e) => set({ visitorsPerDayPerArm: Number(e.target.value) })} />
          </div>
          <div>
            <label>Test length (days)</label>
            <div className="v">{params.days}</div>
            <input type="range" min={7} max={56} step={7} value={params.days}
                   onChange={(e) => set({ days: Number(e.target.value) })} />
          </div>
          <div>
            <label>How often you check</label>
            <div className="v">
              {params.checkEveryDays === 1 ? "every day" : `every ${params.checkEveryDays} days`}
            </div>
            <div className="chips">
              {[1, 2, 4, 7, 14].map((d) => (
                <button key={d} className={params.checkEveryDays === d ? "on" : ""}
                        onClick={() => set({ checkEveryDays: d })}>
                  {d === 1 ? "daily" : `${d}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <button className="run" disabled={running} onClick={() => run(params)}>
            {running ? "simulating…" : `run ${params.experiments.toLocaleString()} experiments`}
          </button>
          {running && (
            <span className="mono" style={{ fontSize: ".8rem", color: "var(--faint)" }}>
              {(progress * 100).toFixed(0)}%
            </span>
          )}
          {!running && res && (
            <span className="small" style={{ margin: 0 }}>
              {res.looks} look{res.looks === 1 ? "" : "s"} →{" "}
              <strong className="mono" style={{ color: "var(--bad-text)" }}>{pct(res.peeking)}</strong> false
              positives, against the <strong className="mono">5%</strong> you were promised.
            </span>
          )}
        </div>
      </div>

      <p className="note">
        Seeded, so the same settings always give the same answer. Checking less often helps but
        does not fix it — the only look that carries the 5% guarantee is a single one, planned in
        advance.
      </p>

      {/* ---------------------------------------------------------------- */}
      <div className="sechead">
        <span className="n">03</span>
        <h2>What it looks like from inside</h2>
      </div>
      <p className="small" style={{ marginBottom: 20 }}>
        Eight of those experiments, drawn individually. Every one has <strong>no real
        difference</strong>. The line is the p-value as the days pass; the band below is
        &ldquo;significant&rdquo;. Watch how many wander into it and back out again.
      </p>
      {res && <Trajectories paths={res.paths} looks={res.looks} />}

      {/* ---------------------------------------------------------------- */}
      <div className="sechead">
        <span className="n">04</span>
        <h2>The fix, and checking it against the textbook</h2>
      </div>
      <p className="small" style={{ marginBottom: 20 }}>
        If you insist on looking often, the threshold has to get stricter. I did not look the
        correction up — the page measures it: the level at which only 5% of these null experiments
        would ever have crossed, at any look. Then compares it to the published answer.
      </p>

      {res && (
        <div className="panel tight big">
          <div>
            <div className="v bad">0.05</div>
            <div className="l">naive threshold → {pct(res.peeking)} wrong</div>
          </div>
          <div>
            <div className="v good">{res.corrected.toFixed(4)}</div>
            <div className="l">measured here → {pct(res.correctedRate)} wrong</div>
          </div>
          <div style={{ boxShadow: "none" }}>
            <div className="v" style={pocock ? undefined : { fontSize: "1rem", lineHeight: 1.4, color: "var(--faint)" }}>
              {pocock ? pocock.toFixed(4) : "not tabulated"}
            </div>
            <div className="l">
              {pocock
                ? `Pocock, published, ${res.looks} looks`
                : `published tables stop near 20 looks — check every 2d or weekly to compare`}
            </div>
          </div>
        </div>
      )}
      {res && (
        <p className="note">
          {pocock === null &&
            "Standard Pocock tables are published up to roughly 20 looks, so at this setting there is nothing to compare against — switch the check frequency above to weekly or every 2 days and the published value appears. "}
          The measured figure lands close to Pocock&rsquo;s, sometimes a little above and sometimes
          a little below. It is a 5th percentile estimated from {res.params.experiments.toLocaleString()}{" "}
          experiments, so only about {Math.round(res.params.experiments * 0.05).toLocaleString()} of them
          determine it — it carries real sampling error, and raising the experiment count tightens it.
          Two further reasons to expect a small gap rather than an exact match: Pocock&rsquo;s levels
          assume continuous, equally spaced looks on a smooth process, while this is discrete, uses a
          z-test on proportions, and may not space its final look evenly. A <em>large</em> gap would
          mean something here is wrong; a small wandering one is what correctness looks like.
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      <div className="sechead">
        <span className="n">05</span>
        <h2>Before you start: how long must it run?</h2>
      </div>
      <Calculator />

      {/* ---------------------------------------------------------------- */}
      <div className="sechead">
        <span className="n">06</span>
        <h2>What this does not show</h2>
      </div>
      <div className="panel">
        <p>
          <strong>That every early stop is wrong.</strong> If a real effect is large, an early
          look can find it honestly. The problem is that you cannot tell which case you are in
          from the p-value alone — that is precisely what the guarantee was for.
        </p>
        <p>
          <strong>That this replaces a real experimentation platform.</strong> GrowthBook, Statsig
          and Optimizely solve the whole problem, properly, including always-valid intervals that
          work for unlimited looks. This explains one part of it.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Anything about your data.</strong> There is no dataset here. It is simulation
          from a seed, which is the honest way to demonstrate a claim about method rather than
          about a particular company.
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Trajectories({ paths, looks }: { paths: Done["paths"]; looks: number }) {
  const W = 880, H = 300, PL = 46, PR = 14, PT = 14, PB = 34;
  // log scale: p-values that matter live near zero, and a linear axis hides them
  const ly = (p: number) => Math.log10(Math.max(p, 1e-4));
  const yTop = 0, yBot = -4;
  const X = (i: number) => PL + (i / Math.max(1, looks - 1)) * (W - PL - PR);
  const Y = (p: number) => PT + ((ly(p) - yTop) / (yBot - yTop)) * (H - PT - PB);

  return (
    <div className="panel scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label="p-value paths for eight null experiments" style={{ display: "block" }}>
        <rect x={PL} y={Y(0.05)} width={W - PL - PR} height={H - PB - Y(0.05)}
              fill="var(--bad)" opacity={0.09} />
        <line x1={PL} x2={W - PR} y1={Y(0.05)} y2={Y(0.05)} stroke="var(--bad)" strokeWidth={1} strokeDasharray="5 4" />
        <text x={W - PR} y={Y(0.05) - 7} textAnchor="end" fontSize={10.5} fill="var(--bad-text)" className="mono">
          p = 0.05 — anything below this looks like a winner
        </text>
        {[1, 0.1, 0.01, 0.001].map((p) => (
          <text key={p} x={PL - 8} y={Y(p) + 4} textAnchor="end" fontSize={10} fill="var(--faint)" className="mono">
            {p}
          </text>
        ))}
        <text x={(W - PL) / 2 + PL} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)"
              className="mono" letterSpacing={1.4}>
          EACH CHECK, IN ORDER
        </text>
        {paths.map((path, i) => {
          const stopped = path.stoppedAtLook !== null;
          return (
            <g key={i}>
              <polyline fill="none" stroke={stopped ? "var(--bad)" : "var(--muted)"}
                        strokeWidth={stopped ? 1.8 : 1.1} opacity={stopped ? 0.95 : 0.5}
                        points={path.p.map((p, j) => `${X(j)},${Y(p)}`).join(" ")} />
              {stopped && (
                <circle cx={X(path.stoppedAtLook!)} cy={Y(path.p[path.stoppedAtLook!])} r={4}
                        fill="var(--bad)" />
              )}
            </g>
          );
        })}
      </svg>
      <p className="note" style={{ marginTop: 14 }}>
        Red paths are the ones that dipped below the line at least once — a team checking that day
        would have declared a winner and shipped. Several climb back out afterwards, which is the
        whole problem: the same experiment says &ldquo;significant&rdquo; on Tuesday and
        &ldquo;nothing here&rdquo; on Friday.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Calculator() {
  const [baseline, setBaseline] = useState(4);
  const [lift, setLift] = useState(0.5);
  const [traffic, setTraffic] = useState(500);
  const [planned, setPlanned] = useState(14);

  const n = useMemo(() => sampleSizePerArm(baseline / 100, lift / 100), [baseline, lift]);
  const daysNeeded = Math.ceil(n / traffic);
  const canDetect = useMemo(
    () => detectableLift(baseline / 100, planned * traffic) * 100,
    [baseline, planned, traffic]
  );
  const enough = daysNeeded <= planned;

  return (
    <>
      <div className="panel">
        <div className="ctrl">
          <div>
            <label>Current conversion rate</label>
            <div className="v">{baseline.toFixed(1)}%</div>
            <input type="range" min={0.5} max={25} step={0.5} value={baseline}
                   onChange={(e) => setBaseline(Number(e.target.value))} />
          </div>
          <div>
            <label>Smallest lift worth caring about</label>
            <div className="v">+{lift.toFixed(1)} pts</div>
            <input type="range" min={0.1} max={5} step={0.1} value={lift}
                   onChange={(e) => setLift(Number(e.target.value))} />
          </div>
          <div>
            <label>Visitors per day, per arm</label>
            <div className="v">{traffic.toLocaleString()}</div>
            <input type="range" min={50} max={5000} step={50} value={traffic}
                   onChange={(e) => setTraffic(Number(e.target.value))} />
          </div>
          <div>
            <label>Days you planned to run</label>
            <div className="v">{planned}</div>
            <input type="range" min={3} max={90} step={1} value={planned}
                   onChange={(e) => setPlanned(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="panel tight big" style={{ marginTop: 8 }}>
        <div>
          <div className="v">{n.toLocaleString()}</div>
          <div className="l">visitors needed per arm</div>
        </div>
        <div>
          <div className={`v ${enough ? "good" : "bad"}`}>{daysNeeded}</div>
          <div className="l">days that actually takes</div>
        </div>
        <div style={{ boxShadow: "none" }}>
          <div className="v acc">+{canDetect.toFixed(2)}</div>
          <div className="l">smallest lift {planned} days can detect</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 8, borderLeft: `3px solid var(--${enough ? "good" : "bad"})` }}>
        {enough ? (
          <p style={{ margin: 0 }}>
            <strong>Your plan works.</strong> {planned} days at {traffic.toLocaleString()} visitors
            per arm per day reaches the sample you need. Decide the end date now, write it down,
            and read the result once.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            <strong>Your plan cannot answer your question.</strong> You want to detect
            +{lift.toFixed(1)} points, which needs {daysNeeded} days — you planned {planned}. In{" "}
            {planned} days the smallest effect you can reliably detect is{" "}
            <strong className="mono">+{canDetect.toFixed(2)} points</strong>. Run it longer, accept
            you are only hunting for larger effects, or do not run it.
          </p>
        )}
      </div>
      <p className="note">
        Two-proportion test, 5% significance, 80% power. This is the conversation worth having
        before the test launches rather than after it disappoints — and the reason so many tests
        end in an argument is that nobody had it.
      </p>
    </>
  );
}
