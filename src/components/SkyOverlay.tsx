import { useEffect, useRef } from "react";

/**
 * Blue sky overlay with drifting clouds and occasional planes.
 */
export function SkyOverlay() {
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

    type Cloud = {
      x: number;
      y: number;
      speed: number;
      width: number;
      height: number;
      opacity: number;
      blobs: { ox: number; oy: number; rx: number; ry: number }[];
    };

    type Plane = {
      x: number;
      y: number;
      speed: number;
      size: number;
      opacity: number;
      direction: 1 | -1;
    };

    const makeCloud = (startX?: number): Cloud => {
      const width = 80 + Math.random() * 160;
      const height = 25 + Math.random() * 35;
      const blobCount = 3 + Math.floor(Math.random() * 3);
      const blobs = [];
      for (let i = 0; i < blobCount; i++) {
        blobs.push({
          ox: (Math.random() - 0.5) * width * 0.7,
          oy: (Math.random() - 0.5) * height * 0.4,
          rx: width * (0.2 + Math.random() * 0.25),
          ry: height * (0.3 + Math.random() * 0.35),
        });
      }
      return {
        x: startX !== undefined ? startX : Math.random() * w,
        y: h * 0.04 + Math.random() * h * 0.28,
        speed: 0.15 + Math.random() * 0.35,
        width,
        height,
        opacity: 0.25 + Math.random() * 0.3,
        blobs,
      };
    };

    const clouds: Cloud[] = [];
    for (let i = 0; i < 5; i++) clouds.push(makeCloud());

    const planes: Plane[] = [];
    let nextPlane = 8000 + Math.random() * 15000;

    const spawnPlane = () => {
      const dir = Math.random() > 0.5 ? 1 : -1 as 1 | -1;
      planes.push({
        x: dir === 1 ? -30 : w + 30,
        y: h * 0.05 + Math.random() * h * 0.2,
        speed: (0.8 + Math.random() * 0.6) * dir,
        size: 3 + Math.random() * 2,
        opacity: 0.4 + Math.random() * 0.3,
        direction: dir,
      });
    };

    const drawCloud = (c: Cloud) => {
      for (const b of c.blobs) {
        ctx.beginPath();
        ctx.ellipse(c.x + b.ox, c.y + b.oy, b.rx, b.ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.fill();
      }
    };

    const drawPlane = (p: Plane) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.direction === -1) ctx.scale(-1, 1);

      // fuselage
      ctx.beginPath();
      ctx.moveTo(-p.size * 3, 0);
      ctx.lineTo(p.size * 3, 0);
      ctx.lineTo(p.size * 2, -p.size * 0.3);
      ctx.lineTo(-p.size * 2, -p.size * 0.2);
      ctx.closePath();
      ctx.fillStyle = `rgba(220, 220, 230, ${p.opacity})`;
      ctx.fill();

      // wings
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.5, 0);
      ctx.lineTo(p.size * 0.5, -p.size * 2);
      ctx.lineTo(p.size * 1.5, -p.size * 2);
      ctx.lineTo(p.size * 0.5, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(200, 200, 210, ${p.opacity * 0.8})`;
      ctx.fill();

      // tail
      ctx.beginPath();
      ctx.moveTo(-p.size * 2.5, 0);
      ctx.lineTo(-p.size * 2, -p.size * 1.2);
      ctx.lineTo(-p.size * 1.5, -p.size * 1.2);
      ctx.lineTo(-p.size * 1.8, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(200, 200, 210, ${p.opacity * 0.7})`;
      ctx.fill();

      // contrail
      ctx.beginPath();
      ctx.moveTo(-p.size * 3, p.size * 0.1);
      const trailLen = 30 + Math.random() * 20;
      const grad = ctx.createLinearGradient(-p.size * 3, 0, -p.size * 3 - trailLen, 0);
      grad.addColorStop(0, `rgba(255,255,255,${p.opacity * 0.4})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.lineTo(-p.size * 3 - trailLen, p.size * 0.1);
      ctx.strokeStyle = grad;
      ctx.lineWidth = p.size * 0.3;
      ctx.stroke();

      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // clouds
      for (const c of clouds) {
        c.x += c.speed;
        if (c.x - c.width > w + 50) {
          c.x = -c.width - 50;
          c.y = h * 0.04 + Math.random() * h * 0.28;
        }
        drawCloud(c);
      }

      // planes
      nextPlane -= 16;
      if (nextPlane <= 0) {
        spawnPlane();
        nextPlane = 12000 + Math.random() * 20000;
      }

      for (let i = planes.length - 1; i >= 0; i--) {
        const p = planes[i];
        p.x += p.speed;
        if ((p.direction === 1 && p.x > w + 60) || (p.direction === -1 && p.x < -60)) {
          planes.splice(i, 1);
          continue;
        }
        drawPlane(p);
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
