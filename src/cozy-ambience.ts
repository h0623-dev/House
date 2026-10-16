/** Quiet, original procedural ambience. The shared game audio context is never suspended or closed here. */
export interface CozyAmbienceState { minutes: number; walking: boolean; visible: boolean }
export interface CozyAmbience {
  /** Call from an actual sound-toggle gesture; merely loading a village never creates an audio context. */
  setEnabled(enabled: boolean): void;
  update(state: CozyAmbienceState): void;
  /** Release current sources while retaining the user's sound preference for foreground return. */
  stop(): void;
}
interface Voice { source: AudioScheduledSourceNode; nodes: AudioNode[] }
interface Wind { source: AudioBufferSourceNode; highPass: BiquadFilterNode; lowPass: BiquadFilterNode; gain: GainNode }
const MAX_VOICES = 6;
const between = (minimum: number, maximum: number): number => minimum + Math.random() * (maximum - minimum);

export function createCozyAmbience(getAudioContext: () => AudioContext): CozyAmbience {
  let enabled = false;
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let wind: Wind | undefined;
  let noise: AudioBuffer | undefined;
  let nextNature = 0;
  let nextStep = 0;
  let lastNight: boolean | undefined;
  let lastState: CozyAmbienceState = { minutes: 480, walking: false, visible: false };
  const voices = new Set<Voice>();

  function releaseVoice(voice: Voice): void {
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* An already finished one-shot needs only disconnecting. */ }
    for (const node of voice.nodes) node.disconnect();
    voices.delete(voice);
  }
  function stop(): void {
    for (const voice of [...voices]) releaseVoice(voice);
    if (wind) {
      try { wind.source.stop(); } catch { /* The source may have ended with its context. */ }
      wind.source.disconnect(); wind.highPass.disconnect(); wind.lowPass.disconnect(); wind.gain.disconnect();
      wind = undefined;
    }
    master?.disconnect(); master = undefined;
    nextNature = 0; nextStep = 0; lastNight = undefined;
  }
  function makeNoise(ctx: AudioContext): AudioBuffer {
    // One shared, softly correlated buffer serves breeze and every footstep. It is not rebuilt per update.
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < data.length; index += 1) {
      brown = (brown + (Math.random() * 2 - 1) * .025) / 1.025;
      data[index] = brown * 3;
    }
    // Remove the endpoint drift once, so the looping buffer has no sudden seam.
    const drift = data[data.length - 1] - data[0];
    for (let index = 0; index < data.length; index += 1) data[index] -= drift * index / (data.length - 1);
    return buffer;
  }
  function startWind(ctx: AudioContext): void {
    if (wind || ctx.state !== 'running') return;
    noise ??= makeNoise(ctx);
    master = ctx.createGain(); master.gain.setValueAtTime(.55, ctx.currentTime); master.connect(ctx.destination);
    const source = ctx.createBufferSource(), highPass = ctx.createBiquadFilter(), lowPass = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise; source.loop = true;
    highPass.type = 'highpass'; highPass.frequency.value = 95; highPass.Q.value = .4;
    lowPass.type = 'lowpass'; lowPass.frequency.value = 620; lowPass.Q.value = .3;
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(.022, ctx.currentTime + 1.4);
    source.connect(highPass); highPass.connect(lowPass); lowPass.connect(gain); gain.connect(master);
    source.start(); wind = { source, highPass, lowPass, gain };
  }
  function remember(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    const voice: Voice = { source, nodes }; voices.add(voice);
    source.onended = () => {
      source.onended = null;
      for (const node of nodes) node.disconnect();
      voices.delete(voice);
    };
  }
  function nature(ctx: AudioContext, night: boolean): void {
    if (!master || voices.size >= MAX_VOICES) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const start = ctx.currentTime + .012, frequency = night ? between(2_700, 3_100) : between(1_750, 2_450);
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    let duration: number;
    if (night) {
      // A distant cricket phrase, separated by long quiet intervals.
      for (let pulse = 0; pulse < 4; pulse += 1) {
        const time = start + pulse * .12;
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.004, time + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, time + .065); gain.gain.setValueAtTime(0, time + .075);
      }
      duration = .5;
    } else {
      // Two short, softly rising calls avoid a constant synthetic melody.
      for (let chirp = 0; chirp < 2; chirp += 1) {
        const time = start + chirp * .23;
        oscillator.frequency.setValueAtTime(frequency + chirp * 180, time);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.25, time + .065);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .92, time + .13);
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.01, time + .016);
        gain.gain.exponentialRampToValueAtTime(.0001, time + .12); gain.gain.setValueAtTime(0, time + .15);
      }
      duration = .42;
    }
    oscillator.connect(gain); gain.connect(master); remember(oscillator, [oscillator, gain]); oscillator.start(start); oscillator.stop(start + duration);
  }
  function footstep(ctx: AudioContext): void {
    if (!master || !noise || voices.size >= MAX_VOICES) return;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    const start = ctx.currentTime + .006;
    source.buffer = noise; filter.type = 'lowpass'; filter.frequency.value = between(450, 650); filter.Q.value = .35;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.04, start + .005);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .065);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    remember(source, [source, filter, gain]); source.start(start, between(.1, 1.8), .075);
  }
  function update(state: CozyAmbienceState): void {
    lastState = { ...state };
    if (!enabled || !state.visible || !context || context.state !== 'running') {
      if (wind || voices.size) stop();
      return;
    }
    try {
      const ctx = context, minute = ((state.minutes % 1_440) + 1_440) % 1_440;
      const night = minute < 390 || minute >= 1_140;
      startWind(ctx);
      if (lastNight !== night) {
        lastNight = night; nextNature = ctx.currentTime + between(3, 7);
        wind?.gain.gain.setTargetAtTime(night ? .014 : .022, ctx.currentTime, 1.5);
      }
      if (ctx.currentTime >= nextNature) {
        nature(ctx, night); nextNature = ctx.currentTime + (night ? between(7, 13) : between(9, 18));
      }
      if (state.walking && ctx.currentTime >= nextStep) {
        footstep(ctx); nextStep = ctx.currentTime + .24;
      } else if (!state.walking) nextStep = ctx.currentTime;
    } catch {
      // Audio is optional. Unsupported or lost devices must not interrupt a village action.
      stop();
    }
  }
  function setEnabled(value: boolean): void {
    enabled = value;
    if (!enabled) { stop(); return; }
    try {
      const next = getAudioContext();
      if (next !== context) { stop(); context = next; noise = undefined; }
      if (context.state === 'closed') return;
      if (context.state === 'suspended') void context.resume().then(() => { if (enabled) update(lastState); }).catch(() => stop());
      else update(lastState);
    } catch { enabled = false; stop(); }
  }
  return { setEnabled, update, stop };
}
