// code-guard: intentional-duplicate - local names (view, state, loop) fuzzy-match other components; the only GL view in the app.
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import * as THREE from 'three';

import { buildFlyAgaric, disposeModel, FLY_AGARIC_HEIGHT, type PartName } from './fly-agaric';

/** Species that have a 3D model. */
export const MODEL_SPECIES = new Set(['amanita-muscaria']);

export type Focus = PartName | 'all';
/** Camera per feature: pitch (radians, negative = from below), look-at height and distance, all in model units. */
const VIEWS: Record<Focus, { pitch: number; ty: number; dist: number }> = {
  all: { pitch: 0.22, ty: FLY_AGARIC_HEIGHT * 0.5, dist: 3.5 },
  cap: { pitch: 0.55, ty: 1.35, dist: 2.9 },
  warts: { pitch: 0.95, ty: 1.45, dist: 2.1 },
  gills: { pitch: -0.55, ty: 1.3, dist: 2.3 },
  ring: { pitch: 0.12, ty: 1.12, dist: 1.9 },
  stem: { pitch: 0.12, ty: 0.75, dist: 3.2 },
  bulb: { pitch: 0.28, ty: 0.22, dist: 1.6 },
};
const SILHOUETTE_VIEW = { pitch: 0.08, ty: FLY_AGARIC_HEIGHT * 0.5, dist: 3.6 };
const HIGHLIGHT = new THREE.Color('#F2B33D');
const AUTO_SPIN = 0.006; // radians per frame
const IDLE_MS = 2500; // pause the auto-spin after the user drags

type Props = {
  height: number;
  /** Background behind the model (screen colour; GL clears with it). */
  background: string;
  /** Draw the model as a flat shadow in this colour instead of with materials and light. */
  silhouette?: string;
  focus?: Focus;
  accessibilityLabel: string;
};

/** Points every material of a part at an emissive tint (0 = off). */
function tint(part: THREE.Object3D | undefined, k: number) {
  part?.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) o.material.emissive.copy(HIGHLIGHT).multiplyScalar(k);
  });
}

/**
 * RESPONSIBILITY: Zmienny stan widoku 3D wspólny dla gestu, propsów i pętli renderu (poza stanem Reacta: zmiany nie mogą przerysowywać); pilnuje, żeby działała najwyżej jedna scena
 * INPUTS:         focus, reduced, active (z propsów, ustawień ruchu i fokusu ekranu); drag(dx) z gestu; attach(start) z fabryką sceny
 * OUTPUTS:        pola czytane przez pętlę renderu (yaw, focus, reduced, active, lastDrag)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
class Live {
  yaw = 0.6;
  lastDrag = 0;
  frame = 0;
  /** False while the screen is covered or hidden: the loop keeps ticking but skips all GL calls. */
  active = true;
  cleanup = () => {};
  constructor(
    public focus: Focus,
    public reduced: boolean,
  ) {}
  /** Horizontal drag turns the model; the auto-spin waits a moment after the last drag. */
  drag(dx: number) {
    this.yaw -= dx * 0.012;
    this.lastDrag = Date.now();
  }
  /** Stops the previous scene first: expo-gl can fire onContextCreate again (surface re-created), and two loops would share `frame`. */
  attach(start: () => () => void) {
    this.release();
    this.cleanup = start();
  }
  /** Runs the scene cleanup once (a second call, e.g. StrictMode remount, must not dispose twice). */
  release() {
    const stop = this.cleanup;
    this.cleanup = () => {};
    try {
      stop();
    } catch (e) {
      // The old surface may already be destroyed under us; the new scene must still start.
      console.warn('3D cleanup failed', e);
    }
  }
  sync(focus: Focus, reduced: boolean, active: boolean) {
    this.focus = focus;
    this.reduced = reduced;
    this.active = active;
  }
}

/**
 * RESPONSIBILITY: Stawia scenę three na kontekście expo-gl (model, światło albo płaski cień, kamera) i uruchamia pętlę renderu
 * INPUTS:         gl: kontekst z GLView; background: kolor tła; silhouette?: kolor cienia; live: stan współdzielony z komponentem (obrót, cecha, ruch)
 * OUTPUTS:        funkcja sprzątająca (zatrzymuje pętlę, zwalnia geometrie, materiały i renderer)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        GPU (bufory i shadery w kontekście expo-gl)
 * ERRORS:         wyjątek three (np. brak WebGL2) przechodzi do wywołującego
 */
