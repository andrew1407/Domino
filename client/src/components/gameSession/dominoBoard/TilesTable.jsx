import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getCommonDeck, getCurentPlayer, getFirstTile, getPickedTile, getRoundInfo, getSessionEmitter } from '../../../storage/selectors';
import { layoutChain, insideRect, GHOST_ROOM } from '../../../canvas/layout';
import { drawBoard } from '../../../canvas/render';
import { canPlaceTile } from '../../../tools';
import styles from '../../../styles/gameSession/DominoBoard.module.scss';

const MARGIN = 24;
const CLICK_DELTA = 6;
const ZOOM_LIMITS = [0.4, 3];
const BUTTON_ZOOM = 1.25;

const clampZoom = z => Math.min(ZOOM_LIMITS[1], Math.max(ZOOM_LIMITS[0], z));

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const CenterIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
  </Icon>
);
const MinusIcon = () => <Icon><path d="M5 12h14" /></Icon>;
const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;

// base view (zoom = 1, no pan): the placed tiles are centered and fitted into
// the board with room for the ghost areas on every side, so picking a tile
// (which adds ghost areas) never moves the board
const baseView = (layout, size, baseScale) => {
  const b = layout.tileBounds;
  if (!b) return { scale: baseScale, centerX: 0, centerY: 0 };
  const fitScale = Math.min(
    (size.width - 2 * MARGIN) / (b.maxX - b.minX + 2 * GHOST_ROOM),
    (size.height - 2 * MARGIN) / (b.maxY - b.minY + 2 * GHOST_ROOM),
  );
  return {
    scale: Math.min(baseScale, fitScale),
    centerX: (b.minX + b.maxX) / 2,
    centerY: (b.minY + b.maxY) / 2,
  };
};

const makeView = (base, size, zoom, pan) => {
  const scale = base.scale * zoom;
  return {
    scale,
    originX: size.width / 2 - base.centerX * scale + pan.x,
    originY: size.height / 2 - base.centerY * scale + pan.y,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  };
};

