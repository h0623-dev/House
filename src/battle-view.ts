import { BattleSimulation, SKILL_COOLDOWNS, STAGE_NAMES, type BattleEnemy, type BattleResult, type BattleSkill } from './battle';
import { drawHero } from './actors';
import { icon } from './icons';
import './battle.css';

export type { BattleResult } from './battle';
interface BattleOptions {
  gender: 'female' | 'male';
  name: string;
  level: number;
  health: number;
  stage: number;
  onFinish: (result: BattleResult) => void;
}
const SKILLS: { id: BattleSkill; symbol: string; label: string; description: string; key: string }[] = [
  { id: 'sweep', symbol: '✦', label: '바람 가르기', description: '모든 적 공격', key: '1' },
  { id: 'dash', symbol: icon('paw'), label: '보리 돌진', description: '집중 공격 · 저지', key: '2' },
  { id: 'heal', symbol: '✚', label: '초록빛 회복', description: '체력 29 회복', key: '3' },
];
const clean = (s: string): string => s.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

/** Owns a single modal battle and releases every listener on destroy. */
export class BattleView {
  readonly simulation: BattleSimulation;
  private readonly options: BattleOptions;
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private readonly previouslyFocused: HTMLElement | null;
  private readonly previousOverflow: string;
  private readonly app: HTMLElement | null;
  private readonly appWasInert: boolean;
  private frame = 0;
  private last = 0;
  private lastHUD = 0;
  private width = 0;
  private height = 0;
  private destroyed = false;
  private delivered = false;
  private resultShown = false;
  private manualPause = false;
  private confirmingRetreat = false;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(options: BattleOptions) {
    this.options = options;
    this.simulation = new BattleSimulation(options);
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    this.app = document.querySelector('#app');
    this.appWasInert = this.app?.inert ?? false;
    if (this.app) this.app.inert = true;
    document.body.style.overflow = 'hidden';
    this.root = document.createElement('div');
    this.root.className = 'battle-screen';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', '서울 외곽 사냥 전투');
    const s = this.simulation.state;
    this.root.innerHTML = `
      <div class="battle-shell">
        <header class="battle-topbar">
          <button class="battle-circle" data-battle="retreat" aria-label="전투에서 돌아가기">‹</button>
          <div class="battle-heading"><span>EXPEDITION ${String(s.stage).padStart(2, '0')}</span><h2>${STAGE_NAMES[s.stage - 1]}</h2></div>
          <button class="battle-circle" data-battle="pause" aria-label="전투 일시정지">Ⅱ</button>
        </header>
        <div class="battle-progress"><span data-battle-wave>WAVE 1 / 3</span><div class="battle-wave-dots"><i></i><i></i><i></i></div><strong data-battle-time>00:00</strong></div>
        <section class="battle-arena" aria-label="생존자와 보리가 좀비를 상대하는 전투 화면">
          <canvas aria-label="캐릭터가 자동 공격합니다. 아래 세 가지 기술을 눌러 전투를 도와주세요."></canvas>
          <div class="battle-location"><span>SEOUL OUTSKIRTS · 2187</span><b>도로에 다시, 작은 평화를.</b></div>
          <div class="battle-wave-banner" aria-live="polite"><small>새로운 만남</small><strong>WAVE 01</strong></div>
          <div class="battle-boss-label" hidden>⚠ 도로의 파수꾼 등장</div>
          <div class="battle-pause-layer" hidden><strong>잠시 숨을 고르는 중</strong><span>준비되면 다시 함께 달려요.</span><button data-battle="resume">전투 계속하기</button></div>
          <div class="battle-retreat-layer" hidden><div><span class="battle-dialog-kicker">BACK TO OUR HOME</span><h3>트럭으로 돌아갈까요?</h3><p>승리 보상은 받지 못해요.<br>사용한 기력과 현재 체력은 유지돼요.</p><button data-battle="cancel-retreat">계속 싸우기</button><button class="battle-secondary" data-battle="confirm-retreat">트럭으로 돌아가기</button></div></div>
        </section>
        <footer class="battle-command-panel">
          <div class="battle-party"><div class="battle-party-symbol">✧</div><div class="battle-party-info"><div><strong>${clean(options.name)}</strong><span>Lv.${s.level} <i>＋ 보리</i></span><b data-battle-health-label>${Math.ceil(s.health)} / 100</b></div><div class="battle-health-track" role="progressbar" aria-label="생존자 체력" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.ceil(s.health)}"><i></i></div></div><button class="battle-auto" data-battle="auto" aria-pressed="false"><span>AUTO</span><b>OFF</b></button></div>
          <div class="battle-skills">${SKILLS.map(skill => `<button class="battle-skill battle-skill-${skill.id}" data-skill="${skill.id}" aria-label="${skill.label}: ${skill.description}"><span class="battle-skill-art">${skill.symbol}</span><span class="battle-skill-text"><strong>${skill.label}</strong><small>${skill.description}</small></span><span class="battle-skill-cooldown"></span><kbd>${skill.key}</kbd></button>`).join('')}</div>
          <p class="battle-help"><span class="battle-live-dot"></span>기본 공격은 자동 · 반짝이는 기술을 눌러 도와주세요</p>
        </footer>
        <div class="battle-result-layer" hidden role="dialog" aria-modal="true" aria-label="전투 결과"></div>
      </div>`;
    document.body.append(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.root.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    this.resize();
    this.onVisibility();
    this.renderHUD();
    this.root.querySelector<HTMLButtonElement>('[data-battle="pause"]')!.focus();
    this.frame = requestAnimationFrame(this.animate);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.root.removeEventListener('click', this.onClick);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.root.remove();
    document.body.style.overflow = this.previousOverflow;
    if (this.app) this.app.inert = this.appWasInert;
    this.previouslyFocused?.focus();
  }

  private readonly onVisibility = (): void => {
    this.last = 0;
    this.simulation.setPaused(this.manualPause || this.confirmingRetreat || document.hidden);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      const buttons = [...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(button => button.offsetParent !== null && !button.closest('[inert]'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
      else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.confirmingRetreat) this.confirmRetreat(false);
      else if (!this.simulation.state.result) this.togglePause();
    }
    if (!event.repeat && ['1', '2', '3'].includes(event.key)) this.simulation.useSkill(SKILLS[Number(event.key) - 1].id);
  };

  private readonly onClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!target || target.disabled) return;
    if (target.dataset.skill) {
      this.simulation.useSkill(target.dataset.skill as BattleSkill);
      this.renderHUD();
      return;
    }
    switch (target.dataset.battle) {
      case 'pause': case 'resume': this.togglePause(); break;
      case 'auto': this.simulation.setAuto(!this.simulation.state.auto); break;
      case 'retreat': if (!this.simulation.state.result) this.confirmRetreat(true); break;
      case 'cancel-retreat': this.confirmRetreat(false); break;
      case 'confirm-retreat': this.simulation.retreat(); this.confirmRetreat(false); break;
      case 'finish': {
        const result = this.simulation.state.result;
        if (result && !this.delivered) {
          this.delivered = true;
          this.destroy();
          this.options.onFinish({ ...result });
        }
        break;
      }
    }
    if (!this.destroyed) this.renderHUD();
  };

