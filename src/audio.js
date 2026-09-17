/**
 * Audio Engine for Five Nights at Friends
 * Plays the authentic FNAF audio files with fallback synthesis.
 */

class SoundEngine {
  constructor() {
    this.isInitialized = false;
    this.ctx = null;
    this.audioPool = {};
    this.soundPoolMax = 2; // Maximum concurrent elements per sound key

    // Sound file mapping
    this.soundPaths = {
      fan: 'assets/audio/fan.mp3',
      light_buzz: 'assets/audio/light_buzz.mp3',
      camera_blip: 'assets/audio/camera_blip.mp3',
      door_bang: 'assets/audio/door_bang.mp3',
      ambience: 'assets/audio/ambience.mp3',
      laugh: 'assets/audio/laugh.mp3',
      running: 'assets/audio/running.mp3',
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
      phone_guy: 'assets/audio/phone_call.mp3',
      phone_night2: 'assets/audio/phone_night2.mp3',
      phone_night3: 'assets/audio/phone_night3.mp3',
      phone_night4: 'assets/audio/phone_night4.mp3',
      music_box: 'assets/audio/music_box.wav',
      chime_6am: 'assets/audio/chime_6am.wav'
    };

    this.loops = {};
    this.titleAudio = null;
    this.runningAudio = null;
    this._runningSource = null;
    this._runningGain = null;
    this.masterVolume = 1.0;
    try {
      const saved = localStorage.getItem('fnaf_volume');
      if (saved !== null) {
        const v = parseFloat(saved);
        if (!isNaN(v) && v >= 0 && v <= 1) this.masterVolume = v;
      }
    } catch (e) {}
  }

  setMasterVolume(val) {
    const num = Math.max(0, Math.min(1, parseFloat(val)));
    this.masterVolume = Number.isFinite(num) ? num : 1.0;
    try {
      localStorage.setItem('fnaf_volume', this.masterVolume.toString());
    } catch (e) {}

    if (this._runningGain) {
      this._runningGain.gain.value = 3.0 * this.masterVolume;
    } else if (this.runningAudio) {
      this.runningAudio.volume = this.masterVolume;
    }

    // Adjust active title audio
    if (this.titleAudio) {
      this.titleAudio.volume = Math.max(0, Math.min(1, 0.32 * this.masterVolume));
    }

    // Adjust active loops
    Object.keys(this.loops).forEach(key => {
      const sound = this.loops[key];
      if (sound) {
        const baseVol = (key === 'fan') ? 0.35 : ((key === 'ambience') ? 0.4 : 0.35);
        sound.volume = Math.max(0, Math.min(1, baseVol * this.masterVolume));
      }
    });

    // Adjust active audio elements in pool
    Object.keys(this.audioPool).forEach(k => {
      this.audioPool[k].forEach(a => {
        if (!a.paused && !a.ended) {
          a.volume = Math.max(0, Math.min(1, this.masterVolume));
        }
      });
    });
  }

  getMasterVolume() {
    return this.masterVolume;
  }

  getAudioContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlockAudio() {
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  startTitleMusic() {
    try {
      if (!this.titleAudio) {
        this.titleAudio = new Audio(this.soundPaths.ambience);
        this.titleAudio.loop = true;
        this.titleAudio.volume = Math.max(0, Math.min(1, 0.32 * this.masterVolume));
      }
      if (this.titleAudio.paused) {
        const p = this.titleAudio.play();
        if (p && p.catch) {
          p.catch(() => {
            // If iOS Safari rejects autoplay, reset instance so next user gesture creates a fresh Audio element
            this.titleAudio = null;
          });
        }
      }
    } catch (e) {
      this.titleAudio = null;
    }
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

    // Start looping ambiance and fan
    this.startLoop('ambience', 0.4);
    this.startLoop('fan', 0.35);
  }

  play(key, volume = 1.0) {
    const src = this.soundPaths[key];
    if (!src) return null;

    if (!this.audioPool[key]) {
      this.audioPool[key] = [];
    }

    const pool = this.audioPool[key];
    let audio = pool.find(a => a.paused || a.ended);

    if (!audio) {
      if (pool.length < this.soundPoolMax) {
        audio = new Audio(src);
        pool.push(audio);
      } else {
        // Reuse oldest element
        audio = pool[0];
        try {
          audio.pause();
        } catch (e) {}
      }
    }

    try {
      audio.volume = Math.max(0, Math.min(1, volume * this.masterVolume));
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {}

    return audio;
  }

  playSqueak() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
    } catch (e) {}
  }

  playRunning() {
    this.stopRunning();
    try {
      const ctx = this.getAudioContext();
      if (!ctx || ctx.state !== 'running') {
        this.runningAudio = this.play('running', 1.0);
        return;
      }
      const audio = new Audio(this.soundPaths.running);
      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 3.0 * this.masterVolume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      audio.volume = 1.0;
      audio.play().catch(() => {});
      this.runningAudio = audio;
      this._runningSource = source;
      this._runningGain = gainNode;
    } catch (e) {
      this.runningAudio = this.play('running', 1.0);
    }
  }

  stopRunning() {
    if (this.runningAudio) {
      try {
        this.runningAudio.pause();
        this.runningAudio.currentTime = 0;
      } catch (e) {}
      try {
        if (this._runningSource) this._runningSource.disconnect();
        if (this._runningGain) this._runningGain.disconnect();
      } catch (e) {}
      this._runningSource = null;
      this._runningGain = null;
      this.runningAudio = null;
    }
  }

  playErrorBuzz() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
    setTimeout(() => {
      this.play('win_cheer', 1.0);
    }, 6200);
  }

  startLoop(key, volume = 0.5) {
    if (this.loops[key]) return;
    const src = this.soundPaths[key];
    if (!src) return;
    const sound = new Audio(src);
    sound.loop = true;
    sound.volume = Math.max(0, Math.min(1, volume * this.masterVolume));
    sound.play().catch(() => {});
    this.loops[key] = sound;
  }

  stopLoop(key) {
    if (this.loops[key]) {
      try {
        this.loops[key].pause();
        this.loops[key].currentTime = 0;
      } catch (e) {}
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
        const sound = new Audio(this.soundPaths.light_buzz);
        sound.loop = true;
        sound.volume = Math.max(0, Math.min(1, 0.35 * this.masterVolume));
        sound.play().catch(() => {});
        this.loops[loopKey] = sound;
      }
    } else {
      this.stopLoop(loopKey);
    }
  }
}

window.soundEngine = new SoundEngine();
