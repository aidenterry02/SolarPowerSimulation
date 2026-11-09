import { useEffect, useRef, useState } from "react";
import {
  latLonToTile,
  projectToPixel,
  satelliteTileUrl,
  type BuildingFootprint,
  type GeoPoint,
} from "../lib/geo";

interface Props {
  center: GeoPoint;
  building?: BuildingFootprint | null;
  zoom?: number;
}

/**
 * Lightweight satellite preview using Esri World Imagery tiles + optional OSM outline.
 */
export function SatelliteMap({ center, building, zoom = 19 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width || 640);
      setSize({ width: w, height: Math.round(w * 0.56) });
    });
    ro.observe(el);
    setSize({
      width: Math.floor(el.clientWidth || 640),
      height: Math.round((el.clientWidth || 640) * 0.56),
    });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = size;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#93a4c3";
    ctx.font = "13px DM Sans, sans-serif";
    ctx.fillText("Loading satellite imagery…", 16, 28);

    const { x: tx, y: ty } = latLonToTile(center.lat, center.lon, zoom);
    // 3x3 tile mosaic centered near the pin
    const tiles: Array<{ img: HTMLImageElement; ox: number; oy: number }> = [];
    const loads: Promise<void>[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const tileX = tx + dx;
        const tileY = ty + dy;
        const p = new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = satelliteTileUrl(zoom, tileX, tileY);
        });
        // Position tiles relative to center tile
        const centerTileOrigin = {
          // world pixel of top-left of center tile
          x: tx * 256,
          y: ty * 256,
        };
        const worldTL = {
          x: tileX * 256,
          y: tileY * 256,
        };
        // We'll map after we know center projection — store offsets vs center tile
        tiles.push({
          img,
          ox: worldTL.x - centerTileOrigin.x,
          oy: worldTL.y - centerTileOrigin.y,
        });
        loads.push(p);
      }
    }

    let cancelled = false;

    void Promise.all(loads).then(() => {
      if (cancelled || !canvasRef.current) return;
      const c = canvasRef.current.getContext("2d");
      if (!c) return;

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = "#0b1220";
      c.fillRect(0, 0, width, height);

      // Pixel offset of center lat/lon within the center tile
      const n = 2 ** zoom;
      const world = n * 256;
      const lonToX = (lo: number) => ((lo + 180) / 360) * world;
      const latToY = (la: number) => {
        const latRad = (la * Math.PI) / 180;
        return (
          ((1 -
            Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
            2) *
          world
        );
      };
      const cx = lonToX(center.lon);
      const cy = latToY(center.lat);
      const centerTileWorldX = tx * 256;
      const centerTileWorldY = ty * 256;
      const offsetInCenterTileX = cx - centerTileWorldX;
      const offsetInCenterTileY = cy - centerTileWorldY;

      for (const t of tiles) {
        if (!t.img.complete || t.img.naturalWidth === 0) continue;
        const drawX = width / 2 - offsetInCenterTileX + t.ox;
        const drawY = height / 2 - offsetInCenterTileY + t.oy;
        c.drawImage(t.img, drawX, drawY, 256, 256);
      }

      // Building outline
      if (building && building.ring.length >= 3) {
        c.beginPath();
        building.ring.forEach(([lon, lat], i) => {
          const p = projectToPixel(
            lat,
            lon,
            center.lat,
            center.lon,
            zoom,
            width,
            height
          );
          if (i === 0) c.moveTo(p.x, p.y);
          else c.lineTo(p.x, p.y);
        });
        c.closePath();
        c.fillStyle = "rgba(61, 214, 140, 0.28)";
        c.fill();
        c.strokeStyle = "#3dd68c";
        c.lineWidth = 2.5;
        c.stroke();
      }

      // Center pin
      const pin = projectToPixel(
        center.lat,
        center.lon,
        center.lat,
        center.lon,
        zoom,
        width,
        height
      );
      c.beginPath();
      c.arc(pin.x, pin.y, 6, 0, Math.PI * 2);
      c.fillStyle = "#f5b942";
      c.fill();
      c.strokeStyle = "#0b1220";
      c.lineWidth = 2;
      c.stroke();
    });

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lon, building, zoom, size.width, size.height]);

  return (
    <div className="sat-map" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="sat-canvas"
        role="img"
        aria-label="Satellite view of selected address"
      />
      <div className="sat-credit">
        Imagery © Esri · Building outline © OpenStreetMap
      </div>
    </div>
  );
}
