import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame, type GameState } from '../src/game';
import { GAME_SPEED_MULTIPLIER } from '../src/game-speed';
import { WALK_SPEED } from '../src/scene-motion';
import { blocksActorStep, groundLocation, HERO_BODY_RADIUS, type NavigationActor,
  type NavigationLocation, type NavigationPath, type NavigationWorld } from '../src/scene-navigation';
import type { PetPatrolState } from '../src/scene-patrol';
import type { UnitId } from '../src/units';

type Action = { elapsed: number; duration: number; walk: number; work: number; stalled: number;
  navigation: NavigationPath };
type PhysicalScene = { state: GameState; action: Action | null; lastFrame: number; reducedMotion: boolean;
  petMotion: Map<UnitId, PetPatrolState>; petYields: Map<UnitId, unknown>;
  animate(timestamp: number): void; ensurePets(): void; setState(state: GameState): void;
  playAction(kind: 'chop'): Promise<void>; currentHeroLocation(): NavigationLocation;
  physicalActors(): NavigationActor[]; navigationWorld(radius?: number, actors?: NavigationActor[]): NavigationWorld;
  stepBlocker(from: NavigationLocation, to: NavigationLocation): NavigationActor | undefined;
  advancePets(delta: number): void };
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const copy = <T>(value: T): T => structuredClone(value);
const closePoint = (actual: readonly number[], expected: readonly number[]) => assert.ok(distance(actual, expected) < 1e-6);