function startScene(gl: ExpoWebGLRenderingContext, background: string, silhouette: string | undefined, live: Live): () => void {
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  // three only needs a canvas-like object; expo-gl provides the context itself.
  const canvas = { width: w, height: h, style: {}, clientHeight: h, addEventListener: () => {}, removeEventListener: () => {} };
  const renderer = new THREE.WebGLRenderer({ canvas: canvas as unknown as HTMLCanvasElement, context: gl as unknown as WebGL2RenderingContext, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setViewport(0, 0, w, h);
  renderer.setClearColor(background);

  const scene = new THREE.Scene();
  const model = buildFlyAgaric();
  if (silhouette) {
    const flat = new THREE.MeshBasicMaterial({ color: silhouette, side: THREE.DoubleSide });
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        (o.material as THREE.Material).dispose();
        o.material = flat;
      }
    });
  } else {
    scene.add(new THREE.HemisphereLight('#FFF6E8', '#C9B89A', 2.2));
    const sun = new THREE.DirectionalLight('#FFFFFF', 2.4);
    sun.position.set(2, 4, 3);
    scene.add(sun);
  }
  scene.add(model);
  const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
  const cam = { ...(silhouette ? SILHOUETTE_VIEW : VIEWS[live.focus]) };
  let shown: Focus = 'all';

  const loop = (t: number) => {
    const s = live;
    if (!s.active) {
      s.frame = requestAnimationFrame(loop);
      return;
    }
    const target = silhouette ? SILHOUETTE_VIEW : VIEWS[s.focus];
    // ease the camera towards the chosen view
    cam.pitch += (target.pitch - cam.pitch) * 0.08;
    cam.ty += (target.ty - cam.ty) * 0.08;
    cam.dist += (target.dist - cam.dist) * 0.08;
    if (!s.reduced && Date.now() - s.lastDrag > IDLE_MS) s.yaw += AUTO_SPIN;
    camera.position.set(cam.dist * Math.cos(cam.pitch) * Math.sin(s.yaw), cam.ty + cam.dist * Math.sin(cam.pitch), cam.dist * Math.cos(cam.pitch) * Math.cos(s.yaw));
    camera.lookAt(0, cam.ty, 0);
    if (!silhouette) {
      if (shown !== s.focus) tint(model.getObjectByName(shown), 0);
      shown = s.focus;
      if (shown !== 'all') tint(model.getObjectByName(shown), s.reduced ? 0.3 : 0.2 + 0.15 * Math.sin(t / 250));
    }
    try {
      renderer.render(scene, camera);
      gl.endFrameEXP();
    } catch (e) {
      // Context lost or destroyed under us: stop drawing instead of throwing from every frame.
      console.warn('3D view stopped', e);
      return;
    }
    s.frame = requestAnimationFrame(loop);
  };
  live.frame = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(live.frame);
    disposeModel(model);
    renderer.dispose();
  };
}

/**
 * RESPONSIBILITY: Widok GL z modelem 3D muchomora: obrót palcem (poziomo), powolny autoobrót, kamera przejeżdża do wybranej cechy i ją podświetla; tryb cienia (płaska sylwetka) dla quizu
 * INPUTS:         height, background, silhouette? (kolor cienia), focus? (część modelu), accessibilityLabel
 * OUTPUTS:        View z GLView; render tylko w pętli requestAnimationFrame, zatrzymanej po odmontowaniu
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        GPU (kontekst expo-gl; geometrie zwalniane przy odmontowaniu)
 * ERRORS:         brak WebGL / błąd kontekstu → pusta plama w kolorze tła, reszta ekranu działa
 */
export function Mushroom3D({ height, background, silhouette, focus = 'all', accessibilityLabel }: Props) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const [live] = useState(() => new Live(focus, reduced));
  useEffect(() => live.sync(focus, reduced, focused), [live, focus, reduced, focused]);
  useEffect(() => () => live.release(), [live]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12]) // vertical swipes keep scrolling the screen
        .onChange((e) => live.drag(e.changeX)),
    [live],
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      live.attach(() => startScene(gl, background, silhouette, live));
    } catch (e) {
      // No usable WebGL (very old GPU): leave the background patch, the rest of the screen still works.
      console.warn('3D model unavailable', e);
    }
  };

  return (
    <GestureDetector gesture={pan}>
      <View style={[ui.box, { height, backgroundColor: background }]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <GLView style={ui.fill} onContextCreate={onContextCreate} />
      </View>
    </GestureDetector>
  );
}

const ui = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden' },
  fill: { flex: 1 },
});
