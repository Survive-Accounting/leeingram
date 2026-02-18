import { useEffect, useRef } from "react";

/**
 * Subtle shooting-star overlay for all pages.
 */
export function NightSkyOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    type Shooter = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number };
    let shooters: Shooter[] = [];
    let nextShooter = 2000 + Math.random() * 4000;

    const spawnShooter = () => {
      shooters.push({
        x: Math.random() * w * 0.8 + w * 0.1,
        y: Math.random() * h * 0.3,
        vx: (Math.random() - 0.3) * 4,
        vy: Math.random() * 2 + 1.5,
        life: 0,
        maxLife: 40 + Math.random() * 30,
        len: 30 + Math.random() * 40,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      nextShooter -= 16;
      if (nextShooter <= 0) {
        spawnShooter();
        nextShooter = 4000 + Math.random() * 8000;
      }

      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        const progress = s.life / s.maxLife;
        const fade = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
        const a = fade * 0.7;

        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len / 4), s.y - s.vy * (s.len / 4));
        grad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 4), s.y - s.vy * (s.len / 4));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (s.life >= s.maxLife) shooters.splice(i, 1);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
