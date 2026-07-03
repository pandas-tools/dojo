"use client";

import { useEffect, useState } from "react";

// TEMPORARY diagnostic overlay for the reels reload bug (desktop lg: + mobile).
// Activated only when the URL contains `reeldebug`. Read-only. Samples scroll +
// which section is visually centered + which is `active` (data-active) + its
// title, renders BOTH the sample timeline and the internal cause events
// (window.__rt: mount/pin/obs/release/sentinel/activeIndex), and POSTs the lot
// to /api/rtrace (now public) so a real-device FAILURE trace is readable
// server-side. REMOVE together with /api/rtrace + dbg() + data-active.
export default function ReelsProbe() {
  const [on, setOn] = useState(false);
  const [samples, setSamples] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!window.location.search.includes("reeldebug")) return;
    setOn(true);
    const c = document.querySelector(".overflow-y-scroll") as HTMLElement | null;
    const trace: Record<string, unknown>[] = [];

    const sample = (label: string) => {
      const vv = window.visualViewport;
      const secs = c ? [...c.querySelectorAll<HTMLElement>("[data-lesson-id]")] : [];
      let centerIdx = -1;
      let activeIdx = -1;
      let visTitle = "";
      if (c) {
        const cy = c.clientHeight / 2;
        secs.forEach((s, i) => {
          const r = s.getBoundingClientRect();
          if (r.top <= cy && r.bottom >= cy) {
            centerIdx = i;
            visTitle = (s.querySelector("p")?.textContent || "").slice(0, 20);
          }
          if (s.dataset.active === "1") activeIdx = i;
        });
      }
      const row = {
        t: Math.round(performance.now()),
        label,
        st: c ? Math.round(c.scrollTop) : -1,
        winH: window.innerWidth,
        vvH: vv ? Math.round(vv.height) : -1,
        centerIdx,
        activeIdx,
        visTitle,
      };
      trace.push(row);
      return row;
    };

    const rtEvents = () =>
      (window as unknown as { __rt?: Record<string, unknown>[] }).__rt ?? [];

    const post = (partial: boolean) =>
      fetch("/api/rtrace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          ua: navigator.userAgent,
          w: window.innerWidth,
          partial,
          trace: [...trace],
          events: rtEvents(),
        }),
      }).catch(() => {});

    let n = 0;
    const id = window.setInterval(() => {
      const row = sample("s" + n);
      setSamples((prev) => [
        ...prev.slice(-33),
        `${row.t} st=${row.st} w=${row.winH} c=${row.centerIdx} a=${row.activeIdx} ${row.visTitle}`,
      ]);
      setEvents(rtEvents().map((e) => JSON.stringify(e)));
      n++;
      if (n >= 50) {
        window.clearInterval(id);
        void post(false);
      }
    }, 150);
    // POST early + whenever the tab is hidden, so a trace survives even if the
    // user navigates away before the run completes.
    const early = window.setTimeout(() => void post(true), 3000);
    const onHide = () => void post(true);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(early);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  if (!on) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.85)",
        color: "#4f8",
        font: "9px/1.25 monospace",
        padding: "4px 6px",
        maxHeight: "60vh",
        maxWidth: "100vw",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {"EVENTS (cause):\n" + events.join("\n") + "\n\nSAMPLES st=scroll c=centerSection a=activeSection:\n" + samples.join("\n")}
    </div>
  );
}