test('actual Scene uses one physical clock on a phone rendering every 350 ms', async t => {
  // Only the browser shell and painting are stubbed. The constructor, action,
  // collision checks, frame integration, patrol and yielding are product code.
  const globals: Record<string, unknown> = {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, devicePixelRatio: 1 },
    document: { hidden: false, addEventListener() {} },
    Image: class { complete = false; naturalWidth = 0; },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  };
  const descriptors = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  const hook = registerHooks({ load(url, context, next) {
    if (/\.(png|webp|jpg|svg)$/.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
    return next(url, context);
  } });
  let restorePainting: (() => void) | undefined;
  try {
    const { Scene } = await import('../src/scene');
    hook.deregister();
    const prototype = Scene.prototype as unknown as { render(): void };
    const originalRender = prototype.render;
    prototype.render = () => {};
    restorePainting = () => { prototype.render = originalRender; };
    function freshScene(): PhysicalScene {
      const canvas = { getContext: () => ({}), style: {}, dataset: {}, setAttribute() {}, addEventListener() {},
        getBoundingClientRect: () => ({ width: 360, height: 500 }), dispatchEvent() {} };
      const scene = new Scene(canvas as unknown as HTMLCanvasElement, () => {}) as unknown as PhysicalScene;
      scene.setState(createGame());
      scene.ensurePets();
      return scene;
    }
    function observePhysics(scene: PhysicalScene) {
      const observed = { calls: 0, heroSteps: 0, petSteps: 0, blocked: 0, physicsSeconds: 0,
        firstBlockedAt: null as number | null, maxStalled: 0, lastAcceptedHero: copy(scene.currentHeroLocation()) };
      const originalBlocker = scene.stepBlocker.bind(scene), originalPets = scene.advancePets.bind(scene);
      let pending: { from: NavigationLocation; to: NavigationLocation; actors: NavigationActor[]; blocked: boolean } | undefined;
      scene.stepBlocker = (from, to) => {
        const actors = copy(scene.physicalActors().filter(actor => actor.id !== 'hero'));
        const blocker = originalBlocker(from, to);
        pending = { from: copy(from), to: copy(to), actors, blocked: Boolean(blocker) };
        if (blocker) {
          observed.blocked++;
          observed.firstBlockedAt ??= observed.physicsSeconds;
        }
        return blocker;
      };
      scene.advancePets = delta => {
        const hero = copy(scene.currentHeroLocation());
        if (pending) {
          if (pending.blocked) closePoint(hero.point, pending.from.point);
          else {
            closePoint(hero.point, pending.to.point);
            assert.equal(blocksActorStep(pending.from, hero, HERO_BODY_RADIUS, pending.actors), undefined,
              'every accepted hero sweep preserves the complete companion body');
            const moved = distance(hero.point, pending.from.point);
            assert.ok(moved <= WALK_SPEED * delta + 1e-6, 'movement preserves the existing walk/climb speed');
            if (moved > 1e-7) observed.heroSteps++;
            observed.lastAcceptedHero = copy(hero);
          }
          pending = undefined;
        }
        const before = copy([...scene.petMotion.values()]);
        originalPets(delta);
        // Patrol order is the selected team's order: later pets see the actual
        // accepted feet of earlier pets, rather than an invented stale circle.
        const actors: NavigationActor[] = [{ id: 'hero', location: hero, radius: HERO_BODY_RADIUS },
          ...before.map(pet => ({ id: pet.id, location: pet.location, radius: pet.radius }))];
        for (const prior of before) {
          const pet = scene.petMotion.get(prior.id)!;
          assert.equal(pet.radius, prior.radius);
          assert.equal(blocksActorStep(prior.location, pet.location, pet.radius, actors.filter(actor => actor.id !== pet.id)), undefined,
            'every accepted pet sweep preserves the full hero and companion bodies');
          const moved = distance(prior.location.point, pet.location.point);
          assert.ok(moved <= 44 * delta + 1e-6, 'paws retain the existing 2× patrol cruise speed');
          assert.ok(Math.abs(pet.distance - prior.distance - moved) < 1e-6, 'gait distance comes only from accepted feet');
          if (moved > 1e-7) observed.petSteps++;
          actors.find(actor => actor.id === pet.id)!.location = copy(pet.location);
        }
        observed.calls++;
        observed.physicsSeconds += delta;
        observed.maxStalled = Math.max(observed.maxStalled, scene.action?.stalled ?? 0);
      };
      return observed;
    }
    function start(scene: PhysicalScene) {
      const outcome = { resolved: 0, rejected: 0, error: '' };
      const finished = scene.playAction('chop').then(() => { outcome.resolved++; }, error => {
        outcome.rejected++; outcome.error = String(error.message);
      });
      // These are the actual failing browser frame gaps, not a test-side physics
      // integrator. Previously they held the hero at (303.592, 289.620) and
      // rejected after 20.662 seconds without a completed woodcutting reward.
      scene.lastFrame = 1000;
      let frame = 0;
      return { outcome, finished, next() { scene.animate(1129 + frame++ * 366.667); },
        realSeconds() { return (129 + (frame - 1) * 366.667) / 1000; } };
    }

    await t.test('the captured slow-frame woodcutting returns safely and completes exactly once', async () => {
      const scene = freshScene(), observed = observePhysics(scene), before = copy(scene.state), run = start(scene);
      assert.equal(GAME_SPEED_MULTIPLIER, 2);
      assert.equal(HERO_BODY_RADIUS, 7);
      assert.ok(Math.abs(scene.petMotion.get('dog')!.radius - 25.74) < 1e-10);
      assert.ok(Math.abs(scene.petMotion.get('cat')!.radius - 24.82) < 1e-10);
      assert.equal(scene.action!.work, 1.275);
      assert.deepEqual(scene.action!.navigation.points, [[403.28, 306.41999999999996],
        [331.9573647680092, 290.66775652039524], [220.98, 286.57], [182.79, 313.36], [140, 527], [142, 590]]);
      const returnLocation = copy(scene.action!.navigation.returnLocation);
      for (let frame = 0; frame < 100 && scene.action; frame++) run.next();
      assert.equal(scene.action, null, 'the genuine chore finishes rather than leaving a busy action');
      await run.finished;
      assert.deepEqual(run.outcome, { resolved: 1, rejected: 0, error: '' });
      assert.deepEqual(scene.currentHeroLocation(), returnLocation);
      assert.ok(run.realSeconds() < 16, 'the recorded low-RAF case completes promptly without extending the stall deadline');
      assert.ok(observed.blocked > 0 && observed.maxStalled > 0, 'the fixture exercises real waiting for a companion');
      assert.ok(observed.maxStalled < 16);
      assert.ok(observed.heroSteps > 10 && observed.petSteps > 10, 'both residents actually move under the same observed frame gaps');
      assert.ok(Math.abs(observed.physicsSeconds - run.realSeconds()) < 1e-6,
        'physical movement consumes the complete elapsed browser time');
      assert.deepEqual(scene.state, before, 'animation never mutates resources or saved progress');
    });

    for (const variant of ['immobile', 'reduced-motion'] as const) await t.test(`${variant} bodies still stop the return and cancel after 16 seconds`, async () => {
      const scene = freshScene(), blockingLocation = copy(scene.petMotion.get('cat')!.location),
        observed = observePhysics(scene), run = start(scene);
      // Retain a real initial patrol foot position, then introduce the stationary
      // dog there while the hero is on the return ladder and the cat has left.
      // The retired cottage changes patrol positions: the old hardcoded blocker
      // would overlap the new cat. This captured, clear point blocks the return aisle.
      for (let frame = 0; frame < 20 && scene.action!.elapsed < scene.action!.walk + scene.action!.work + .3; frame++) run.next();
      assert.equal(scene.currentHeroLocation().surface, 'ladder');
      const dog = scene.petMotion.get('dog')!;
      const others = scene.physicalActors().filter(actor => actor.id !== 'dog');
      assert.ok(groundLocation(scene.navigationWorld(dog.radius, others), blockingLocation.point, blockingLocation.floor),
        'the captured blocking feet clear static structures and every current companion at the full dog radius');
      assert.equal(blocksActorStep(blockingLocation, blockingLocation, dog.radius, others), undefined,
        'introducing the blocker never creates an existing hero or companion overlap');
      dog.location = copy(blockingLocation);
      dog.route = null;
      dog.elapsed = 0;
      scene.petYields.delete('dog');
      assert.ok(groundLocation(scene.navigationWorld(dog.radius, []), dog.location.point), 'the blocking body is genuinely on clear deck ground');
      if (variant === 'immobile') scene.state.companions.dog.health = 0;
      else scene.reducedMotion = true;
      const retainedDog = copy(dog.location), before = copy(scene.state);
      observed.firstBlockedAt = null;
      for (let frame = 0; frame < 100 && scene.action; frame++) run.next();
      assert.equal(scene.action, null);
      await run.finished;
      assert.equal(run.outcome.resolved, 0, 'a blocked and cancelled job never invokes the reward completion callback');
      assert.equal(run.outcome.rejected, 1);
      assert.match(run.outcome.error, /동물이 길을 막아/);
      assert.notEqual(observed.firstBlockedAt, null);
      const blockedSeconds = observed.physicsSeconds - observed.firstBlockedAt!;
      assert.ok(blockedSeconds >= 16 && blockedSeconds < 16 + .366667 + 1e-6,
        'cancellation retains the original real 16-second budget');
      assert.deepEqual(scene.currentHeroLocation(), observed.lastAcceptedHero, 'cancellation retains the actual safe feet');
      assert.deepEqual(dog.location, retainedDog, 'an immobile or reduced-motion body cannot be moved aside');
      assert.equal(scene.petYields.has('dog'), false);
      assert.deepEqual(scene.state, before, 'cancellation cannot award resources or change saved progress');
    });
  } finally {
    hook.deregister();
    restorePainting?.();
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
