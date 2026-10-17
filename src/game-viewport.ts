import './game-viewport.css';

export type GameLayout = 'compact' | 'comfortable' | 'expanded';

export interface GameViewportState {
  width: number;
  height: number;
  left: number;
  top: number;
  visibleLeft: number;
  visibleTop: number;
  visibleWidth: number;
  visibleHeight: number;
  usableWidth: number;
  usableHeight: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  keyboardInset: number;
  keyboard: boolean;
  layout: GameLayout;
  posture: 'continuous' | 'folded';
}

export interface GameViewportController {
  readonly current: GameViewportState;
  refresh(): void;
  destroy(): void;
}

type DevicePosture = EventTarget & { type?: 'continuous' | 'folded' };
type VirtualKeyboard = EventTarget & { boundingRect?: DOMRectReadOnly };
type ExtendedNavigator = Navigator & {
  devicePosture?: DevicePosture;
  virtualKeyboard?: VirtualKeyboard;
};

const CSS_PROPERTIES = [
  '--game-viewport-width', '--game-viewport-height', '--game-viewport-left', '--game-viewport-top',
  '--game-visible-width', '--game-visible-height', '--game-visible-left', '--game-visible-top', '--game-usable-width', '--game-usable-height',
  '--game-safe-top', '--game-safe-right', '--game-safe-bottom', '--game-safe-left', '--game-keyboard-inset',
] as const;
const DATA_PROPERTIES = ['gameLayout', 'gameKeyboard', 'gamePosture', 'gameSegments'] as const;

let activeController: GameViewportController | null = null;

