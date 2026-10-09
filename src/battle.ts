import { GAME_SPEED_MULTIPLIER, realDuration } from './game-speed';
import { COMPANIONS, COMPANION_IDS, MAX_COMPANION_XP, getCompanionLevel, getCompanionMaxHealth, type CompanionHealth, type CompanionId, type CompanionRoster } from './companions';

/** Small deterministic animal combat engine. No DOM, wall clock or random state. */
export type BattleOutcome = 'victory' | 'defeat' | 'retreat';
export type BattleSkill = 'sweep' | 'dash' | 'heal';
export interface BattleResult {
  outcome: BattleOutcome;
  stage: number;
  /** Remaining team health as a percentage; no survivor damage is implied. */
  remainingHealth: number;
  companionHealth: CompanionHealth;
  enemiesDefeated: number;
  /** Active elapsed real seconds; pauses and hidden time never count. */
  duration: number;
}
export interface BattleEnemy {
  id: number;
  kind: 'moss' | 'runner' | 'boss';
  health: number;
  maxHealth: number;
  x: number;
  attackIn: number;
  hurtUntil: number;
  attackUntil: number;
  /** Last struck animal, retained so a lethal hit still animates toward its victim. */
  attackTarget: CompanionId | null;
  defeatedAt: number | null;
}
export interface BattleAlly {
  id: CompanionId;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  /** Horizontal arena position as a percentage. */
  x: number;
  attackUntil: number;
  skillUntil: number;
  hurtUntil: number;
  downAt: number | null;
  guardUntil: number;
}
export interface BattleEvent {
  id: number;
  at: number;
  kind: 'attack' | 'dog' | 'damage' | 'heal' | 'sweep' | 'dash' | 'wave' | 'defeat';
  target: number | CompanionId;
  /** Animal responsible for an attack; enemy strikes and supplies have no animal actor. */
  actor?: CompanionId;
  amount: number;
  x: number;
}
export interface BattleState {
  stage: number;
  wave: number;
  /** Simulation seconds at the original combat pace. */
  time: number;
  /** Aggregate team percentage, retained for callers displaying a single team bar. */
  health: number;
  maxHealth: number;
  level: number;
  allies: Record<CompanionId, BattleAlly>;
  enemies: BattleEnemy[];
  enemiesDefeated: number;
  cooldowns: Record<BattleSkill, number>;
  transition: number;
  paused: boolean;
  auto: boolean;
  events: BattleEvent[];
  result: BattleResult | null;
}
export type BattleSkillUnavailableReason = 'ready' | 'invalid' | 'paused' | 'finished' | 'transition' | 'cooldown' | 'down' | 'full' | 'no-targets';
export interface BattleSkillAvailability { available: boolean; reason: BattleSkillUnavailableReason }
export const SKILL_COOLDOWNS: Record<BattleSkill, number> = { sweep: 12, dash: 10, heal: 23 };
export const STAGE_NAMES = ['서울 숲길 · 옛 요금소', '한강 북단 · 끊어진 교량', '남산 순환로 · 녹슨 검문소'] as const;
const valid = (value: number, fallback: number, min: number, max: number): number => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const isSkill = (value: unknown): value is BattleSkill => value === 'sweep' || value === 'dash' || value === 'heal';

/** The view and engine share availability, including the skill owner's condition. */
export function getBattleSkillAvailability(state: BattleState, skill: unknown): BattleSkillAvailability {
  const unavailable = (reason: BattleSkillUnavailableReason): BattleSkillAvailability => ({ available: false, reason });
  if (!isSkill(skill)) return unavailable('invalid');
  if (state.result) return unavailable('finished');
  if (state.paused) return unavailable('paused');
  if (state.transition > 0) return unavailable('transition');
  if (state.cooldowns[skill] > 0) return unavailable('cooldown');
  const owner = skill === 'sweep' ? state.allies.cat : skill === 'dash' ? state.allies.dog : null;
  if (owner && owner.health <= 0) return unavailable('down');
  const alive = COMPANION_IDS.map(id => state.allies[id]).filter(ally => ally.health > 0);
  if (!alive.length) return unavailable('down');
  if (!state.enemies.some(enemy => enemy.health > 0)) return unavailable('no-targets');
  if (skill === 'heal' && alive.every(ally => ally.health >= ally.maxHealth)) return unavailable('full');
  return { available: true, reason: 'ready' };
}

export function canUseSkill(state: BattleState, skill: unknown): boolean {
  return getBattleSkillAvailability(state, skill).available;
}

export class BattleSimulation {
  readonly state: BattleState;
  private readonly attackIn: Record<CompanionId, number> = { dog: 1.2, cat: 0.7 };
  private nextEnemy = 0;
  private nextEvent = 0;

