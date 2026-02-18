import React, { useEffect, useRef } from 'react';
import { COLORS } from '../constants_test';

export const Confetti: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 50 }).map(() => ({
      x: Math.random() * canvas.width,
      y: -20,
      w: Math.random() * 10 + 5,
      h: Math.random() * 10 + 5,
      dy: Math.random() * 5 + 2,
      dx: (Math.random() - 0.5) * 2,
      color: [COLORS.primary, COLORS.yellow, '#000'][Math.floor(Math.random() * 3)]
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.dy;
        p.x += p.dx;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        if (p.y > canvas.height) p.y = -20;
      });
      requestAnimationFrame(animate);
    };
    
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[100]" />;
};