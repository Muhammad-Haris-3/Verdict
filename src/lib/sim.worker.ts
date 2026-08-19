/// <reference lib="webworker" />
import { simulate, type SimParams } from "./sim";

// The simulation runs here so a four-week daily-check run over thousands of
// experiments cannot freeze the page while it computes.
self.onmessage = (e: MessageEvent<SimParams>) => {
  const res = simulate(e.data, (done, total) => {
    (self as unknown as Worker).postMessage({ type: "progress", done, total });
  });
  (self as unknown as Worker).postMessage({
    type: "done",
    // echo the params actually used: the sliders may have moved since this run
    // started, and labelling a result with settings that did not produce it is
    // exactly the kind of quiet mislabelling this page is about.
    params: res.params,
    looks: res.looks,
    peeking: res.falsePositiveRatePeeking,
    fixed: res.falsePositiveRateFixedHorizon,
    corrected: res.correctedThreshold,
    correctedRate: res.correctedRate,
    paths: res.paths,
  });
};