function editableElement(): boolean {
  const element = document.activeElement;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !element.disabled
      && !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

function pixels(value: number): string { return `${Math.round(value * 100) / 100}px`; }
function dimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Fit to CSS viewport pixels, never to a model name or the display's physical
 * resolution. Fold/unfold, split windows, browser chrome and native insets can
 * all change these bounds without reloading the saved game or scaling canvas
 * pointer coordinates. The keyboard gets its own visible bounds so a form can
 * scroll above it without shrinking the whole village into a smaller layout.
 */
export function initializeGameViewport(): GameViewportController {
  if (activeController) return activeController;

  const root = document.documentElement;
  const oldStyles = CSS_PROPERTIES.map(property => [property, root.style.getPropertyValue(property), root.style.getPropertyPriority(property)] as const);
  const oldData = DATA_PROPERTIES.map(property => [property, root.dataset[property]] as const);
  const safeProbe = document.createElement('div');
  safeProbe.setAttribute('aria-hidden', 'true');
  safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;contain:strict;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  document.body.append(safeProbe);

  const viewport = window.visualViewport;
  const extendedNavigator = navigator as ExtendedNavigator;
  const devicePosture = extendedNavigator.devicePosture;
  const keyboard = extendedNavigator.virtualKeyboard;
  const touchQuery = window.matchMedia('(any-pointer: coarse)');
  const foldedQuery = window.matchMedia('(device-posture: folded)');
  const horizontalSegments = window.matchMedia('(horizontal-viewport-segments: 2)');
  const verticalSegments = window.matchMedia('(vertical-viewport-segments: 2)');
  const mediaQueries = [touchQuery, foldedQuery, horizontalSegments, verticalSegments];
  let frame = 0;
  let destroyed = false;
  let unoccludedWidth = 0;
  let unoccludedHeight = 0;
  let current: GameViewportState;

  function refresh(): void {
    if (destroyed) return;
    const layoutWidth = dimension(root.clientWidth, dimension(window.innerWidth, 1));
    const layoutHeight = dimension(window.innerHeight, dimension(root.clientHeight, 1));
    // Reflowing while a user pinches would fight browser magnification. Keep
    // the normal layout bounds and let the browser handle that magnification.
    const useVisualViewport = viewport && Math.abs(viewport.scale - 1) < .04;
    const visibleWidth = useVisualViewport ? Math.min(layoutWidth, dimension(viewport.width, layoutWidth)) : layoutWidth;
    const visibleHeight = useVisualViewport ? Math.min(layoutHeight, dimension(viewport.height, layoutHeight)) : layoutHeight;
    const visibleLeft = useVisualViewport ? Math.max(0, viewport.offsetLeft) : 0;
    const visibleTop = useVisualViewport ? Math.max(0, viewport.offsetTop) : 0;

    const sameWidth = unoccludedWidth > 0 && Math.abs(visibleWidth - unoccludedWidth) < Math.max(32, unoccludedWidth * .08);
    const keyboardHeight = Math.max(0, keyboard?.boundingRect?.height ?? 0);
    const occluded = unoccludedHeight - visibleHeight > Math.max(110, unoccludedHeight * .22);
    const touch = touchQuery.matches || navigator.maxTouchPoints > 0;
    const keyboardOpen = sameWidth && touch && (keyboardHeight > 0 || (occluded && editableElement()));

    let width = visibleWidth;
    let height = visibleHeight;
    let left = visibleLeft;
    let top = visibleTop;
    if (keyboardOpen) {
      width = unoccludedWidth;
      height = unoccludedHeight;
      left = current?.left ?? 0;
      top = current?.top ?? 0;
    } else {
      unoccludedWidth = width;
      unoccludedHeight = height;
    }

    const probeStyle = getComputedStyle(safeProbe);
    const safeTop = Math.min(height / 3, Math.max(0, parseFloat(probeStyle.paddingTop) || 0));
    const safeRight = Math.min(width / 3, Math.max(0, parseFloat(probeStyle.paddingRight) || 0));
    const safeBottom = Math.min(height / 3, Math.max(0, parseFloat(probeStyle.paddingBottom) || 0));
    const safeLeft = Math.min(width / 3, Math.max(0, parseFloat(probeStyle.paddingLeft) || 0));
    const usableWidth = Math.max(1, width - safeLeft - safeRight);
    const usableHeight = Math.max(1, height - safeTop - safeBottom);
    const layout: GameLayout = usableWidth < 720 || usableHeight < 460 ? 'compact'
      : usableWidth >= 1100 && usableHeight >= 620 ? 'expanded' : 'comfortable';
    const posture = devicePosture?.type === 'folded' || foldedQuery.matches ? 'folded' : 'continuous';
    const next: GameViewportState = {
      width, height, left, top, visibleLeft, visibleTop, visibleWidth, visibleHeight, usableWidth, usableHeight,
      safeTop, safeRight, safeBottom, safeLeft,
      keyboardInset: keyboardOpen ? Math.max(keyboardHeight, height - visibleHeight) : 0,
      keyboard: keyboardOpen, layout, posture,
    };
    const segments = horizontalSegments.matches ? '2x1' : verticalSegments.matches ? '1x2' : '1x1';
    const changed = !current || Object.keys(next).some(key => next[key as keyof GameViewportState] !== current[key as keyof GameViewportState])
      || root.dataset.gameSegments !== segments;
    if (!changed) return;
    current = next;

    const values = [width, height, left, top, visibleWidth, visibleHeight, visibleLeft, visibleTop, usableWidth, usableHeight,
      safeTop, safeRight, safeBottom, safeLeft, next.keyboardInset];
    CSS_PROPERTIES.forEach((property, index) => root.style.setProperty(property, pixels(values[index])));
    root.dataset.gameLayout = layout;
    root.dataset.gameKeyboard = keyboardOpen ? 'open' : 'closed';
    root.dataset.gamePosture = posture;
    root.dataset.gameSegments = segments;
    window.dispatchEvent(new CustomEvent<GameViewportState>('gameviewportchange', { detail: { ...next } }));
  }

  function scheduleRefresh(): void {
    if (destroyed || frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; refresh(); });
  }
  function onVisibility(): void { if (!document.hidden) scheduleRefresh(); }

  window.addEventListener('resize', scheduleRefresh);
  window.addEventListener('orientationchange', scheduleRefresh);
  window.addEventListener('pageshow', scheduleRefresh);
  window.screen.orientation?.addEventListener('change', scheduleRefresh);
  viewport?.addEventListener('resize', scheduleRefresh);
  viewport?.addEventListener('scroll', scheduleRefresh);
  devicePosture?.addEventListener('change', scheduleRefresh);
  keyboard?.addEventListener('geometrychange', scheduleRefresh);
  mediaQueries.forEach(query => query.addEventListener('change', scheduleRefresh));
  document.addEventListener('fullscreenchange', scheduleRefresh);
  document.addEventListener('webkitfullscreenchange', scheduleRefresh);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('focusin', scheduleRefresh);
  document.addEventListener('focusout', scheduleRefresh);
  document.fonts?.addEventListener('loadingdone', scheduleRefresh);
  document.fonts?.addEventListener('loadingerror', scheduleRefresh);
  void document.fonts?.ready.then(scheduleRefresh);
  refresh();

  const controller: GameViewportController = {
    get current() { return { ...current }; },
    refresh: scheduleRefresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleRefresh);
      window.removeEventListener('orientationchange', scheduleRefresh);
      window.removeEventListener('pageshow', scheduleRefresh);
      window.screen.orientation?.removeEventListener('change', scheduleRefresh);
      viewport?.removeEventListener('resize', scheduleRefresh);
      viewport?.removeEventListener('scroll', scheduleRefresh);
      devicePosture?.removeEventListener('change', scheduleRefresh);
      keyboard?.removeEventListener('geometrychange', scheduleRefresh);
      mediaQueries.forEach(query => query.removeEventListener('change', scheduleRefresh));
      document.removeEventListener('fullscreenchange', scheduleRefresh);
      document.removeEventListener('webkitfullscreenchange', scheduleRefresh);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('focusin', scheduleRefresh);
      document.removeEventListener('focusout', scheduleRefresh);
      document.fonts?.removeEventListener('loadingdone', scheduleRefresh);
      document.fonts?.removeEventListener('loadingerror', scheduleRefresh);
      safeProbe.remove();
      oldStyles.forEach(([property, value, priority]) => value ? root.style.setProperty(property, value, priority) : root.style.removeProperty(property));
      oldData.forEach(([property, value]) => value === undefined ? delete root.dataset[property] : root.dataset[property] = value);
      activeController = null;
    },
  };
  activeController = controller;
  return controller;
}
