import { BattleSimulation, getBattleEnemyTarget, getBattleSkillAvailability, SKILL_COOLDOWNS, STAGE_NAMES, type BattleAlly, type BattleEnemy, type BattleResult, type BattleSkill } from './battle';
import { realDuration } from './game-speed';
import { type CompanionRoster } from './companions';
import { UNITS, type UnitBattleBonuses, type UnitId, type UnitRoster } from './units';
import { companionArtReady, companionPortrait, drawCompanion, type CompanionPose } from './companion-art';
import { drawZombie } from './creatures';
import { drawBattleLandscape } from './battle-art';
import { icon } from './icons';
import './battle.css';

export type { BattleResult } from './battle';
interface BattleOptions {
  gender: 'female' | 'male';
  name: string;
  level: number;
  health: number;
  stage: number;
  companions?: CompanionRoster;
  units?: UnitRoster;
  teamIds?: UnitId[];
  bonuses?: UnitBattleBonuses;
  onFinish: (result: BattleResult) => void;
}
interface SkillButton { id: BattleSkill; symbol: string; label: string; description: string; owner: string; ownerId?: UnitId; key: string }
function teamSkills(teamIds: UnitId[]): SkillButton[] {
  // Keep the original dog/cat key order while every new team uses its actual members.
  const ordered = teamIds.length === 2 && teamIds.includes('dog') && teamIds.includes('cat') ? ['cat', 'dog'] as UnitId[] : teamIds;
  const skills = ordered.map(id => {
    const unit = UNITS[id];
    const symbol = { dash: 'dash', sweep: 'sweep', mend: 'heal', volley: 'hunt', fortify: 'shield', burst: 'sparkle' }[unit.skillId];
    return { id: unit.skillId as BattleSkill, symbol: icon(symbol), label: unit.skillLabel, description: unit.skillDescription, owner: unit.name, ownerId: id, key: '' } as SkillButton;
  });
  if (skills.length < 3) skills.push({ id: 'heal', symbol: icon('heal'), label: '함께 회복', description: '생존 아군 +29', owner: '회복 보급', key: '' });
  return skills.map((skill, index) => ({ ...skill, key: String(index + 1) }));
}
const clean = (s: string): string => s.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const HEALTH_COLORS: Record<UnitId, string> = { dog: '#e9c987', cat: '#becbe9', rabbit: '#c1dda3', fox: '#edb985', boar: '#d8c49c', owl: '#cdbde9' };

