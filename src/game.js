/**
 * Game Manager for Five Nights at Friends
 * Controls game initialization, power drain, night clock, friend AI movement,
 * title screen animations, save progression, transitions, and jumpscares.
 */

class GameManager {
  constructor() {
    this.office = null;
    this.cameras = null;
    this.currentNight = 1;
    this.currentHour = 0; // 0 = 12 AM, 1 = 1 AM, ... 6 = 6 AM
    this.hourDurationSeconds = 60; // 60s per in-game hour
    this.elapsedSecondsInHour = 0;
    this.powerPercent = 99.0;
    this.isPowerOut = false;
    this.isRunning = false;
    this.isGameOver = false;

    // Overlay & UI Elements
    this.titleScreen = document.getElementById('title-screen');
    this.startOverlay = this.titleScreen || document.getElementById('start-overlay');
    this.startBtn = document.getElementById('menu-btn-newgame') || document.getElementById('start-btn');
    this.hudTime = document.getElementById('hud-time');
    this.hudNight = document.getElementById('hud-night');
    this.powerPercentEl = document.getElementById('power-percent');
    this.jumpscareOverlay = document.getElementById('jumpscare-overlay');
    this.jumpscareImg = document.getElementById('jumpscare-img');
    this.nightIntroOverlay = document.getElementById('night-intro-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.gameoverStaticCanvas = document.getElementById('gameover-static-canvas');
    this.titleStaticCanvas = document.getElementById('title-static-canvas');
    this.titleBgBase = document.getElementById('title-bg-base');
    this.titleBgTwitch = document.getElementById('title-bg-twitch');

    // Title animation states
    this.titleStaticAnimId = null;
    this.titleTwitchTimeout = null;
    this.gameoverStaticAnimId = null;
    this.titleTwitchFrames = [
      'assets/title/title_frame_1.png',
      'assets/title/title_frame_2.png',
      'assets/title/title_frame_3.png'
    ];

    // Friends Definitions & AI
    this.friends = {
      trevor: {
        name: "Trevor",
        title: "The Fast Sprinter (Foxy)",
        role: "Pirate Cove Rusher",
        aiLevel: 3,
        currentRoom: "1C", // Trevor starts in Pirate Cove, NOT on Show Stage!
        coveStage: 1,      // 1 = closed curtains, 2 = red eye peek, 3 = outside cove, 4 = sprint
        coveTimer: 0,
        isSprinting: false,
        sprintTimeRemaining: 0,
        isBanging: false,
        bangTimer: 0,
        doorWaitSeconds: 0,
        jumpscareImg: "assets/friends/trevor_scare.jpg"
      },
      chris: {
        name: "Chris",
        title: "The Big Guy",
        role: "Kitchen & East Hall Stalker",
        aiLevel: 2,
        currentRoom: "1A", // Chris starts on Show Stage
        doorWaitSeconds: 0,
        jumpscareImg: "assets/friends/chris_seahawks_scream.jpg"
      },
      spencer: {
        name: "Spencer",
        title: "Chocolate Fiend",
        role: "Dining & Supply Closet Lurker",
        aiLevel: 2,
        currentRoom: "1A", // Spencer starts on Show Stage
        doorWaitSeconds: 0,
        jumpscareImg: "assets/friends/spencer_scare.jpg"
      },
      daxon: {
        name: "Daxon",
        title: "The Goofy One",
        role: "Restrooms & Spaghetti Window Lurker",
        aiLevel: 2,
        currentRoom: "1A", // Daxon starts on Show Stage
        doorWaitSeconds: 0,
        jumpscareImg: "assets/friends/daxon_scare.jpg"
      }
    };

    // Canonical FNAF 1 AI configurations
    this.nightConfigs = {
      1: { spencer: 0, chris: 0, trevor: 0, daxon: 0 },
      2: { spencer: 3, chris: 0, trevor: 1, daxon: 1 },
      3: { spencer: 0, chris: 1, trevor: 2, daxon: 5 },
      4: { spencer: 2, chris: 1, trevor: 6, daxon: 4 },
      5: { spencer: 5, chris: 3, trevor: 5, daxon: 7 },
      6: { spencer: 10, chris: 4, trevor: 14, daxon: 12 }
    };

    // Save Data
    this.saveDataKey = 'fnaf_friends_save_v1';
    this.saveData = this.loadSaveData();

    // State flags for advanced mechanics
    this.phoneCallSound = null;
    this.poweroutMusic = null;
    this.poweroutFlickerInterval = null;
    this.clockInterval = null;
    this.movementInterval = null;
    this.foxyInterval = null;
    this.hallucinationInterval = null;
    this.leftInOffice = false;
    this.rightInOffice = false;
    this.customAI = { spencer: 2, chris: 2, trevor: 2, daxon: 2 };
    this.hasWon = false;
    this.customModalOrigin = 'menu';
    this.pendingTimeouts = new Set();
    this.timerGeneration = 0;
    this.phoneCallTimer = null;
    this.transitionSounds = new Set();
    this.kitchenClatterTimer = 0;

    this.init();
  }

  /* ==========================================================================
     SAVE PROGRESSION SYSTEM (localStorage)
     ========================================================================== */
  loadSaveData() {
    try {
      const raw = localStorage.getItem(this.saveDataKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          night: Math.max(1, Math.min(6, parseInt(parsed.night, 10) || 1)),
          beatNight5: !!parsed.beatNight5,
          beatNight6: !!parsed.beatNight6,
          stars: parseInt(parsed.stars, 10) || 0
        };
      }
    } catch (e) {
      console.warn('Could not load save data:', e);
    }
    return { night: 1, beatNight5: false, beatNight6: false, stars: 0 };
  }

  saveGameProgress(nightCompleted) {
    if (typeof nightCompleted === 'number') {
      if (nightCompleted >= 5) this.saveData.beatNight5 = true;
      if (nightCompleted >= 6) this.saveData.beatNight6 = true;
      const nextNight = Math.min(6, Math.max(this.saveData.night, nightCompleted + 1));
      this.saveData.night = nextNight;
      this.saveData.stars = (this.saveData.beatNight5 ? 1 : 0) + (this.saveData.beatNight6 ? 1 : 0);
    }
    try {
      localStorage.setItem(this.saveDataKey, JSON.stringify(this.saveData));
    } catch (e) {
      console.warn('Could not save game progress:', e);
    }
    this.updateTitleMenu();
  }

  resetSaveData() {
    this.saveData = { night: 1, beatNight5: false, beatNight6: false, stars: 0 };
    try {
      localStorage.removeItem(this.saveDataKey);
    } catch (e) {
      console.warn('Could not remove save data:', e);
    }
    this.updateTitleMenu();
  }

