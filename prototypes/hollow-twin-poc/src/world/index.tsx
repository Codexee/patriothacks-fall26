/// <reference types="vite/client" />
// PROTOTYPE: the PixiJS cutaway of the Hollow. The canvas renders at art resolution and CSS scales it
// by SCALE with image-rendering: pixelated, so pixels stay crisp and the fill cost stays low.
import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import type { WorldProps } from '../sim/types.ts';
import { C, SCALE, computeLayout } from './palette.ts';
import { HollowScene } from './scene.ts';

export function World(props: WorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HollowScene | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let ready = false;
    let lastHover = '';
    const app = new Application();
    const artWidth = () => Math.max(1, Math.floor(host.clientWidth / SCALE));

    const sizeCanvas = (scene: HollowScene) => {
      const { artW, artH } = scene.layout;
      app.renderer.resize(artW, artH);
      const s = app.canvas.style;
      s.width = `${artW * SCALE}px`;
      s.height = `${artH * SCALE}px`;
      host.style.height = `${artH * SCALE}px`;
    };

    const mount = (artW: number) => {
      sceneRef.current?.destroy();
      const scene = new HollowScene(app, artW);
      sceneRef.current = scene;
      if (import.meta.env.DEV) (window as unknown as { __hollowScene?: HollowScene }).__hollowScene = scene; // debug handle
      sizeCanvas(scene);
      scene.setFrame(propsRef.current.frame);
      scene.setSelected(propsRef.current.selected);
    };

    const emitHover = (t: { level: number; col: number } | null) => {
      const key = t ? `${t.level}:${t.col}` : '';
      if (key === lastHover) return;
      lastHover = key;
      sceneRef.current?.setHover(t);
      propsRef.current.onHover(t);
    };
    const onMove = (e: PointerEvent) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const r = app.canvas.getBoundingClientRect();
      const ax = ((e.clientX - r.left) / r.width) * scene.layout.artW;
      const ay = ((e.clientY - r.top) / r.height) * scene.layout.artH;
      emitHover(scene.hitTest(ax, ay));
    };
    const onLeave = () => emitHover(null);

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      if (!ready) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const w = artWidth();
        if (sceneRef.current && computeLayout(w).artW !== sceneRef.current.layout.artW) mount(w);
      }, 120);
    });

    const initial = computeLayout(artWidth());
    app
      .init({
        width: initial.artW, height: initial.artH, resolution: 1, autoDensity: false,
        antialias: false, roundPixels: true, background: C.bg, preference: 'webgl',
      })
      .then(() => {
        if (disposed) { app.destroy(true, { children: true }); return; }
        ready = true;
        const cv = app.canvas;
        cv.style.display = 'block';
        cv.style.imageRendering = 'pixelated';
        host.appendChild(cv);
        mount(artWidth());
        app.ticker.add((tk) => sceneRef.current?.tick(tk.deltaMS));
        cv.addEventListener('pointermove', onMove);
        cv.addEventListener('pointerleave', onLeave);
        ro.observe(host);
      });

    return () => {
      disposed = true;
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      if (!ready) return; // init still pending: the .then above destroys the app
      app.canvas.removeEventListener('pointermove', onMove);
      app.canvas.removeEventListener('pointerleave', onLeave);
      sceneRef.current?.destroy();
      sceneRef.current = null;
      app.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => { sceneRef.current?.setFrame(props.frame); }, [props.frame]);
  useEffect(() => { sceneRef.current?.setSelected(props.selected); }, [props.selected]);

  return <div ref={hostRef} style={{ width: '100%', minHeight: 200, overflow: 'hidden', background: '#0b0b10' }} />;
}
