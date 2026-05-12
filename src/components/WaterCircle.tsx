"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useId, useRef } from "react";

type Props = {
  /** Current intake in ml */
  intakeMl: number;
  /** Daily goal in ml */
  goalMl: number;
  /** Bumps when a new intake is added — triggers the sloshing burst. */
  sloshKey: number;
  /** Circle diameter in px (default 280). */
  size?: number;
};

/**
 * HydraBlue half-fill circle hero: white ring, soft shadow, animated water
 * inside clipped to a circle. Two layered sine-wave surfaces with parallax,
 * drifting bubbles, gentle "breathing" wave, and a real side-to-side slosh
 * when `sloshKey` changes (animated via framer-motion `animate(...)`).
 */
export function WaterCircle({ intakeMl, goalMl, sloshKey, size = 280 }: Props) {
  const progress = Math.max(0, Math.min(1, intakeMl / Math.max(1, goalMl)));

  // Motion values driving the water surface
  const slosh = useMotionValue(0); // horizontal translate of the wave path
  const amplitude = useMotionValue(5); // wave amplitude (px) — exaggerated during slosh
  const fillProgress = useMotionValue(progress);

  // Smoothly animate the fill toward the new progress.
  useEffect(() => {
    const controls = animate(fillProgress, progress, {
      type: "spring",
      stiffness: 70,
      damping: 18,
      mass: 1.3,
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
    const sloshAnim = animate(slosh, [0, 20, -16, 11, -6, 0], {
      duration: 1.5,
      ease: "easeInOut",
    });
    const ampAnim = animate(amplitude, [5, 13, 9, 11, 7, 5], {
      duration: 1.5,
      ease: "easeInOut",
    });
    return () => {
      sloshAnim.stop();
      ampAnim.stop();
    };
  }, [sloshKey, slosh, amplitude]);

  // Continuous gentle wave "breathing"
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

  // Subtle circle-pulse on slosh
  const cupScaleX = useMotionValue(1);
  const cupScaleY = useMotionValue(1);
  useEffect(() => {
    if (sloshKey === 0) return;
    const a = animate(cupScaleY, [1, 0.97, 1.015, 0.99, 1], {
      duration: 0.7,
      ease: "easeOut",
    });
    const b = animate(cupScaleX, [1, 1.02, 0.99, 1.005, 1], {
      duration: 0.7,
      ease: "easeOut",
    });
    return () => {
      a.stop();
      b.stop();
    };
  }, [sloshKey, cupScaleX, cupScaleY]);

  // SVG geometry
  const W = size;
  const H = size;
  const cx = W / 2;
  const cy = H / 2;
  const radius = W / 2 - 2;
  const innerLeft = 0;
  const innerRight = W;
  const innerTop = 0;
  const innerBottom = H;
  const innerHeight = innerBottom - innerTop;

  // Water surface Y from fillProgress (0 -> bottom, 1 -> top)
  const waterY = useTransform(
    fillProgress,
    (p) => innerBottom - p * innerHeight,
  );

  // Two layered sine-wave paths.
  const wavePathA = useTransform(
    [waterY, slosh, amplitude, wavePhase] as const,
    ([y, sx, amp, phase]: number[]) =>
      buildWavePath(innerLeft, innerRight, innerBottom, y, sx, amp, phase, 3),
  );
  const wavePathB = useTransform(
    [waterY, slosh, amplitude, wavePhase] as const,
    ([y, sx, amp, phase]: number[]) =>
      buildWavePath(
        innerLeft,
        innerRight,
        innerBottom,
        y + 4,
        -sx * 0.65,
        amp * 0.7,
        phase + Math.PI,
        2.4,
      ),
  );

  // Stable IDs for SVG defs (must not change between renders)
  const clipId = useId();
  const waterGradId = useId();
  const surfaceGradId = useId();
  const innerShadowId = useId();
  const highlightId = useId();

  return (
    <motion.div
      style={{ scaleX: cupScaleX, scaleY: cupScaleY }}
      className="relative inline-block"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        aria-label="Animated water fill"
        role="img"
      >
        <defs>
          {/* Circular clip — confines water to the inside of the disk */}
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={radius - 8} />
          </clipPath>
          {/* Water gradient — teal at top, deep blue at bottom */}
          <linearGradient id={waterGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="35%" stopColor="#22c4d4" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          {/* Surface highlight — used as B wave fill */}
          <linearGradient id={surfaceGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.7" />
          </linearGradient>

          {/* Top-left highlight on the disk */}
          <radialGradient id={highlightId} cx="0.28" cy="0.28" r="0.6">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Inner shadow on the rim */}
          <radialGradient id={innerShadowId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="85%" stopColor="rgba(15,28,46,0)" />
            <stop offset="100%" stopColor="rgba(15,28,46,0.10)" />
          </radialGradient>
        </defs>

        {/* Disk background (empty area) */}
        <circle cx={cx} cy={cy} r={radius - 8} fill="#eef3f8" />

        {/* Water + bubbles clipped to the inner circle */}
        <g clipPath={`url(#${clipId})`}>
          <motion.path d={wavePathA} fill={`url(#${waterGradId})`} />
          <motion.path d={wavePathB} fill={`url(#${surfaceGradId})`} opacity={0.65} />

          {/* Drifting bubbles — rise from bottom, fade as they near the surface */}
          <Bubble cx={cx - 30} cy={innerBottom} delay={0} />
          <Bubble cx={cx + 20} cy={innerBottom} delay={1.6} />
          <Bubble cx={cx - 60} cy={innerBottom} delay={3.1} r={5} />
          <Bubble cx={cx + 55} cy={innerBottom} delay={2.2} r={4} />

          {/* Refraction highlight bar — only visible above water */}
          <motion.line
            x1={innerLeft + 30}
            x2={innerRight - 30}
            y1={waterY}
            y2={waterY}
            stroke="#ffffff"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ y: 0 }}
          />
        </g>

        {/* Inner shadow + top-left highlight on rim (over water) */}
        <circle
          cx={cx}
          cy={cy}
          r={radius - 8}
          fill={`url(#${highlightId})`}
          pointerEvents="none"
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius - 8}
          fill={`url(#${innerShadowId})`}
          pointerEvents="none"
        />

        {/* White outer rim — multi-layer */}
        <circle
          cx={cx}
          cy={cy}
          r={radius - 2}
          fill="none"
          stroke="#ffffff"
          strokeWidth={14}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius - 8}
          fill="none"
          stroke="rgba(15,28,46,0.06)"
          strokeWidth={1}
        />
      </svg>
    </motion.div>
  );
}

