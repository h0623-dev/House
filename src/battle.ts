import { GAME_SPEED_MULTIPLIER, realDuration } from './game-speed';

/** Small deterministic combat engine. No DOM, wall clock or random state. */
export type BattleOutcome = 'victory' | 'defeat' | 'retreat';
export type BattleSkill = 'sweep' | 'dash' | 'heal';
export interface BattleResult {
  outcome: BattleOutcome;
  stage: number;
  remainingHealth: number;
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
  defeatedAt: number | null;
}
export interface BattleEvent {
  id: number;
  at: number;
  kind: 'attack' | 'dog' | 'damage' | 'heal' | 'sweep' | 'dash' | 'wave' | 'defeat';
  target: number | 'hero';
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
  enemies: BattleEnemy[];
  enemiesDefeated: number;
  cooldowns: Record<BattleSkill, number>;
  transition: number;
  paused: boolean;
  auto: boolean;
  heroAttackUntil: number;
  heroSkillUntil: number;
  heroHurtUntil: number;
  dogAttackUntil: number;
  events: BattleEvent[];
  result: BattleResult | null;
}
export const SKILL_COOLDOWNS: Record<BattleSkill, number> = { sweep: 12, dash: 10, heal: 23 };
export const STAGE_NAMES = ['서울 숲길 · 옛 요금소', '한강 북단 · 끊어진 교량', '남산 순환로 · 녹슨 검문소'] as const;
const valid = (value: number, fallback: number, min: number, max: number): number => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export class BattleSimulation {
  readonly state: BattleState;
  private attackIn = 0.7;
  private dogAttackIn = 1.2;
  private nextEnemy = 0;
  private nextEvent = 0;

  constructor(options: { level: number; health: number; stage: number }) {
    this.state = {
      stage: Math.floor(valid(options.stage, 1, 1, 3)), wave: 1, time: 0,
      health: valid(options.health, 100, 1, 100), maxHealth: 100,
      level: Math.floor(valid(options.level, 1, 1, 100)), enemies: [], enemiesDefeated: 0,
      cooldowns: { sweep: 0, dash: 0, heal: 0 }, transition: 1.4,
      paused: false, auto: false, heroAttackUntil: 0, heroSkillUntil: 0,
      heroHurtUntil: 0, dogAttackUntil: 0, events: [], result: null,
    };
    this.spawnWave();
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

  useSkill(skill: BattleSkill): boolean {
    const s = this.state;
    if (s.paused || s.result || s.transition > 0 || s.cooldowns[skill] > 0) return false;
    const targets = s.enemies.filter(enemy => enemy.health > 0);
    if (!targets.length || (skill === 'heal' && s.health >= s.maxHealth)) return false;
    s.cooldowns[skill] = SKILL_COOLDOWNS[skill];
    if (skill === 'heal') {
      const amount = Math.min(29, s.maxHealth - s.health);
      s.health += amount;
      this.event('heal', 'hero', amount, 25);
      s.heroSkillUntil = s.time + 0.8;
    } else if (skill === 'sweep') {
      s.heroSkillUntil = s.time + 0.8;
      this.event('sweep', targets[0].id, 0, targets[0].x);
      for (const enemy of targets) this.hit(enemy, 23 + s.level * 2);
    } else {
      s.dogAttackUntil = s.time + 0.9;
      this.event('dash', targets[0].id, 0, targets[0].x);
      this.hit(targets[0], 34 + s.level * 2);
      // The dash staggers every living enemy, a small window to recover.
      for (const enemy of targets) enemy.attackIn = Math.max(enemy.attackIn, 2.2);
    }
    this.checkWave();
    return true;
  }

  retreat(): BattleResult {
    if (!this.state.result) this.finish('retreat');
    return { ...this.state.result! };
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
      if (s.health < 74) this.useSkill('heal');
      this.useSkill('sweep');
      this.useSkill('dash');
      if (s.result || s.transition > 0) return;
    }
    const nearest = s.enemies.find(enemy => enemy.health > 0);
    if (!nearest) { this.checkWave(); return; }
    this.attackIn -= dt;
    this.dogAttackIn -= dt;
    if (this.attackIn <= 0) {
      this.attackIn += 1.45;
      s.heroAttackUntil = s.time + 0.52;
      this.event('attack', nearest.id, 0, nearest.x);
      this.hit(nearest, 9 + Math.min(s.level, 15) * 1.4);
    }
    const dogTarget = s.enemies.find(enemy => enemy.health > 0);
    if (this.dogAttackIn <= 0 && dogTarget) {
      this.dogAttackIn += 2.3;
      s.dogAttackUntil = s.time + 0.55;
      this.event('dog', dogTarget.id, 0, dogTarget.x);
      this.hit(dogTarget, 5 + Math.min(s.level, 15) * 0.8);
    }
    for (let i = 0; i < s.enemies.length; i++) {
      const enemy = s.enemies[i];
      if (enemy.health <= 0) continue;
      const contact = 49 + i * 16;
      if (enemy.x > contact) {
        enemy.x = Math.max(contact, enemy.x - dt * (enemy.kind === 'runner' ? 4.4 : 3.1));
      } else {
        enemy.attackIn -= dt;
        if (enemy.attackIn <= 0) {
          enemy.attackIn += enemy.kind === 'boss' ? 3.5 : 4.6 + i * 0.2;
          enemy.attackUntil = s.time + 0.65;
          const amount = (enemy.kind === 'boss' ? 6 : 2.3) * (1 + (s.stage - 1) * 0.35);
          s.health = Math.max(0, s.health - amount);
          s.heroHurtUntil = s.time + 0.35;
          this.event('damage', 'hero', amount, 25);
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
        attackIn: 1.8 + index * 0.6, hurtUntil: 0, attackUntil: 0, defeatedAt: null };
    });
    this.attackIn = 0.8;
    this.dogAttackIn = 1.2;
    this.event('wave', 'hero', s.wave, 50);
  }

  private hit(enemy: BattleEnemy, damage: number): void {
    if (enemy.health <= 0) return;
    const amount = Math.min(enemy.health, Math.round(damage));
    enemy.health -= amount;
    enemy.hurtUntil = this.state.time + 0.23;
    this.event('damage', enemy.id, amount, enemy.x);
    if (enemy.health <= 0) {
      enemy.defeatedAt = this.state.time;
      this.state.enemiesDefeated++;
      this.event('defeat', enemy.id, 0, enemy.x);
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

  private event(kind: BattleEvent['kind'], target: BattleEvent['target'], amount: number, x: number): void {
    this.state.events.push({ id: this.nextEvent++, at: this.state.time, kind, target, amount, x });
  }

  private finish(outcome: BattleOutcome): void {
    const s = this.state;
    s.result = { outcome, stage: s.stage, remainingHealth: Math.max(1, Math.round(s.health)), enemiesDefeated: s.enemiesDefeated, duration: Math.round(realDuration(s.time)) };
  }
}