/** Owns a single modal battle and releases every listener on destroy. */
export class BattleView {
  readonly simulation: BattleSimulation;
  private readonly options: BattleOptions;
  private readonly skills: SkillButton[];
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
    const s = this.simulation.state;
    this.skills = teamSkills(s.teamIds);
    const teamNames = s.teamIds.map(id => s.allies[id].name).join(' · ');
    const bonusLabels: string[] = [];
    if (s.bonuses.attackMultiplier > 1) bonusLabels.push(`동료 공격 +${Math.round((s.bonuses.attackMultiplier - 1) * 100)}%`);
    if (s.bonuses.enemyDamageMultiplier < 1) bonusLabels.push(`받는 피해 −${Math.round((1 - s.bonuses.enemyDamageMultiplier) * 100)}%`);
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    this.app = document.querySelector('#app');
    this.appWasInert = this.app?.inert ?? false;
    if (this.app) this.app.inert = true;
    document.body.style.overflow = 'hidden';
    this.root = document.createElement('div');
    this.root.className = 'battle-screen';
    this.root.dataset.teamSize = String(s.teamIds.length);
    this.root.style.setProperty('--party-size', String(s.teamIds.length));
    this.root.style.setProperty('--skill-count', String(this.skills.length));
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', `${teamNames}의 동물 팀 전투`);
    this.root.innerHTML = `
      <div class="battle-shell">
        <header class="battle-topbar">
          <button class="battle-circle" data-battle="retreat" aria-label="전투에서 돌아가기">‹</button>
          <div class="battle-heading"><span>EXPEDITION ${String(s.stage).padStart(2, '0')}</span><h2>${STAGE_NAMES[s.stage - 1]}</h2></div>
          <button class="battle-circle" data-battle="pause" aria-label="전투 일시정지">Ⅱ</button>
        </header>
        <div class="battle-progress"><span data-battle-wave>WAVE 1 / 3</span><div class="battle-wave-dots"><i></i><i></i><i></i></div><strong data-battle-time>0초</strong></div>
        <section class="battle-arena" aria-label="${teamNames}가 좀비를 상대하는 전투 화면">
          <canvas aria-label="${teamNames}가 자동으로 공격합니다. 아래 동물별 기술을 눌러 도와주세요."></canvas>
          <div class="battle-location"><span>ANIMAL EXPEDITION · 2187</span><b>${teamNames}가 우리집을 지켜요.</b></div>
          <div class="battle-wave-banner" aria-live="polite"><small>새로운 만남</small><strong>WAVE 01</strong></div>
          <div class="battle-boss-label" hidden>⚠ 도로의 파수꾼 등장</div>
          <div class="battle-pause-layer" hidden><strong>잠시 숨을 고르는 중</strong><span>준비되면 다시 함께 달려요.</span><button data-battle="resume">전투 계속하기</button></div>
          <div class="battle-retreat-layer" hidden><div><span class="battle-dialog-kicker">BACK TO OUR HOME</span><h3>친구들과 돌아갈까요?</h3><p>승리 보상은 받지 못해요.<br>출전한 동료의 현재 체력은 유지돼요.</p><button data-battle="cancel-retreat">계속 싸우기</button><button class="battle-secondary" data-battle="confirm-retreat">트럭으로 돌아가기</button></div></div>
        </section>
        <footer class="battle-command-panel">
          <div class="battle-party"><div class="battle-roster">${s.teamIds.map(id => {
            const ally = s.allies[id];
            return `<div class="battle-ally" data-battle-ally="${id}" aria-label="${ally.name}, ${UNITS[id].roleLabel}, 레벨 ${ally.level}"><div class="battle-ally-portrait">${companionPortrait(id)}</div><div class="battle-ally-info"><div class="battle-ally-name"><strong>${clean(ally.name)}</strong><span>Lv.${ally.level}</span></div><small>${UNITS[id].roleLabel}</small><div class="battle-ally-health-row"><b data-battle-ally-health="${id}">${Math.ceil(ally.health)} / ${ally.maxHealth}</b><span data-battle-ally-status="${id}"></span></div><div class="battle-ally-track" data-battle-ally-track="${id}" role="progressbar" aria-label="${ally.name} 체력" aria-valuemin="0" aria-valuemax="${ally.maxHealth}" aria-valuenow="${Math.ceil(ally.health)}"><i></i></div></div></div>`;
          }).join('')}</div><button class="battle-auto" data-battle="auto" aria-label="동물 기술 자동 사용" aria-pressed="false"><span>AUTO</span><b>OFF</b></button></div>
          <div class="battle-team-health"><span>동물 팀 체력</span><div class="battle-health-track" role="progressbar" aria-label="동물 팀 체력" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.ceil(s.health)}"><i></i></div><b data-battle-health-label>${Math.ceil(s.health)} / 100</b></div>
          <div class="battle-skills">${this.skills.map(skill => `<button class="battle-skill battle-skill-${skill.id}" data-skill="${skill.id}" data-skill-owner="${skill.ownerId ?? 'supplies'}" aria-label="${skill.owner}: ${skill.label}, ${skill.description}"><span class="battle-skill-owner">${skill.owner}</span><span class="battle-skill-art">${skill.symbol}</span><span class="battle-skill-text"><strong>${skill.label}</strong><small>${skill.description}</small></span><span class="battle-skill-cooldown"></span><kbd>${skill.key}</kbd></button>`).join('')}</div>
          <p class="battle-help"><span class="battle-live-dot"></span><span data-battle-bonuses>${bonusLabels.length ? bonusLabels.join(' · ') : '기본 공격은 자동 · 동료의 기술로 함께 싸워요'}</span></p>
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
    if (!event.repeat && ['1', '2', '3'].includes(event.key)) {
      const skill = this.skills[Number(event.key) - 1];
      if (skill) this.simulation.useSkill(skill.id);
      this.renderHUD();
    }
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
          this.options.onFinish({ ...result, companionHealth: { ...result.companionHealth },
            ...(result.reserveHealth ? { reserveHealth: { ...result.reserveHealth } } : {}) });
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
    for (const id of s.teamIds) {
      const ally = s.allies[id], percent = ally.health / ally.maxHealth * 100;
      const card = this.root.querySelector<HTMLElement>(`[data-battle-ally="${id}"]`)!;
      card.classList.toggle('down', ally.health <= 0);
      card.classList.toggle('guarding', ally.guardUntil > s.time);
      this.root.querySelector(`[data-battle-ally-health="${id}"]`)!.textContent = `${Math.ceil(ally.health)} / ${ally.maxHealth}`;
      this.root.querySelector(`[data-battle-ally-status="${id}"]`)!.textContent = ally.health <= 0 ? '쉼' : ally.tauntUntil > s.time ? '도발' : ally.guardUntil > s.time ? '보호' : '';
      const track = this.root.querySelector<HTMLElement>(`[data-battle-ally-track="${id}"]`)!;
      track.setAttribute('aria-valuenow', String(Math.ceil(ally.health)));
      track.classList.toggle('low', percent < 30);
      track.querySelector<HTMLElement>('i')!.style.width = `${percent}%`;
    }
    const auto = this.root.querySelector<HTMLButtonElement>('[data-battle="auto"]')!;
    auto.setAttribute('aria-pressed', String(s.auto));
    auto.querySelector('b')!.textContent = s.auto ? 'ON' : 'OFF';
    for (const skill of this.skills) {
      const button = this.root.querySelector<HTMLButtonElement>(`[data-skill="${skill.id}"]`)!;
      const remaining = s.cooldowns[skill.id];
      const availability = getBattleSkillAvailability(s, skill.id);
      button.disabled = !availability.available;
      button.dataset.unavailableReason = availability.reason;
      button.style.setProperty('--cooldown', `${remaining / SKILL_COOLDOWNS[skill.id] * 100}%`);
      const ownerDown = skill.ownerId ? s.allies[skill.ownerId].health <= 0 : false;
      const label = ownerDown ? `${skill.owner} 쉬는 중` : remaining > 0 ? `${Math.ceil(realDuration(remaining))}초`
        : availability.reason === 'full' ? '체력 가득' : availability.reason === 'paused' ? '일시정지'
        : availability.reason === 'transition' || availability.reason === 'no-targets' ? '준비 중'
        : availability.reason === 'finished' || availability.reason === 'down' ? '쉬는 중' : '사용 가능';
      button.querySelector('.battle-skill-cooldown')!.textContent = label;
    }
    const banner = this.root.querySelector<HTMLElement>('.battle-wave-banner')!;
    banner.classList.toggle('visible', s.transition > 0 && !s.result);
    if (banner.dataset.wave !== String(s.wave)) {
      banner.dataset.wave = String(s.wave);
      banner.querySelector('small')!.textContent = s.wave === 3 ? '마지막 도전 · 우리집을 함께 지켜요' : s.wave === 1 ? '동물 친구들의 작은 모험' : '조금만 더, 함께 달려요';
      banner.querySelector('strong')!.textContent = s.wave === 3 ? 'BOSS WAVE' : `WAVE 0${s.wave}`;
    }
    this.root.querySelector<HTMLElement>('.battle-boss-label')!.hidden = s.wave !== 3 || s.transition > 0 || !!s.result;
  }

  private showResult(): void {
    this.resultShown = true;
    const s = this.simulation.state, result = s.result!;
    const victory = result.outcome === 'victory';
    const layer = this.root.querySelector<HTMLElement>('.battle-result-layer')!;
    layer.hidden = false;
    const animals = s.teamIds.map(id => {
      const ally = s.allies[id];
      return `<div class="battle-result-ally ${ally.health <= 0 ? 'down' : ''}" data-battle-result-ally="${id}"><span>${companionPortrait(id)}</span><div><strong>${clean(ally.name)}</strong><small>${ally.health <= 0 ? '트럭에서 푹 쉬어요' : `${Math.ceil(ally.health)} / ${ally.maxHealth} HP`}</small></div></div>`;
    }).join('');
    layer.innerHTML = `<div class="battle-result-card ${victory ? 'victory' : ''}"><div class="battle-result-emblem">${icon(victory ? 'sparkle' : result.outcome === 'retreat' ? 'home' : 'heart')}</div><span class="battle-dialog-kicker">${victory ? 'A LITTLE VICTORY' : 'WE GO HOME TOGETHER'}</span><h2>${victory ? '오늘도, 함께 해냈어요!' : result.outcome === 'retreat' ? '친구들과 우리집으로' : '우리 친구들, 잠시 쉬어요'}</h2><p>${victory ? '좀비들을 물리치고 우리집을 지켰어요.<br>동물 친구들과 함께 트럭으로 돌아가요.' : '출전한 친구들이 열심히 싸워주었어요.<br>트럭에서 쉬고 다시 도전할 수 있어요.'}</p><div class="battle-result-roster">${animals}</div><div class="battle-result-stats"><div><b>${result.enemiesDefeated}</b><span>물리친 좀비</span></div><div><b>${result.duration}<small>초</small></b><span>함께한 시간</span></div><div><b>${result.remainingHealth}<small>%</small></b><span>동물 팀 체력</span></div></div>${victory ? `<div class="battle-loot"><span>${icon('food')} 식량 +${6 + result.stage * 2}</span><span>${icon('wood')} 목재 +2</span><span>${icon('scrap')} 고철 +${result.stage * 2}</span><span>${icon('sparkle')} 경험치 +${20 + result.stage * 10}</span></div>` : '<div class="battle-result-note">이번에는 전리품이 없어요. 휴식 후 다시 만나요.</div>'}<button data-battle="finish">전리품 챙기고 우리집으로 <span>→</span></button></div>`;
    if (!victory) layer.querySelector('button')!.innerHTML = '트럭 위 우리집으로 <span>→</span>';
    else layer.querySelector('.battle-loot')!.insertAdjacentHTML('beforeend', `<span class="battle-loot-companions">${icon('paw')} 출전 동료 경험치 +${20 + (result.stage - 1) * 5}<small>출전한 동료에게 각각 지급</small></span>`);
    this.root.querySelector('.battle-topbar')?.setAttribute('inert', '');
    this.root.querySelector('.battle-command-panel')?.setAttribute('inert', '');
    layer.querySelector<HTMLButtonElement>('button')!.focus();
  }

  private draw(): void {
    const c = this.ctx, w = this.width, h = this.height, s = this.simulation.state;
    if (!w || !h) return;
    c.clearRect(0, 0, w, h);
    c.save();
    this.drawLandscape(c, w, h, s.time);
    const floor = h * 0.77;
    const actorScale = Math.max(0.92, Math.min(1.5, Math.min(w / 350, h / 360))) * .8;
    for (const enemy of [...s.enemies].reverse()) this.drawEnemy(c, enemy, w, floor, actorScale, s.time);
    const animalScale = s.teamIds.length === 3 ? Math.max(.84, actorScale * 1.05) : Math.max(.92, actorScale * 1.1);
    const actors = [...s.teamIds].sort((a, b) => s.allies[a].x - s.allies[b].x).map(id => this.drawAlly(c, s.allies[id], floor, animalScale));
    this.drawEffects(c, w, floor, animalScale);
    c.restore();
    // Read-only rendered-frame evidence for mobile playtests and accessibility tooling.
    this.canvas.dataset.battleActors = JSON.stringify(actors);
    this.canvas.dataset.battleTeam = JSON.stringify(s.teamIds);
    this.canvas.dataset.battleBonuses = JSON.stringify(s.bonuses);
    this.canvas.dataset.battleEvents = JSON.stringify(s.events.map(event => ({
      ...event, owner: event.actor ?? (typeof event.target === 'string' ? event.target : null),
      value: event.amount, time: event.at,
    })));
    this.canvas.dataset.battleEnemies = JSON.stringify(s.enemies.map(enemy => ({
      id: enemy.id, kind: enemy.kind, x: enemy.x, health: enemy.health, maxHealth: enemy.maxHealth,
      slowUntil: enemy.slowUntil, attackTarget: enemy.attackTarget, attackUntil: enemy.attackUntil,
    })));
    this.canvas.dataset.battleTime = String(realDuration(s.time));
    this.canvas.dataset.battlePaused = String(s.paused);
    this.canvas.dataset.battleArtReady = String(companionArtReady());
    this.root.dataset.battleOutcome = s.result?.outcome ?? 'active';
  }

  private drawLandscape(c: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    drawBattleLandscape(c, w, h, this.simulation.state.stage, t, this.reducedMotion);
  }

  private allyFloor(id: UnitId, floor: number): number {
    const s = this.simulation.state;
    if (s.teamIds.length < 3) return floor;
    const row = [...s.teamIds].sort((a, b) => s.allies[a].x - s.allies[b].x).indexOf(id);
    // The three companions stand in separate road lanes, with shadows at their soles.
    return floor - (s.teamIds.length - 1 - Math.max(0, row)) * 12;
  }

  private drawEnemy(c: CanvasRenderingContext2D, e: BattleEnemy, w: number, floor: number, scale: number, time: number): void {
    const deadFor = e.defeatedAt === null ? 0 : time - e.defeatedAt;
    if (e.health <= 0 && deadFor > 0.6) return;
    const boss = e.kind === 'boss';
    const s = this.simulation.state, index = s.enemies.indexOf(e);
    const contactTarget = getBattleEnemyTarget(s, e);
    const moving = contactTarget ? e.x > contactTarget.x + 14 + index * 6 : false;
    const hurt = e.hurtUntil > time, attacking = e.attackUntil > time;
    const attackPhase = Math.max(0, Math.min(1, 1 - (e.attackUntil - time) / .65));
    const target = e.attackTarget ? s.allies[e.attackTarget] : contactTarget;
    const travel = this.reducedMotion ? 8 : target ? Math.max(0, w * (e.x - target.x) / 100 - 18 * scale) : 0;
    const x = w * e.x / 100 - (attacking ? Math.sin(attackPhase * Math.PI) * travel : 0);
    const k = scale * (boss ? 1.03 : .91);
    const feet = floor - 2 - index * 9 + (attacking && target && !this.reducedMotion
      ? (this.allyFloor(target.id, floor) - floor) * Math.sin(attackPhase * Math.PI) : 0);
    if (e.slowUntil > time && e.health > 0) {
      c.save(); c.fillStyle = '#c5c5f444'; c.strokeStyle = '#e4ddff9e'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(x, feet - 1, 22 * k, 7 * k, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
    }
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

  private drawAlly(c: CanvasRenderingContext2D, ally: BattleAlly, floor: number, scale: number) {
    const s = this.simulation.state, time = s.time, down = ally.health <= 0;
    const attacking = ally.attackUntil > time, skill = ally.skillUntil > time, hurt = ally.hurtUntil > time;
    const latest = [...s.events].reverse().find(event => event.actor === ally.id &&
      (event.kind === 'attack' || event.kind === 'dog' || event.kind === 'sweep' || event.kind === 'dash' || event.kind === 'volley' || event.kind === 'burst'));
    const latestSkill = [...s.events].reverse().find(event =>
      (event.actor === ally.id && (event.kind === 'sweep' || event.kind === 'dash' || event.kind === 'mend' || event.kind === 'volley' || event.kind === 'fortify' || event.kind === 'burst')) || (event.kind === 'heal' && event.target === ally.id));
    const attackDuration = ally.id === 'cat' ? .52 : .55;
    const skillDuration = latestSkill?.kind === 'dash' ? .9 : .8;
    const attackProgress = clamp(1 - (ally.attackUntil - time) / attackDuration);
    const skillProgress = clamp(1 - (ally.skillUntil - time) / skillDuration);
    const offensiveSkill = skill && latestSkill && ['sweep', 'dash', 'volley', 'burst'].includes(latestSkill.kind) && time - latestSkill.at < skillDuration;
    const activeProgress = down || s.result ? 0 : offensiveSkill ? skillProgress : attacking ? attackProgress : skill ? skillProgress : 0;
    const activeEvent = offensiveSkill ? latestSkill : latest;
    const target = activeEvent && time - activeEvent.at < 1 ? s.enemies.find(enemy => enemy.id === activeEvent.target)
      : s.enemies.find(enemy => enemy.health > 0);
    const melee = ['frontguard', 'fastattack', 'tank'].includes(UNITS[ally.id].role);
    const charging = melee && !down && !s.result && (attacking || offensiveSkill);
    const leap = charging && !this.reducedMotion ? Math.sin(activeProgress * Math.PI) : 0;
    const baseX = this.width * ally.x / 100;
    const distance = target ? Math.max(0, this.width * target.x / 100 - baseX - 26 * scale) : 15;
    const x = baseX + distance * leap;
    const ground = this.allyFloor(ally.id, floor);
    const y = ground - leap * (ally.id === 'cat' ? 17 : 9);
    const pose: CompanionPose = down ? 'down' : s.result ? (s.result.outcome === 'victory' ? 'celebrate' : 'idle')
      : hurt ? 'hurt' : skill ? 'skill' : attacking ? 'attack' : s.transition > 0 ? 'walk' : 'idle';
    if (ally.guardUntil > time && !down && !s.result) {
      c.save(); c.strokeStyle = '#f8d486'; c.fillStyle = '#f5cf7728'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(x, ground - 31 * scale, 33 * scale, 42 * scale, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
    }
    drawCompanion(c, { id: ally.id, x, y, scale, time, facing: 1, pose,
      ...((attacking || skill) && !down ? { progress: activeProgress } : {}) });
    const hpWidth = s.teamIds.length === 3 ? Math.min(43 * scale, this.width * .083) : 43 * scale;
    const hpY = y - 72 * scale;
    c.save(); c.globalAlpha = down ? .65 : 1;
    this.round(c, x - hpWidth / 2 - 1, hpY - 1, hpWidth + 2, 6, 3, '#233829d9', '#ffedbeab', .8);
    const percentage = clamp(ally.health / ally.maxHealth);
    if (percentage > 0) this.round(c, x - hpWidth / 2, hpY, hpWidth * percentage, 4, 2,
      percentage < .3 ? '#eeaa78' : HEALTH_COLORS[ally.id]);
    c.textAlign = 'center'; c.font = `700 ${s.teamIds.length === 3 ? 8 : 9}px "Noto Sans KR Variable", sans-serif`;
    c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = '#293c2ee6';
    const label = `${ally.name}${down ? ' 쉼' : s.teamIds.length < 3 && ally.guardUntil > time ? ' · 보호' : ''}`;
    c.strokeText(label, x, hpY - 6); c.fillStyle = down ? '#e2d5b9' : '#fff5d9'; c.fillText(label, x, hpY - 6);
    c.restore();
    return { id: ally.id, owner: ally.id, name: ally.name, role: UNITS[ally.id].roleLabel,
      level: ally.level, health: ally.health, maxHealth: ally.maxHealth, x, y, baseX, scale, pose,
      guardUntil: ally.guardUntil, tauntUntil: ally.tauntUntil, downAt: ally.downAt,
      time, stage: s.stage, wave: s.wave, progress: activeProgress };
  }

  private drawEffects(c: CanvasRenderingContext2D, w: number, floor: number, scale: number): void {
    const s = this.simulation.state;
    for (const event of s.events) {
      const elapsed = s.time - event.at;
      const petTarget = typeof event.target === 'string';
      const x = petTarget ? w * s.allies[event.target as UnitId].x / 100 : w * event.x / 100;
      const sourceX = event.actor ? w * s.allies[event.actor].x / 100 : x;
      const targetFloor = petTarget ? this.allyFloor(event.target as UnitId, floor) : floor;
      const sourceFloor = event.actor ? this.allyFloor(event.actor, floor) : targetFloor;
      const middle = floor - 53 * scale;
      if (event.kind === 'damage' || event.kind === 'heal') {
        if (elapsed > 1.1) continue;
        c.save(); c.globalAlpha = Math.min(1, (1.1 - elapsed) * 2.4);
        c.textAlign = 'center'; c.font = `800 ${petTarget ? 16 : 18}px "DM Sans Variable", sans-serif`;
        c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = '#2d3e2dde';
        c.shadowColor = '#2d3e2d80'; c.shadowBlur = 5;
        const label = `${event.kind === 'heal' ? '+' : '−'}${Math.ceil(event.amount)}`;
        const y = targetFloor - (petTarget ? 95 : 132) * scale - elapsed * (this.reducedMotion ? 6 : 31);
        c.strokeText(label, x + event.id % 3 * 7, y);
        c.fillStyle = event.kind === 'heal' ? '#c7f0b6' : petTarget ? '#ffb49a' : '#ffe2a7';
        c.fillText(label, x + event.id % 3 * 7, y);
        c.shadowBlur = 0;
        if (event.kind === 'heal') {
          c.lineWidth = 1.3; c.strokeStyle = '#c1eeb27a';
          c.beginPath(); c.ellipse(x, targetFloor - 3, 28 * scale + elapsed * 8, 8 * scale,
            0, 0, Math.PI * 2); c.stroke();
          for (let i = 0; i < 5; i++) {
            const angle = i * 1.3 + elapsed * 3;
            this.glint(c, x + Math.sin(angle) * 23 * scale,
              targetFloor - 8 - elapsed * (this.reducedMotion ? 10 : 71) - i % 3 * 18, 2.4 + i % 2, '#eaf7c4');
          }
        }
        c.restore();
      } else if ((event.kind === 'attack' || event.kind === 'dog') && elapsed < .45) {
        const p = elapsed / .45;
        c.save();
        c.globalAlpha = Math.min(1, (1 - p) * 2.5);
        c.lineCap = 'round'; c.shadowColor = event.actor === 'cat' ? '#e3d6ff' : '#ffe1a4'; c.shadowBlur = 7;
        if (event.actor === 'cat') {
          c.strokeStyle = '#f9edfff0'; c.lineWidth = 2.2;
          for (let i = 0; i < 3; i++) {
            c.beginPath(); c.moveTo(x - 17 + i * 8, middle + 13);
            c.quadraticCurveTo(x - 3 + i * 7, middle - 1, x + 8 + i * 5, middle - 22); c.stroke();
          }
        } else if (event.actor === 'fox' || event.actor === 'owl' || event.actor === 'rabbit') {
          const color = event.actor === 'owl' ? '#d7cbff' : event.actor === 'rabbit' ? '#d6efb6' : '#ffe0a5';
          this.projectile(c, sourceX, sourceFloor - 36 * scale, x - 10, middle, p, color, event.actor === 'fox');
        } else {
          c.strokeStyle = '#ffe1a7dc'; c.lineWidth = 2;
          c.beginPath(); c.ellipse(x - 11, floor - 20 * scale, 12 + p * 16, 8 + p * 12, -.2, -.8, 1.2); c.stroke();
          this.glint(c, x - 8, middle + 9, 5, '#fff1c5');
        }
        c.shadowBlur = 0;
        c.restore();
      } else if ((event.kind === 'sweep' || event.kind === 'dash') && elapsed < .75) {
        const phase = elapsed / .75, alpha = 1 - phase;
        c.save(); c.globalAlpha = alpha;
        c.shadowColor = event.kind === 'sweep' ? '#d8cafa' : '#ffe1a5'; c.shadowBlur = 10;
        c.lineCap = 'round';
        if (event.kind === 'sweep') {
          c.strokeStyle = '#f6eaffdf'; c.lineWidth = 3.2;
          // Nabi's three sweeping claw marks cross every living enemy lane.
          for (const enemy of s.enemies) {
            const clawX = w * enemy.x / 100;
            for (let i = 0; i < 3; i++) {
              c.beginPath(); c.moveTo(clawX - 27 + i * 10, middle + 24);
              c.quadraticCurveTo(clawX - 2 + i * 8, middle - 3, clawX + 15 + i * 5, middle - 34); c.stroke();
            }
          }
        } else {
          c.strokeStyle = '#fff0c5c9'; c.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            c.beginPath(); c.moveTo(sourceX + 13 + phase * 20, floor - 15 - i * 8);
            c.lineTo(x - 14 - i * 4, floor - 17 - i * 8); c.stroke();
          }
          c.strokeStyle = '#ffe2a5'; c.lineWidth = 3;
          c.beginPath(); c.ellipse(x - 11, middle + 9, 21 + phase * 18, 31 * scale, -.2, -1.4, 1.4); c.stroke();
        }
        c.shadowBlur = 0;
        if (!this.reducedMotion) for (let i = 0; i < 5; i++) {
          this.glint(c, x + Math.cos(i * 1.1) * elapsed * 69,
            middle + Math.sin(i * 1.1) * elapsed * 57, 1.8 + i % 3 * .65,
            event.kind === 'sweep' ? '#e8dcff' : '#fff0b7');
        }
        c.restore();
      } else if (event.kind === 'volley' && elapsed < .8) {
        c.save(); c.globalAlpha = clamp((.8 - elapsed) * 2.5);
        for (let shot = 0; shot < 3; shot++) {
          const phase = elapsed / .8 * 1.7 - shot * .17;
          if (phase < 0 || phase > 1) continue;
          this.projectile(c, sourceX, sourceFloor - (37 + shot * 5) * scale,
            x - 7, middle - shot * 5, phase, shot === 1 ? '#fff3c4' : '#ffd299', true);
        }
        c.restore();
      } else if (event.kind === 'burst' && elapsed < .8) {
        const phase = elapsed / .8;
        c.save(); c.globalAlpha = 1 - phase; c.lineWidth = 2.2; c.strokeStyle = '#e2d9ff';
        c.fillStyle = '#c5b8f640'; c.shadowColor = '#beaefa'; c.shadowBlur = 8;
        for (const enemy of s.enemies) {
          const targetX = w * enemy.x / 100;
          c.beginPath(); c.ellipse(targetX, floor - 21 * scale, (22 + phase * 24) * scale, 34 * scale, 0, 0, Math.PI * 2); c.fill(); c.stroke();
          this.glint(c, targetX - 16, middle - 15, 4, '#fff2fa');
          this.glint(c, targetX + 13, middle + 4, 3, '#e2d3ff');
        }
        c.restore();
      } else if ((event.kind === 'mend' || event.kind === 'fortify' || event.kind === 'buff') && elapsed < .8) {
        const phase = elapsed / .8;
        c.save(); c.globalAlpha = 1 - phase;
        const healing = event.actor === 'rabbit';
        c.strokeStyle = healing ? '#d4edbc' : '#ffdaa1'; c.fillStyle = healing ? '#bcdda936' : '#edc77836'; c.lineWidth = 1.8;
        const targetX = event.kind === 'buff' ? x : sourceX;
        const buffMiddle = (event.kind === 'buff' ? targetFloor : sourceFloor) - 53 * scale;
        c.beginPath();
        c.moveTo(targetX, buffMiddle - 22 * scale); c.lineTo(targetX + 16 * scale, buffMiddle - 13 * scale);
        c.quadraticCurveTo(targetX + 17 * scale, buffMiddle + 14 * scale, targetX, buffMiddle + 26 * scale);
        c.quadraticCurveTo(targetX - 17 * scale, buffMiddle + 14 * scale, targetX - 16 * scale, buffMiddle - 13 * scale);
        c.closePath(); c.fill(); c.stroke();
        this.glint(c, targetX, buffMiddle, 4, healing ? '#e7f9cf' : '#ffecbd');
        c.restore();
      } else if (event.kind === 'defeat' && elapsed < .6) {
        c.save(); c.globalAlpha = 1 - elapsed / .6;
        for (let i = 0; i < (petTarget ? 2 : 7); i++) {
          const px = x + Math.cos(i * 1.2) * elapsed * (petTarget ? 14 : 58);
          const py = targetFloor - 53 * scale + Math.sin(i * 1.2) * elapsed * (petTarget ? 10 : 51) - elapsed * 16;
          this.glint(c, px, py, 2 + i % 3 * .5, i % 2 ? '#d1dcb6' : '#f9eac2');
        }
        c.restore();
      }
    }
  }

  private projectile(c: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number,
    phase: number, color: string, arrow: boolean): void {
    const p = clamp(phase);
    const x = fromX + (toX - fromX) * p;
    const y = fromY + (toY - fromY) * p - (this.reducedMotion ? 0 : Math.sin(p * Math.PI) * 12);
    c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = arrow ? 1.7 : 2.3; c.lineCap = 'round';
    c.shadowColor = color; c.shadowBlur = 6;
    c.beginPath(); c.moveTo(x - 14, y + 2); c.lineTo(x + 3, y); c.stroke();
    if (arrow) { c.beginPath(); c.moveTo(x + 7, y); c.lineTo(x, y - 3); c.lineTo(x + 1, y + 3); c.closePath(); c.fill(); }
    else { c.beginPath(); c.arc(x + 3, y, 3.5, 0, Math.PI * 2); c.fill(); }
    c.restore();
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
