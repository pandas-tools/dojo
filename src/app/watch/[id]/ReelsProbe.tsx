"use client";

import { useEffect, useState } from "react";

// TEMPORARY diagnostic overlay for the mobile-Safari reels reload bug.
// Activated only when the URL contains `reeldebug`. Read-only: it samples the
// scroll container, which section is visually centered, which section is
// `active` (data-active), and the viewport height over ~8s, renders a live
// overlay, and POSTs the full timeline to /api/_rt so the trace can be read
// back server-side from a real iPhone without a Mac / Web Inspector.
// REMOVE together with /api/_rt and the data-active attribute after diagnosis.
export default function ReelsProbe() {
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

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
      if (c) {
        const cy = c.clientHeight / 2;
        secs.forEach((s, i) => {
          const r = s.getBoundingClientRect();
          if (r.top <= cy && r.bottom >= cy) centerIdx = i;
          if (s.dataset.active === "1") activeIdx = i;
        });
      }
      const row = {
        t: Math.round(performance.now()),
        label,
        st: c ? Math.round(c.scrollTop) : -1,
        ch: c ? c.clientHeight : -1,
        winH: window.innerHeight,
        vvH: vv ? Math.round(vv.height) : -1,
        centerIdx,
        activeIdx,
        nSec: secs.length,
        url: location.pathname.split("/").pop()?.slice(0, 8),
      };
      trace.push(row);
      return row;
    };

    const post = (partial: boolean) =>
      fetch("/api/_rt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ ua: navigator.userAgent, partial, trace: [...trace] }),
      }).catch(() => {});

    let n = 0;
    const id = window.setInterval(() => {
      const row = sample("s" + n);
      setLines((prev) => [
        ...prev.slice(-30),
        `${row.t}ms st=${row.st} vv=${row.vvH} win=${row.winH} center=${row.centerIdx} active=${row.activeIdx}`,
      ]);
      n++;
      if (n >= 45) {
        window.clearInterval(id);
        void post(false);
      }
    }, 200);
    const early = window.setTimeout(() => void post(true), 3500);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(early);
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
        background: "rgba(0,0,0,0.82)",
        color: "#3f6",
        font: "9px/1.25 monospace",
        padding: "4px 6px",
        maxHeight: "46vh",
        maxWidth: "100vw",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {`initialURL lesson idx & scroll timeline (st=scrollTop, center=visible section, active=data-active):\n`}
      {lines.join("\n")}
    </div>
  );
}
