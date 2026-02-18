import { useEffect, useRef } from "react";
import leeHeadshot from "@/assets/lee-headshot-styled.png";

/**
 * A canvas-rendered wireframe globe with the headshot projected onto it.
 * Shows simplified continent outlines and slow-moving tracer lights.
 */
export function GlobeHeadshot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const size = 192; // canvas pixel size

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;

    // Load headshot
    const img = new Image();
    img.src = leeHeadshot;
    imgRef.current = img;

    // Simplified continent outlines as lon/lat polylines (degrees)
    // Each continent is an array of [lon, lat] points
    const continents: [number, number][][] = [
      // North America (simplified)
      [[-130,50],[-120,60],[-100,65],[-80,60],[-70,45],[-80,30],[-90,25],[-105,20],[-120,35],[-130,50]],
      // South America
      [[-80,10],[-70,5],[-50,0],[-40,-10],[-35,-20],[-40,-35],[-55,-50],[-70,-45],[-75,-20],[-80,0],[-80,10]],
      // Europe
      [[-10,35],[0,40],[5,45],[10,50],[20,55],[30,60],[40,55],[30,45],[25,35],[10,35],[-10,35]],
      // Africa
      [[-15,15],[-10,30],[0,35],[10,35],[20,30],[35,20],[40,10],[45,0],[40,-15],[30,-30],[20,-35],[15,-25],[10,-5],[5,5],[-5,5],[-15,15]],
      // Asia (simplified)
      [[40,55],[60,60],[80,65],[100,60],[120,55],[130,45],[140,40],[130,30],[120,25],[105,15],[100,20],[80,25],[70,20],[60,25],[45,35],[40,40],[40,55]],
      // Australia
      [[115,-15],[130,-12],[145,-15],[150,-25],[145,-35],[135,-35],[120,-30],[115,-20],[115,-15]],
    ];

    // Tracer state
    type Tracer = {
      lon: number; lat: number;
      targetLon: number; targetLat: number;
      progress: number; speed: number;
      life: number; maxLife: number;
      brightness: number;
    };
    let tracers: Tracer[] = [];
    let nextTracer = 1000;

    const spawnTracer = () => {
      const targets = [
        [0, 48], [30, 0], [-90, 40], [100, 35], [140, -25], [-60, -15], [-120, 55], [70, 30],
        [20, 50], [-40, -20], [110, 20], [10, -10],
      ];
      const t = targets[Math.floor(Math.random() * targets.length)];
      tracers.push({
        lon: Math.random() * 360 - 180,
        lat: Math.random() * 120 - 60,
        targetLon: t[0],
        targetLat: t[1],
        progress: 0,
        speed: 0.008 + Math.random() * 0.006,
        life: 0,
        maxLife: 120 + Math.random() * 80,
        brightness: 0.7 + Math.random() * 0.3,
      });
    };

    let rotation = 0;
    let animId: number;

    const project = (lon: number, lat: number, rot: number): [number, number, number] => {
      const phi = (lat * Math.PI) / 180;
      const lambda = ((lon + rot) * Math.PI) / 180;
      const x = cx + r * Math.cos(phi) * Math.sin(lambda);
      const y = cy - r * Math.sin(phi);
      const z = Math.cos(phi) * Math.cos(lambda);
      return [x, y, z];
    };

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Draw globe background sphere with subtle gradient
      const grd = ctx.createRadialGradient(cx - 15, cy - 15, r * 0.1, cx, cy, r);
      grd.addColorStop(0, "rgba(30,50,80,0.6)");
      grd.addColorStop(0.7, "rgba(10,20,40,0.5)");
      grd.addColorStop(1, "rgba(5,10,20,0.3)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Draw headshot clipped to circle with low opacity
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 0.35;
        const s = r * 2;
        ctx.drawImage(img, cx - s / 2, cy - s / 2 - 8, s, s);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Draw latitude lines
      ctx.strokeStyle = "rgba(218,165,32,0.12)";
      ctx.lineWidth = 0.5;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 5) {
          const [x, y, z] = project(lon, lat, rotation);
          if (z > 0) {
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
          } else { started = false; }
        }
        ctx.stroke();
      }

      // Draw longitude lines
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 5) {
          const [x, y, z] = project(lon, lat, rotation);
          if (z > 0) {
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
          } else { started = false; }
        }
        ctx.stroke();
      }

      // Draw continent outlines
      ctx.strokeStyle = "rgba(218,165,32,0.35)";
      ctx.lineWidth = 1;
      for (const cont of continents) {
        ctx.beginPath();
        let started = false;
        for (const [lon, lat] of cont) {
          const [x, y, z] = project(lon, lat, rotation);
          if (z > 0) {
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
          } else { started = false; }
        }
        ctx.stroke();
      }

      // Draw tracers
      nextTracer -= 16;
      if (nextTracer <= 0) {
        spawnTracer();
        nextTracer = 2000 + Math.random() * 3000;
      }

      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.progress += t.speed;
        t.life++;

        const curLon = t.lon + (t.targetLon - t.lon) * Math.min(t.progress, 1);
        const curLat = t.lat + (t.targetLat - t.lat) * Math.min(t.progress, 1);
        const [x, y, z] = project(curLon, curLat, rotation);

        if (z > 0) {
          const fade = t.progress < 0.3 ? t.progress / 0.3 : t.progress > 0.8 ? (1 - t.progress) / 0.2 : 1;
          const a = Math.max(0, fade * t.brightness);

          // Glow
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 6);
          glow.addColorStop(0, `rgba(218,165,32,${a * 0.8})`);
          glow.addColorStop(0.5, `rgba(218,165,32,${a * 0.3})`);
          glow.addColorStop(1, `rgba(218,165,32,0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(x - 6, y - 6, 12, 12);

          // Dot
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,220,100,${a})`;
          ctx.fill();
        }

        if (t.life >= t.maxLife || t.progress >= 1.2) tracers.splice(i, 1);
      }

      // Globe edge glow
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(218,165,32,0.25)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(218,165,32,0.3)";
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      rotation += 0.15; // slow rotation
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-40 h-40 sm:w-48 sm:h-48"
      style={{ imageRendering: "auto" }}
    />
  );
}