  constructor(options: { level: number; health: number; stage: number; companions?: CompanionRoster }) {
    const legacyLevel = Math.floor(valid(options.level, 1, 1, 10));
    const legacyHealth = valid(options.health, 100, 0, 100);
    const createAlly = (id: CompanionId): BattleAlly => {
      const saved = options.companions?.[id];
      const progress = saved ? {
        health: valid(saved.health, 100, 0, 100), xp: Math.floor(valid(saved.xp, 0, 0, MAX_COMPANION_XP)),
      } : { health: legacyHealth, xp: (legacyLevel - 1) * 80 };
      const maxHealth = getCompanionMaxHealth(id, progress);
      const health = maxHealth * progress.health / 100;
      return { id, name: COMPANIONS[id].name, level: getCompanionLevel(progress), health, maxHealth,
        x: id === 'dog' ? 35 : 21, attackUntil: 0, skillUntil: 0, hurtUntil: 0,
        downAt: health <= 0 ? 0 : null, guardUntil: 0 };
    };
    this.state = {
      stage: Math.floor(valid(options.stage, 1, 1, 3)), wave: 1, time: 0,
      health: 100, maxHealth: 100,
      level: Math.floor(valid(options.level, 1, 1, 100)),
      allies: { dog: createAlly('dog'), cat: createAlly('cat') }, enemies: [], enemiesDefeated: 0,
      cooldowns: { sweep: 0, dash: 0, heal: 0 }, transition: 1.4,
      paused: false, auto: false, events: [], result: null,
    };
    this.updateTeamHealth();
    this.spawnWave();
    if (this.state.health <= 0) this.finish('defeat');
  }

  setPaused(paused: boolean): void { this.state.paused = paused; }
  setAuto(auto: boolean): void { this.state.auto = auto; }

  /** Caller sends elapsed seconds; long frames are discarded, never fast-forwarded. */
  tick(delta: number): void {
    const s = this.state;
    if (s.paused || s.result || !Number.isFinite(delta) || delta <= 0) return;
    // Clamp elapsed real time before accelerating, so a resumed frame cannot catch up.
    let remaining = Math.min(delta, 0.1) * GAME_SPEED_MULTIPLIER;
    // Fixed maximum internal step means movement, hits and cooldowns stay stable.
    while (remaining > 0.000001 && !s.result) {
      const step = Math.min(remaining, 1 / 60);
      remaining -= step;
      this.step(step);
    }
  }

  useSkill(skill: unknown): boolean {
    const s = this.state;
    if (!isSkill(skill) || !canUseSkill(s, skill)) return false;
    const targets = s.enemies.filter(enemy => enemy.health > 0);
    s.cooldowns[skill] = SKILL_COOLDOWNS[skill];
    if (skill === 'heal') {
      for (const id of COMPANION_IDS) {
        const ally = s.allies[id];
        if (ally.health <= 0) continue;
        const amount = Math.min(29, ally.maxHealth - ally.health);
        if (amount <= 0) continue;
        ally.health += amount;
        ally.skillUntil = s.time + 0.8;
        this.event('heal', id, amount, ally.x);
      }
      this.updateTeamHealth();
    } else if (skill === 'sweep') {
      const cat = s.allies.cat;
      cat.skillUntil = s.time + 0.8;
      this.event('sweep', targets[0].id, 0, targets[0].x, 'cat');
      for (const enemy of targets) this.hit(enemy, 23 + cat.level * 2, 'cat');
    } else {
      const dog = s.allies.dog;
      dog.attackUntil = s.time + 0.9;
      dog.skillUntil = s.time + 0.9;
      dog.guardUntil = s.time + 2.2;
      this.event('dash', targets[0].id, 0, targets[0].x, 'dog');
      this.hit(targets[0], 34 + dog.level * 2, 'dog');
      // The charge protects the front row and staggers every living enemy.
      for (const enemy of targets) if (enemy.health > 0) enemy.attackIn = Math.max(enemy.attackIn, 2.2);
    }
    this.checkWave();
    return true;
  }

  retreat(): BattleResult {
    if (!this.state.result) this.finish('retreat');
    return { ...this.state.result!, companionHealth: { ...this.state.result!.companionHealth } };
  }

