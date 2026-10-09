import { GAME_SPEED_MULTIPLIER, realDuration } from './game-speed';
import { MAX_COMPANION_XP, type CompanionHealth, type CompanionRoster } from './companions';
import { UNIT_IDS, RESERVE_UNIT_IDS, UNITS, getUnitLevel, getUnitMaxHealth, getUnitRoster, isUnitId, type ReserveHealth, type UnitBattleBonuses, type UnitId, type UnitRoster, type UnitSkillId } from './units';

/** Small deterministic animal combat engine. No DOM, wall clock or random state. */
export type BattleOutcome = 'victory' | 'defeat' | 'retreat';
export type BattleSkill = UnitSkillId | 'heal';
export interface BattleResult {
  outcome: BattleOutcome;
  stage: number;
  /** Remaining selected-team health as a percentage; no survivor damage is implied. */
  remainingHealth: number;
  companionHealth: CompanionHealth;
  reserveHealth?: ReserveHealth;
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
  attackTarget: UnitId | null;
  slowUntil: number;
  defeatedAt: number | null;
}
export interface BattleAlly {
  id: UnitId;
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
  tauntUntil: number;
}
export interface BattleEvent {
  id: number;
  at: number;
  kind: 'attack' | 'dog' | 'damage' | 'heal' | 'sweep' | 'dash' | 'mend' | 'volley' | 'fortify' | 'burst' | 'buff' | 'wave' | 'defeat';
  target: number | UnitId;
  /** Animal responsible for an ability; enemy strikes and shared supplies have no animal actor. */
  actor?: UnitId;
  amount: number;
  x: number;
}
export interface BattleState {
  stage: number;
  wave: number;
  /** Simulation seconds at the original combat pace. */
  time: number;
  health: number;
  maxHealth: number;
  level: number;
  /** Only these animals participate, render, take damage or receive owned abilities. */
  teamIds: UnitId[];
  /** The complete roster preserves nonparticipant health in the returned snapshot. */
  allies: Record<UnitId, BattleAlly>;
  bonuses: UnitBattleBonuses;
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
export const SKILL_COOLDOWNS: Record<BattleSkill, number> = { sweep: 12, dash: 10, heal: 23, mend: 18, volley: 11, fortify: 14, burst: 16 };
export const STAGE_NAMES = ['서울 숲길 · 옛 요금소', '한강 북단 · 끊어진 교량', '남산 순환로 · 녹슨 검문소'] as const;
const valid = (value: number, fallback: number, min: number, max: number): number => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const isSkill = (value: unknown): value is BattleSkill => typeof value === 'string' && (value === 'heal' || UNIT_IDS.some(id => UNITS[id].skillId === value));
const skillOwner = (skill: BattleSkill): UnitId | undefined => UNIT_IDS.find(id => UNITS[id].skillId === skill);

/** The view and engine share availability, including selection and the skill owner's condition. */
export function getBattleSkillAvailability(state: BattleState, skill: unknown): BattleSkillAvailability {
  const unavailable = (reason: BattleSkillUnavailableReason): BattleSkillAvailability => ({ available: false, reason });
  if (!isSkill(skill)) return unavailable('invalid');
  if (state.result) return unavailable('finished');
  if (state.paused) return unavailable('paused');
  if (state.transition > 0) return unavailable('transition');
  const owner = skillOwner(skill);
  if (owner && (!state.teamIds.includes(owner) || state.allies[owner].health <= 0)) return unavailable('down');
  if (state.cooldowns[skill] > 0) return unavailable('cooldown');
  const alive = state.teamIds.map(id => state.allies[id]).filter(ally => ally.health > 0);
  if (!alive.length) return unavailable('down');
  if (!state.enemies.some(enemy => enemy.health > 0)) return unavailable('no-targets');
  if ((skill === 'heal' || skill === 'mend') && alive.every(ally => ally.health >= ally.maxHealth)) return unavailable('full');
  return { available: true, reason: 'ready' };
}
export function canUseSkill(state: BattleState, skill: unknown): boolean { return getBattleSkillAvailability(state, skill).available; }

/** Taunt overrides flanking; otherwise runners seek the rear and other enemies the front. */
export function getBattleEnemyTarget(state: BattleState, enemy: BattleEnemy): BattleAlly | undefined {
  const alive = state.teamIds.map(id => state.allies[id]).filter(ally => ally.health > 0);
  const taunter = alive.find(ally => ally.tauntUntil > state.time);
  if (taunter) return taunter;
  return alive.sort((a, b) => enemy.kind === 'runner' ? a.x - b.x : b.x - a.x)[0];
}

export class BattleSimulation {
  readonly state: BattleState;
  private readonly attackIn = Object.fromEntries(UNIT_IDS.map(id => [id, 1.2])) as Record<UnitId, number>;
  private readonly initialHealth = Object.fromEntries(UNIT_IDS.map(id => [id, 100])) as Record<UnitId, number>;
  private nextEnemy = 0;
  private nextEvent = 0;

