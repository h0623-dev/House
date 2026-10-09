import { BattleSimulation, SKILL_COOLDOWNS, STAGE_NAMES, type BattleEnemy, type BattleResult, type BattleSkill } from './battle';
import { realDuration } from './game-speed';
import { drawHero } from './actors';
import { drawPet, drawZombie } from './creatures';
import { drawBattleLandscape } from './battle-art';
import { icon, portrait } from './icons';
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
  { id: 'sweep', symbol: icon('sweep'), label: '바람 가르기', description: '모든 적 공격', key: '1' },
  { id: 'dash', symbol: icon('dash'), label: '보리 돌진', description: '집중 공격 · 저지', key: '2' },
  { id: 'heal', symbol: icon('heal'), label: '초록빛 회복', description: '체력 29 회복', key: '3' },
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
        <div class="battle-progress"><span data-battle-wave>WAVE 1 / 3</span><div class="battle-wave-dots"><i></i><i></i><i></i></div><strong data-battle-time>0초</strong></div>
        <section class="battle-arena" aria-label="생존자와 보리가 좀비를 상대하는 전투 화면">
          <canvas aria-label="캐릭터가 자동 공격합니다. 아래 세 가지 기술을 눌러 전투를 도와주세요."></canvas>
          <div class="battle-location"><span>SEOUL OUTSKIRTS · 2187</span><b>도로에 다시, 작은 평화를.</b></div>
          <div class="battle-wave-banner" aria-live="polite"><small>새로운 만남</small><strong>WAVE 01</strong></div>
          <div class="battle-boss-label" hidden>⚠ 도로의 파수꾼 등장</div>
          <div class="battle-pause-layer" hidden><strong>잠시 숨을 고르는 중</strong><span>준비되면 다시 함께 달려요.</span><button data-battle="resume">전투 계속하기</button></div>
          <div class="battle-retreat-layer" hidden><div><span class="battle-dialog-kicker">BACK TO OUR HOME</span><h3>트럭으로 돌아갈까요?</h3><p>승리 보상은 받지 못해요.<br>사용한 기력과 현재 체력은 유지돼요.</p><button data-battle="cancel-retreat">계속 싸우기</button><button class="battle-secondary" data-battle="confirm-retreat">트럭으로 돌아가기</button></div></div>
        </section>
        <footer class="battle-command-panel">
          <div class="battle-party"><div class="battle-party-symbol">${portrait(options.gender)}</div><div class="battle-party-info"><div><strong>${clean(options.name)}</strong><span>Lv.${s.level} <i>＋ 보리</i></span><b data-battle-health-label>${Math.ceil(s.health)} / 100</b></div><div class="battle-health-track" role="progressbar" aria-label="생존자 체력" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.ceil(s.health)}"><i></i></div></div><button class="battle-auto" data-battle="auto" aria-pressed="false"><span>AUTO</span><b>OFF</b></button></div>
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
    this.root.querySelector('[data-battle-time]')!.textContent = `${Math.floor(realDuration(s.time))}초`;
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
      button.querySelector('.battle-skill-cooldown')!.textContent = remaining > 0 ? `${Math.ceil(realDuration(remaining))}초` : skill.id === 'heal' && s.health >= 100 ? '체력 가득' : 'READY';
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
    layer.innerHTML = `<div class="battle-result-card ${victory ? 'victory' : ''}"><div class="battle-result-emblem">${icon(victory ? 'sparkle' : result.outcome === 'retreat' ? 'home' : 'heart')}</div><span class="battle-dialog-kicker">${victory ? 'A LITTLE VICTORY' : 'WE GO HOME TOGETHER'}</span><h2>${victory ? '오늘도, 함께 해냈어요!' : result.outcome === 'retreat' ? '우리집으로 돌아가요' : '괜찮아요, 다음이 있으니까'}</h2><p>${victory ? '길을 지키던 좀비들을 물리쳤어요.<br>보리와 전리품을 챙겨 트럭으로 돌아가요.' : '보리가 곁을 지켜주었어요.<br>트럭에서 쉬고 다시 도전할 수 있어요.'}</p><div class="battle-result-stats"><div><b>${result.enemiesDefeated}</b><span>물리친 좀비</span></div><div><b>${result.duration}<small>초</small></b><span>함께한 시간</span></div><div><b>${result.remainingHealth}</b><span>남은 체력</span></div></div>${victory ? `<div class="battle-loot"><span>${icon('food')} 식량 +${6 + result.stage * 2}</span><span>${icon('wood')} 목재 +2</span><span>${icon('scrap')} 고철 +${result.stage * 2}</span><span>${icon('sparkle')} 경험치 +${20 + result.stage * 10}</span></div>` : '<div class="battle-result-note">이번에는 전리품이 없어요. 휴식 후 다시 만나요.</div>'}<button data-battle="finish">전리품 챙기고 우리집으로 <span>→</span></button></div>`;
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
    // Give the road more breathing room while keeping the party and infected
    // on the same scale and their feet anchored to the painted ground.
    const actorScale = Math.max(0.92, Math.min(1.5, Math.min(w / 350, h / 360))) * .8;
    const heroX = w * 0.235;
    const attacking = s.heroAttackUntil > s.time;
    const skill = s.heroSkillUntil > s.time;
    const hurt = s.heroHurtUntil > s.time;
    const transition = s.transition > 0;
    const attackProgress = 1 - (s.heroAttackUntil - s.time) / 0.52;
    const lunge = attacking && !this.reducedMotion ? Math.sin(attackProgress * Math.PI) * 19 : 0;
    if (skill) {
      c.save(); c.globalAlpha = 0.35 + Math.sin(s.time * 15) * 0.07;
      const aura = c.createRadialGradient(heroX, floor - 54 * actorScale, 3,
        heroX, floor - 54 * actorScale, 72 * actorScale);
      aura.addColorStop(0, '#f5ecc981'); aura.addColorStop(.52, '#afd8a542');
      aura.addColorStop(1, '#a8c99200'); c.fillStyle = aura;
      c.fillRect(heroX - 76 * actorScale, floor - 137 * actorScale, 152 * actorScale, 145 * actorScale); c.restore();
    }
    drawHero(c, { x: heroX + lunge, y: floor, scale: actorScale, time: s.time, gender: this.options.gender,
      pose: s.result?.outcome === 'victory' ? 'celebrate' : hurt ? 'hurt' : skill ? 'skill' : attacking ? 'attack' : transition ? 'walk' : 'idle',
      facing: 1, ...(attacking ? { progress: attackProgress } : {}) });
    this.drawDog(c, heroX + 34 * actorScale, floor + 18, actorScale * 0.93, s.time);
    // The rear lanes paint first, so the leading enemy retains its face,
    // weapon and feet when the incoming party briefly overlaps on a phone.
    for (const enemy of [...s.enemies].reverse()) this.drawEnemy(c, enemy, w, floor, actorScale, s.time);
    this.drawEffects(c, w, floor, heroX, actorScale);
    c.restore();
  }

  private drawLandscape(c: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    drawBattleLandscape(c, w, h, this.simulation.state.stage, t, this.reducedMotion);
  }

  private drawEnemy(c: CanvasRenderingContext2D, e: BattleEnemy, w: number, floor: number, scale: number, time: number): void {
    const deadFor = e.defeatedAt === null ? 0 : time - e.defeatedAt;
    if (e.health <= 0 && deadFor > 0.6) return;
    const boss = e.kind === 'boss';
    const index = this.simulation.state.enemies.indexOf(e);
    const moving = e.x > 49 + index * 16;
    const hurt = e.hurtUntil > time, attacking = e.attackUntil > time;
    const attackPhase = Math.max(0, Math.min(1, 1 - (e.attackUntil - time) / .65));
    const travel = this.reducedMotion ? 8 : Math.max(0, w * e.x / 100 - w * .34);
    const x = w * e.x / 100 - (attacking ? Math.sin(attackPhase * Math.PI) * travel : 0);
    const k = scale * (boss ? 1.03 : .91);
    const feet = floor - 2 - index * 9;
    drawZombie(c, { x, y: feet, scale: k, time, kind: e.kind === 'moss' ? 'walker' : e.kind,
      facing: -1, pose: e.health <= 0 ? 'defeat' : hurt ? 'hurt' : attacking ? 'attack' : moving ? 'walk' : 'idle',
      ...(e.health <= 0 ? { progress: deadFor / .6 } : attacking ? { progress: attackPhase } : {}) });
    if (e.health <= 0) return;
    const hpY = feet - (boss ? 169 : 145) * k;
    const hpWidth = (boss ? 65 : 47) * k;
    c.save();
    c.shadowColor = '#16251c80'; c.shadowBlur = 5;
    this.round(c, x - hpWidth / 2 - 1, hpY - 1, hpWidth + 2, 7, 3,
      '#233829cf', '#e8d7a494', .8);
    c.shadowBlur = 0;
    const hp = c.createLinearGradient(x - hpWidth / 2, 0, x + hpWidth / 2, 0);
    hp.addColorStop(0, boss ? '#b7784d' : '#86a264');
    hp.addColorStop(1, boss ? '#f3d085' : '#d9e9a4');
    c.fillStyle = hp;
    c.beginPath(); c.roundRect(x - hpWidth / 2, hpY, hpWidth * e.health / e.maxHealth, 5, 2.5); c.fill();
    c.fillStyle = '#fffce46b'; c.fillRect(x - hpWidth / 2 + 2, hpY + 1,
      Math.max(0, hpWidth * e.health / e.maxHealth - 4), .8);
    if (boss) {
      c.textAlign = 'center'; c.font = '600 9px "Noto Sans KR Variable", sans-serif';
      c.lineWidth = 3; c.strokeStyle = '#293d2c'; c.strokeText('도로의 파수꾼', x, hpY - 9);
      c.fillStyle = '#ffe9b3'; c.fillText('도로의 파수꾼', x, hpY - 9);
    }
    c.restore();
  }

  private drawDog(c: CanvasRenderingContext2D, x: number, y: number, scale: number, time: number): void {
    const s = this.simulation.state, active = s.dogAttackUntil > time;
    const fraction = active ? 1 - (s.dogAttackUntil - time) / .9 : 0;
    const leap = active && !this.reducedMotion ? Math.sin(Math.max(0, fraction) * Math.PI) : 0;
    const target = s.enemies.find(enemy => enemy.health > 0);
    const dx = target ? Math.max(0, this.width * target.x / 100 - x - 24) : 50;
    drawPet(c, { x: x + dx * leap, y: y - leap * 12, scale: scale * .91, time, facing: 1,
      pose: s.result?.outcome === 'victory' ? 'celebrate' : active ? 'pounce' : s.transition > 0 ? 'run' : 'idle',
      ...(active ? { progress: fraction } : {}) });
  }

  private drawEffects(c: CanvasRenderingContext2D, w: number, floor: number, heroX: number, scale: number): void {
    const s = this.simulation.state;
    for (const event of s.events) {
      const elapsed = s.time - event.at;
      const x = event.target === 'hero' ? heroX : w * event.x / 100;
      const middle = floor - 63 * scale;
      if (event.kind === 'damage' || event.kind === 'heal') {
        if (elapsed > 1.1) continue;
        c.save(); c.globalAlpha = Math.min(1, (1.1 - elapsed) * 2.4);
        c.textAlign = 'center'; c.font = `800 ${event.target === 'hero' ? 20 : 18}px "DM Sans Variable", sans-serif`;
        c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = '#2d3e2dde';
        c.shadowColor = '#2d3e2d80'; c.shadowBlur = 5;
        const label = `${event.kind === 'heal' ? '+' : '−'}${Math.ceil(event.amount)}`;
        const y = floor - 132 * scale - elapsed * 31;
        c.strokeText(label, x + event.id % 3 * 7, y);
        c.fillStyle = event.kind === 'heal' ? '#c7f0b6' : event.target === 'hero' ? '#ffb49a' : '#ffe2a7';
        c.fillText(label, x + event.id % 3 * 7, y);
        c.shadowBlur = 0;
        if (event.kind === 'heal') {
          c.lineWidth = 1.3; c.strokeStyle = '#c1eeb27a';
          c.beginPath(); c.ellipse(heroX, floor - 3, 38 * scale + elapsed * 8, 10 * scale,
            0, 0, Math.PI * 2); c.stroke();
          for (let i = 0; i < 8; i++) {
            const angle = i * 1.3 + elapsed * 3;
            this.glint(c, heroX + Math.sin(angle) * 34 * scale,
              floor - 8 - elapsed * 91 - i % 3 * 24, 2.4 + i % 2, '#eaf7c4');
          }
        }
        c.restore();
      } else if ((event.kind === 'attack' || event.kind === 'dog') && elapsed < .45) {
        const p = elapsed / .45;
        c.save();
        c.globalAlpha = Math.min(1, (1 - p) * 2.5);
        const projectileX = heroX + 26 + (x - heroX - 26) * p;
        const projectileY = middle - Math.sin(p * Math.PI) * 17;
        const tail = c.createLinearGradient(projectileX - 35, 0, projectileX + 12, 0);
        tail.addColorStop(0, '#e1e6b500'); tail.addColorStop(.6, '#b5d0af70');
        tail.addColorStop(1, '#fff8dbe6');
        c.strokeStyle = tail; c.lineWidth = event.kind === 'dog' ? 3 : 5;
        c.lineCap = 'round'; c.shadowColor = '#fff1bc'; c.shadowBlur = 9;
        c.beginPath(); c.moveTo(projectileX - 34, projectileY + 9);
        c.quadraticCurveTo(projectileX - 5, projectileY + 3, projectileX + 9, projectileY - 5); c.stroke();
        c.shadowBlur = 0; this.glint(c, projectileX + 8, projectileY - 4, 4, '#fff9e0');
        c.restore();
      } else if ((event.kind === 'sweep' || event.kind === 'dash') && elapsed < .75) {
        const phase = elapsed / .75, alpha = 1 - phase;
        c.save(); c.globalAlpha = alpha;
        c.shadowColor = event.kind === 'sweep' ? '#cedeb0' : '#ffe1a5'; c.shadowBlur = 13;
        const stroke = c.createLinearGradient(x - 45, middle + 45, x + 65, middle - 56);
        stroke.addColorStop(0, '#83b99500'); stroke.addColorStop(.44, '#b9d5ba9e');
        stroke.addColorStop(.74, '#fff8d8f2'); stroke.addColorStop(1, '#e5ddaf00');
        c.strokeStyle = stroke; c.lineWidth = event.kind === 'sweep' ? 7 : 4;
        c.lineCap = 'round'; c.beginPath();
        c.ellipse(x, middle, 31 + elapsed * 90, 51 * scale, -.6, -1.8, 1.6); c.stroke();
        c.shadowBlur = 0; c.lineWidth = 1.2; c.strokeStyle = '#f8f0c5a8';
        c.beginPath(); c.ellipse(x + 2, middle, 36 + elapsed * 91, 53 * scale, -.6, -1.7, 1.3); c.stroke();
        if (event.kind === 'dash') {
          c.strokeStyle = '#fff0c59e'; c.lineWidth = 1.5;
          for (let i = 0; i < 4; i++) {
            c.beginPath(); c.moveTo(heroX + 30 + phase * 30, floor - 15 - i * 10);
            c.lineTo(x - 14 - i * 7, floor - 18 - i * 10); c.stroke();
          }
        }
        for (let i = 0; i < 9; i++) {
          this.glint(c, x + Math.cos(i * 1.1) * elapsed * 119,
            middle + Math.sin(i * 1.1) * elapsed * 87, 1.8 + i % 3 * .65,
            i % 2 ? '#cdddbb' : '#fff0b7');
        }
        c.restore();
      } else if (event.kind === 'defeat' && elapsed < .6) {
        c.save(); c.globalAlpha = 1 - elapsed / .6;
        for (let i = 0; i < 8; i++) {
          const px = x + Math.cos(i * 1.2) * elapsed * 58;
          const py = middle + Math.sin(i * 1.2) * elapsed * 51 - elapsed * 16;
          this.glint(c, px, py, 2 + i % 3 * .5, i % 2 ? '#d1dcb6' : '#f9eac2');
        }
        c.restore();
      }
    }
  }

  private glint(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
    c.save(); c.translate(x, y); c.fillStyle = color;
    c.beginPath(); c.moveTo(0, -radius * 1.7); c.quadraticCurveTo(radius * .23, -radius * .23, radius, 0);
    c.quadraticCurveTo(radius * .23, radius * .23, 0, radius * 1.7);
    c.quadraticCurveTo(-radius * .23, radius * .23, -radius, 0);
    c.quadraticCurveTo(-radius * .23, -radius * .23, 0, -radius * 1.7); c.fill(); c.restore();
  }

  private round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, line = 1): void {
    if (w <= 0 || h <= 0) return;
    c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = line; c.stroke(); }
  }
}