export default function TilesTable() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [ size, setSize ] = useState({ width: 0, height: 0 });
  const [ camera, setCamera ] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const [ hovered, setHovered ] = useState(null);
  const [ grabbing, setGrabbing ] = useState(false);
  const [ redraw, setRedraw ] = useState(0);
  const requestRedraw = useCallback(() => setRedraw(n => n + 1), []);
  const deck = useSelector(getCommonDeck);
  const firstTile = useSelector(getFirstTile);
  const pickedTile = useSelector(getPickedTile);
  const sessionEmitter = useSelector(getSessionEmitter);
  const currentPlayer = useSelector(getCurentPlayer);
  const { currentMove } = useSelector(getRoundInfo);
  const myMove = !!currentPlayer && currentPlayer === currentMove;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setSize({
      width: container.clientWidth,
      height: container.clientHeight,
    }));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // base scale: tiles take a comfortable part of the board height
  const baseScale = Math.min(1, Math.max(0.45, size.height / 820));

  const layout = useMemo(() => {
    if (!size.width || !deck.length) return { tiles: [], ghosts: {}, bounds: null };
    return layoutChain({
      deck,
      firstTile,
      pickedTile: myMove ? pickedTile : null,
    });
  }, [deck, firstTile, pickedTile, myMove, size.width]);

  const base = useMemo(() => baseView(layout, size, baseScale), [layout, size, baseScale]);
  const view = useMemo(() => makeView(base, size, camera.zoom, camera.pan), [base, size, camera]);

  const ghostState = useMemo(() => ({
    left: { allowed: canPlaceTile(pickedTile, deck, 'left'), hovered: hovered === 'left' },
    right: { allowed: canPlaceTile(pickedTile, deck, 'right'), hovered: hovered === 'right' },
  }), [pickedTile, deck, hovered]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width) return;
    // resizing reallocates (and clears) the buffer: only on a size change
    const width = Math.round(size.width * view.dpr);
    const height = Math.round(size.height * view.dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    drawBoard({
      ctx: canvas.getContext('2d'),
      view,
      layout,
      ghostState,
      onImageLoad: requestRedraw,
    });
  }, [layout, view, ghostState, size, redraw]);

  // new round: reset the camera
  useEffect(() => {
    setCamera({ zoom: 1, pan: { x: 0, y: 0 } });
  }, [firstTile]);

  // the latest values for native event handlers (attached once)
  const live = useRef({});
  live.current = { base, size, layout, ghostState, myMove, sessionEmitter, pickedTile };

  // zooms keeping the board point under (x, y) (canvas coordinates) in place
  const zoomAt = useCallback((factor, x, y) => {
    setCamera(({ zoom, pan }) => {
      const { base: b, size: s } = live.current;
      const nextZoom = clampZoom(zoom * factor);
      const prev = makeView(b, s, zoom, pan);
      const scale2 = b.scale * nextZoom;
      const originX = x - (x - prev.originX) * scale2 / prev.scale;
      const originY = y - (y - prev.originY) * scale2 / prev.scale;
      return {
        zoom: nextZoom,
        pan: {
          x: originX - s.width / 2 + b.centerX * scale2,
          y: originY - s.height / 2 + b.centerY * scale2,
        },
      };
    });
  }, []);

  const panBy = useCallback((dx, dy) => {
    setCamera(({ zoom, pan }) => ({ zoom, pan: { x: pan.x + dx, y: pan.y + dy } }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let gestureScale = 1;

    const local = e => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const ghostAt = point => {
      const { layout: l, base: b, size: s } = live.current;
      const { zoom, pan } = cameraRef.current;
      const v = makeView(b, s, zoom, pan);
      const boardPoint = { x: (point.x - v.originX) / v.scale, y: (point.y - v.originY) / v.scale };
      for (const side of ['left', 'right'])
        if (insideRect(l.ghosts[side], boardPoint)) return side;
      return null;
    };

    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    };

    const onDown = e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // capture is optional
      }
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 2) {
        drag = null;
        pinch = pinchState();
      } else if (pointers.size === 1) {
        const p = local(e);
        drag = { last: p, start: p };
        setGrabbing(true);
      }
    };

    const onMove = e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, local(e));
      if (pinch && pointers.size >= 2) {
        e.preventDefault();
        const next = pinchState();
        if (pinch.distance > 0) zoomAt(next.distance / pinch.distance, next.mid.x, next.mid.y);
        panBy(next.mid.x - pinch.mid.x, next.mid.y - pinch.mid.y);
        pinch = next;
        return;
      }
      if (drag) {
        const p = local(e);
        panBy(p.x - drag.last.x, p.y - drag.last.y);
        drag.last = p;
        return;
      }
      if (e.pointerType === 'mouse') setHovered(ghostAt(local(e)));
    };

    const onUp = e => {
      pointers.delete(e.pointerId);
      if (!pointers.size) setGrabbing(false);
      if (pinch) {
        if (pointers.size < 2) pinch = null;
        // continue dragging with the remaining finger
        if (pointers.size === 1) {
          const [p] = pointers.values();
          drag = { last: p, start: { x: -1e6, y: -1e6 } };
        } else {
          drag = null;
        }
        return;
      }
      const current = drag;
      drag = null;
      if (!current || e.type === 'pointercancel') return;
      const p = local(e);
      const moved = Math.abs(p.x - current.start.x) > CLICK_DELTA || Math.abs(p.y - current.start.y) > CLICK_DELTA;
      if (moved) return;
      const side = ghostAt(p);
      const { ghostState: g, myMove: mine, sessionEmitter: emitter, pickedTile: picked } = live.current;
      if (side && g[side].allowed && mine) emitter?.moveAction(side, picked);
    };

    // mouse wheel & touchpad: ctrl+wheel is a touchpad pinch, plain wheel zooms by steps
    const onWheel = e => {
      e.preventDefault();
      const p = local(e);
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = e.ctrlKey ?
        Math.exp(-delta * 0.01) :
        (delta < 0 ? 1.12 : 1 / 1.12);
      zoomAt(factor, p.x, p.y);
    };

    // Safari (macOS/iOS) gesture events
    const onGestureStart = e => {
      e.preventDefault();
      gestureScale = 1;
    };
    const onGestureChange = e => {
      e.preventDefault();
      const p = local(e);
      zoomAt(e.scale / gestureScale, p.x, p.y);
      gestureScale = e.scale;
    };

    const onLeave = () => setHovered(null);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('gesturestart', onGestureStart, { passive: false });
    canvas.addEventListener('gesturechange', onGestureChange, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('gesturestart', onGestureStart);
      canvas.removeEventListener('gesturechange', onGestureChange);
    };
  }, [zoomAt, panBy]);

  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const zoomCenter = useCallback(factor => zoomAt(factor, size.width / 2, size.height / 2), [zoomAt, size]);
  const resetView = useCallback(() => setCamera({ zoom: 1, pan: { x: 0, y: 0 } }), []);
  const moved = camera.pan.x || camera.pan.y || camera.zoom !== 1;
  const cursor = grabbing ? 'grabbing' :
    hovered && ghostState[hovered]?.allowed ? 'pointer' : 'grab';

  return (
    <div ref={containerRef} className={styles.tilesTable}>
      <canvas ref={canvasRef} style={{ cursor }} data-testid="board-canvas" />
      {layout.tiles.length > 0 && (
        <div className={styles.viewControls}>
          {moved ? (
            <button type="button" title="center the board" aria-label="center the board" onClick={resetView}>
              <CenterIcon />
            </button>
          ) : null}
          <button type="button" title="zoom out" aria-label="zoom out" onClick={() => zoomCenter(1 / BUTTON_ZOOM)}>
            <MinusIcon />
          </button>
          <button type="button" title="zoom in" aria-label="zoom in" onClick={() => zoomCenter(BUTTON_ZOOM)}>
            <PlusIcon />
          </button>
        </div>
      )}
    </div>
  );
}
