import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import MarsScene, { type Phase } from "@/components/MarsScene";

const IS_EXPORT = typeof window !== "undefined" && window.location.pathname.toLowerCase().endsWith("/allslides");

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ children: ReactNode; onError: (m: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e.message || "3D renderer failed to start.");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function MartianMap() {
  const [phase, setPhase] = useState<Phase>(IS_EXPORT ? "tactical" : "shoulder");
  const [reveal, setReveal] = useState(IS_EXPORT ? 1 : 0);
  const [playToken, setPlayToken] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [glError, setGlError] = useState<string | null>(() => (typeof window !== "undefined" && !hasWebGL() ? "WebGL is unavailable in this browser or GPU is disabled." : null));
  const [notice, setNotice] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const play = useCallback(() => {
    setReveal(0);
    setPhase("playing");
    setPlayToken((n) => n + 1);
  }, []);
  const reset = useCallback(() => {
    setPhase("shoulder");
    setReveal(0);
    setResetToken((n) => n + 1);
  }, []);
  const fullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => setNotice("Could not exit fullscreen. Press Esc."));
      return;
    }
    if (!el.requestFullscreen) {
      setNotice("Fullscreen is not supported here. Open the deck in its own tab.");
      return;
    }
    el.requestFullscreen().catch(() => setNotice("Fullscreen was blocked (embedded preview). Open the deck in a new tab."));
  }, []);

  const playRef = useRef(play);
  playRef.current = play;
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    if (IS_EXPORT) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== " " && k !== "h" && k !== "r") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (k === " ") playRef.current();
      else if (k === "h") setHidden((v) => !v);
      else resetRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const legendOn = phase !== "shoulder";

  return (
    <div
      ref={rootRef}
      className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text"
      onClick={stop}
      onPointerDown={stop}
      onTouchEnd={stop}
      onWheel={stop}
    >
      <div className="absolute inset-0">
        {glError ? (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_90%,#5a2414_0%,#0b0e14_65%)]">
            <div className="max-w-[46vw] border border-[#b65a39]/60 bg-[#0b0e14]/85 p-[2.4vw]">
              <div className="font-mono text-[1.5vw] uppercase tracking-[0.12em] text-fast">3D view unavailable</div>
              <div className="mt-[1.6vh] text-[2vw] leading-snug">{glError}</div>
              <div className="mt-[1.6vh] text-[1.5vw] text-muted">Enable hardware acceleration or open in a WebGL-capable browser. No substitute terrain is drawn.</div>
            </div>
          </div>
        ) : (
          <SceneBoundary onError={setGlError}>
            <MarsScene
              phase={phase}
              reveal={reveal}
              playToken={playToken}
              resetToken={resetToken}
              setReveal={setReveal}
              onDone={() => setPhase("tactical")}
              onFail={setGlError}
            />
          </SceneBoundary>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-gradient-to-b from-[#0b0e14]/90 via-[#0b0e14]/45 to-transparent" />

      <div className="pointer-events-none absolute left-[4vw] top-[6vh] max-w-[56vw]">
        <div className="inline-flex items-center gap-[0.8vw] border border-[#b65a39]/70 bg-[#b65a39]/20 px-[1vw] py-[0.6vh] font-mono text-[1.5vw] font-bold tracking-[0.1em] text-[#f1b393]">
          <span className="h-[0.7vw] w-[0.7vw] bg-primary" />
          NASA SPACE APPS 2026 // TEAM E-MARS
        </div>
        <h1 className="mt-[2.4vh] font-display text-[4.2vw] font-bold uppercase leading-[0.98] tracking-tight [text-wrap:balance]">
          Interplanetary Survival Guide: <span className="text-primary">Martian Map</span>
        </h1>
        <p className="mt-[2vh] text-[2vw] leading-snug text-[#d8dee6]">Hyperlocalized EVA Route Optimization &amp; Multi-Layer Hazard Mapping</p>
        <p className="mt-[1.2vh] font-mono text-[1.5vw] text-muted">Schematic concept · illustrative terrain &amp; routes</p>
      </div>

      <div className={`pointer-events-none absolute bottom-[5vh] right-[3vw] w-[37vw] border border-white/15 bg-[#0b0e14]/70 p-[1.6vw] backdrop-blur-md transition-opacity duration-700 ${legendOn ? "opacity-100" : "opacity-0"}`}>
        <div className="font-mono text-[1.5vw] uppercase tracking-[0.12em] text-muted">Route comparison</div>
        <div className="mt-[1.4vh] flex items-start gap-[1vw]">
          <span className="mt-[0.9vh] h-[0.5vh] w-[2.6vw] shrink-0 bg-safe" />
          <div className="text-[1.6vw] leading-snug">
            <span className="font-bold text-safe">SAFEST ROUTE:</span> Low Slope (&lt;12°) • High O₂ &amp; Battery Margin • +14 min
          </div>
        </div>
        <div className="mt-[1.2vh] flex items-start gap-[1vw]">
          <span className="mt-[0.9vh] h-[0.5vh] w-[2.6vw] shrink-0 border-t-[0.5vh] border-dashed border-fast" />
          <div className="text-[1.6vw] leading-snug">
            <span className="font-bold text-fast">FASTEST ROUTE:</span> Direct Vector • High Regolith/Slope Risk • -14 min
          </div>
        </div>
        <div className="mt-[1.4vh] border-t border-white/10 pt-[1vh] text-[1.5vw] leading-snug text-muted">Illustrative concept values — not NASA-measured, certified, or app output.</div>
      </div>

      {!IS_EXPORT && !hidden && (
        <div className="absolute bottom-[5vh] left-[3vw] flex items-center gap-[0.4vw] border border-white/15 bg-[#0b0e14]/75 p-[0.4vw] font-mono text-[1.5vw] backdrop-blur-md">
          <button type="button" onClick={play} className="px-[1vw] py-[0.8vh] text-safe hover:bg-white/10">
            {phase === "shoulder" ? "▶ Play" : "↻ Replay"} <span className="text-muted">[Space]</span>
          </button>
          <button type="button" onClick={reset} className="px-[1vw] py-[0.8vh] hover:bg-white/10">Reset <span className="text-muted">[R]</span></button>
          <button type="button" onClick={fullscreen} className="px-[1vw] py-[0.8vh] hover:bg-white/10">Fullscreen</button>
          <button type="button" onClick={() => setHidden(true)} className="px-[1vw] py-[0.8vh] text-muted hover:bg-white/10">Hide [H]</button>
        </div>
      )}
      {notice && !IS_EXPORT && (
        <div className="absolute left-1/2 top-[3vh] -translate-x-1/2 border border-fast/60 bg-[#0b0e14]/90 px-[1.4vw] py-[1vh] text-[1.5vw] text-fast">{notice}</div>
      )}
    </div>
  );
}