  private togglePause(): void {
    if (this.simulation.state.result || this.confirmingRetreat) return;
    this.manualPause = !this.manualPause;
    this.root.querySelector<HTMLElement>('.battle-pause-layer')!.hidden = !this.manualPause;
    const button = this.root.querySelector<HTMLButtonElement>('[data-battle="pause"]')!;
    button.textContent = this.manualPause ? '▷' : 'Ⅱ';
    button.setAttribute('aria-label', this.manualPause ? '전투 계속하기' : '전투 일시정지');
    this.onVisibility();
  }

  private confirmRetreat(show: boolean): void {
    this.confirmingRetreat = show;
    this.root.querySelector<HTMLElement>('.battle-retreat-layer')!.hidden = !show;
    this.onVisibility();
    this.root.querySelector<HTMLButtonElement>(show ? '[data-battle="cancel-retreat"]' : '[data-battle="retreat"]')?.focus();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private readonly animate = (now: number): void => {
    if (this.destroyed) return;
    const delta = this.last === 0 ? 0 : (now - this.last) / 1000;
    this.last = now;
    this.simulation.tick(delta);
    this.draw();
    if (now - this.lastHUD >= 100 || this.simulation.state.result) { this.renderHUD(); this.lastHUD = now; }
    if (this.simulation.state.result && !this.resultShown) this.showResult();
    this.frame = requestAnimationFrame(this.animate);
  };

  private renderHUD(): void {
    const s = this.simulation.state;
    this.root.querySelector('[data-battle-wave]')!.textContent = `WAVE ${s.wave} / 3`;
    this.root.querySelector('[data-battle-time]')!.textContent = `${String(Math.floor(s.time / 60)).padStart(2, '0')}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`;
    this.root.querySelectorAll('.battle-wave-dots i').forEach((dot, i) => { dot.className = i < s.wave - 1 ? 'done' : i === s.wave - 1 ? 'current' : ''; });
    this.root.querySelector('[data-battle-health-label]')!.textContent = `${Math.ceil(s.health)} / 100`;
    const health = this.root.querySelector<HTMLElement>('.battle-health-track')!;
    health.setAttribute('aria-valuenow', String(Math.ceil(s.health)));
    health.classList.toggle('low', s.health < 30);
    health.querySelector<HTMLElement>('i')!.style.width = `${s.health}%`;
    const auto = this.root.querySelector<HTMLButtonElement>('[data-battle="auto"]')!;
    auto.setAttribute('aria-pressed', String(s.auto));
    auto.querySelector('b')!.textContent = s.auto ? 'ON' : 'OFF';
    for (const skill of SKILLS) {
      const button = this.root.querySelector<HTMLButtonElement>(`[data-skill="${skill.id}"]`)!;
      const remaining = s.cooldowns[skill.id];
      button.disabled = remaining > 0 || s.paused || s.transition > 0 || !!s.result || (skill.id === 'heal' && s.health >= 100);
      button.style.setProperty('--cooldown', `${remaining / SKILL_COOLDOWNS[skill.id] * 100}%`);
      button.querySelector('.battle-skill-cooldown')!.textContent = remaining > 0 ? `${Math.ceil(remaining)}s` : skill.id === 'heal' && s.health >= 100 ? '체력 가득' : 'READY';
    }
    const banner = this.root.querySelector<HTMLElement>('.battle-wave-banner')!;
    banner.classList.toggle('visible', s.transition > 0 && !s.result);
    if (banner.dataset.wave !== String(s.wave)) {
      banner.dataset.wave = String(s.wave);
      banner.querySelector('small')!.textContent = s.wave === 3 ? '마지막 도전 · 보스를 물리쳐요' : s.wave === 1 ? '보리와 함께하는 작은 모험' : '조금만 더, 함께 달려요';
      banner.querySelector('strong')!.textContent = s.wave === 3 ? 'BOSS WAVE' : `WAVE 0${s.wave}`;
    }
    this.root.querySelector<HTMLElement>('.battle-boss-label')!.hidden = s.wave !== 3 || s.transition > 0 || !!s.result;
  }

  private showResult(): void {
    this.resultShown = true;
    const result = this.simulation.state.result!;
    const victory = result.outcome === 'victory';
    const layer = this.root.querySelector<HTMLElement>('.battle-result-layer')!;
    layer.hidden = false;
    layer.innerHTML = `<div class="battle-result-card ${victory ? 'victory' : ''}"><div class="battle-result-emblem">${victory ? '✦' : result.outcome === 'retreat' ? '⌂' : '♡'}</div><span class="battle-dialog-kicker">${victory ? 'A LITTLE VICTORY' : 'WE GO HOME TOGETHER'}</span><h2>${victory ? '오늘도, 함께 해냈어요!' : result.outcome === 'retreat' ? '우리집으로 돌아가요' : '괜찮아요, 다음이 있으니까'}</h2><p>${victory ? '길을 지키던 좀비들을 물리쳤어요.<br>보리와 전리품을 챙겨 트럭으로 돌아가요.' : '보리가 곁을 지켜주었어요.<br>트럭에서 쉬고 다시 도전할 수 있어요.'}</p><div class="battle-result-stats"><div><b>${result.enemiesDefeated}</b><span>물리친 좀비</span></div><div><b>${result.duration}<small>초</small></b><span>함께한 시간</span></div><div><b>${result.remainingHealth}</b><span>남은 체력</span></div></div>${victory ? `<div class="battle-loot"><span>${icon('food')} 식량 +${6 + result.stage * 2}</span><span>${icon('wood')} 목재 +2</span><span>${icon('scrap')} 고철 +${result.stage * 2}</span><span>${icon('sparkle')} 경험치 +${20 + result.stage * 10}</span></div>` : '<div class="battle-result-note">이번에는 전리품이 없어요. 휴식 후 다시 만나요.</div>'}<button data-battle="finish">전리품 챙기고 우리집으로 <span>→</span></button></div>`;
    if (!victory) layer.querySelector('button')!.innerHTML = '트럭 위 우리집으로 <span>→</span>';
    this.root.querySelector('.battle-topbar')?.setAttribute('inert', '');
    this.root.querySelector('.battle-command-panel')?.setAttribute('inert', '');
    layer.querySelector<HTMLButtonElement>('button')!.focus();
  }

  private draw(): void {
    const c = this.ctx, w = this.width, h = this.height, s = this.simulation.state;
    if (!w || !h) return;
    c.clearRect(0, 0, w, h);
    c.save();
    if (!this.reducedMotion && s.heroHurtUntil > s.time) c.translate(Math.sin(s.time * 89) * 2, 0);
    this.drawLandscape(c, w, h, s.time);
    const floor = h * 0.77;
    const actorScale = Math.max(0.9, Math.min(1.5, w / 600));
    const heroX = w * 0.235;
    const attacking = s.heroAttackUntil > s.time;
    const skill = s.heroSkillUntil > s.time;
    const hurt = s.heroHurtUntil > s.time;
    const transition = s.transition > 0;
    const attackProgress = 1 - (s.heroAttackUntil - s.time) / 0.52;
    const lunge = attacking && !this.reducedMotion ? Math.sin(attackProgress * Math.PI) * 19 : 0;
    if (skill) {
      c.save(); c.globalAlpha = 0.2 + Math.sin(s.time * 15) * 0.07;
      c.fillStyle = '#b7faad'; c.beginPath(); c.ellipse(heroX, floor - 52, 50, 85, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    drawHero(c, { x: heroX + lunge, y: floor, scale: actorScale, time: s.time, gender: this.options.gender,
      pose: s.result?.outcome === 'victory' ? 'celebrate' : hurt ? 'hurt' : skill ? 'skill' : attacking ? 'attack' : transition ? 'walk' : 'idle',
      facing: 1, ...(attacking ? { progress: attackProgress } : {}) });
    this.drawDog(c, heroX + 34 * actorScale, floor + 18, actorScale * 0.93, s.time);
    for (const enemy of s.enemies) this.drawEnemy(c, enemy, w, floor, actorScale, s.time);
    this.drawEffects(c, w, floor, heroX, actorScale);
    c.restore();
  }

  private drawLandscape(c: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const stage = this.simulation.state.stage;
    const sky = c.createLinearGradient(0, 0, 0, h);
    const palette = stage === 2 ? ['#7fa6b5', '#c8d9cd', '#c5d5b9'] : stage === 3 ? ['#b89992', '#e9cba6', '#e5cb97'] : ['#8bbbc0', '#dce2ba', '#eacf96'];
    sky.addColorStop(0, palette[0]); sky.addColorStop(0.5, palette[1]); sky.addColorStop(1, palette[2]);
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff4cd'; c.globalAlpha = 0.64; c.beginPath(); c.arc(w * 0.75, h * 0.22, Math.min(68, w * 0.12), 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    for (let i = 0; i < 13; i++) {
      const x = (i * 97 % (w + 60)) - 20, height = 40 + i * 19 % 78;
      c.fillStyle = i % 2 ? '#8ca8a0' : '#95b0a5'; c.fillRect(x, h * 0.5 - height, 27 + i % 3 * 9, height);
      c.fillStyle = '#b8cbbb';
      for (let row = 0; row < 4; row++) c.fillRect(x + 5, h * 0.5 - height + 9 + row * 12, 4, 6);
    }
    // The broken Namsan tower and green ridgeline place the journey in future Seoul.
    c.strokeStyle = '#8aa398'; c.lineWidth = 4; c.beginPath(); c.moveTo(w * 0.57, h * 0.4); c.lineTo(w * 0.57, h * 0.2); c.stroke();
    c.fillStyle = '#819f92'; c.fillRect(w * 0.57 - 8, h * 0.275, 16, 5);
    c.fillStyle = '#769786'; c.beginPath(); c.moveTo(0, h * 0.51);
    for (let x = 0; x <= w + 30; x += 30) c.lineTo(x, h * 0.46 + Math.sin(x / 68) * 13); c.lineTo(w, h * 0.65); c.lineTo(0, h * 0.65); c.fill();
    if (stage === 2) {
      const river = c.createLinearGradient(0, h * 0.49, 0, h * 0.66); river.addColorStop(0, '#86a9a5'); river.addColorStop(1, '#a9c4b5');
      c.fillStyle = river; c.fillRect(0, h * 0.49, w, h * 0.18);
      c.strokeStyle = '#d5dfc760'; c.lineWidth = 1;
      for (let i = 0; i < 18; i++) { const rx = (i * 79 + t * 3) % w, ry = h * 0.50 + i * 8 % (h * 0.12); c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + 18 + i % 3 * 9, ry); c.stroke(); }
      c.fillStyle = '#88a299'; c.fillRect(w * 0.13, h * 0.48, 12, h * 0.12); c.fillRect(w * 0.36, h * 0.48, 12, h * 0.12);
      c.strokeStyle = '#738f86'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, h * 0.50); c.lineTo(w * 0.43, h * 0.50); c.lineTo(w * 0.49, h * 0.54); c.moveTo(w * 0.67, h * 0.50); c.lineTo(w, h * 0.50); c.stroke();
    }
    for (let i = 0; i < 9; i++) {
      if (stage === 2 && i > 0 && i < 8) continue;
      const x = i * w / 8, y = h * 0.56;
      this.tree(c, x, y, 0.55 + i % 3 * 0.15, '#527965', '#638d6b');
    }
    // Abandoned toll station: cream canopy, vines and a clearly Korean road sign.
    const signX = w * 0.72, signY = h * 0.41;
    c.strokeStyle = '#677d67'; c.lineWidth = 5; c.beginPath(); c.moveTo(signX - 47, signY); c.lineTo(signX - 47, h * 0.66); c.moveTo(signX + 47, signY); c.lineTo(signX + 47, h * 0.66); c.stroke();
    this.round(c, signX - 62, signY - 27, 124, 47, 4, '#386c59');
    this.round(c, signX - 57, signY - 22, 114, 37, 2, undefined, '#c9d5ac', 1);
    c.textAlign = 'center'; c.fillStyle = '#f3efd3'; c.font = 'bold 14px "Noto Sans KR Variable", sans-serif'; c.fillText(stage === 2 ? '한강 · 북단  ↗' : stage === 3 ? '남산 · 검문소 ↑' : '서울 · 숲길  ↗', signX, signY - 2);
    c.font = '8px sans-serif'; c.fillText(stage === 2 ? 'HANGANG BRIDGE' : stage === 3 ? 'NAMSAN CHECKPOINT' : 'SEOUL FOREST  2 km', signX, signY + 10);
    c.strokeStyle = '#496d40'; c.lineWidth = 5; c.beginPath(); c.moveTo(signX + 57, signY - 28); c.quadraticCurveTo(signX + 35, signY + 5, signX + 61, signY + 41); c.stroke();
    c.fillStyle = '#597853'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(signX + 51 + i % 2 * 8, signY - 15 + i * 10, 7, 3, i, 0, Math.PI * 2); c.fill(); }
    if (stage === 3) {
      const boothX = w * 0.12, boothY = h * 0.64;
      this.round(c, boothX - 28, boothY - 73, 54, 76, 3, '#9d9e80', '#6d8064', 2);
      this.round(c, boothX - 21, boothY - 62, 40, 28, 2, '#5c7a70');
      c.strokeStyle = '#b9bea0'; c.lineWidth = 3; c.beginPath(); c.moveTo(boothX - 1, boothY - 62); c.lineTo(boothX - 1, boothY - 34); c.moveTo(boothX - 23, boothY - 47); c.lineTo(boothX + 20, boothY - 47); c.stroke();
      c.fillStyle = '#747c60'; c.fillRect(boothX - 35, boothY - 80, 68, 9); c.fillStyle = '#d1c194'; c.fillRect(boothX - 10, boothY - 23, 21, 22);
      c.strokeStyle = '#6c7657'; c.lineWidth = 5; c.beginPath(); c.moveTo(boothX - 29, boothY); c.quadraticCurveTo(boothX - 10, boothY - 36, boothX - 22, boothY - 81); c.stroke();
      c.fillStyle = '#668553'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(boothX - 21 + i % 2 * 7, boothY - i * 12, 8, 4, i, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = '#7b876c'; c.lineWidth = 6; c.beginPath(); c.moveTo(w * 0.39, h * 0.63); c.lineTo(w * 0.39, h * 0.48); c.lineTo(w * 0.62, h * 0.51); c.stroke();
      c.strokeStyle = '#a89b72'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.42, h * 0.49); c.lineTo(w * 0.61, h * 0.51); c.stroke();
    }
    // Perspective highway with broken lane markers and roadside wildflowers.
    c.fillStyle = '#829178'; c.fillRect(0, h * 0.62, w, h * 0.38);
    const road = c.createLinearGradient(0, h * 0.63, 0, h); road.addColorStop(0, '#a4a795'); road.addColorStop(1, '#c3bea1');
    c.fillStyle = road; c.beginPath(); c.moveTo(0, h * 0.69); c.lineTo(w, h * 0.62); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.strokeStyle = '#d1cdb1'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h * 0.7); c.lineTo(w, h * 0.635); c.stroke();
    c.strokeStyle = '#e9ddb0'; c.lineWidth = Math.max(4, h * 0.012); c.setLineDash([45, 37]); c.beginPath(); c.moveTo(0, h * 0.89); c.lineTo(w, h * 0.88); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#929a80'; c.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) { const x = i * 83 % w; c.beginPath(); c.moveTo(x, h * 0.93); c.lineTo(x + 13, h * 0.9); c.lineTo(x + 6, h * 0.875); c.stroke(); }
    c.fillStyle = '#a8ae8b'; for (let i = 0; i < 36; i++) c.fillRect(i * 43 % w, h * 0.7 + i * 17 % (h * 0.27), 2, 1);
    for (let i = 0; i < 20; i++) {
      const x = i * 71 % w, y = h * 0.64 + Math.sin(i * 2.8) * 9;
      c.strokeStyle = '#647d4d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 5); c.lineTo(x - 4, y - 5); c.moveTo(x, y + 5); c.lineTo(x + 5, y - 8); c.stroke();
      if (i % 3 === 0) { c.fillStyle = '#eed7a2'; c.beginPath(); c.arc(x + 5, y - 8, 2.4, 0, Math.PI * 2); c.fill(); }
    }
    if (stage === 2) {
      c.strokeStyle = '#647b6c'; c.lineWidth = 3.5;
      for (let i = 0; i < 12; i++) { if (i === 5 || i === 6) continue; const rx = i * w / 11; c.beginPath(); c.moveTo(rx, h * 0.665); c.lineTo(rx, h * 0.585); c.stroke(); }
      c.strokeStyle = '#c4cbb0'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, h * 0.58); c.lineTo(w * 0.37, h * 0.58); c.lineTo(w * 0.43, h * 0.64); c.moveTo(w * 0.62, h * 0.60); c.lineTo(w * 0.69, h * 0.58); c.lineTo(w, h * 0.58); c.stroke();
    } else if (stage === 3) {
      const bx = w * 0.78, by = h * 0.66;
      c.strokeStyle = '#736e54'; c.lineWidth = 4; c.beginPath(); c.moveTo(bx - 25, by + 5); c.lineTo(bx - 17, by - 26); c.moveTo(bx + 25, by + 5); c.lineTo(bx + 17, by - 26); c.stroke();
      this.round(c, bx - 34, by - 27, 68, 18, 3, '#d6be82', '#9b9c70', 1.5);
      c.fillStyle = '#777d61'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(bx - 29 + i * 16, by - 26); c.lineTo(bx - 21 + i * 16, by - 26); c.lineTo(bx - 30 + i * 16, by - 10); c.lineTo(bx - 38 + i * 16, by - 10); c.fill(); }
      c.fillStyle = '#8b9675'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(w * 0.49 + i * 10, h * 0.66 + i % 2 * 3, 7 + i % 3, 4, -0.2, 0, Math.PI * 2); c.fill(); }
    }
    this.tree(c, -12, h * 0.71, stage === 2 ? 0.65 : 1.2, '#3c614e', '#547957');
    this.tree(c, w + 19, h * 0.67, stage === 2 ? 0.6 : 1.1, '#3b604e', '#4e7957');
    c.globalAlpha = 0.6; c.fillStyle = '#f8f0be';
    for (let i = 0; i < 12; i++) { const x = ((i * 127 + t * 8) % (w + 30)) - 15, y = h * 0.26 + (i * 39) % (h * 0.48) + Math.sin(t + i) * 5; c.beginPath(); c.ellipse(x, y, 2.3, 1.3, i, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1;
  }

  private tree(c: CanvasRenderingContext2D, x: number, y: number, scale: number, dark: string, light: string): void {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.fillStyle = '#6e7753'; c.fillRect(-4, -80, 8, 85);
    for (const [cx, cy, radius] of [[0, -113, 34], [-21, -84, 34], [20, -83, 38], [-8, -55, 32]]) {
      c.fillStyle = dark; c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.fill(); c.fillStyle = light; c.beginPath(); c.arc(cx - 5, cy - 8, radius * 0.78, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  private drawEnemy(c: CanvasRenderingContext2D, e: BattleEnemy, w: number, floor: number, scale: number, time: number): void {
    const deadFor = e.defeatedAt === null ? 0 : time - e.defeatedAt;
    if (e.health <= 0 && deadFor > 0.6) return;
    const boss = e.kind === 'boss', moving = e.x > 49 + this.simulation.state.enemies.indexOf(e) * 16;
    const wave = Math.sin(time * (moving ? 8 : 3) + e.id);
    const hurt = e.hurtUntil > time;
    const attacking = e.attackUntil > time;
    const attackTravel = this.reducedMotion ? 8 : Math.max(0, w * e.x / 100 - w * 0.34);
    const x = w * e.x / 100 + (hurt ? 3 : 0) - (attacking ? Math.sin((e.attackUntil - time) / 0.65 * Math.PI) * attackTravel : 0);
    const k = scale * (boss ? 1.35 : 0.85);
    c.save(); c.translate(x, floor - 2); c.scale(k, k);
    if (e.health <= 0) { c.globalAlpha = Math.max(0, 1 - deadFor / 0.6); c.translate(0, -deadFor * 28); c.rotate(-deadFor * 0.8); }
    c.fillStyle = '#344d3929'; c.beginPath(); c.ellipse(0, 2, 26, 7, 0, 0, Math.PI * 2); c.fill();
    c.translate(0, wave * 1.8);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // Boots, overalls, dangling sleeves and oversized expressive moss-green face.
    this.round(c, -18, -17 + wave * 2, 14, 18, 5, '#40544b', '#3c5043', 1.5);
    this.round(c, 5, -17 - wave * 2, 14, 18, 5, '#40544b', '#3c5043', 1.5);
    this.round(c, -21, -52, 42, 41, 11, boss ? '#b69b6a' : e.kind === 'runner' ? '#799b91' : '#88996b', '#47694f', 2);
    c.fillStyle = boss ? '#d6bd80' : '#b4c19b'; c.beginPath(); c.moveTo(-11, -51); c.lineTo(-2, -26); c.lineTo(11, -51); c.fill();
    c.strokeStyle = '#546651'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -32); c.lineTo(0, -12); c.stroke();
    c.strokeStyle = '#648763'; c.lineWidth = 12; c.beginPath(); c.moveTo(-16, -46); c.lineTo(-29, -36 + wave); c.lineTo(attacking ? -51 : -37, attacking ? -51 : -37); c.moveTo(17, -44); c.lineTo(27, -27 - wave); c.stroke();
    c.fillStyle = '#bbce94'; c.beginPath(); c.arc(attacking ? -51 : -37, attacking ? -51 : -37, 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#54764f'; c.lineWidth = 2;
    c.fillStyle = boss ? '#9ab079' : '#b4ca91'; c.beginPath(); c.ellipse(0, -72, 27, 25, -0.08, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#b5cc92'; c.beginPath(); c.ellipse(21, -69, 9, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#78995f'; c.beginPath(); c.moveTo(-26, -81); c.quadraticCurveTo(-17, -105, 1, -97); c.quadraticCurveTo(23, -99, 27, -82); c.lineTo(12, -87); c.lineTo(3, -80); c.lineTo(-8, -89); c.lineTo(-16, -82); c.fill();
    c.fillStyle = '#e5edc6'; c.beginPath(); c.ellipse(-12, -71, 7, 8, 0.1, 0, Math.PI * 2); c.ellipse(9, -69, 6, 7, -0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#354c45'; c.beginPath(); c.ellipse(-15, -70, 2.7, 4.1, 0, 0, Math.PI * 2); c.ellipse(6, -69, 2.7, 3.4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#45603f'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-20, -81); c.lineTo(-6, -77); c.moveTo(4, -77); c.lineTo(16, -81); c.stroke();
    c.fillStyle = '#5c7850'; c.beginPath(); c.ellipse(-3, -57, 8, 5, 0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8e8c7'; c.fillRect(-8, -61, 4, 5); c.fillRect(0, -60, 4, 4);
    c.fillStyle = '#7ca36a'; c.beginPath(); c.ellipse(15, -57, 4, 2.3, -0.4, 0, Math.PI * 2); c.fill();
    if (boss) {
      this.round(c, -27, -107, 52, 16, 7, '#cbb167', '#6c774d', 2);
      c.fillStyle = '#a39d56'; c.fillRect(-32, -94, 61, 5);
      c.fillStyle = '#668c53'; c.beginPath(); c.ellipse(12, -111, 12, 4, -0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f4d488'; c.beginPath(); c.arc(-8, -44, 4, 0, Math.PI * 2); c.fill();
    } else {
      c.strokeStyle = '#628846'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, -94); c.quadraticCurveTo(2, -108, 12, -110); c.stroke();
      c.fillStyle = '#81a363'; c.beginPath(); c.ellipse(13, -108, 9, 4, -0.4, 0, Math.PI * 2); c.fill();
    }
    if (hurt) { c.fillStyle = '#ffedb861'; c.beginPath(); c.ellipse(0, -54, 32, 50, 0, 0, Math.PI * 2); c.fill(); }
    if (e.health > 0) {
      const hpY = boss ? -124 : -121;
      this.round(c, -26, hpY, 52, 5, 2.5, '#334f4666');
      this.round(c, -26, hpY, 52 * e.health / e.maxHealth, 5, 2.5, boss ? '#e4ae73' : '#c6d783');
      if (boss) { c.textAlign = 'center'; c.fillStyle = '#3d5642'; c.font = 'bold 8px "Noto Sans KR Variable", sans-serif'; c.fillText('도로의 파수꾼', 0, hpY - 6); }
    }
    c.restore();
  }

  private drawDog(c: CanvasRenderingContext2D, x: number, y: number, scale: number, time: number): void {
    const s = this.simulation.state, active = s.dogAttackUntil > time;
    const fraction = active ? 1 - (s.dogAttackUntil - time) / 0.9 : 0;
    const leap = active && !this.reducedMotion ? Math.sin(Math.max(0, fraction) * Math.PI) : 0;
    const target = s.enemies.find(enemy => enemy.health > 0);
    const dx = target ? Math.max(0, this.width * target.x / 100 - x - 24) : 50;
    c.save(); c.translate(x + dx * leap, y - leap * 23); c.scale(scale, scale);
    c.fillStyle = '#344b3927'; c.beginPath(); c.ellipse(0, 1 + leap * 15, 25, 5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#c3905d'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-18, -20); c.quadraticCurveTo(-37, -40 + Math.sin(time * 12) * 5, -24, -43); c.stroke();
    this.round(c, -18, -30, 38, 24, 11, '#dca86d', '#ab794f', 1.5);
    for (let i = 0; i < 4; i++) this.round(c, -14 + i * 9, -11, 7, 13 - (i % 2 ? leap * 5 : 0), 3, '#bc8855');
    c.fillStyle = '#e9bb80'; c.beginPath(); c.ellipse(17, -34, 18, 18, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c5925c'; c.beginPath(); c.moveTo(2, -42); c.lineTo(3, -61); c.lineTo(16, -49); c.moveTo(19, -49); c.lineTo(29, -62); c.lineTo(31, -41); c.fill();
    c.fillStyle = '#f2d3a6'; c.beginPath(); c.moveTo(5, -46); c.lineTo(6, -56); c.lineTo(12, -48); c.moveTo(23, -48); c.lineTo(27, -56); c.lineTo(27, -44); c.fill();
    c.fillStyle = '#fff0cf'; c.beginPath(); c.ellipse(21, -26, 15, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#424941'; c.beginPath(); c.ellipse(12, -36, 2.1, 3.2, 0, 0, Math.PI * 2); c.ellipse(25, -37, 2.1, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(20, -30); c.lineTo(26, -30); c.lineTo(23, -26); c.fill();
    c.strokeStyle = '#59614c'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(23, -26); c.quadraticCurveTo(22, -20, 17, -23); c.stroke();
    c.strokeStyle = '#5b9c84'; c.lineWidth = 5; c.beginPath(); c.moveTo(2, -20); c.lineTo(22, -18); c.stroke();
    c.fillStyle = '#edc869'; c.beginPath(); c.arc(17, -16, 3.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  private drawEffects(c: CanvasRenderingContext2D, w: number, floor: number, heroX: number, scale: number): void {
    const s = this.simulation.state;
    for (const event of s.events) {
      const elapsed = s.time - event.at;
      const x = event.target === 'hero' ? heroX : w * event.x / 100;
      if (event.kind === 'damage' || event.kind === 'heal') {
        if (elapsed > 1.1) continue;
        c.save(); c.globalAlpha = Math.min(1, (1.1 - elapsed) * 2.4);
        c.textAlign = 'center'; c.font = `800 ${event.target === 'hero' ? 20 : 18}px "DM Sans Variable", sans-serif`;
        c.lineWidth = 4; c.strokeStyle = '#fffcdf';
        const label = `${event.kind === 'heal' ? '+' : '−'}${Math.ceil(event.amount)}`, y = floor - 113 * scale - elapsed * 32;
        c.strokeText(label, x + event.id % 3 * 7, y); c.fillStyle = event.kind === 'heal' ? '#477c4d' : event.target === 'hero' ? '#ad5848' : '#8c7145'; c.fillText(label, x + event.id % 3 * 7, y);
        if (event.kind === 'heal') { c.fillStyle = '#daf4b1'; for (let i = 0; i < 5; i++) { const px = heroX - 27 + i * 12, py = floor - 13 - elapsed * 80 - i % 2 * 25; c.fillRect(px - 2, py - 6, 4, 12); c.fillRect(px - 6, py - 2, 12, 4); } }
        c.restore();
      } else if (event.kind === 'attack' && elapsed < 0.45) {
        const p = elapsed / 0.45;
        c.save(); c.translate(heroX + 20 + (x - heroX - 20) * p, floor - 52 * scale - Math.sin(p * Math.PI) * 16);
        c.strokeStyle = '#fff1b7'; c.lineWidth = 5; c.shadowColor = '#fff7cc'; c.shadowBlur = 13;
        c.beginPath(); c.moveTo(-19, 7); c.lineTo(11, -3); c.stroke(); c.lineWidth = 2; c.strokeStyle = '#679484'; c.stroke(); c.restore();
      } else if ((event.kind === 'sweep' || event.kind === 'dash') && elapsed < 0.75) {
        c.save(); c.globalAlpha = 1 - elapsed / 0.75;
        c.strokeStyle = event.kind === 'sweep' ? '#f7eec0' : '#d9e9bb'; c.lineWidth = event.kind === 'sweep' ? 9 : 5;
        c.shadowColor = '#e5fabc'; c.shadowBlur = 12;
        c.beginPath(); c.ellipse(x, floor - 52, 31 + elapsed * 90, 54, -0.6, -1.8, 1.6); c.stroke();
        for (let i = 0; i < 7; i++) { c.fillStyle = '#f5e6a2'; c.beginPath(); c.arc(x + Math.cos(i) * elapsed * 120, floor - 52 + Math.sin(i) * elapsed * 90, 2.8, 0, Math.PI * 2); c.fill(); }
        c.restore();
      } else if (event.kind === 'defeat' && elapsed < 0.6) {
        c.save(); c.globalAlpha = 1 - elapsed / 0.6; c.fillStyle = '#e8edbc';
        for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + Math.cos(i) * elapsed * 60, floor - 50 + Math.sin(i) * elapsed * 55, 3 + i % 3, 0, Math.PI * 2); c.fill(); } c.restore();

      }
    }
  }

  private round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, line = 1): void {
    if (w <= 0 || h <= 0) return;
    c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = line; c.stroke(); }
  }
}
