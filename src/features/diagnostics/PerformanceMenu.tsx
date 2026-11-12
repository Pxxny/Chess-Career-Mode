import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Modal, Tabs } from "@/components/ui";
import { engineManager } from "@/game/engine/manager";
import {
  METRIC_LABELS,
  PERF_SESSION_KEY,
  performanceRecorder,
} from "@/diagnostics/performance";

interface Runtime {
  fps: number | null;
  lagMs: number | null;
  longTasks: boolean;
  visible: boolean;
}
const initialRuntime: Runtime = {
  fps: null,
  lagMs: null,
  longTasks:
    typeof PerformanceObserver !== "undefined" &&
    !!PerformanceObserver.supportedEntryTypes?.includes("longtask"),
  visible: typeof document === "undefined" || !document.hidden,
};
const ms = (value: number) => `${value.toFixed(1)} ms`;
export function PerformanceMenu() {
  const location = useLocation(),
    navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(() =>
    performanceRecorder.isEnabled(),
  );
  const [open, setOpen] = useState(() => performanceRecorder.isEnabled());
  const [recording, setRecording] = useState(() =>
    performanceRecorder.isEnabled(),
  );
  const [tab, setTab] = useState<"overview" | "timings" | "recent">("overview");
  const [snapshot, setSnapshot] = useState(() =>
    performanceRecorder.snapshot(),
  );
  const [runtime, setRuntime] = useState<Runtime>(initialRuntime);
  const engine = useSyncExternalStore(
    engineManager.subscribe,
    engineManager.getInfo,
  );
  const enable = () => {
    try {
      sessionStorage.setItem(PERF_SESSION_KEY, "1");
    } catch {
      /* optional */
    }
    performanceRecorder.setEnabled(true);
    setRecording(true);
    setUnlocked(true);
    setOpen(true);
  };
  useEffect(() => {
    if (new URLSearchParams(location.search).get("perf") === "1") enable();
  }, [location.search]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
        e.preventDefault();
        enable();
      }
    };
    window.addEventListener("keydown", key);
    let taps = 0,
      firstTap = 0;
    const tap = (e: MouseEvent) => {
      if (
        !(e.target instanceof Element) ||
        !e.target.closest("[data-performance-trigger]")
      )
        return;
      const now = performance.now();
      if (now - firstTap > 4000) {
        taps = 0;
        firstTap = now;
      }
      if (++taps >= 7) {
        taps = 0;
        firstTap = 0;
        enable();
      }
    };
    document.addEventListener("click", tap);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("click", tap);
    };
  }, []);
  useEffect(() => {
    if (!unlocked || !recording) {
      setRuntime(initialRuntime);
      return;
    }
    let frame = 0,
      count = 0,
      from = performance.now(),
      expected = from + 1000;
    let measured: Runtime = { ...initialRuntime, visible: !document.hidden };
    const raf = (now: number) => {
      if (!document.hidden) {
        count++;
        if (now - from >= 1000) {
          measured.fps = (count * 1000) / (now - from);
          count = 0;
          from = now;
        }
      }
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    const visibility = () => {
      count = 0;
      from = performance.now();
      expected = from + 1000;
      measured = {
        ...measured,
        fps: null,
        lagMs: null,
        visible: !document.hidden,
      };
    };
    document.addEventListener("visibilitychange", visibility);
    let observer: PerformanceObserver | undefined;
    if (
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("longtask")
    ) {
      measured.longTasks = true;
      observer = new PerformanceObserver((list) => {
        if (!document.hidden)
          for (const e of list.getEntries())
            performanceRecorder.record("ui.long-task", e.duration);
      });
      observer.observe({ entryTypes: ["longtask"] });
    }
    const timer = setInterval(() => {
      const now = performance.now();
      measured.lagMs = document.hidden ? null : Math.max(0, now - expected);
      expected = now + 1000;
      setRuntime({ ...measured });
    }, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [unlocked, recording]);
  useEffect(() => {
    if (!open) return;
    setSnapshot(performanceRecorder.snapshot());
    const timer = setInterval(
      () => setSnapshot(performanceRecorder.snapshot()),
      500,
    );
    return () => clearInterval(timer);
  }, [open]);
  const disable = () => {
    performanceRecorder.setEnabled(false);
    performanceRecorder.clear();
    try {
      sessionStorage.removeItem(PERF_SESSION_KEY);
    } catch {
      /* optional */
    }
    const params = new URLSearchParams(location.search);
    params.delete("perf");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
        hash: location.hash,
      },
      { replace: true },
    );
    setOpen(false);
    setUnlocked(false);
    setRecording(false);
  };
  const refresh = () => setSnapshot(performanceRecorder.snapshot());
  const memory = (
    performance as Performance & { memory?: { usedJSHeapSize: number } }
  ).memory;
  const exportReport = () => {
    const report = {
      format: "chess-career-performance",
      version: 1,
      exportedAt: new Date().toISOString(),
      ...performanceRecorder.snapshot(),
      runtime,
      engine: { status: engine.status, label: engine.label },
      heapUsedMB: memory ? memory.usedJSHeapSize / 1048576 : null,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chess-Career-Mode-Performance-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!unlocked) return null;
  return (
    <>
      {!open && (
        <button
          className="fixed bottom-24 right-3 z-[60] rounded-lg border border-gold-400/50 bg-navy-900 px-3 py-2 text-xs text-gold-300 shadow-xl"
          onClick={() => setOpen(true)}
          aria-label="Open performance menu"
        >
          Diagnostics
        </button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Performance diagnostics"
        size="game"
      >
        <div data-testid="performance-menu" className="space-y-4">
          <p className="text-xs text-ink-muted">
            Measurements come from actual activity in this tab. Close this panel
            and play to collect data. Reloading starts a new report.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                performanceRecorder.setEnabled(!recording);
                setRecording(!recording);
                refresh();
              }}
            >
              {recording ? "Pause measurements" : "Resume measurements"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                performanceRecorder.clear();
                refresh();
              }}
            >
              Clear measurements
            </Button>
            <Button onClick={exportReport}>Download performance report</Button>
            <Button variant="secondary" onClick={disable}>
              Hide diagnostics
            </Button>
          </div>
          <p className="text-xs text-gold-300">
            {recording ? "Recording measurements" : "Measurements paused"}
          </p>
          <Tabs
            label="Performance sections"
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "timings", label: "Timings" },
              { id: "recent", label: "Recent samples" },
            ]}
            active={tab}
            onChange={setTab}
          >
            {tab === "overview" && (
              <>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt>FPS</dt>
                    <dd className="text-xl font-bold">
                      {runtime.fps === null ? "—" : runtime.fps.toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt>Event loop lag</dt>
                    <dd className="text-xl font-bold">
                      {runtime.lagMs === null ? "—" : ms(runtime.lagMs)}
                    </dd>
                  </div>
                  <div>
                    <dt>Engine</dt>
                    <dd translate="no">{engine.label}</dd>
                  </div>
                  <div>
                    <dt>Engine status</dt>
                    <dd translate="no">{engine.status}</dd>
                  </div>
                  <div>
                    <dt>JavaScript heap</dt>
                    <dd>
                      {memory
                        ? `${(memory.usedJSHeapSize / 1048576).toFixed(1)} MB`
                        : "Not supported"}
                    </dd>
                  </div>
                  <div>
                    <dt>Page visibility</dt>
                    <dd>{runtime.visible ? "Visible" : "Background"}</dd>
                  </div>
                  <div>
                    <dt>Long task observer</dt>
                    <dd>{runtime.longTasks ? "Supported" : "Not supported"}</dd>
                  </div>
                  <div>
                    <dt>Metric groups</dt>
                    <dd>{snapshot.metrics.length}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-ink-muted">
                  FPS and lag are sampled while this tab is visible. Engine
                  searches include gameplay and analysis. Instant skips pacing
                  waits but still waits for engine searches.
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  P95 uses the latest 100 samples per metric. Recent samples
                  keep the latest 200 entries. Timings overlap; do not add them
                  together.
                </p>
              </>
            )}
            {tab === "timings" &&
              (snapshot.metrics.length ? (
                <div>
                  <p className="mb-2 text-xs text-ink-muted">
                    Scroll the table sideways to see all columns.
                  </p>
                  <div
                    className="overflow-x-auto"
                    data-testid="performance-timing-scroll"
                  >
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead>
                        <tr>
                          {[
                            "Activity",
                            "Count",
                            "Last",
                            "Average",
                            "P95",
                            "Maximum",
                          ].map((h) => (
                            <th key={h} className="p-2">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.metrics.map((m) => (
                          <tr
                            key={m.id}
                            data-metric={m.id}
                            className="border-t border-white/10"
                          >
                            <td className="min-w-[200px] p-2">
                              {METRIC_LABELS[m.id]}
                              {m.id === "calendar.advance" &&
                                m.last.tags.days !== undefined &&
                                m.last.ms > 0 && (
                                  <p>
                                    {(
                                      (m.last.tags.days * 1000) /
                                      m.last.ms
                                    ).toFixed(2)}{" "}
                                    days/s
                                  </p>
                                )}
                            </td>
                            <td className="p-2">{m.count}</td>
                            <td className="whitespace-nowrap p-2">
                              {ms(m.last.ms)}
                            </td>
                            <td className="whitespace-nowrap p-2">
                              {ms(m.meanMs)}
                            </td>
                            <td className="whitespace-nowrap p-2">
                              {ms(m.p95Ms)}
                            </td>
                            <td className="whitespace-nowrap p-2">
                              {ms(m.maxMs)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p>
                  No measurements yet. Use the game, then reopen this panel.
                </p>
              ))}
            {tab === "recent" &&
              (snapshot.recent.length ? (
                <ul className="space-y-2">
                  {snapshot.recent
                    .slice(-30)
                    .reverse()
                    .map((e, i) => (
                      <li
                        key={`${e.atMs}-${i}`}
                        className="rounded-lg bg-navy-900 p-3 text-xs"
                      >
                        <p>
                          {METRIC_LABELS[e.id]} · {ms(e.ms)}
                        </p>
                        <p
                          className="mt-1 break-words text-ink-muted"
                          translate="no"
                        >
                          {JSON.stringify(e.tags)}
                        </p>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>
                  No measurements yet. Use the game, then reopen this panel.
                </p>
              ))}
          </Tabs>
        </div>
      </Modal>
    </>
  );
}