  constructor(options: { level: number; health: number; stage: number; companions?: CompanionRoster; units?: UnitRoster; teamIds?: UnitId[]; bonuses?: UnitBattleBonuses }) {
    const legacyLevel = Math.floor(valid(options.level, 1, 1, 10));
    const legacyHealth = valid(options.health, 100, 0, 100);
    const roster = options.units ?? getUnitRoster({ companions: options.companions ?? {
      dog: { health: legacyHealth, xp: (legacyLevel - 1) * 80 }, cat: { health: legacyHealth, xp: (legacyLevel - 1) * 80 },
    } });
    const requested = options.teamIds ?? ['dog', 'cat'];
    const teamIds = [...new Set(requested.filter(isUnitId))].slice(0, 3);
    const createAlly = (id: UnitId): BattleAlly => {
      const saved = roster[id], progress = { health: valid(saved?.health, 100, 0, 100), xp: Math.floor(valid(saved?.xp, 0, 0, MAX_COMPANION_XP)) };
      this.initialHealth[id] = progress.health;
      const maxHealth = getUnitMaxHealth(id, progress), health = maxHealth * progress.health / 100;
      return { id, name: UNITS[id].name, level: getUnitLevel(progress), health, maxHealth,
        x: id === 'dog' ? 35 : 21, attackUntil: 0, skillUntil: 0, hurtUntil: 0,
        downAt: health <= 0 ? 0 : null, guardUntil: 0, tauntUntil: 0 };
    };
    const allies = Object.fromEntries(UNIT_IDS.map(id => [id, createAlly(id)])) as Record<UnitId, BattleAlly>;
    // Role determines position independently of selection order, so a tank actually protects the rear.
    const priority: Record<UnitId, number> = { boar: 0, dog: 1, cat: 2, fox: 3, owl: 4, rabbit: 5 };
    [...teamIds].sort((a, b) => priority[a] - priority[b]).forEach((id, index) => { allies[id].x = teamIds.length === 3 ? 35 - index * 10 : index === 0 ? 35 : 21; });
    this.state = {
      stage: Math.floor(valid(options.stage, 1, 1, 3)), wave: 1, time: 0, health: 100, maxHealth: 100,
      level: Math.floor(valid(options.level, 1, 1, 100)), teamIds, allies,
      bonuses: { attackMultiplier: valid(options.bonuses?.attackMultiplier ?? 1, 1, 1, 1.2), enemyDamageMultiplier: valid(options.bonuses?.enemyDamageMultiplier ?? 1, 1, .85, 1) },
      enemies: [], enemiesDefeated: 0,
      cooldowns: { sweep: 0, dash: 0, heal: 0, mend: 0, volley: 0, fortify: 0, burst: 0 }, transition: 1.4,
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
    let remaining = Math.min(delta, 0.1) * GAME_SPEED_MULTIPLIER;
    while (remaining > 0.000001 && !s.result) {
      const step = Math.min(remaining, 1 / 60);
      remaining -= step;
      this.step(step);
    }
  }

  useSkill(skill: unknown): boolean {
    const s = this.state;
    if (!isSkill(skill) || !canUseSkill(s, skill)) return false;
    const targets = s.enemies.filter(enemy => enemy.health > 0), ownerId = skillOwner(skill), owner = ownerId ? s.allies[ownerId] : undefined;
    s.cooldowns[skill] = SKILL_COOLDOWNS[skill];
    if (owner) owner.skillUntil = s.time + (skill === 'dash' ? .9 : .8);
    if (skill === 'heal' || skill === 'mend') {
      if (skill === 'mend') this.event('mend', ownerId!, 0, owner!.x, ownerId);
      for (const id of s.teamIds) {
        const ally = s.allies[id];
        if (ally.health <= 0) continue;
        const amount = Math.min(skill === 'mend' ? 29 + owner!.level * 2 : 29, ally.maxHealth - ally.health);
        if (amount > 0) {
          ally.health += amount;
          ally.skillUntil = s.time + .8;
          this.event('heal', id, amount, ally.x, ownerId);
        }
        if (skill === 'mend') this.guard(ally, 2, ownerId!);
      }
      this.updateTeamHealth();
    } else if (skill === 'sweep' || skill === 'burst') {
      this.event(skill, targets[0].id, 0, targets[0].x, ownerId);
      for (const enemy of targets) {
        this.hit(enemy, (skill === 'sweep' ? 23 : 28) + owner!.level * 2, ownerId!);
        if (skill === 'burst' && enemy.health > 0) enemy.slowUntil = s.time + 4;
      }
    } else if (skill === 'dash') {
      owner!.attackUntil = s.time + .9;
      this.guard(owner!, 2.2, ownerId!);
      this.event('dash', targets[0].id, 0, targets[0].x, ownerId);
      this.hit(targets[0], 34 + owner!.level * 2, ownerId!);
      for (const enemy of targets) if (enemy.health > 0) enemy.attackIn = Math.max(enemy.attackIn, 2.2);
    } else if (skill === 'volley') {
      const target = [...targets].sort((a, b) => b.health - a.health)[0];
      this.event('volley', target.id, 0, target.x, ownerId);
      for (let hit = 0; hit < 3 && target.health > 0; hit++) this.hit(target, 18 + owner!.level * 2, ownerId!);
    } else {
      owner!.tauntUntil = s.time + 4.5;
      this.event('fortify', ownerId!, 4.5, owner!.x, ownerId);
      for (const id of s.teamIds) if (s.allies[id].health > 0) this.guard(s.allies[id], 4.5, ownerId!);
    }
    this.checkWave();
    return true;
  }

  retreat(): BattleResult {
    if (!this.state.result) this.finish('retreat');
    return { ...this.state.result!, companionHealth: { ...this.state.result!.companionHealth }, ...(this.state.result!.reserveHealth ? { reserveHealth: { ...this.state.result!.reserveHealth } } : {}) };
  }

  private step(dt: number): void {
    const s = this.state;
    s.time += dt;
    s.events = s.events.filter(event => s.time - event.at < 1.6);
    for (const skill of Object.keys(s.cooldowns) as BattleSkill[]) s.cooldowns[skill] = Math.max(0, s.cooldowns[skill] - dt);
    if (s.transition > 0) { s.transition = Math.max(0, s.transition - dt); return; }
    if (s.auto) {
      if (s.teamIds.some(id => s.allies[id].health > 0 && s.allies[id].health / s.allies[id].maxHealth < .74)) {
        if (!this.useSkill('mend') && s.teamIds.length < 3) this.useSkill('heal');
      }
      for (const id of s.teamIds) this.useSkill(UNITS[id].skillId);
      if (s.result || s.transition > 0) return;
    }
    if (!s.enemies.some(enemy => enemy.health > 0)) { this.checkWave(); return; }
    // Faster rear fighters act first; each animal owns its independent attack timer.
    for (const id of [...s.teamIds].sort((a, b) => UNITS[a].attackInterval - UNITS[b].attackInterval)) {
      const ally = s.allies[id];
      if (ally.health <= 0) continue;
      this.attackIn[id] -= dt;
      const target = s.enemies.find(enemy => enemy.health > 0);
      if (this.attackIn[id] > 0 || !target) continue;
      this.attackIn[id] += UNITS[id].attackInterval;
      ally.attackUntil = s.time + (id === 'cat' ? .52 : .55);
      this.event(id === 'dog' ? 'dog' : 'attack', target.id, 0, target.x, id);
      this.hit(target, UNITS[id].attackDamage + ally.level * UNITS[id].damagePerLevel, id);
    }
    for (let i = 0; i < s.enemies.length; i++) {
      const enemy = s.enemies[i];
      if (enemy.health <= 0) continue;
      const target = getBattleEnemyTarget(s, enemy);
      if (!target) { this.finish('defeat'); return; }
      const contact = target.x + 14 + i * 6;
      if (enemy.x > contact) {
        const speed = (enemy.kind === 'runner' ? 4.4 : 3.1) * (enemy.slowUntil > s.time ? .5 : 1);
        enemy.x = Math.max(contact, enemy.x - dt * speed);
      } else {
        enemy.attackIn -= dt;
        if (enemy.attackIn <= 0) {
          enemy.attackIn += enemy.kind === 'boss' ? 3.5 : 4.6 + i * .2;
          enemy.attackUntil = s.time + .65;
          enemy.attackTarget = target.id;
          const baseDamage = (enemy.kind === 'boss' ? 6 : 2.3) * (1 + (s.stage - 1) * .35) * s.bonuses.enemyDamageMultiplier;
          const amount = Math.min(target.health, baseDamage * (target.guardUntil > s.time ? .45 : 1));
          target.health -= amount;
          target.hurtUntil = s.time + .35;
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

  private guard(ally: BattleAlly, seconds: number, actor: UnitId): void {
    ally.guardUntil = Math.max(ally.guardUntil, this.state.time + seconds);
    this.event('buff', ally.id, seconds, ally.x, actor);
  }

  private spawnWave(): void {
    const s = this.state, scale = 1 + (s.stage - 1) * .36;
    const kinds: BattleEnemy['kind'][] = s.wave === 1 ? ['moss', 'moss'] : s.wave === 2 ? ['runner', 'moss', 'runner'] : ['boss', 'moss', 'runner'];
    s.enemies = kinds.map((kind, index) => {
      const maxHealth = Math.round((kind === 'boss' ? 210 : s.wave === 3 ? 65 : 76) * scale);
      return { id: this.nextEnemy++, kind, maxHealth, health: maxHealth, x: 75 + index * 9,
        attackIn: 1.8 + index * .6, hurtUntil: 0, attackUntil: 0, attackTarget: null, slowUntil: 0, defeatedAt: null };
    });
    for (const id of UNIT_IDS) this.attackIn[id] = id === 'cat' ? .8 : 1.2;
    this.event('wave', s.teamIds[0] ?? 'dog', s.wave, 50);
  }

  private hit(enemy: BattleEnemy, damage: number, actor: UnitId): void {
    if (enemy.health <= 0) return;
    const amount = Math.min(enemy.health, Math.round(damage * this.state.bonuses.attackMultiplier));
    enemy.health -= amount;
    enemy.hurtUntil = this.state.time + .23;
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
    const current = s.teamIds.reduce((sum, id) => sum + s.allies[id].health, 0);
    const max = s.teamIds.reduce((sum, id) => sum + s.allies[id].maxHealth, 0);
    s.health = max > 0 ? Math.min(100, Math.max(0, current / max * 100)) : 0;
  }

  private event(kind: BattleEvent['kind'], target: BattleEvent['target'], amount: number, x: number, actor?: UnitId): void {
    this.state.events.push({ id: this.nextEvent++, at: this.state.time, kind, target, amount, x, ...(actor ? { actor } : {}) });
  }

  private finish(outcome: BattleOutcome): void {
    const s = this.state;
    this.updateTeamHealth();
    const health = Object.fromEntries(UNIT_IDS.map(id => [id, s.teamIds.includes(id)
      ? s.allies[id].health / s.allies[id].maxHealth * 100 : this.initialHealth[id]])) as Record<UnitId, number>;
    s.result = {
      outcome, stage: s.stage, remainingHealth: Math.round(s.health), companionHealth: { dog: health.dog, cat: health.cat },
      reserveHealth: Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, health[id]])) as ReserveHealth,
      enemiesDefeated: s.enemiesDefeated, duration: Math.round(realDuration(s.time)),
    };
  }
}
