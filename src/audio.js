/**
 * Audio Engine for Five Nights at Friends
 * Plays the authentic FNAF audio files with fallback synthesis.
 */

class SoundEngine {
  constructor() {
    this.isInitialized = false;
    this.audioCache = {};

    // Sound file mapping
    this.soundPaths = {
      fan: 'assets/audio/fan.mp3',
      light_buzz: 'assets/audio/light_buzz.mp3',
      camera_blip: 'assets/audio/camera_blip.mp3',
      door_bang: 'assets/audio/door_bang.mp3',
      ambience: 'assets/audio/ambience.mp3',
      laugh: 'assets/audio/laugh.mp3',
      running: 'assets/audio/running_loud.wav',
      window_scare: 'assets/audio/window_scare.mp3',
      win_cheer: 'assets/audio/win_cheer.mp3',
      door_slam: 'assets/audio/door_slam.mp3',
      door_motor: 'assets/audio/door_motor.mp3',
      xscream: 'assets/audio/xscream.mp3',
      camera_open: 'assets/audio/camera_open.mp3',
      camera_close: 'assets/audio/camera_close.mp3',
      blip: 'assets/audio/blip.mp3',
      kitchen1: 'assets/audio/kitchen1.mp3',
      kitchen2: 'assets/audio/kitchen2.mp3',
      deep_steps: 'assets/audio/deep_steps.mp3',
      phone_guy: 'assets/audio/phone_guy.wav',
      music_box: 'assets/audio/music_box.wav',
      chime_6am: 'assets/audio/chime_6am.wav'
    };

    this.loops = {};
    this.titleAudio = null;
    this.runningAudio = null;
  }

  unlockAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {}
  }

  startTitleMusic() {
    if (this.titleAudio) return;
    try {
      this.titleAudio = new Audio(this.soundPaths.ambience);
      this.titleAudio.loop = true;
      this.titleAudio.volume = 0.32;
      this.titleAudio.play().catch(() => {});
    } catch (e) {}
  }

  stopTitleMusic() {
    if (this.titleAudio) {
      this.titleAudio.pause();
      this.titleAudio.currentTime = 0;
      this.titleAudio = null;
    }
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.stopTitleMusic();

    // Preload audio elements
    for (const [key, path] of Object.entries(this.soundPaths)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.audioCache[key] = audio;
    }

    // Start looping ambiance and fan
    this.startLoop('ambience', 0.4);
    this.startLoop('fan', 0.35);
  }

  play(key, volume = 1.0) {
    if (!this.soundPaths[key]) return;
    const sound = new Audio(this.soundPaths[key]);
    sound.volume = volume;
    sound.play().catch(e => console.warn(`Audio play failed for ${key}:`, e));
    return sound;
  }

  playSqueak() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.17);
    } catch(e) {}
  }

  playRunning() {
    this.stopRunning();

    // 1. Play high-impact stereo audio file with maximum volume
    this.runningAudio = this.play('running', 1.0);

    // 2. High-impact left-channel footsteps synthesis (louder triangle waves + kick punch)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = -0.80; // Heavy left ear bias (West Hall)
        panner.connect(ctx.destination);
      }
      const dest = panner || ctx.destination;

      // 14 rapid footsteps accelerating & crescendoing as Trevor sprints to your door
      const stepsCount = 14;
      let time = ctx.currentTime + 0.04;
      let stepInterval = 0.24;

      for (let i = 0; i < stepsCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Punchy triangle waveform with audible harmonics for phone/laptop speakers
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, time);
        osc.frequency.exponentialRampToValueAtTime(55, time + 0.14);

        // Maximum loud volume (0.65 ramped up to 1.0)
        const vol = 0.65 + (i / stepsCount) * 0.35;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.005, time + 0.16);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(time);
        osc.stop(time + 0.17);

        time += stepInterval;
        stepInterval = Math.max(0.14, stepInterval * 0.94);
      }
    } catch (e) {
      console.warn('Running sound synthesis error:', e);
    }
  }

  stopRunning() {
    if (this.runningAudio) {
      this.runningAudio.pause();
      this.runningAudio.currentTime = 0;
      this.runningAudio = null;
    }
  }

  playErrorBuzz() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(75, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  }

  playHallucinationGlitch() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Rapid frequency burst
      for (let i = 0; i < 4; i++) {
        const t = ctx.currentTime + i * 0.025;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150 + Math.random() * 800, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.025);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.03);
      }
    } catch (e) {}
  }

  play6AM() {
    this.play('chime_6am', 0.9);
    // After 6 seconds of church bell tolls, triumphant kids cheer!
    setTimeout(() => {
      this.play('win_cheer', 1.0);
    }, 6200);
  }

  startLoop(key, volume = 0.5) {
    if (this.loops[key]) return;
    const sound = new Audio(this.soundPaths[key]);
    sound.loop = true;
    sound.volume = volume;
    sound.play().catch(e => console.warn(`Audio loop failed for ${key}:`, e));
    this.loops[key] = sound;
  }

  stopLoop(key) {
    if (this.loops[key]) {
      this.loops[key].pause();
      this.loops[key].currentTime = 0;
      delete this.loops[key];
    }
  }

  playDoorSlam() {
    this.play('door_motor', 0.6);
    setTimeout(() => this.play('door_slam', 0.8), 100);
  }

  playDoorOpen() {
    this.play('door_motor', 0.5);
  }

  playButtonClick() {
    this.play('door_slam', 0.25);
  }

  setLightHum(side, active) {
    const loopKey = `light_${side}`;
    if (active) {
      if (!this.loops[loopKey]) {
        this.startLoop(loopKey, 0.4);
        if (this.loops[loopKey]) {
          this.loops[loopKey].src = this.soundPaths.light_buzz;
          this.loops[loopKey].play().catch(() => {});
        } else {
          const sound = new Audio(this.soundPaths.light_buzz);
          sound.loop = true;
          sound.volume = 0.4;
          sound.play().catch(() => {});
          this.loops[loopKey] = sound;
        }
      }
    } else {
      this.stopLoop(loopKey);
    }
  }
}

window.soundEngine = new SoundEngine();