  private step(dt: number): void {
    const s = this.state;
    s.time += dt;
    s.events = s.events.filter(event => s.time - event.at < 1.6);
    for (const skill of Object.keys(s.cooldowns) as BattleSkill[]) s.cooldowns[skill] = Math.max(0, s.cooldowns[skill] - dt);
    if (s.transition > 0) {
      s.transition = Math.max(0, s.transition - dt);
      return;
    }
    if (s.auto) {
      if (COMPANION_IDS.some(id => s.allies[id].health > 0 && s.allies[id].health / s.allies[id].maxHealth < 0.74)) this.useSkill('heal');
      this.useSkill('sweep');
      this.useSkill('dash');
      if (s.result || s.transition > 0) return;
    }
    if (!s.enemies.some(enemy => enemy.health > 0)) { this.checkWave(); return; }
    for (const id of ['cat', 'dog'] as const) {
      const ally = s.allies[id];
      if (ally.health <= 0) continue;
      this.attackIn[id] -= dt;
      const target = s.enemies.find(enemy => enemy.health > 0);
      if (this.attackIn[id] > 0 || !target) continue;
      this.attackIn[id] += id === 'cat' ? 1.45 : 2.3;
      ally.attackUntil = s.time + (id === 'cat' ? 0.52 : 0.55);
      this.event(id === 'cat' ? 'attack' : 'dog', target.id, 0, target.x, id);
      this.hit(target, id === 'cat' ? 9 + ally.level * 1.4 : 5 + ally.level * 0.8, id);
    }
    for (let i = 0; i < s.enemies.length; i++) {
      const enemy = s.enemies[i];
      if (enemy.health <= 0) continue;
      const preferred = enemy.kind === 'runner' ? s.allies.cat : s.allies.dog;
      const target = preferred.health > 0 ? preferred : (preferred.id === 'cat' ? s.allies.dog : s.allies.cat);
      if (target.health <= 0) { this.finish('defeat'); return; }
      const contact = target.x + 14 + i * 6;
      if (enemy.x > contact) {
        enemy.x = Math.max(contact, enemy.x - dt * (enemy.kind === 'runner' ? 4.4 : 3.1));
      } else {
        enemy.attackIn -= dt;
        if (enemy.attackIn <= 0) {
          enemy.attackIn += enemy.kind === 'boss' ? 3.5 : 4.6 + i * 0.2;
          enemy.attackUntil = s.time + 0.65;
          enemy.attackTarget = target.id;
          const baseDamage = (enemy.kind === 'boss' ? 6 : 2.3) * (1 + (s.stage - 1) * 0.35);
          const damage = baseDamage * (target.id === 'dog' && target.guardUntil > s.time ? 0.45 : 1);
          const amount = Math.min(target.health, damage);
          target.health -= amount;
          target.hurtUntil = s.time + 0.35;
          this.event('damage', target.id, amount, target.x);
          if (target.health <= 0) {
            target.health = 0;
            target.downAt = s.time;
            this.event('defeat', target.id, 0, target.x);
          }
          this.updateTeamHealth();
          if (s.health <= 0) { this.finish('defeat'); return; }
        }
      }
    }
    this.checkWave();
  }

  private spawnWave(): void {
    const s = this.state;
    const scale = 1 + (s.stage - 1) * 0.36;
    const kinds: BattleEnemy['kind'][] = s.wave === 1 ? ['moss', 'moss'] : s.wave === 2 ? ['runner', 'moss', 'runner'] : ['boss', 'moss', 'runner'];
    s.enemies = kinds.map((kind, index) => {
      const maxHealth = Math.round((kind === 'boss' ? 210 : s.wave === 3 ? 65 : 76) * scale);
      return { id: this.nextEnemy++, kind, maxHealth, health: maxHealth, x: 75 + index * 9,
        attackIn: 1.8 + index * 0.6, hurtUntil: 0, attackUntil: 0, attackTarget: null, defeatedAt: null };
    });
    this.attackIn.cat = 0.8;
    this.attackIn.dog = 1.2;
    this.event('wave', 'dog', s.wave, 50);
  }

  private hit(enemy: BattleEnemy, damage: number, actor: CompanionId): void {
    if (enemy.health <= 0) return;
    const amount = Math.min(enemy.health, Math.round(damage));
    enemy.health -= amount;
    enemy.hurtUntil = this.state.time + 0.23;
    this.event('damage', enemy.id, amount, enemy.x, actor);
    if (enemy.health <= 0) {
      enemy.defeatedAt = this.state.time;
      this.state.enemiesDefeated++;
      this.event('defeat', enemy.id, 0, enemy.x, actor);
    }
  }

  private checkWave(): void {
    const s = this.state;
    if (s.result || s.enemies.some(enemy => enemy.health > 0)) return;
    if (s.wave === 3) { this.finish('victory'); return; }
    s.wave++;
    s.transition = 2.6;
    this.spawnWave();
  }

  private updateTeamHealth(): void {
    const s = this.state;
    const current = COMPANION_IDS.reduce((sum, id) => sum + s.allies[id].health, 0);
    const max = COMPANION_IDS.reduce((sum, id) => sum + s.allies[id].maxHealth, 0);
    s.health = Math.min(100, Math.max(0, current / max * 100));
  }

  private event(kind: BattleEvent['kind'], target: BattleEvent['target'], amount: number, x: number, actor?: CompanionId): void {
    this.state.events.push({ id: this.nextEvent++, at: this.state.time, kind, target, amount, x, ...(actor ? { actor } : {}) });
  }

  private finish(outcome: BattleOutcome): void {
    const s = this.state;
    this.updateTeamHealth();
    s.result = {
      outcome, stage: s.stage, remainingHealth: Math.round(s.health),
      companionHealth: { dog: s.allies.dog.health / s.allies.dog.maxHealth * 100, cat: s.allies.cat.health / s.allies.cat.maxHealth * 100 },
      enemiesDefeated: s.enemiesDefeated, duration: Math.round(realDuration(s.time)),
    };
  }
}
