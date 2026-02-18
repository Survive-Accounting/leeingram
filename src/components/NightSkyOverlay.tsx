import { useEffect, useRef } from "react";

/**
 * Subtle animated night-sky overlay:
 * – Slow day→night→day color cycle
 * – Twinkling stars that fade in at "night"
 * – Occasional shooting stars
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
      initStars();
    };
    window.addEventListener("resize", handleResize);

    // Stars
    type Star = { x: number; y: number; r: number; phase: number; speed: number };
    let stars: Star[] = [];

    const initStars = () => {
      const count = Math.floor((w * h) / 6000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.7, // mostly upper sky
        r: Math.random() * 1.4 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.8 + 0.3,
      }));
    };
    initStars();

    // Shooting stars
    type Shooter = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number };
    let shooters: Shooter[] = [];
    let nextShooter = 3000 + Math.random() * 5000;

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

    // Cycle: 60s total, smooth sine between day/night
    const cycleDuration = 60000; // ms

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);

      // Night intensity: 0 = full day, 1 = full night
      const cycle = (time % cycleDuration) / cycleDuration;
      const nightIntensity = (Math.sin(cycle * Math.PI * 2 - Math.PI / 2) + 1) / 2;

      // Overlay tint: dark blue at night, transparent at day
      const alpha = nightIntensity * 0.45;
      ctx.fillStyle = `rgba(8, 10, 30, ${alpha})`;
      ctx.fillRect(0, 0, w, h);

      // Subtle colour wash (psychedelic touch)
      const hue = (time / 200) % 360;
      ctx.fillStyle = `hsla(${hue}, 60%, 50%, ${nightIntensity * 0.03})`;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (const s of stars) {
        const twinkle = Math.sin(time * 0.001 * s.speed + s.phase) * 0.5 + 0.5;
        const starAlpha = nightIntensity * twinkle * 0.8;
        if (starAlpha < 0.02) continue;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
        ctx.fill();
      }

      // Shooting stars
      nextShooter -= 16;
      if (nextShooter <= 0 && nightIntensity > 0.3) {
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
        const a = fade * nightIntensity * 0.7;

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
