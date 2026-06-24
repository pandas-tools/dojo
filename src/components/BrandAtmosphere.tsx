import { cn } from "@/lib/cn";

/**
 * BrandAtmosphere — layered cool-palette scene used as the backdrop for
 * brand moments (login, onboarding, hero zones). Composed of:
 *   - base near-black
 *   - bottom radial brand-glow (arctic-haze bleeds up from the bottom edge)
 *   - top-corner arctic-haze halo
 *   - optional star sprinkle (subtle white dots randomly positioned)
 *   - optional dot-matrix pattern (sparse arctic-haze grid)
 *
 * Compose the page like:
 *   <main className="relative isolate min-h-dvh overflow-hidden bg-near-black">
 *     <BrandAtmosphere />
 *     <div className="relative ...">{content}</div>
 *   </main>
 *
 * Variants tune intensity:
 *   - "full"   — the full premium scene (auth flow)
 *   - "halo"   — a quiet top halo for in-app surfaces (browse)
 *   - "panel"  — strong gradient for a hero/aside panel
 */
type Variant = "full" | "halo" | "panel";

export default function BrandAtmosphere({
  variant = "full",
  showStars = true,
  showDots = false,
  className,
}: {
  variant?: Variant;
  showStars?: boolean;
  showDots?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {variant === "full" && <FullAtmosphere showStars={showStars} showDots={showDots} />}
      {variant === "halo" && <HaloAtmosphere />}
      {variant === "panel" && <PanelAtmosphere />}
    </div>
  );
}

function FullAtmosphere({ showStars, showDots }: { showStars: boolean; showDots: boolean }) {
  return (
    <>
      {/* Top-left arctic-haze halo */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_15%_-10%,rgba(193,232,251,0.22),transparent_55%)]" />
      {/* Bottom brand glow — the Lunaris move: light bleeds up from the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(110%_85%_at_50%_115%,rgba(193,232,251,0.55),rgba(132,158,171,0.15)_42%,transparent_72%)]" />
      {/* Deep brand tint, layered low */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_80%_90%,rgba(84,100,108,0.35),transparent_60%)]" />
      {showDots && <DotMatrix />}
      {showStars && <Stars />}
      {/* Grain */}
      <Grain />
    </>
  );
}

function HaloAtmosphere() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(90%_55%_at_50%_-15%,rgba(193,232,251,0.16),transparent_65%)]" />
      <Grain opacity={0.025} />
    </>
  );
}

function PanelAtmosphere() {
  return (
    <>
      <div className="absolute inset-0 bg-brand-gradient-dark opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_30%_15%,rgba(193,232,251,0.35),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(100%_60%_at_70%_85%,rgba(84,100,108,0.45),transparent_70%)]" />
      <DotMatrix />
      <Grain opacity={0.04} />
    </>
  );
}

/**
 * Star sprinkle — quiet white dots at fixed positions. Hand-placed so they
 * read as constellations, not noise. Mostly small (1px) with a few 2px
 * accents.
 */
function Stars() {
  const stars: Array<[string, string, number, number]> = [
    // [top%, left%, size_px, opacity]
    ["6%", "12%", 1, 0.7],
    ["10%", "78%", 1, 0.45],
    ["14%", "45%", 1, 0.55],
    ["18%", "92%", 2, 0.55],
    ["22%", "8%", 1, 0.35],
    ["26%", "62%", 1, 0.5],
    ["31%", "30%", 1, 0.4],
    ["35%", "88%", 1, 0.3],
    ["42%", "5%", 2, 0.5],
    ["48%", "55%", 1, 0.35],
    ["54%", "94%", 1, 0.45],
    ["60%", "20%", 1, 0.3],
    ["66%", "72%", 1, 0.4],
    ["72%", "8%", 1, 0.35],
    ["80%", "42%", 1, 0.3],
    ["88%", "85%", 2, 0.45],
    ["92%", "18%", 1, 0.4],
  ];
  return (
    <div className="absolute inset-0">
      {stars.map(([top, left, size, opacity], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top,
            left,
            width: `${size}px`,
            height: `${size}px`,
            opacity,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Dot-matrix — sparse arctic-haze dot grid. Reads as quiet structure
 * behind the scene; doesn't compete with content.
 */
function DotMatrix() {
  return (
    <div
      className="absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "radial-gradient(rgba(193,232,251,0.6) 1px, transparent 1.2px)",
        backgroundSize: "26px 26px",
        maskImage:
          "radial-gradient(ellipse 65% 55% at 50% 60%, black, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 65% 55% at 50% 60%, black, transparent 75%)",
      }}
    />
  );
}

/**
 * Inline SVG noise grain — keeps dark surfaces from looking flat-digital.
 * The brand wiki allows noise on near-black surfaces only.
 */
function Grain({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity, mixBlendMode: "overlay" }}
    >
      <filter id="dojo-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#dojo-grain)" />
    </svg>
  );
}