function Bubble({
  cx,
  cy,
  delay,
  r = 6,
}: {
  cx: number;
  cy: number;
  delay: number;
  r?: number;
}) {
  const t = useMotionValue(0);
  useEffect(() => {
    const a = animate(t, [0, 1], {
      duration: 4.2,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    });
    return () => a.stop();
  }, [t, delay]);

  // Rise from cy (bottom of inner circle) up to ~80px above
  const offsetY = useTransform(t, (v) => -v * 110);
  const wobbleX = useTransform(t, (v) => Math.sin(v * Math.PI * 2) * 6);
  const opacity = useTransform(t, [0, 0.1, 0.85, 1], [0, 0.55, 0.45, 0]);

  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={r}
      fill="rgba(255,255,255,0.7)"
      style={{ x: wobbleX, y: offsetY, opacity }}
    />
  );
}

/**
 * Build an SVG path for a sine-wave water surface clamped to [left,right]
 * with the area below filled down to `bottom`. `phase` shifts the wave
 * horizontally for parallax/breathing. `waves` is the number of cycles.
 */
function buildWavePath(
  left: number,
  right: number,
  bottom: number,
  surfaceY: number,
  shiftX: number,
  amplitude: number,
  phase: number,
  waves: number,
): string {
  const steps = 64;
  const width = right - left;
  let d = `M ${left} ${bottom}`;
  d += ` L ${left} ${surfaceY}`;
  for (let i = 0; i <= steps; i++) {
    const x = left + (i / steps) * width;
    const t = (i / steps) * Math.PI * 2 * waves;
    const y =
      surfaceY +
      Math.sin(t + phase + shiftX * 0.08) * amplitude +
      Math.cos(t * 0.5 + phase) * (amplitude * 0.25);
    d += ` L ${x + shiftX * 0.2} ${y}`;
  }
  d += ` L ${right} ${bottom} Z`;
  return d;
}