  /* ==========================================================================
     AUTHENTIC FNAF 1 TITLE SCREEN & TWITCH SYSTEM
     ========================================================================== */
  initTitleScreen() {
    // Preload twitch frames
    this.titleTwitchFrames.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    // Helper to request horizontal / landscape orientation lock on mobile devices
    const tryLockLandscape = () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) {}
    };

    // Unlock Web Audio & try landscape orientation lock on any user interaction while on title screen
    const ensureTitleAudio = () => {
      window.soundEngine.unlockAudio();
      tryLockLandscape();
      if (this.titleScreen && !this.titleScreen.classList.contains('hidden') && !this.isRunning) {
        window.soundEngine.startTitleMusic();
      }
    };
    ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach(evt => {
      document.addEventListener(evt, ensureTitleAudio, { passive: true });
    });

    // Initial audio attempt
    window.soundEngine.startTitleMusic();

    this.updateTitleMenu();
    this.startTitleStaticLoop();
    this.startTitleTwitchLoop();

    // Menu Buttons
    const btnNewGame = document.getElementById('menu-btn-newgame');
    if (btnNewGame) {
      btnNewGame.addEventListener('click', () => {
        tryLockLandscape();
        window.soundEngine.unlockAudio();
        window.soundEngine.playButtonClick();
        this.startNightWithIntro(1);
      });
    }

    const btnContinue = document.getElementById('menu-btn-continue');
    if (btnContinue) {
      btnContinue.addEventListener('click', () => {
        tryLockLandscape();
        window.soundEngine.unlockAudio();
        window.soundEngine.playButtonClick();
        this.startNightWithIntro(this.saveData.night || 1);
      });
    }

    const btnNight6 = document.getElementById('menu-btn-night6');
    if (btnNight6) {
      btnNight6.addEventListener('click', () => {
        window.soundEngine.unlockAudio();
        window.soundEngine.playButtonClick();
        this.startNightWithIntro(6);
      });
    }

    const btnCustom = document.getElementById('menu-btn-custom');
    if (btnCustom) {
      btnCustom.addEventListener('click', () => {
        window.soundEngine.unlockAudio();
        window.soundEngine.playButtonClick();
        this.openCustomNight('title');
      });
    }

    // Controls Modal
    const btnControls = document.getElementById('title-btn-controls');
    const controlsModal = document.getElementById('controls-modal');
    const btnCloseControls = document.getElementById('btn-close-controls');
    const btnDoneControls = document.getElementById('btn-done-controls');

    if (btnControls && controlsModal) {
      btnControls.addEventListener('click', () => {
        window.soundEngine.playButtonClick();
        controlsModal.classList.remove('hidden');
      });
    }
    const hideControls = () => {
      window.soundEngine.playButtonClick();
      if (controlsModal) controlsModal.classList.add('hidden');
    };
    if (btnCloseControls) btnCloseControls.addEventListener('click', hideControls);
    if (btnDoneControls) btnDoneControls.addEventListener('click', hideControls);

    // Reset Save Button
    const btnReset = document.getElementById('title-btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm("Reset saved night progression back to Night 1?")) {
          this.resetSaveData();
        }
      });
    }

    // Game Over Overlay Buttons
    const btnRetry = document.getElementById('btn-gameover-retry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        window.soundEngine.playButtonClick();
        const n = this.currentNight || 1;
        this.startNightWithIntro(n);
      });
    }

    const btnMenu = document.getElementById('btn-gameover-menu');
    if (btnMenu) {
      btnMenu.addEventListener('click', () => {
        window.soundEngine.playButtonClick();
        this.returnToTitle();
      });
    }

    // Win Screen Menu Button
    const btnWinMenu = document.getElementById('btn-win-menu');
    if (btnWinMenu) {
      btnWinMenu.addEventListener('click', () => {
        window.soundEngine.playButtonClick();
        this.returnToTitle();
      });
    }
  }

  updateTitleMenu() {
    const continueTag = document.getElementById('continue-night-tag');
    if (continueTag) {
      continueTag.textContent = `Night ${this.saveData.night}`;
    }

    const night6Btn = document.getElementById('menu-btn-night6');
    if (night6Btn) {
      if (this.saveData.beatNight5) {
        night6Btn.classList.remove('hidden');
      } else {
        night6Btn.classList.add('hidden');
      }
    }
  }

  startTitleStaticLoop() {
    if (!this.titleStaticCanvas) return;
    if (this.titleStaticAnimId) cancelAnimationFrame(this.titleStaticAnimId);
    const canvas = this.titleStaticCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const renderNoise = () => {
      if (!this.titleScreen || this.titleScreen.classList.contains('hidden') || this.titleScreen.hidden) {
        return;
      }
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = (Math.random() * 90 + 30) | 0; // translucent CRT static
      }
      ctx.putImageData(imgData, 0, 0);
      this.titleStaticAnimId = requestAnimationFrame(renderNoise);
    };
    renderNoise();
  }

  startTitleTwitchLoop() {
    if (this.titleTwitchTimeout) {
      clearTimeout(this.titleTwitchTimeout);
      this.titleTwitchTimeout = null;
    }

    const scheduleNextTwitch = () => {
      if (!this.titleScreen || this.titleScreen.classList.contains('hidden') || this.titleScreen.hidden) {
        return;
      }
      // Wait between 1.4s and 4.2s
      const delay = 1400 + Math.random() * 2800;
      this.titleTwitchTimeout = setTimeout(() => {
        if (!this.titleScreen || this.titleScreen.classList.contains('hidden') || this.titleScreen.hidden) {
          return;
        }
        this.executeTitleTwitch(() => {
          scheduleNextTwitch();
        });
      }, delay);
    };

    scheduleNextTwitch();
  }

  executeTitleTwitch(onComplete) {
    if (!this.titleBgTwitch) {
      if (onComplete) onComplete();
      return;
    }

    // Pick random twitch frame
    const frame = this.titleTwitchFrames[Math.floor(Math.random() * this.titleTwitchFrames.length)];
    this.titleBgTwitch.src = frame;
    this.titleBgTwitch.classList.remove('hidden');

    const duration = 75 + Math.random() * 85; // 75-160ms twitch flash
    setTimeout(() => {
      this.titleBgTwitch.classList.add('hidden');

      // 35% chance for rapid double-twitch
      if (Math.random() < 0.35) {
        setTimeout(() => {
          const secondFrame = this.titleTwitchFrames[Math.floor(Math.random() * this.titleTwitchFrames.length)];
          this.titleBgTwitch.src = secondFrame;
          this.titleBgTwitch.classList.remove('hidden');
          setTimeout(() => {
            this.titleBgTwitch.classList.add('hidden');
            if (onComplete) onComplete();
          }, 60);
        }, 50);
      } else {
        if (onComplete) onComplete();
      }
    }, duration);
  }

  stopTitleLoops() {
    if (this.titleStaticAnimId) {
      cancelAnimationFrame(this.titleStaticAnimId);
      this.titleStaticAnimId = null;
    }
    if (this.titleTwitchTimeout) {
      clearTimeout(this.titleTwitchTimeout);
      this.titleTwitchTimeout = null;
    }
    if (this.titleBgTwitch) {
      this.titleBgTwitch.classList.add('hidden');
    }
    window.soundEngine.stopTitleMusic();
  }

  returnToTitle() {
    this.stopNightEffects();
    if (this.gameoverStaticAnimId) {
      cancelAnimationFrame(this.gameoverStaticAnimId);
      this.gameoverStaticAnimId = null;
    }
    ['gameover-overlay', 'win-overlay', 'custom-night-modal', 'jumpscare-overlay', 'night-intro-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    if (this.office) this.office.reset();
    if (this.cameras) this.cameras.reset();

    if (this.titleScreen) {
      this.titleScreen.classList.remove('hidden');
      this.titleScreen.hidden = false;
    }
    this.updateTitleMenu();
    this.startTitleStaticLoop();
    this.startTitleTwitchLoop();
    window.soundEngine.startTitleMusic();
  }

  /* ==========================================================================
     AUTHENTIC 12:00 AM NIGHT INTRO TRANSITION
     ========================================================================== */
  startNightWithIntro(night) {
    this.stopTitleLoops();
    if (this.titleScreen) {
      this.titleScreen.classList.add('hidden');
    }
    ['gameover-overlay', 'win-overlay', 'custom-night-modal', 'jumpscare-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    const isCustom = (night === 'custom');
    const nightNum = isCustom ? 'custom' : (parseInt(night, 10) || 1);
    this.currentNight = nightNum;

    const introOverlay = document.getElementById('night-intro-overlay');
    const introLabel = document.getElementById('night-intro-label');
    const introTime = document.getElementById('night-intro-time');

    const nightOrdinal = {
      1: '1st Night',
      2: '2nd Night',
      3: '3rd Night',
      4: '4th Night',
      5: '5th Night',
      6: '6th Night'
    };

    if (introLabel) {
      introLabel.textContent = isCustom ? 'Custom Night' : (nightOrdinal[nightNum] || `Night ${nightNum}`);
    }
    if (introTime) {
      introTime.textContent = '12:00 AM';
    }

    if (introOverlay) {
      introOverlay.classList.remove('hidden');
    }

    // Play subtle clock blip
    window.soundEngine.play('blip', 0.8);

    const instant = window.location.search.includes('instant=1');
    const delay = instant ? 100 : 1900;

    this.scheduleTimeout(() => {
      if (introOverlay) {
        introOverlay.classList.add('hidden');
      }
      this.startGame();
    }, delay);
  }

  /* ==========================================================================
     INITIALIZATION & HUD FULLSCREEN BINDINGS
     ========================================================================== */
  init() {
    this.initTitleScreen();

    // Fallback legacy start button if rendered
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        if (this.isRunning) return;
        this.startNightWithIntro(1);
      });
    }

    // Custom Night Modal openers & closers
    const openCustomBtn = document.getElementById('open-custom-btn');
    const customModal = document.getElementById('custom-night-modal');
    const closeCustomBtn = document.getElementById('btn-close-custom-modal');
    const openFromWinBtn = document.getElementById('btn-open-custom-from-win');

    if (openCustomBtn && customModal) {
      openCustomBtn.addEventListener('click', () => this.openCustomNight('menu'));
    }

    if (openFromWinBtn && customModal) {
      openFromWinBtn.addEventListener('click', () => this.openCustomNight('win'));
    }

    if (closeCustomBtn && customModal) {
      closeCustomBtn.addEventListener('click', () => {
        customModal.classList.add('hidden');
        if (this.customModalOrigin === 'win' && this.hasWon) {
          const winOverlay = document.getElementById('win-overlay');
          if (winOverlay) winOverlay.classList.remove('hidden');
        } else if (!this.isRunning) {
          this.returnToTitle();
        }
      });
    }

    // AI Stepper buttons in Custom Night
    const stepBtns = document.querySelectorAll('.step-btn');
    stepBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const friend = btn.getAttribute('data-friend');
        const dir = Number(btn.getAttribute('data-dir'));
        if (!Object.prototype.hasOwnProperty.call(this.customAI, friend) || ![-1, 1].includes(dir)) return;
        this.customAI[friend] = this.clampAI(this.customAI[friend] + dir);
        const valEl = document.getElementById(`ai-num-${friend}`);
        if (valEl) valEl.textContent = this.customAI[friend];
      });
    });

    // 20/20/20/20 Mode Quick Preset
    const btn20 = document.getElementById('btn-20-20-mode');
    if (btn20) {
      btn20.addEventListener('click', () => {
        ['spencer', 'chris', 'trevor', 'daxon'].forEach(f => {
          this.customAI[f] = 20;
          const valEl = document.getElementById(`ai-num-${f}`);
          if (valEl) valEl.textContent = '20';
        });
      });
    }

    // Start Custom Night
    const startCustomBtn = document.getElementById('btn-start-custom-night');
    if (startCustomBtn) {
      startCustomBtn.addEventListener('click', () => {
        if (this.isRunning) return;
        if (customModal) customModal.classList.add('hidden');
        this.startNightWithIntro('custom');
      });
    }

    // Phone Guy Mute button
    const muteBtn = document.getElementById('btn-mute-call');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.mutePhoneCall();
      });
    }

    // Next Night Button on 6 AM Win Screen
    const nextNightBtn = document.getElementById('btn-next-night');
    if (nextNightBtn) {
      nextNightBtn.addEventListener('click', () => {
        if (!this.hasWon) return;
        const winOverlay = document.getElementById('win-overlay');
        if (winOverlay) winOverlay.classList.add('hidden');
        if (this.currentNight === 'custom' || this.currentNight >= 6) {
          this.openCustomNight('win');
          return;
        }
        const next = typeof this.currentNight === 'number' ? this.currentNight + 1 : 1;
        this.startNightWithIntro(next);
      });
    }

    const instant = window.location.search.includes('instant=1');
    if (window.location.search.includes('autostart')) {
      if (instant) {
        this.startGame();
      } else {
        this.scheduleTimeout(() => this.startGame(), 200);
      }
    }
  }

  clampAI(value) {
    const level = Number(value);
    return Number.isFinite(level) ? Math.max(0, Math.min(20, Math.trunc(level))) : 0;
  }

  openCustomNight(origin) {
    if (this.isRunning || (origin === 'win' && !this.hasWon)) return;
    const modal = document.getElementById('custom-night-modal');
    if (!modal) return;
    this.customModalOrigin = origin;
    this.stopTitleLoops();
    if (this.titleScreen) {
      this.titleScreen.hidden = true;
      this.titleScreen.classList.add('hidden');
    }
    const winOverlay = document.getElementById('win-overlay');
    if (winOverlay) winOverlay.classList.add('hidden');
    modal.classList.remove('hidden');
  }

  scheduleTimeout(callback, delay) {
    const generation = this.timerGeneration;
    const timer = setTimeout(() => {
      this.pendingTimeouts.delete(timer);
      if (generation === this.timerGeneration) callback();
    }, delay);
    this.pendingTimeouts.add(timer);
    return timer;
  }

  clearPendingTimeouts() {
    this.timerGeneration++;
    this.pendingTimeouts.forEach(timer => clearTimeout(timer));
    this.pendingTimeouts.clear();
    this.phoneCallTimer = null;
    const hallucination = document.getElementById('hallucination-overlay');
    if (hallucination) hallucination.classList.add('hidden');
    const toast = document.getElementById('iphone-fs-toast');
    if (toast) toast.classList.remove('visible');
  }

  playTransitionSound(key, volume) {
    const sound = window.soundEngine.play(key, volume);
    if (sound) {
      this.transitionSounds.add(sound);
      sound.onended = () => this.transitionSounds.delete(sound);
    }
    return sound;
  }

  clearTransitionSounds() {
    this.transitionSounds.forEach(sound => {
      sound.onended = null;
      sound.pause();
      sound.currentTime = 0;
    });
    this.transitionSounds.clear();
  }

  stopNightEffects() {
    this.clearPendingTimeouts();
    this.clearTransitionSounds();
    ['clockInterval', 'movementInterval', 'foxyInterval', 'hallucinationInterval', 'poweroutFlickerInterval'].forEach(key => {
      clearInterval(this[key]);
      this[key] = null;
    });
    this.mutePhoneCall(false);
    if (this.poweroutMusic) {
      this.poweroutMusic.pause();
      this.poweroutMusic = null;
    }
    window.soundEngine.stopRunning();
    window.soundEngine.stopLoop('fan');
    window.soundEngine.stopLoop('ambience');
    window.soundEngine.setLightHum('left', false);
    window.soundEngine.setLightHum('right', false);
  }

  startGame() {
    this.resetNightState();
    this.stopTitleLoops();
    if (this.titleScreen) {
      this.titleScreen.hidden = true;
      this.titleScreen.classList.add('hidden');
    }
    ['win-overlay', 'custom-night-modal', 'jumpscare-overlay', 'night-intro-overlay', 'gameover-overlay'].forEach(id => {
      const overlay = document.getElementById(id);
      if (overlay) overlay.classList.add('hidden');
    });

    // Start authentic audio engine
    window.soundEngine.init();
    window.soundEngine.startLoop('fan', 0.35);
    window.soundEngine.startLoop('ambience', 0.4);

    // Start or reset office and cameras controllers
    if (!this.office) {
      this.office = new OfficeController(this);
    }
    if (!this.cameras) {
      this.cameras = new CameraController(this);
    }

    this.isRunning = true;
    this.isGameOver = false;
    this.isPowerOut = false;
    this.powerPercent = 99.0;
    this.currentHour = 0;
    this.elapsedSecondsInHour = 0;
    this.leftInOffice = false;
    this.rightInOffice = false;

    // Apply Night AI settings
    if (this.currentNight !== 'custom' && (!Number.isInteger(this.currentNight) || !this.nightConfigs[this.currentNight])) {
      this.currentNight = 1;
    }
    const cfg = this.currentNight === 'custom' ? this.customAI : this.nightConfigs[this.currentNight];
    Object.keys(this.friends).forEach(key => {
      this.friends[key].aiLevel = this.clampAI(cfg[key]);
    });

    // Reset friend starting positions
    this.friends.trevor.currentRoom = '1C';
    this.friends.trevor.coveStage = 1;
    this.friends.trevor.coveTimer = 0;
    this.friends.trevor.isSprinting = false;
    this.friends.trevor.sprintTimeRemaining = 0;
    this.friends.trevor.doorWaitSeconds = 0;
    this.friends.trevor.isBanging = false;
    this.friends.trevor.bangTimer = 0;
    this.kitchenClatterTimer = 0;

    this.friends.chris.currentRoom = '1A';
    this.friends.chris.doorWaitSeconds = 0;

    this.friends.spencer.currentRoom = '1A';
    this.friends.spencer.doorWaitSeconds = 0;

    this.friends.daxon.currentRoom = '1A';
    this.friends.daxon.doorWaitSeconds = 0;

    // Update HUD
    const nightLabel = (this.currentNight === 'custom') ? 'Custom Night' : `Night ${this.currentNight}`;
    if (this.hudNight) this.hudNight.textContent = nightLabel;
    if (this.hudTime) this.hudTime.textContent = '12 AM';
    if (this.powerPercentEl) this.powerPercentEl.textContent = '99%';

    const instant = window.location.search.includes('instant=1');

    if (window.location.search.includes('light=left')) {
      if (window.location.search.includes('who=spencer')) {
        this.friends.spencer.currentRoom = 'left_door';
      } else {
        this.friends.trevor.currentRoom = 'left_door';
      }
      if (instant) {
        this.office.toggleLeftLight();
      } else {
        this.scheduleTimeout(() => this.office.toggleLeftLight(), 100);
      }
    } else if (window.location.search.includes('light=right')) {
      if (window.location.search.includes('who=chris')) {
        this.friends.chris.currentRoom = 'right_door';
      } else {
        this.friends.daxon.currentRoom = 'right_door';
      }
      if (instant) {
        this.office.toggleRightLight();
      } else {
        this.scheduleTimeout(() => this.office.toggleRightLight(), 100);
      }
    } else if (window.location.search.includes('door=left')) {
      if (instant) {
        this.office.toggleLeftDoor();
      } else {
        this.scheduleTimeout(() => this.office.toggleLeftDoor(), 100);
      }
    } else if (window.location.search.includes('cams=open')) {
      const urlParams = new URLSearchParams(window.location.search);
      const cam = urlParams.get('cam') || '1A';
      if (cam === '1B') this.friends.spencer.currentRoom = '1B';
      else if (cam === '1C') {
        this.friends.trevor.currentRoom = '1C';
        const st = parseInt(urlParams.get('stage') || '1');
        this.friends.trevor.coveStage = st;
      }
      else if (cam === '2A') {
        this.friends.trevor.currentRoom = '2A';
        this.friends.trevor.isSprinting = true;
        this.friends.trevor.sprintTimeRemaining = 10.0;
      }
      else if (cam === '2B') this.friends.spencer.currentRoom = '2B';
      else if (cam === '3') this.friends.spencer.currentRoom = '3';
      else if (cam === '4A') this.friends.daxon.currentRoom = '4A';
      else if (cam === '4B') this.friends.daxon.currentRoom = '4B';
      else if (cam === '5') this.friends.spencer.currentRoom = '5';
      else if (cam === '6') this.friends.chris.currentRoom = '6';
      else if (cam === '7') this.friends.daxon.currentRoom = '7';

      if (instant) {
        this.cameras.openMonitor(true);
        if (cam) this.cameras.switchCamera(cam, true);
      } else {
        this.scheduleTimeout(() => {
          this.cameras.openMonitor();
          if (cam) this.cameras.switchCamera(cam, true);
        }, 250);
      }
    }

    console.log(`${nightLabel} started with authentic assets! Squad active:`, this.friends);

    this.startClockAndPower();
    this.startAIMovementLoop();

    // Start Phone Guy call on Nights 1 to 4
    if ([1, 2, 3, 4].includes(this.currentNight)) {
      this.startPhoneCall();
    }
  }

  startClockAndPower() {
    let lastTime = performance.now();

    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      if (!this.isRunning || this.isGameOver) return;

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Drain power
      if (!this.isPowerOut) {
        const usage = this.office.getUsageLevel();
        const drainRate = 0.085 * usage;
        this.powerPercent = Math.max(0, this.powerPercent - drainRate * delta);
        this.powerPercentEl.textContent = `${Math.floor(this.powerPercent)}%`;

        if (this.powerPercent <= 0) {
          this.triggerPowerOutage();
        }
      }

      // Hour clock
      this.elapsedSecondsInHour += delta;
      while (this.elapsedSecondsInHour >= this.hourDurationSeconds) {
        this.elapsedSecondsInHour -= this.hourDurationSeconds;
        this.currentHour++;

        const hours = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM'];
        this.hudTime.textContent = hours[this.currentHour] || '6 AM';

        // Animatronic AI level increases slightly each hour (Canonical FNAF 1 canon)
        if (this.currentNight !== 'custom' && this.currentHour < 6) {
          if (this.currentNight === 1) {
            // Chris (Freddy) NEVER moves on Night 1!
            if (this.currentHour === 2) this.friends.spencer.aiLevel = this.clampAI(this.friends.spencer.aiLevel + 1);
            if (this.currentHour === 3) this.friends.daxon.aiLevel = this.clampAI(this.friends.daxon.aiLevel + 1);
            if (this.currentHour === 4) this.friends.trevor.aiLevel = this.clampAI(this.friends.trevor.aiLevel + 1);
          } else if (this.currentNight === 2) {
            // Chris (Freddy) stays at 0 on Night 2!
            if (this.currentHour === 3) this.friends.spencer.aiLevel = this.clampAI(this.friends.spencer.aiLevel + 1);
            if (this.currentHour === 4) this.friends.daxon.aiLevel = this.clampAI(this.friends.daxon.aiLevel + 1);
            if (this.currentHour === 5) this.friends.trevor.aiLevel = this.clampAI(this.friends.trevor.aiLevel + 1);
          } else {
            // Nights 3+: squad advances
            this.friends.spencer.aiLevel = this.clampAI(this.friends.spencer.aiLevel + 1);
            this.friends.daxon.aiLevel = this.clampAI(this.friends.daxon.aiLevel + 1);
            this.friends.trevor.aiLevel = this.clampAI(this.friends.trevor.aiLevel + 1);
            if (this.currentHour >= 3) {
              this.friends.chris.aiLevel = this.clampAI(this.friends.chris.aiLevel + 1);
            }
          }
        }

        if (this.currentHour >= 6) {
          this.triggerWin();
          return;
        }
      }

      // Kitchen clatter audio
      this.updateKitchenAudio(delta);

      // Doorway attack check
      this.checkDoorwayAttacks(delta);

    }, 200);
  }

  /* ==========================================================================
     FRIEND AI MOVEMENT ENGINE
     ========================================================================== */
  startAIMovementLoop() {
    // Normal squad movement check every 4.8 seconds
    if (this.movementInterval) clearInterval(this.movementInterval);
    this.movementInterval = setInterval(() => {
      if (!this.isRunning || this.isPowerOut || this.isGameOver) return;

      this.processMovementTick('chris');
      this.processMovementTick('spencer');
      this.processMovementTick('daxon');
    }, 4800);

    // Dedicated Trevor (Foxy) Pirate Cove progression & deterrence loop every 1.0 second
    if (this.foxyInterval) clearInterval(this.foxyInterval);
    this.foxyInterval = setInterval(() => {
      if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
      this.updateTrevorFoxyAI();
    }, 1000);
  }

  updateTrevorFoxyAI() {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
    const trevor = this.friends.trevor;
    if (trevor.aiLevel <= 0 || trevor.isSprinting || trevor.currentRoom !== '1C') return;

    // Deterrence check: If player has camera monitor open and is watching CAM 1C (Pirate Cove)
    const isWatchingCove = (this.cameras && this.cameras.isOpen && this.cameras.activeCam === '1C');
    if (isWatchingCove) {
      // Watching Pirate Cove deters Trevor! Reset progress timer
      trevor.coveTimer = Math.max(0, trevor.coveTimer - 1.5);
      return;
    }

    // Trevor advances stages when unmonitored
    trevor.coveTimer += 1.0;

    // Movement opportunity every ~9 to 12s
    const threshold = Math.max(5.0, 13.0 - trevor.aiLevel * 2.0);
    if (trevor.coveTimer >= threshold) {
      trevor.coveTimer = 0;
      const roll = Math.floor(Math.random() * 20) + 1;
      if (roll <= trevor.aiLevel + 3) {
        trevor.coveStage++;

        if (trevor.coveStage === 2 || trevor.coveStage === 3) {
          window.soundEngine.play('deep_steps', 0.6);
          if (this.cameras && this.cameras.isOpen) {
            if (this.cameras.activeCam === '1C') this.cameras.triggerStaticBurst();
            this.cameras.updateFeedDisplay();
          }
        } else if (trevor.coveStage >= 4) {
          // TREVOR HAS BROKEN OUT! SPRINT DOWN WEST HALL CAM 2A!
          trevor.coveStage = 4;
          trevor.isSprinting = true;
          trevor.currentRoom = '2A';
          trevor.sprintTimeRemaining = 2.5; // ~2.5s sprint window matching running audio
          window.soundEngine.playRunning();

          if (this.cameras && this.cameras.isOpen) {
            this.cameras.triggerStaticBurst();
            this.cameras.updateFeedDisplay();
          }
        }
      }
    }
  }

  processMovementTick(friendKey) {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
    const friend = this.friends[friendKey];
    if (!friend) return;

    // Movement opportunity roll (1 to 20 <= aiLevel)
    const roll = Math.floor(Math.random() * 20) + 1;
    if (roll > friend.aiLevel) return;

    // Friend advances along their single-variant route
    const oldRoom = friend.currentRoom;

    switch (friendKey) {
      case 'chris':
        // Big Guy / Kitchen pizza lover & East Hall
        if (oldRoom === '1A') friend.currentRoom = '1B';
        else if (oldRoom === '1B') friend.currentRoom = '6'; // Kitchen clatter!
        else if (oldRoom === '6') friend.currentRoom = '4A';
        else if (oldRoom === '4A') friend.currentRoom = '4B';
        else if (oldRoom === '4B') {
          friend.currentRoom = 'right_door';
          friend.doorWaitSeconds = 0;
        }
        break;

      case 'spencer':
        // Chocolate fiend & Dining table / Supply closet stalker
        if (oldRoom === '1A') friend.currentRoom = '1B'; // Spencer sitting at dining table!
        else if (oldRoom === '1B') friend.currentRoom = (Math.random() > 0.5 ? '3' : '5');
        else if (oldRoom === '5') friend.currentRoom = '3';
        else if (oldRoom === '3') friend.currentRoom = '2B';
        else if (oldRoom === '2B') {
          friend.currentRoom = 'left_door';
          friend.doorWaitSeconds = 0;
        }
        break;

      case 'daxon':
        // Goofy spaghetti hair & Restrooms & East Hall window lurker
        if (oldRoom === '1A') friend.currentRoom = '7'; // Restrooms
        else if (oldRoom === '7') friend.currentRoom = '4A';
        else if (oldRoom === '4A') friend.currentRoom = '4B'; // Spaghetti hair!
        else if (oldRoom === '4B') {
          friend.currentRoom = 'right_door';
          friend.doorWaitSeconds = 0;
        }
        break;
    }

    if (friend.currentRoom !== oldRoom) {
      window.soundEngine.play('deep_steps', 0.5);

      // If player is viewing either room, glitch static & update feed
      if (this.cameras && this.cameras.isOpen) {
        if (this.cameras.activeCam === oldRoom || this.cameras.activeCam === friend.currentRoom || this.cameras.activeCam === '1A') {
          this.cameras.triggerStaticBurst();
        }
        this.cameras.updateFeedDisplay();
      }
    }
  }

  onDoorOpened(side) {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
    if (side === 'left') {
      // If player opens the left door WHILE Trevor is actively banging: instant jumpscare!
      if (this.friends.trevor.isBanging) {
        this.friends.trevor.isBanging = false;
        window.soundEngine.stopRunning();
        this.triggerJumpscare(this.friends.trevor);
      }
    }
  }

  onDoorClosed(side) {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
    if (side === 'left') {
      let blocked = false;
      // If Trevor was lingering (non-sprinting / non-banging)
      if (this.friends.trevor.currentRoom === 'left_door' && !this.friends.trevor.isBanging && !this.friends.trevor.isSprinting) {
        window.soundEngine.stopRunning();
        this.friends.trevor.currentRoom = '1C'; // Trevor retreats back to cove!
        this.friends.trevor.coveStage = 1;
        this.friends.trevor.coveTimer = 0;
        this.friends.trevor.isSprinting = false;
        this.friends.trevor.sprintTimeRemaining = 0;
        this.friends.trevor.doorWaitSeconds = 0;
        this.friends.trevor.isBanging = false;
        this.friends.trevor.bangTimer = 0;
        blocked = true;
      }
      if (this.friends.spencer.currentRoom === 'left_door') {
        this.friends.spencer.currentRoom = '1B'; // Spencer retreats to dining table!
        blocked = true;
      }
      if (blocked) {
        window.soundEngine.play('door_bang', 0.95);
        if (this.cameras && this.cameras.isOpen) this.cameras.updateFeedDisplay();
      }
    } else if (side === 'right') {
      let blocked = false;
      if (this.friends.daxon.currentRoom === 'right_door') {
        this.friends.daxon.currentRoom = '7'; // Daxon retreats to restrooms!
        blocked = true;
      }
      if (this.friends.chris.currentRoom === 'right_door') {
        this.friends.chris.currentRoom = '6'; // Chris retreats to kitchen!
        blocked = true;
      }
      if (blocked) {
        window.soundEngine.play('door_bang', 0.95);
        if (this.cameras && this.cameras.isOpen) this.cameras.updateFeedDisplay();
      }
    }
  }

  checkDoorwayAttacks(delta) {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
    const trevor = this.friends.trevor;

    // 1. Handle Trevor active sprint down West Hall (CAM 2A)
    if (trevor.isSprinting) {
      trevor.sprintTimeRemaining -= delta;
      if (trevor.sprintTimeRemaining <= 0) {
        trevor.isSprinting = false;
        window.soundEngine.stopRunning();

        if (this.office.leftDoorClosed) {
          // Left door was closed in time! Foxy bangs repeatedly on the metal door!
          window.soundEngine.play('door_bang', 0.95);
          trevor.isBanging = true;
          trevor.bangTimer = 3.2; // Knocks duration: door cannot be safely opened until this expires!
          trevor.currentRoom = 'left_door';
          trevor.doorWaitSeconds = 0;

          // Power drain from Foxy banging on door
          this.powerPercent = Math.max(0, this.powerPercent - 2.0);
          this.powerPercentEl.textContent = `${Math.floor(this.powerPercent)}%`;
          if (this.powerPercent <= 0) {
            this.triggerPowerOutage();
            return;
          }
        } else {
          // Door was open! Instant jumpscare!
          this.triggerJumpscare(trevor);
          return;
        }
      }
    }

    // 2. Handle Trevor active door-banging state
    if (trevor.isBanging) {
      // If player opens door while he is banging: instant jumpscare!
      if (!this.office.leftDoorClosed) {
        trevor.isBanging = false;
        this.triggerJumpscare(trevor);
        return;
      }

      trevor.bangTimer -= delta;
      if (trevor.bangTimer <= 0) {
        // Banging is complete! Now it's safe to open the door!
        trevor.isBanging = false;
        trevor.currentRoom = '1C'; // Trevor retreats back to Pirate Cove
        trevor.coveStage = 1;
        trevor.coveTimer = 0;
        trevor.sprintTimeRemaining = 0;
        trevor.doorWaitSeconds = 0;

        if (this.cameras && this.cameras.isOpen) {
          if (this.cameras.activeCam === '1C') this.cameras.triggerStaticBurst();
          this.cameras.updateFeedDisplay();
        }
      }
    }

    // 3. Check left door (Trevor lingering if non-banging)
    if (trevor.currentRoom === 'left_door' && !trevor.isBanging && !trevor.isSprinting) {
      if (this.office.leftDoorClosed) {
        this.onDoorClosed('left');
      } else {
        trevor.doorWaitSeconds += delta;
        if (trevor.doorWaitSeconds > 4.5 || (this.cameras && this.cameras.isOpen && trevor.doorWaitSeconds > 1.2)) {
          window.soundEngine.stopRunning();
          this.triggerJumpscare(trevor);
          return;
        }
      }
    }

    // Check Spencer at left door
    if (this.friends.spencer.currentRoom === 'left_door') {
      if (this.office.leftDoorClosed) {
        this.onDoorClosed('left');
      } else {
        this.friends.spencer.doorWaitSeconds += delta;
        if (this.friends.spencer.doorWaitSeconds > 5.0) {
          this.triggerJumpscare(this.friends.spencer);
          return;
        }
      }
    }

    // Check right door
    if (this.friends.daxon.currentRoom === 'right_door') {
      if (this.office.rightDoorClosed) {
        this.onDoorClosed('right');
      } else {
        this.friends.daxon.doorWaitSeconds += delta;
        if (this.friends.daxon.doorWaitSeconds > 5.0 || (this.cameras && this.cameras.isOpen && this.friends.daxon.doorWaitSeconds > 1.5)) {
          this.triggerJumpscare(this.friends.daxon);
          return;
        }
      }
    }

    if (this.friends.chris.currentRoom === 'right_door') {
      if (this.office.rightDoorClosed) {
        this.onDoorClosed('right');
      } else {
        this.friends.chris.doorWaitSeconds += delta;
        if (this.friends.chris.doorWaitSeconds > 4.5) {
          this.triggerJumpscare(this.friends.chris);
        }
      }
    }
  }

  updateKitchenAudio(delta) {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;

    const chrisInKitchen = (this.friends.chris && this.friends.chris.currentRoom === '6');
    if (!chrisInKitchen) {
      this.kitchenClatterTimer = 0;
      return;
    }

    // Chris is in the kitchen clattering pots, pans, and eating pizza!
    this.kitchenClatterTimer = (this.kitchenClatterTimer || 0) - delta;
    if (this.kitchenClatterTimer <= 0) {
      this.kitchenClatterTimer = 2.4 + Math.random() * 2.2; // Every 2.4 - 4.6 seconds
      const isViewingKitchen = (this.cameras && this.cameras.isOpen && this.cameras.activeCam === '6');
      const volume = isViewingKitchen ? 0.85 : 0.25; // Loud on CAM 6, ambient elsewhere
      const soundKey = Math.random() > 0.5 ? 'kitchen1' : 'kitchen2';
      window.soundEngine.play(soundKey, volume);
    }
  }

  triggerJumpscare(friend) {
    if (!this.isRunning || this.isGameOver || this.hasWon) return;
    this.isGameOver = true;
    this.isRunning = false;

    // Clear all active intervals & audio
    this.stopNightEffects();
    window.soundEngine.stopRunning();

    // Force close cameras immediately
    if (this.cameras) this.cameras.reset();

    // Play loud jumpscare screech!
    this.playTransitionSound('xscream', 1.0);

    // Show jumpscare overlay
    if (this.jumpscareImg && friend) {
      this.jumpscareImg.src = friend.jumpscareImg;
    }
    if (this.jumpscareOverlay) {
      this.jumpscareOverlay.classList.remove('hidden');
    }

    // Plunge lights off
    if (this.office) {
      if (this.office.leftLightOn) this.office.toggleLeftLight();
      if (this.office.rightLightOn) this.office.toggleRightLight();
    }

    this.scheduleTimeout(() => {
      this.showGameOver(friend);
    }, 2000);
  }

  showGameOver(friend) {
    this.stopNightEffects();
    if (this.jumpscareOverlay) this.jumpscareOverlay.classList.add('hidden');
    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.remove('hidden');
      const friendText = document.getElementById('gameover-friend-text');
      if (friendText && friend) {
        friendText.textContent = `${friend.name} (${friend.title}) caught you!`;
      }
      this.startGameOverStaticLoop();
    }
  }

  startGameOverStaticLoop() {
    if (!this.gameoverStaticCanvas) return;
    if (this.gameoverStaticAnimId) cancelAnimationFrame(this.gameoverStaticAnimId);
    const canvas = this.gameoverStaticCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const drawNoise = () => {
      if (!this.gameoverOverlay || this.gameoverOverlay.classList.contains('hidden')) {
        return;
      }
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = (Math.random() * 190 + 65) | 0; // dense TV static
      }
      ctx.putImageData(imgData, 0, 0);
      this.gameoverStaticAnimId = requestAnimationFrame(drawNoise);
    };
    drawNoise();
  }

  /* ==========================================================================
     AUTHENTIC 0% POWER OUTAGE - CHRIS TOREADOR MARCH SEQUENCE
     ========================================================================== */
  triggerPowerOutage() {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
    this.isPowerOut = true;
    this.powerPercent = 0;
    this.powerPercentEl.textContent = '0%';
    this.clearPendingTimeouts();
    ['movementInterval', 'foxyInterval', 'hallucinationInterval'].forEach(key => {
      clearInterval(this[key]);
      this[key] = null;
    });
    window.soundEngine.setLightHum('left', false);
    window.soundEngine.setLightHum('right', false);

    // Mute phone call if active
    this.mutePhoneCall(false);

    // Force close cameras
    if (this.cameras) this.cameras.reset();
    this.clearTransitionSounds();
    window.soundEngine.stopRunning();
    window.soundEngine.stopLoop('fan');
    window.soundEngine.stopLoop('ambience');

    // Force doors open if closed & lights off
    if (this.office) {
      this.office.reset();

      // Pitch black office
      this.office.bgImg.src = 'assets/office/office_clean.png';
      this.office.stage.style.filter = 'brightness(0.04) contrast(1.5)';
    }

    console.log("POWER OUT! Office plunged into darkness. Waiting for Chris...");

    // After 1.8 seconds, Chris appears in the left doorway with glowing eyes and music box!
    this.scheduleTimeout(() => {
      if (this.isGameOver) return;

      if (this.office) {
        this.office.bgImg.src = 'assets/office/office_powerout_chris.png';
      }

      // Start Toreador music box
      this.poweroutMusic = this.playTransitionSound('music_box', 0.9);

      // Flickering light effect synchronized with music box
      this.poweroutFlickerInterval = setInterval(() => {
        if (!this.office) return;
        const b = (Math.random() < 0.25) ? 0.05 : (0.35 + Math.random() * 0.65);
        this.office.stage.style.filter = `brightness(${b.toFixed(2)}) contrast(1.4)`;
      }, 95);

      // Music box plays for 7 to 10 seconds before sudden darkness
      const musicDuration = 7000 + Math.random() * 3500;
      this.scheduleTimeout(() => {
        if (this.isGameOver) return;

        if (this.poweroutFlickerInterval) {
          clearInterval(this.poweroutFlickerInterval);
          this.poweroutFlickerInterval = null;
        }

        if (this.poweroutMusic) {
          this.poweroutMusic.pause();
          this.poweroutMusic.currentTime = 0;
          this.poweroutMusic = null;
        }

        // Total pitch blackness
        if (this.office) {
          this.office.bgImg.src = 'assets/office/office_clean.png';
          this.office.stage.style.filter = 'brightness(0.01)';
        }

        // Deep footsteps creeping closer in pitch dark silence
        this.playTransitionSound('deep_steps', 0.85);

        // 2.2 seconds later: Jumpscare by Chris!
        this.scheduleTimeout(() => {
          if (this.isGameOver) return;
          this.triggerJumpscare(this.friends.chris);
        }, 2200);

      }, musicDuration);

    }, 1800);
  }

  /* ==========================================================================
     AUTHENTIC 6:00 AM WIN SCREEN
     ========================================================================== */
  triggerWin() {
    if (!this.isRunning || this.isGameOver || this.hasWon) return;
    this.hasWon = true;
    this.isRunning = false;
    this.currentHour = 6;
    if (this.hudTime) this.hudTime.textContent = '6 AM';

    // Clear loops and intervals
    this.stopNightEffects();

    // Force close cameras
    if (this.cameras) this.cameras.reset();

    // Save night progression
    const completed = typeof this.currentNight === 'number' ? this.currentNight : 5;
    this.saveGameProgress(completed);

    // Show 6:00 AM Win Overlay
    const winOverlay = document.getElementById('win-overlay');
    const clockDigit = document.getElementById('win-clock-digit');
    const winDetails = document.getElementById('win-details');
    const winSub = document.getElementById('win-sub');

    if (winOverlay) winOverlay.classList.remove('hidden');
    if (clockDigit) {
      clockDigit.textContent = '5 AM';
      clockDigit.classList.remove('flip');
    }
    if (winDetails) {
      winDetails.hidden = true;
      winDetails.classList.add('hidden');
    }
    const nextNightBtn = document.getElementById('btn-next-night');
    if (nextNightBtn) {
      nextNightBtn.textContent = (this.currentNight === 'custom' || this.currentNight >= 6) ? 'CUSTOM NIGHT' : 'NEXT NIGHT';
    }

    // Play Westminster chime + 6 church bell tolls, then kids cheer at 6.2s
    this.playTransitionSound('chime_6am', 0.9);

    // At 2.2s: Flip clock from 5 AM to 6 AM!
    this.scheduleTimeout(() => {
      if (clockDigit) {
        clockDigit.textContent = '6 AM';
        clockDigit.classList.add('flip');
      }
    }, 2200);

    // At 6.2s: Reveal night completed details and stars
    this.scheduleTimeout(() => {
      this.playTransitionSound('win_cheer', 1.0);
      if (winDetails) {
        winDetails.hidden = false;
        winDetails.classList.remove('hidden');
        if (winSub) {
          const nightName = (this.currentNight === 'custom') ? 'Custom Night' : `Night ${this.currentNight}`;
          winSub.textContent = `You survived ${nightName}!`;
        }
      }
    }, 6200);
  }

  resetNightState() {
    this.isRunning = false;
    this.hasWon = false;
    this.stopNightEffects();
    this.powerPercent = 99.0;
    this.isPowerOut = false;
    this.isGameOver = false;
    this.elapsedSecondsInHour = 0;
    this.currentHour = 0;
    this.leftInOffice = false;
    this.rightInOffice = false;

    // Reset squad positions & states
    this.friends.trevor.currentRoom = '1C';
    this.friends.trevor.coveStage = 1;
    this.friends.trevor.coveTimer = 0;
    this.friends.trevor.isSprinting = false;
    this.friends.trevor.sprintTimeRemaining = 0;
    this.friends.trevor.doorWaitSeconds = 0;
    this.friends.trevor.isBanging = false;
    this.friends.trevor.bangTimer = 0;
    this.kitchenClatterTimer = 0;

    this.friends.chris.currentRoom = '1A';
    this.friends.chris.doorWaitSeconds = 0;

    this.friends.spencer.currentRoom = '1A';
    this.friends.spencer.doorWaitSeconds = 0;

    this.friends.daxon.currentRoom = '1A';
    this.friends.daxon.doorWaitSeconds = 0;
    if (this.office) this.office.reset();
    if (this.cameras) this.cameras.reset();
  }

  /* ==========================================================================
     PHONE GUY 12:00 AM RECORDING
     ========================================================================== */
  startPhoneCall() {
    const widget = document.getElementById('phone-call-widget');
    if (!widget) return;

    this.mutePhoneCall(false);

    let soundKey = null;
    if (this.currentNight === 1) soundKey = 'phone_guy';
    else if (this.currentNight === 2) soundKey = 'phone_night2';
    else if (this.currentNight === 3) soundKey = 'phone_night3';
    else if (this.currentNight === 4) soundKey = 'phone_night4';

    if (!soundKey) return;

    this.phoneCallTimer = this.scheduleTimeout(() => {
      this.phoneCallTimer = null;
      if (!this.isRunning || this.isGameOver || this.isPowerOut) return;
      widget.classList.remove('hidden');
      this.phoneCallSound = window.soundEngine.play(soundKey, 0.95);
      if (this.phoneCallSound) {
        this.phoneCallSound.onended = () => {
          this.mutePhoneCall(false);
        };
      }
    }, 1200);
  }

  mutePhoneCall(playSound = true) {
    if (this.phoneCallTimer !== null) {
      clearTimeout(this.phoneCallTimer);
      this.pendingTimeouts.delete(this.phoneCallTimer);
      this.phoneCallTimer = null;
    }
    if (playSound) {
      window.soundEngine.playButtonClick();
    }
    if (this.phoneCallSound) {
      this.phoneCallSound.onended = null;
      this.phoneCallSound.pause();
      this.phoneCallSound.currentTime = 0;
      this.phoneCallSound = null;
    }
    const widget = document.getElementById('phone-call-widget');
    if (widget) widget.classList.add('hidden');
  }

  /* ==========================================================================
     CREEPY HALLUCINATIONS & "IT'S ME"
     ========================================================================== */
  startHallucinationLoop() {
    // Completely removed per user request
    if (this.hallucinationInterval) {
      clearInterval(this.hallucinationInterval);
      this.hallucinationInterval = null;
    }
  }

  triggerHallucination() {
    // Completely removed per user request
  }

  /* ==========================================================================
     DOOR JAMMING & SNEAK-IN MECHANICS
     ========================================================================== */
  onMonitorOpened() {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;

    // Check Left Door sneak-in (Spencer)
    if (this.friends.spencer.currentRoom === 'left_door' && !this.office.leftDoorClosed) {
      console.log("Spencer sneaked into the office! Left door jammed!");
      this.leftInOffice = true;
      this.office.setJammed('left', true);
      this.friends.spencer.currentRoom = 'in_office';
    }

    // Check Right Door sneak-in (Daxon or Chris)
    if (this.friends.daxon.currentRoom === 'right_door' && !this.office.rightDoorClosed) {
      console.log("Daxon sneaked into the office! Right door jammed!");
      this.rightInOffice = true;
      this.office.setJammed('right', true);
      this.friends.daxon.currentRoom = 'in_office';
    } else if (this.friends.chris.currentRoom === 'right_door' && !this.office.rightDoorClosed) {
      console.log("Chris sneaked into the office! Right door jammed!");
      this.rightInOffice = true;
      this.office.setJammed('right', true);
      this.friends.chris.currentRoom = 'in_office';
    }
  }

  onMonitorClosed() {
    if (!this.isRunning || this.isGameOver || this.isPowerOut) return;

    // If an animatronic sneaked in while monitor was up -> JUMPSCARE ON MONITOR DROP!
    if (this.leftInOffice) {
      this.triggerJumpscare(this.friends.spencer);
      return;
    }

    if (this.rightInOffice) {
      const friend = (this.friends.daxon.currentRoom === 'in_office') ? this.friends.daxon : this.friends.chris;
      this.triggerJumpscare(friend);
      return;
    }
  }

  toggleCameras() {
    if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
    if (this.cameras) {
      this.cameras.toggleMonitor();
    }
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new GameManager();
  });
} else {
  window.game = new GameManager();
}
