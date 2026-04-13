import React, { useEffect, useRef } from 'react';
import { COLORS } from '../constants';

export type ConfettiDensity = 'full' | 'lite';

interface Props {
  /** `lite`: fewer particles, gentler motion — use on heavy views (e.g. Generate after DS import). */
  density?: ConfettiDensity;
}

export const Confetti: React.FC<Props> = ({ density = 'full' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const w = Math.min(typeof window !== 'undefined' ? window.innerWidth : 400, 520);
    const h = Math.min(typeof window !== 'undefined' ? window.innerHeight : 700, 900);
    canvas.width = w;
    canvas.height = h;

    const count = density === 'lite' ? 22 : 40;
    const speedMul = density === 'lite' ? 0.85 : 1;

    const particles = Array.from({ length: count }).map(() => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 80,
      w: Math.random() * 8 + 4,
      h: Math.random() * 8 + 4,
      dy: (Math.random() * 4 + 1.5) * speedMul,
      dx: (Math.random() - 0.5) * 1.8 * speedMul,
      color: [COLORS.primary, COLORS.yellow, '#000'][Math.floor(Math.random() * 3)],
    }));

    let rafId = 0;
    let cancelled = false;

    const animate = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.dy;
        p.x += p.dx;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        if (p.y > canvas.height) p.y = -20 - Math.random() * 40;
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[100]" />;
};
