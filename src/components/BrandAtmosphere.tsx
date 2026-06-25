import { cn } from "@/lib/cn";

/**
 * BrandAtmosphere — layered cool-palette scene used as the backdrop for
 * brand moments (login, onboarding, success).
 *
 * Variants tune intensity (`full` / `halo` / `panel`). When `animated` is set,
 * a slow aurora-drift layer is added and a subset of stars softly twinkle.
 * All motion is GPU-composited and auto-suppressed by prefers-reduced-motion.
 */
type Variant = "full" | "halo" | "panel";

export default function BrandAtmosphere({
  variant = "full",
  showStars = true,
  showDots = false,
  animated = false,
  className,
}: {
  variant?: Variant;
  showStars?: boolean;
  showDots?: boolean;
  animated?: boolean;
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
      {variant === "full" && (
        <FullAtmosphere showStars={showStars} showDots={showDots} animated={animated} />
      )}
      {variant === "halo" && <HaloAtmosphere />}
      {variant === "panel" && <PanelAtmosphere />}
    </div>
  );
}

function FullAtmosphere({
  showStars,
  showDots,
  animated,
}: {
  showStars: boolean;
  showDots: boolean;
  animated: boolean;
}) {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_15%_-10%,rgba(193,232,251,0.22),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(110%_85%_at_50%_115%,rgba(193,232,251,0.55),rgba(132,158,171,0.15)_42%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_80%_90%,rgba(84,100,108,0.35),transparent_60%)]" />
      {animated && <AuroraDrift />}
      {showDots && <DotMatrix />}
      {showStars && <Stars twinkle={animated} />}
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

function AuroraDrift() {
  return (
    <>
      <div
        className="aurora-layer-a absolute -inset-[15%]"
        style={{
          background:
            "radial-gradient(closest-side at 30% 40%, rgba(193,232,251,0.35), transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="aurora-layer-b absolute -inset-[20%]"
        style={{
          background:
            "radial-gradient(closest-side at 70% 70%, rgba(159,191,207,0.30), transparent 70%)",
          filter: "blur(50px)",
        }}
      />
    </>
  );
}

function Stars({ twinkle = false }: { twinkle?: boolean }) {
  const stars: Array<[string, string, number, number, boolean]> = [
    ["6%", "12%", 1, 0.7, false],
    ["10%", "78%", 1, 0.45, true],
    ["14%", "45%", 1, 0.55, false],
    ["18%", "92%", 2, 0.55, true],
    ["22%", "8%", 1, 0.35, false],
    ["26%", "62%", 1, 0.5, true],
    ["31%", "30%", 1, 0.4, false],
    ["35%", "88%", 1, 0.3, false],
    ["42%", "5%", 2, 0.5, true],
    ["48%", "55%", 1, 0.35, false],
    ["54%", "94%", 1, 0.45, true],
    ["60%", "20%", 1, 0.3, false],
    ["66%", "72%", 1, 0.4, false],
    ["72%", "8%", 1, 0.35, false],
    ["80%", "42%", 1, 0.3, false],
    ["88%", "85%", 2, 0.45, true],
    ["92%", "18%", 1, 0.4, false],
  ];
  return (
    <div className="absolute inset-0">
      {stars.map(([top, left, size, opacity, twinkles], i) => {
        const willTwinkle = twinkle && twinkles;
        return (
          <span
            key={i}
            className={cn("absolute rounded-full bg-white", willTwinkle && "star-twinkle")}
            style={{
              top,
              left,
              width: `${size}px`,
              height: `${size}px`,
              opacity: willTwinkle ? undefined : opacity,
              ...(willTwinkle
                ? {
                    ["--twinkle-min" as string]: String(Math.max(0.15, opacity - 0.2)),
                    ["--twinkle-max" as string]: String(Math.min(0.85, opacity + 0.15)),
                    animationDelay: `${(i * 0.37) % 4}s`,
                  }
                : {}),
            }}
          />
        );
      })}
    </div>
  );
}

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
