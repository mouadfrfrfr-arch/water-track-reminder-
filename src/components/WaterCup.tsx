"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useId, useRef } from "react";

type Props = {
  /** Current intake in ml */
  intakeMl: number;
  /** Daily goal in ml */
  goalMl: number;
  /** Bumps when a new intake is added — used to trigger the sloshing burst. */
  sloshKey: number;
};

/**
 * A premium claymorphism-styled glass with a live water level, two layered
 * sine-wave surfaces, drifting bubbles and a refraction highlight. When a user
 * adds water (sloshKey changes) we animate the surface side-to-side, briefly
 * exaggerate the wave amplitude, and squish the cup with a spring.
 */
export function WaterCup({ intakeMl, goalMl, sloshKey }: Props) {
  const progress = Math.max(0, Math.min(1, intakeMl / Math.max(1, goalMl)));

  // Motion values driving the water surface
  const slosh = useMotionValue(0); // px translateX of wave path
  const amplitude = useMotionValue(6); // wave amplitude in px
  const fillProgress = useMotionValue(progress);

  // Smoothly animate the fill toward the new progress whenever it changes.
  useEffect(() => {
    const controls = animate(fillProgress, progress, {
      type: "spring",
      stiffness: 80,
      damping: 16,
      mass: 1.2,
    });
    return () => controls.stop();
  }, [progress, fillProgress]);

  // On every "add", slosh the water side-to-side and exaggerate the wave.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const sloshAnim = animate(slosh, [0, 18, -14, 9, -5, 0], {
      duration: 1.4,
      ease: "easeInOut",
    });
    const ampAnim = animate(amplitude, [6, 14, 10, 12, 8, 6], {
      duration: 1.4,
      ease: "easeInOut",
    });
    return () => {
      sloshAnim.stop();
      ampAnim.stop();
    };
  }, [sloshKey, slosh, amplitude]);

  // SVG viewport
  const W = 220;
  const H = 300;
  // Inner water region (matches glass interior)
  const waterTop = 48;
  const waterBottom = 268;
  const waterLeft = 38;
  const waterRight = W - 38;
  const waterHeight = waterBottom - waterTop;

  // Compute water level Y from fillProgress (0 -> bottom, 1 -> top)
  const waterY = useTransform(
    fillProgress,
    (p) => waterBottom - p * waterHeight,
  );

  // Two layered wave paths, slightly offset for parallax.
  const wavePathA = useTransform(
    [waterY, slosh, amplitude] as const,
    ([y, sx, amp]: number[]) => {
      return buildWavePath(
        waterLeft,
        waterRight,
        waterBottom,
        y,
        sx,
        amp,
        0,
      );
    },
  );
  const wavePathB = useTransform(
    [waterY, slosh, amplitude] as const,
    ([y, sx, amp]: number[]) => {
      return buildWavePath(
        waterLeft,
        waterRight,
        waterBottom,
        y + 4,
        -sx * 0.7,
        amp * 0.7,
        Math.PI,
      );
    },
  );

  // Continuous gentle wave breathing (independent from slosh).
  const breathe = useMotionValue(0);
  useEffect(() => {
    const a = animate(breathe, [0, 2 * Math.PI], {
      duration: 5,
      repeat: Infinity,
      ease: "linear",
    });
    return () => a.stop();
  }, [breathe]);
  const wavePhase = useTransform(breathe, (b) => b);
  const wavePathBreathing = useTransform(
    [waterY, slosh, amplitude, wavePhase] as const,
    ([y, sx, amp, phase]: number[]) => {
      return buildWavePath(
        waterLeft,
        waterRight,
        waterBottom,
        y,
        sx,
        amp,
        phase,
      );
    },
  );
  const wavePathBreathingB = useTransform(
    [waterY, slosh, amplitude, wavePhase] as const,
    ([y, sx, amp, phase]: number[]) => {
      return buildWavePath(
        waterLeft,
        waterRight,
        waterBottom,
        y + 4,
        -sx * 0.7,
        amp * 0.7,
        phase + Math.PI,
      );
    },
  );

  // Cup squish in response to sloshKey
  const cupScaleY = useMotionValue(1);
  const cupScaleX = useMotionValue(1);
  useEffect(() => {
    if (sloshKey === 0) return;
    const a = animate(cupScaleY, [1, 0.94, 1.02, 0.98, 1], {
      duration: 0.6,
      ease: "easeOut",
    });
    const b = animate(cupScaleX, [1, 1.04, 0.98, 1.01, 1], {
      duration: 0.6,
      ease: "easeOut",
    });
    return () => {
      a.stop();
      b.stop();
    };
  }, [sloshKey, cupScaleX, cupScaleY]);

  const clipId = useId();
  const glassGradId = useId();
  const waterGradId = useId();
  const highlightGradId = useId();

  // Use the breathing path so the wave is alive even when idle.
  void wavePathA;
  void wavePathB;

  return (
    <motion.div
      style={{ scaleX: cupScaleX, scaleY: cupScaleY }}
      className="relative"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="drop-shadow-[0_30px_40px_rgba(2,132,199,0.35)]"
        aria-label="Animated glass of water"
        role="img"
      >
        <defs>
          {/* Glass body gradient (subtle blue tint) */}
          <linearGradient id={glassGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.7" />
          </linearGradient>
          {/* Water gradient */}
          <linearGradient id={waterGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="55%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </linearGradient>
          {/* Vertical highlight strip on the glass */}
          <linearGradient id={highlightGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          {/* Clip path = inner glass cavity. Water is rendered inside this. */}
          <clipPath id={clipId}>
            <path d={glassInnerPath(W, H)} />
          </clipPath>
        </defs>

        {/* Glass back (the silhouette) */}
        <path
          d={glassOuterPath(W, H)}
          fill={`url(#${glassGradId})`}
          stroke="rgba(12, 74, 110, 0.18)"
          strokeWidth="1.5"
        />

        {/* WATER — clipped to the glass cavity */}
        <g clipPath={`url(#${clipId})`}>
          {/* Back wave (slightly darker, lower) */}
          <motion.path d={wavePathBreathingB} fill={`url(#${waterGradId})`} opacity={0.7} />
          {/* Front wave (main water body) */}
          <motion.path d={wavePathBreathing} fill={`url(#${waterGradId})`} />

          {/* Drifting bubbles inside the water */}
          {BUBBLES.map((b, i) => (
            <Bubble key={i} {...b} waterTopMv={waterY} />
          ))}
        </g>

        {/* Glass inner outline */}
        <path
          d={glassInnerPath(W, H)}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.2"
        />

        {/* Glass highlight strip (refraction) */}
        <rect
          x={waterLeft + 10}
          y={waterTop + 6}
          width={10}
          height={waterHeight - 12}
          rx={5}
          fill={`url(#${highlightGradId})`}
          opacity={0.55}
        />

        {/* Glass rim */}
        <ellipse
          cx={W / 2}
          cy={waterTop}
          rx={(waterRight - waterLeft) / 2 + 3}
          ry={9}
          fill="rgba(255,255,255,0.95)"
          stroke="rgba(12, 74, 110, 0.18)"
          strokeWidth="1.2"
        />
        <ellipse
          cx={W / 2}
          cy={waterTop}
          rx={(waterRight - waterLeft) / 2 - 1}
          ry={6}
          fill="#e0f2fe"
          stroke="rgba(12, 74, 110, 0.12)"
          strokeWidth="0.8"
        />

        {/* Base shadow ellipse below the cup */}
        <ellipse
          cx={W / 2}
          cy={waterBottom + 18}
          rx={70}
          ry={9}
          fill="rgba(12, 74, 110, 0.15)"
        />
      </svg>
    </motion.div>
  );
}

/** Compute outer glass silhouette — slight taper, rounded base. */
function glassOuterPath(W: number, H: number) {
  const topY = 48;
  const bottomY = 268;
  const topInset = 38;
  const bottomInset = 50;
  const left = topInset;
  const right = W - topInset;
  const bLeft = bottomInset;
  const bRight = W - bottomInset;
  const r = 22;
  return [
    `M ${left} ${topY}`,
    `C ${left - 2} ${topY + (bottomY - topY) * 0.4}, ${bLeft - 2} ${bottomY - r * 1.5}, ${bLeft} ${bottomY - r}`,
    `Q ${bLeft} ${bottomY}, ${bLeft + r} ${bottomY}`,
    `L ${bRight - r} ${bottomY}`,
    `Q ${bRight} ${bottomY}, ${bRight} ${bottomY - r}`,
    `C ${bRight + 2} ${bottomY - r * 1.5}, ${right + 2} ${topY + (bottomY - topY) * 0.4}, ${right} ${topY}`,
    `Z`,
  ].join(" ");
  void H;
}

/** Inner clip path — slightly inset so water sits "inside" the glass. */
function glassInnerPath(W: number, H: number) {
  const topY = 50;
  const bottomY = 264;
  const topInset = 42;
  const bottomInset = 54;
  const left = topInset;
  const right = W - topInset;
  const bLeft = bottomInset;
  const bRight = W - bottomInset;
  const r = 18;
  return [
    `M ${left} ${topY}`,
    `C ${left} ${topY + (bottomY - topY) * 0.4}, ${bLeft} ${bottomY - r * 1.5}, ${bLeft} ${bottomY - r}`,
    `Q ${bLeft} ${bottomY}, ${bLeft + r} ${bottomY}`,
    `L ${bRight - r} ${bottomY}`,
    `Q ${bRight} ${bottomY}, ${bRight} ${bottomY - r}`,
    `C ${bRight} ${bottomY - r * 1.5}, ${right} ${topY + (bottomY - topY) * 0.4}, ${right} ${topY}`,
    `Z`,
  ].join(" ");
  void H;
}

/**
 * Build a single sinusoidal water surface path that fills from the surface
 * line down to the bottom of the glass.
 */
function buildWavePath(
  left: number,
  right: number,
  bottom: number,
  surfaceY: number,
  shiftX: number,
  amp: number,
  phase: number,
) {
  const width = right - left;
  const steps = 24;
  const wavelength = width / 1.4;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = left + t * width + shiftX * 0.4;
    const y =
      surfaceY +
      Math.sin((x / wavelength) * Math.PI * 2 + phase) * amp +
      Math.sin((x / wavelength) * Math.PI * 4 + phase * 0.6) * (amp * 0.25);
    points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  points.push(`L ${right + 20} ${bottom + 20}`);
  points.push(`L ${left - 20} ${bottom + 20}`);
  points.push("Z");
  return points.join(" ");
}

type BubbleSpec = { cx: number; r: number; delay: number; duration: number };
const BUBBLES: BubbleSpec[] = [
  { cx: 80, r: 3, delay: 0, duration: 4.5 },
  { cx: 120, r: 2, delay: 1.2, duration: 5.5 },
  { cx: 100, r: 2.5, delay: 2.4, duration: 4.0 },
  { cx: 140, r: 1.6, delay: 3.0, duration: 6.0 },
  { cx: 90, r: 2.2, delay: 0.6, duration: 5.0 },
];

function Bubble({
  cx,
  r,
  delay,
  duration,
  waterTopMv,
}: BubbleSpec & {
  waterTopMv: ReturnType<typeof useMotionValue<number>>;
}) {
  // Bubble travels from waterBottom-10 up to waterTopMv+8.
  const y = useMotionValue(258);
  useEffect(() => {
    let cancelled = false;
    let controls: ReturnType<typeof animate> | null = null;
    const loop = () => {
      if (cancelled) return;
      y.set(258);
      const top = (waterTopMv.get() ?? 100) + 8;
      controls = animate(y, top, {
        duration,
        ease: "easeInOut",
        delay,
        onComplete: loop,
      });
    };
    loop();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [delay, duration, y, waterTopMv]);

  return (
    <motion.circle
      cx={cx}
      cy={y}
      r={r}
      fill="rgba(255,255,255,0.55)"
      stroke="rgba(255,255,255,0.9)"
      strokeWidth={0.5}
    />
  );
}
