/**
 * Game Manager for Five Nights at Friends
 * Controls game initialization, power drain, night clock, friend AI movement, and jumpscares.
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

    // Overlay elements
    this.startOverlay = document.getElementById('start-overlay');
    this.startBtn = document.getElementById('start-btn');
    this.hudTime = document.getElementById('hud-time');
    this.hudNight = document.getElementById('hud-night');
    this.powerPercentEl = document.getElementById('power-percent');
    this.jumpscareOverlay = document.getElementById('jumpscare-overlay');
    this.jumpscareImg = document.getElementById('jumpscare-img');

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

    // Night AI balance configuration
    this.nightConfigs = {
      1: { spencer: 0, chris: 0, trevor: 1, daxon: 1 },
      2: { spencer: 3, chris: 1, trevor: 2, daxon: 3 },
      3: { spencer: 5, chris: 4, trevor: 3, daxon: 5 },
      4: { spencer: 8, chris: 7, trevor: 6, daxon: 8 },
      5: { spencer: 12, chris: 10, trevor: 10, daxon: 12 }
    };

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

    this.init();
  }

  init() {
    this.startBtn.addEventListener('click', () => {
      this.startGame();
    });

    // Fullscreen Toggles (Start Modal & In-Game HUD)
    const startFsBtn = document.getElementById('start-fs-btn');
    const hudFsBtn = document.getElementById('btn-fullscreen');
    let lastFsToggle = 0;

    const updateFsButtons = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      const label = isFs ? '✕ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
      if (startFsBtn) startFsBtn.textContent = label;
      if (hudFsBtn) hudFsBtn.textContent = label;
    };

    document.addEventListener('fullscreenchange', updateFsButtons);
    document.addEventListener('webkitfullscreenchange', updateFsButtons);

    const showIPhoneToast = () => {
      let toast = document.getElementById('iphone-fs-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'iphone-fs-toast';
        toast.className = 'iphone-fs-toast';
        toast.innerHTML = '📱 <strong>iOS Fullscreen:</strong> Tap Safari Share icon <strong>(⎋)</strong> then <strong>"Add to Home Screen"</strong> for borderless full screen!';
        document.body.appendChild(toast);
      }
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 5000);
    };

    const toggleFs = (e) => {
      if (e) {
        e.stopPropagation();
      }
      const now = Date.now();
      if (now - lastFsToggle < 400) return;
      lastFsToggle = now;

      const doc = document;
      const docEl = doc.documentElement;
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

      if (!isFs) {
        let req = null;
        try {
          if (docEl.requestFullscreen) req = docEl.requestFullscreen();
          else if (docEl.webkitRequestFullscreen) req = docEl.webkitRequestFullscreen();
          else if (docEl.mozRequestFullScreen) req = docEl.mozRequestFullScreen();
          else if (docEl.msRequestFullscreen) req = docEl.msRequestFullscreen();
        } catch (err) {
          console.warn('Fullscreen call failed:', err);
          showIPhoneToast();
        }

        if (req && req.catch) {
          req.catch((err) => {
            console.warn('Fullscreen request rejected:', err);
            showIPhoneToast();
          });
        } else if (!req) {
          showIPhoneToast();
        }
        window.scrollTo(0, 1);
      } else {
        if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
      }
    };

    if (startFsBtn) {
      startFsBtn.addEventListener('click', toggleFs);
    }
    if (hudFsBtn) {
      hudFsBtn.addEventListener('click', toggleFs);
    }

    // Custom Night Modal openers & closers
    const openCustomBtn = document.getElementById('open-custom-btn');
    const customModal = document.getElementById('custom-night-modal');
    const closeCustomBtn = document.getElementById('btn-close-custom-modal');
    const openFromWinBtn = document.getElementById('btn-open-custom-from-win');

    if (openCustomBtn && customModal) {
      openCustomBtn.addEventListener('click', () => {
        customModal.classList.remove('hidden');
      });
    }

    if (openFromWinBtn && customModal) {
      openFromWinBtn.addEventListener('click', () => {
        const winOverlay = document.getElementById('win-overlay');
        if (winOverlay) winOverlay.classList.add('hidden');
        customModal.classList.remove('hidden');
      });
    }

    if (closeCustomBtn && customModal) {
      closeCustomBtn.addEventListener('click', () => {
        customModal.classList.add('hidden');
      });
    }

    // AI Stepper buttons in Custom Night
    const stepBtns = document.querySelectorAll('.step-btn');
    stepBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const friend = btn.getAttribute('data-friend');
        const dir = parseInt(btn.getAttribute('data-dir'));
        this.customAI[friend] = Math.max(0, Math.min(20, this.customAI[friend] + dir));
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
        if (customModal) customModal.classList.add('hidden');
        this.currentNight = 'custom';
        this.friends.spencer.aiLevel = this.customAI.spencer;
        this.friends.chris.aiLevel = this.customAI.chris;
        this.friends.trevor.aiLevel = this.customAI.trevor;
        this.friends.daxon.aiLevel = this.customAI.daxon;
        this.startGame();
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
        const winOverlay = document.getElementById('win-overlay');
        if (winOverlay) winOverlay.classList.add('hidden');
        const next = (typeof this.currentNight === 'number') ? this.currentNight + 1 : 2;
        this.currentNight = next;
        this.resetNightState();
        this.startGame();
      });
    }

    const instant = window.location.search.includes('instant=1');
    if (window.location.search.includes('autostart')) {
      if (instant) {
        this.startGame();
      } else {
        setTimeout(() => this.startGame(), 200);
      }
    }
  }

  startGame() {
    this.startOverlay.classList.add('hidden');

    // Start authentic audio engine
    window.soundEngine.init();

    // Start or reset office and cameras controllers
    if (!this.office) {
      this.office = new OfficeController(this);
    } else {
      this.office.reset();
    }
    if (!this.cameras) {
      this.cameras = new CameraController(this);
    } else {
      this.cameras.reset();
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
    if (this.currentNight === 'custom') {
      this.friends.spencer.aiLevel = this.customAI.spencer;
      this.friends.chris.aiLevel = this.customAI.chris;
      this.friends.trevor.aiLevel = this.customAI.trevor;
      this.friends.daxon.aiLevel = this.customAI.daxon;
    } else if (this.nightConfigs[this.currentNight]) {
      const cfg = this.nightConfigs[this.currentNight];
      this.friends.spencer.aiLevel = cfg.spencer;
      this.friends.chris.aiLevel = cfg.chris;
      this.friends.trevor.aiLevel = cfg.trevor;
      this.friends.daxon.aiLevel = cfg.daxon;
    }

    // Reset friend starting positions
    this.friends.trevor.currentRoom = '1C';
    this.friends.trevor.coveStage = 1;
    this.friends.trevor.coveTimer = 0;
    this.friends.trevor.isSprinting = false;
    this.friends.trevor.sprintTimeRemaining = 0;
    this.friends.trevor.doorWaitSeconds = 0;

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
        setTimeout(() => this.office.toggleLeftLight(), 100);
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
        setTimeout(() => this.office.toggleRightLight(), 100);
      }
    } else if (window.location.search.includes('door=left')) {
      if (instant) {
        this.office.toggleLeftDoor();
      } else {
        setTimeout(() => this.office.toggleLeftDoor(), 100);
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
        setTimeout(() => {
          this.cameras.openMonitor();
          if (cam) this.cameras.switchCamera(cam, true);
        }, 250);
      }
    }

    console.log(`${nightLabel} started with authentic assets! Squad active:`, this.friends);

    this.startClockAndPower();
    this.startAIMovementLoop();
    this.startHallucinationLoop();

    // Start Phone Guy call on Night 1
    if (this.currentNight === 1) {
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
      if (this.elapsedSecondsInHour >= this.hourDurationSeconds) {
        this.elapsedSecondsInHour = 0;
        this.currentHour++;

        const hours = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM'];
        this.hudTime.textContent = hours[this.currentHour] || '6 AM';

        // Animatronic AI level increases slightly each hour!
        Object.values(this.friends).forEach(f => f.aiLevel++);

        if (this.currentHour >= 6) {
          this.triggerWin();
        }
      }

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
    const trevor = this.friends.trevor;
    if (trevor.isSprinting || trevor.currentRoom === 'left_door') return;

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
          trevor.sprintTimeRemaining = 3.2; // 3.2s sprint window
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

  onDoorClosed(side) {
    if (side === 'left') {
      let blocked = false;
      if (this.friends.trevor.currentRoom === 'left_door') {
        this.friends.trevor.currentRoom = '1C'; // Trevor retreats back to cove!
        this.friends.trevor.coveStage = 1;
        this.friends.trevor.coveTimer = 0;
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
    const trevor = this.friends.trevor;

    // Handle Trevor active sprint
    if (trevor.isSprinting) {
      trevor.sprintTimeRemaining -= delta;
      if (trevor.sprintTimeRemaining <= 0) {
        trevor.isSprinting = false;
        trevor.currentRoom = 'left_door';

        if (this.office.leftDoorClosed) {
          // Left door closed! BANG!
          window.soundEngine.play('door_bang', 0.95);
          this.powerPercent = Math.max(0, this.powerPercent - 1.5);
          this.powerPercentEl.textContent = `${Math.floor(this.powerPercent)}%`;

          trevor.currentRoom = '1C';
          trevor.coveStage = 1;
          trevor.coveTimer = 0;

          if (this.cameras && this.cameras.isOpen) {
            this.cameras.triggerStaticBurst();
            this.cameras.updateFeedDisplay();
          }
        } else {
          // Door was open! JUMPSCARE!
          this.triggerJumpscare(trevor);
          return;
        }
      }
    }

    // Check left door (Spencer or Trevor lingering)
    if (trevor.currentRoom === 'left_door') {
      if (this.office.leftDoorClosed) {
        this.onDoorClosed('left');
      } else {
        trevor.doorWaitSeconds += delta;
        if (trevor.doorWaitSeconds > 4.5 || (this.cameras && this.cameras.isOpen && trevor.doorWaitSeconds > 1.2)) {
          this.triggerJumpscare(trevor);
        }
      }
    }

    if (this.friends.spencer.currentRoom === 'left_door') {
      if (this.office.leftDoorClosed) {
        this.onDoorClosed('left');
      } else {
        this.friends.spencer.doorWaitSeconds += delta;
        if (this.friends.spencer.doorWaitSeconds > 5.0) {
          this.triggerJumpscare(this.friends.spencer);
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

  triggerJumpscare(friend) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isRunning = false;

    // Clear all active intervals & audio
    this.mutePhoneCall(false);
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.movementInterval) clearInterval(this.movementInterval);
    if (this.foxyInterval) clearInterval(this.foxyInterval);
    if (this.hallucinationInterval) clearInterval(this.hallucinationInterval);
    if (this.poweroutFlickerInterval) clearInterval(this.poweroutFlickerInterval);

    if (this.poweroutMusic) {
      this.poweroutMusic.pause();
      this.poweroutMusic = null;
    }

    // Force close cameras immediately
    if (this.cameras && this.cameras.isOpen) {
      this.cameras.closeMonitor();
    }

    // Play loud jumpscare screech!
    window.soundEngine.play('xscream', 1.0);

    // Show jumpscare overlay
    this.jumpscareImg.src = friend.jumpscareImg;
    this.jumpscareOverlay.classList.remove('hidden');

    // Plunge lights off
    if (this.office) {
      if (this.office.leftLightOn) this.office.toggleLeftLight();
      if (this.office.rightLightOn) this.office.toggleRightLight();
    }

    setTimeout(() => {
      this.jumpscareOverlay.classList.add('hidden');
      alert(`GAME OVER!\n\n${friend.name} (${friend.title}) caught you!`);
      window.location.reload();
    }, 2200);
  }

  /* ==========================================================================
     AUTHENTIC 0% POWER OUTAGE - CHRIS TOREADOR MARCH SEQUENCE
     ========================================================================== */
  triggerPowerOutage() {
    if (this.isPowerOut || this.isGameOver) return;
    this.isPowerOut = true;
    this.powerPercent = 0;
    this.powerPercentEl.textContent = '0%';

    // Mute phone call if active
    this.mutePhoneCall(false);

    // Stop ambient loops
    window.soundEngine.stopLoop('fan');
    window.soundEngine.stopLoop('ambience');
    window.soundEngine.setLightHum('left', false);
    window.soundEngine.setLightHum('right', false);

    // Force close cameras
    if (this.cameras && this.cameras.isOpen) {
      this.cameras.closeMonitor();
    }

    // Force doors open if closed & lights off
    if (this.office) {
      if (this.office.leftDoorClosed) this.office.toggleLeftDoor();
      if (this.office.rightDoorClosed) this.office.toggleRightDoor();
      if (this.office.leftLightOn) this.office.toggleLeftLight();
      if (this.office.rightLightOn) this.office.toggleRightLight();

      // Pitch black office
      this.office.bgImg.src = 'assets/office/office_clean.png';
      this.office.stage.style.filter = 'brightness(0.04) contrast(1.5)';
    }

    console.log("POWER OUT! Office plunged into darkness. Waiting for Chris...");

    // After 1.8 seconds, Chris appears in the left doorway with glowing eyes and music box!
    setTimeout(() => {
      if (this.isGameOver) return;

      if (this.office) {
        this.office.bgImg.src = 'assets/office/office_powerout_chris.png';
      }

      // Start Toreador music box
      this.poweroutMusic = window.soundEngine.play('music_box', 0.9);

      // Flickering light effect synchronized with music box
      this.poweroutFlickerInterval = setInterval(() => {
        if (!this.office) return;
        const b = (Math.random() < 0.25) ? 0.05 : (0.35 + Math.random() * 0.65);
        this.office.stage.style.filter = `brightness(${b.toFixed(2)}) contrast(1.4)`;
      }, 95);

      // Music box plays for 7 to 10 seconds before sudden darkness
      const musicDuration = 7000 + Math.random() * 3500;
      setTimeout(() => {
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
        window.soundEngine.play('deep_steps', 0.85);

        // 2.2 seconds later: Jumpscare by Chris!
        setTimeout(() => {
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
    if (this.isGameOver) return;
    this.isRunning = false;

    // Clear loops and intervals
    this.mutePhoneCall(false);
    window.soundEngine.stopLoop('fan');
    window.soundEngine.stopLoop('ambience');

    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.movementInterval) clearInterval(this.movementInterval);
    if (this.foxyInterval) clearInterval(this.foxyInterval);
    if (this.hallucinationInterval) clearInterval(this.hallucinationInterval);

    // Force close cameras
    if (this.cameras && this.cameras.isOpen) {
      this.cameras.closeMonitor();
    }

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
    if (winDetails) winDetails.classList.add('hidden');

    // Play Westminster chime + 6 church bell tolls, then kids cheer at 6.2s
    window.soundEngine.play6AM();

    // At 2.2s: Flip clock from 5 AM to 6 AM!
    setTimeout(() => {
      if (clockDigit) {
        clockDigit.textContent = '6 AM';
        clockDigit.classList.add('flip');
      }
    }, 2200);

    // At 6.2s: Reveal night completed details and stars
    setTimeout(() => {
      if (winDetails) {
        winDetails.classList.remove('hidden');
        if (winSub) {
          const nightName = (this.currentNight === 'custom') ? 'Custom Night' : `Night ${this.currentNight}`;
          winSub.textContent = `You survived ${nightName}!`;
        }
      }
    }, 6200);
  }

  resetNightState() {
    this.powerPercent = 99.0;
    this.isPowerOut = false;
    this.isGameOver = false;
    this.elapsedSecondsInHour = 0;
    this.currentHour = 0;
    this.leftInOffice = false;
    this.rightInOffice = false;

    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.movementInterval) clearInterval(this.movementInterval);
    if (this.foxyInterval) clearInterval(this.foxyInterval);
    if (this.hallucinationInterval) clearInterval(this.hallucinationInterval);
    if (this.poweroutFlickerInterval) clearInterval(this.poweroutFlickerInterval);

    if (this.poweroutMusic) {
      this.poweroutMusic.pause();
      this.poweroutMusic = null;
    }

    if (this.office) {
      this.office.reset();
    }
    if (this.cameras) {
      this.cameras.reset();
    }

    // Reset squad positions & states
    this.friends.trevor.currentRoom = '1C';
    this.friends.trevor.coveStage = 1;
    this.friends.trevor.coveTimer = 0;
    this.friends.trevor.isSprinting = false;
    this.friends.trevor.sprintTimeRemaining = 0;
    this.friends.trevor.doorWaitSeconds = 0;

    this.friends.chris.currentRoom = '1A';
    this.friends.chris.doorWaitSeconds = 0;

    this.friends.spencer.currentRoom = '1A';
    this.friends.spencer.doorWaitSeconds = 0;

    this.friends.daxon.currentRoom = '1A';
    this.friends.daxon.doorWaitSeconds = 0;
  }

  /* ==========================================================================
     PHONE GUY 12:00 AM RECORDING
     ========================================================================== */
  startPhoneCall() {
    const widget = document.getElementById('phone-call-widget');
    if (!widget) return;

    this.mutePhoneCall(false);

    setTimeout(() => {
      if (!this.isRunning || this.isGameOver || this.isPowerOut) return;
      widget.classList.remove('hidden');
      this.phoneCallSound = window.soundEngine.play('phone_guy', 0.95);
      if (this.phoneCallSound) {
        this.phoneCallSound.onended = () => {
          this.mutePhoneCall(false);
        };
      }
    }, 1200);
  }

  mutePhoneCall(playSound = true) {
    if (playSound) {
      window.soundEngine.playButtonClick();
    }
    if (this.phoneCallSound) {
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
    if (this.hallucinationInterval) clearInterval(this.hallucinationInterval);
    this.hallucinationInterval = setInterval(() => {
      if (!this.isRunning || this.isPowerOut || this.isGameOver) return;
      // 20% chance every 22 seconds
      if (Math.random() < 0.20) {
        this.triggerHallucination();
      }
    }, 22000);
  }

  triggerHallucination() {
    if (this.isGameOver || this.isPowerOut) return;

    const overlay = document.getElementById('hallucination-overlay');
    const img = document.getElementById('hallucination-img');
    const text = overlay ? overlay.querySelector('.hallucination-text') : null;
    if (!overlay || !img) return;

    const creepyImages = [
      'assets/friends/chris_seahawks_scream.jpg',
      'assets/friends/trevor_blue_eyes_nobg.png',
      'assets/friends/trevor_death_stare.jpg',
      'assets/friends/spencer_pucker.jpg',
      'assets/friends/daxon_fisheye.jpg'
    ];

    const pick = creepyImages[Math.floor(Math.random() * creepyImages.length)];
    img.src = pick;

    if (text) {
      text.style.display = (Math.random() < 0.6) ? 'block' : 'none';
    }

    // Audio stutter glitch
    window.soundEngine.playHallucinationGlitch();

    // Rapid double-flash
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.add('hidden');
      setTimeout(() => {
        if (this.isGameOver) return;
        overlay.classList.remove('hidden');
        setTimeout(() => {
          overlay.classList.add('hidden');
        }, 80);
      }, 40);
    }, 70);
  }

  /* ==========================================================================
     DOOR JAMMING & SNEAK-IN MECHANICS
     ========================================================================== */
  onMonitorOpened() {
    if (this.isPowerOut || this.isGameOver) return;

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
    if (this.isGameOver || this.isPowerOut) return;

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

    // Occasional creepy hallucination flash upon putting monitor down (8% chance)
    if (Math.random() < 0.08) {
      this.triggerHallucination();
    }
  }

  toggleCameras() {
    if (this.isPowerOut || this.isGameOver) return;
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
