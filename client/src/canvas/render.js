import { TILE } from './layout';
import { getTileImagePath } from '../tools';

const images = {};
// callbacks waiting for an image: one per image and caller, however many redraws
const pending = new Map();

// tile images are loaded once and shared between renders
export const tileImage = (key, onLoad) => {
  let img = images[key];
  if (!img) {
    const [left, right] = key.split('-').map(Number);
    img = new Image();
    pending.set(img, new Set());
    img.addEventListener('load', () => {
      const callbacks = pending.get(img);
      pending.delete(img);
      callbacks?.forEach(cb => cb());
    }, { once: true });
    img.src = getTileImagePath({ left, right });
    images[key] = img;
  }
  if (!img.complete && onLoad) pending.get(img)?.add(onLoad);
  return img;
};

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

export const drawBoard = ({ ctx, view, layout, ghostState, onImageLoad }) => {
  const { width, height } = ctx.canvas;
  const dpr = view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(
    dpr * view.scale, 0, 0, dpr * view.scale,
    dpr * view.originX, dpr * view.originY,
  );

  for (const p of layout.tiles) {
    const img = tileImage(p.key, onImageLoad);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation * Math.PI / 180);
    ctx.shadowColor = 'rgba(60, 30, 0, 0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    if (img.complete && img.naturalWidth)
      ctx.drawImage(img, -TILE.short / 2, -TILE.long / 2, TILE.short, TILE.long);
    ctx.restore();
  }

  for (const side of ['left', 'right']) {
    const g = layout.ghosts[side];
    if (!g) continue;
    const { allowed, hovered } = ghostState[side];
    const alpha = hovered ? 0.85 : 0.55;
    ctx.save();
    ctx.fillStyle = allowed ? `rgba(127, 194, 73, ${alpha})` : 'rgba(155, 72, 5, 0.25)';
    ctx.strokeStyle = allowed ? 'rgb(64, 120, 30)' : 'rgba(155, 72, 5, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash(allowed ? [] : [8, 6]);
    roundRect(ctx, g.x - g.w / 2 + 2, g.y - g.h / 2 + 2, g.w - 4, g.h - 4, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
};
