import { Capacitor } from '@capacitor/core';
import appPackage from '../package.json';
import './game-orientation.css';

export interface GameOrientationState {
  blocked: boolean;
  landscape: boolean;
}

export interface GameOrientationController extends GameOrientationState {
  requestLandscape(): Promise<void>;
  destroy(): void;
}

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null };

const PLAY_VERSION = import.meta.env?.VITE_APP_VERSION || appPackage.version;
const PLAY_URL = `https://h0623-dev.github.io/House/play-v${PLAY_VERSION}.html`;

/**
 * The operating system owns display rotation. A browser may allow a landscape
 * lock after entering fullscreen; unsupported browsers get a usable rotate
 * prompt instead of a rotated canvas with mismatched pointer coordinates.
 */
export function initializeGameOrientation(): GameOrientationController {
  const native = Capacitor.isNativePlatform();
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const overlay = document.createElement('section');
  overlay.className = 'game-orientation';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'game-orientation-title');
  overlay.setAttribute('aria-describedby', 'game-orientation-description');
  overlay.innerHTML = `
    <div class="game-orientation-card">
      <span class="game-orientation-brand">ROAD HAVEN</span>
      <div class="game-orientation-art" aria-hidden="true">
        <svg viewBox="0 0 276 156" fill="none" focusable="false">
          <ellipse cx="139" cy="136" rx="100" ry="9" fill="#59784d" opacity=".12"/>
          <rect class="game-orientation-phone-portrait" x="98" y="7" width="80" height="132" rx="15" stroke="#8fa77a" stroke-width="3" stroke-dasharray="6 6"/>
          <g class="game-orientation-phone-landscape">
            <rect x="35" y="34" width="206" height="105" rx="17" fill="#305a45" stroke="#244733" stroke-width="3"/>
            <rect x="47" y="45" width="183" height="82" rx="10" fill="#d7e6bd"/>
            <path d="M48 109 94 76 130 99 174 68 229 111V117a10 10 0 0 1-10 10H58a10 10 0 0 1-10-10Z" fill="#9cbb7d"/>
            <circle cx="197" cy="65" r="10" fill="#fff3ba"/>
            <path d="M90 84h79v28H90z" fill="#b88d51" stroke="#785d39" stroke-width="2.5"/>
            <path d="M169 95h17l14 12v11h-31z" fill="#557b54" stroke="#365d40" stroke-width="2.5"/>
            <path d="M175 99h9l9 8h-18z" fill="#daebca"/>
            <path d="M94 80h72M99 75v11m17-11v11m17-11v11m17-11v11m14-11v11" stroke="#85643b" stroke-width="3" stroke-linecap="round"/>
            <path d="M108 83V68m0 8c-12 0-13-10-13-10 12-1 13 10 13 10Zm0 0c12 0 13-10 13-10-12-1-13 10-13 10Z" stroke="#577c46" stroke-width="3" stroke-linecap="round"/>
            <path d="M138 82v-9m0 4c-9 0-10-7-10-7 9-1 10 7 10 7Zm0 0c9 0 10-7 10-7-9-1-10 7-10 7Z" stroke="#62864b" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="108" cy="116" r="9" fill="#344c37"/><circle cx="108" cy="116" r="4" fill="#d1b87e"/>
            <circle cx="185" cy="116" r="9" fill="#344c37"/><circle cx="185" cy="116" r="4" fill="#d1b87e"/>
            <rect x="38" y="77" width="4" height="18" rx="2" fill="#b3c89a"/>
            <circle cx="235" cy="86" r="2" fill="#b3c89a"/>
          </g>
          <path class="game-orientation-arrow" d="M194 14c28 1 47 13 53 32m-12-6 13 7 2-15" stroke="#b99a59" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="m43 14 2 7 7 2-7 2-2 7-2-7-7-2 7-2Zm188 121 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5Z" fill="#c8a45f"/>
        </svg>
      </div>
      <span class="game-orientation-kicker">우리 마을을 더 넓게</span>
      <h1 id="game-orientation-title">가로로 펼쳐서 만나요</h1>
      <p id="game-orientation-description">휴대폰을 옆으로 돌려 주세요.<br>넓은 마을과 조작 버튼이 한눈에 보여요.</p>
      <button class="game-orientation-start" type="button" data-orientation-start>가로 화면으로 시작</button>
      <p class="game-orientation-hint" data-orientation-hint role="status" aria-live="polite">화면이 돌아가지 않으면 휴대폰의 자동 회전을 켜 주세요.</p>
      ${native ? `<div class="game-orientation-native-help"><p>이전 앱은 화면이 세로로 고정돼 있어요.<br>가로 고정 기능은 앱 자체 업데이트가 필요해요.</p><button type="button" data-orientation-update>앱 기능 업데이트 확인</button><a href="${PLAY_URL}" target="_blank" rel="noopener noreferrer">브라우저에서 가로로 플레이</a><small>앱과 브라우저의 마을은 각각 저장돼요.</small></div>` : ''}
      <button class="game-orientation-continue" type="button" data-orientation-continue>지금은 세로로 계속</button>
    </div>`;
  document.body.append(overlay);

  const startButton = overlay.querySelector<HTMLButtonElement>('[data-orientation-start]')!;
  const hint = overlay.querySelector<HTMLElement>('[data-orientation-hint]')!;
  let dismissedPortrait = false;
  let destroyed = false;
  let requesting = false;
  let frame = 0;
  let lastFocused: HTMLElement | null = null;
  let current: GameOrientationState = { blocked: false, landscape: false };

  function mobileScreen(): boolean {
    const shortSide = Math.min(window.screen.width || window.innerWidth, window.screen.height || window.innerHeight);
    return native || (coarsePointer.matches && navigator.maxTouchPoints > 0 && shortSide <= 1100);
  }

  function landscapeScreen(): boolean {
    // A keyboard can make a portrait viewport wider than it is tall. Physical
    // orientation takes precedence on touch devices so it cannot unlock play.
    if (mobileScreen()) {
      const type = window.screen.orientation?.type;
      if (type?.startsWith('portrait')) return false;
      const legacyAngle = (window as Window & { orientation?: number }).orientation;
      if (!type && typeof legacyAngle === 'number' && Math.abs(legacyAngle) % 180 === 0) return false;
    }
    return window.innerWidth > window.innerHeight;
  }

  function refresh(): void {
    if (destroyed) return;
    const landscape = landscapeScreen();
    if (landscape) dismissedPortrait = false;
    const blocked = mobileScreen() && !landscape && !dismissedPortrait;
    const changed = blocked !== current.blocked || landscape !== current.landscape;
    if (blocked && !current.blocked) {
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    overlay.hidden = !blocked;
    document.documentElement.classList.toggle('game-orientation-blocked', blocked);
    document.documentElement.dataset.gameOrientation = landscape ? 'landscape' : 'portrait';
    const wasBlocked = current.blocked;
    current = { blocked, landscape };
    if (changed) window.dispatchEvent(new CustomEvent<GameOrientationState>('gameorientationchange', { detail: { ...current } }));
    if (blocked && !wasBlocked && !document.querySelector('[data-startup-patch]')) startButton.focus({ preventScroll: true });
    if (!blocked && wasBlocked && lastFocused?.isConnected) lastFocused.focus({ preventScroll: true });
  }

  function scheduleRefresh(): void {
    if (destroyed || frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; refresh(); });
  }

  function continuePortrait(): void {
    dismissedPortrait = true;
    refresh();
  }

  async function requestLandscape(): Promise<void> {
    if (requesting || destroyed) return;
    requesting = true;
    startButton.disabled = true;
    startButton.textContent = '가로 화면을 준비해요…';
    try {
      // Fullscreen must be requested directly from this click, before the first
      // await. Catch unsupported/denied APIs and leave the manual route usable.
      const root = document.documentElement as FullscreenElement;
      const fullscreenDocument = document as FullscreenDocument;
      if (!native && !document.fullscreenElement && !fullscreenDocument.webkitFullscreenElement) {
        try {
          if (root.requestFullscreen) await root.requestFullscreen();
          else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
        } catch { /* Device rotation and the continue option remain available. */ }
      }
      const orientation = window.screen.orientation as LockableScreenOrientation | undefined;
      if (orientation?.lock) {
        try { await orientation.lock('landscape'); }
        catch { /* Safari and many tabs do not permit orientation locks. */ }
      }
      if (destroyed) return;
      hint.textContent = native
        ? '화면이 계속 세로라면 아래 앱 기능 업데이트를 선택해 주세요.'
        : '휴대폰의 자동 회전을 켜고 기기를 옆으로 돌려 주세요. iPhone은 세로 방향 고정을 꺼 주세요.';
    } finally {
      requesting = false;
      if (!destroyed) {
        startButton.disabled = false;
        startButton.textContent = '가로 화면으로 시작';
        scheduleRefresh();
      }
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!current.blocked || event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
      event.preventDefault(); first?.focus();
    }
  }

  function onVisibility(): void { if (!document.hidden) scheduleRefresh(); }
  startButton.addEventListener('click', () => { void requestLandscape(); });
  overlay.querySelector('[data-orientation-continue]')!.addEventListener('click', continuePortrait);
  overlay.querySelector('[data-orientation-update]')?.addEventListener('click', () => {
    continuePortrait();
    window.dispatchEvent(new Event('gameorientationupdate'));
  });
  window.addEventListener('resize', scheduleRefresh);
  window.addEventListener('orientationchange', scheduleRefresh);
  window.screen.orientation?.addEventListener('change', scheduleRefresh);
  coarsePointer.addEventListener('change', scheduleRefresh);
  document.addEventListener('fullscreenchange', scheduleRefresh);
  document.addEventListener('webkitfullscreenchange', scheduleRefresh);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKeyDown);
  refresh();

  return {
    get blocked() { return current.blocked; },
    get landscape() { return current.landscape; },
    requestLandscape,
    destroy() {
      destroyed = true;
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleRefresh);
      window.removeEventListener('orientationchange', scheduleRefresh);
      window.screen.orientation?.removeEventListener('change', scheduleRefresh);
      coarsePointer.removeEventListener('change', scheduleRefresh);
      document.removeEventListener('fullscreenchange', scheduleRefresh);
      document.removeEventListener('webkitfullscreenchange', scheduleRefresh);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      document.documentElement.classList.remove('game-orientation-blocked');
      delete document.documentElement.dataset.gameOrientation;
    },
  };
}
