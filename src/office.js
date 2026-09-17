/**
 * Authentic FNAF 1 Office Controller
 * Rock-solid steady office view with smooth panoramic mouse look, authentic doors, and hallway lights.
 */

class OfficeController {
  constructor(gameManager) {
    this.game = gameManager;

    // DOM Elements
    this.stage = document.getElementById('office-stage');
    this.bgImg = document.getElementById('office-bg');

    // Left Controls
    this.leftDoorContainer = document.getElementById('left-door-container');
    this.leftDoorImg = document.getElementById('left-door-img');
    this.btnLeftDoor = document.getElementById('btn-left-door');
    this.btnLeftLight = document.getElementById('btn-left-light');
    this.ledLeftDoor = document.getElementById('led-left-door');
    this.ledLeftLight = document.getElementById('led-left-light');
    this.panelLeftImg = document.getElementById('img-panel-left');

    // Right Controls
    this.rightDoorContainer = document.getElementById('right-door-container');
    this.rightDoorImg = document.getElementById('right-door-img');
    this.btnRightDoor = document.getElementById('btn-right-door');
    this.btnRightLight = document.getElementById('btn-right-light');
    this.ledRightDoor = document.getElementById('led-right-door');
    this.ledRightLight = document.getElementById('led-right-light');
    this.panelRightImg = document.getElementById('img-panel-right');

    // HUD Elements
    this.powerPercentEl = document.getElementById('power-percent');
    this.usageBarsContainer = document.getElementById('usage-bars');
    this.camBar = document.getElementById('cam-monitor-bar');

    // State
    this.leftDoorClosed = false;
    this.rightDoorClosed = false;
    this.leftLightOn = false;
    this.rightLightOn = false;
    this.leftJammed = false;
    this.rightJammed = false;

    // Panning state: dynamically center camera on desk/fan
    const viewW = window.innerWidth;
    const stageW = this.stage && this.stage.offsetWidth > 0 ? this.stage.offsetWidth : (viewW * 1.55);
    const maxP = Math.max(0, stageW - viewW);
    this.currentPanX = - (maxP / 2);
    this.targetPanX = - (maxP / 2);

    // Base asset paths
    this.baseOfficePath = 'assets/office/office_boys.png';
    this.leftLightPath = 'assets/office/office_left_light.png';
    this.rightLightPath = 'assets/office/office_right_light.png';

    // Door Sprite Sheet Configurations for 100% glitch-free GPU playback
    this.leftDoorTotalFrames = 12;
    this.rightDoorTotalFrames = 16;
    this.leftDoorCurrentIndex = -1;
    this.rightDoorCurrentIndex = -1;
    this.leftDoorAnimId = null;
    this.rightDoorAnimId = null;
    this.renderLoopId = null;

    // Preload sprite sheets in memory immediately
    const preloadLeft = new Image();
    preloadLeft.src = 'assets/doors/door_left_sheet.png';
    if (preloadLeft.decode) preloadLeft.decode().catch(() => {});

    const preloadRight = new Image();
    preloadRight.src = 'assets/doors/door_right_sheet.png';
    if (preloadRight.decode) preloadRight.decode().catch(() => {});

    // Preload all hallway light and friend light images for instant 0ms switching
    [
      'assets/office/office_left_light.png',
      'assets/office/office_left_light_trevor.png',
      'assets/office/office_left_light_spencer.png',
      'assets/office/office_right_light.png',
      'assets/office/office_right_light_daxon_tongue.png',
      'assets/office/office_right_light_chris.png',
      'assets/office/office_right_light_chris_shirtless.png',
      'assets/office/panel_left_both.png',
      'assets/office/panel_left_door.png',
      'assets/office/panel_left_light.png',
      'assets/office/panel_left_off.png',
      'assets/office/panel_right_both.png',
      'assets/office/panel_right_door.png',
      'assets/office/panel_right_light.png',
      'assets/office/panel_right_off.png'
    ].forEach(src => {
      const img = new Image();
      img.src = src;
      if (img.decode) img.decode().catch(() => {});
    });

    // Set initial rock-solid background
    this.bgImg.src = this.baseOfficePath;

    if (window.location.search.includes('pan=left')) {
      this.currentPanX = 0;
      this.targetPanX = 0;
    } else if (window.location.search.includes('pan=right')) {
      this.currentPanX = -maxP;
      this.targetPanX = -maxP;
    }

    // Apply transform immediately with vertical center (-50%)
    this.stage.style.transform = `translate3d(${this.currentPanX.toFixed(2)}px, -50%, 0)`;

    this.setupEvents();
    this.updatePanelTextures();
    this.startRenderLoop();
  }

  setupEvents() {
    // Mouse movement: smooth panoramic glide across office with authentic FNAF 1 edge docking
    window.addEventListener('mousemove', (e) => {
      const viewWidth = window.innerWidth;
      const stageWidth = this.stage.offsetWidth;
      const maxPan = stageWidth - viewWidth;

      if (maxPan > 0) {
        const rawNorm = Math.min(Math.max(e.clientX / viewWidth, 0), 1);
        // Authentic FNAF 1 edge docking: left 15% docks solidly at 0, right 15% docks solidly at -maxPan
        const edgeZone = 0.15;
        let norm;
        if (rawNorm <= edgeZone) {
          norm = 0;
        } else if (rawNorm >= 1 - edgeZone) {
          norm = 1;
        } else {
          norm = (rawNorm - edgeZone) / (1 - 2 * edgeZone);
        }
        this.targetPanX = - (norm * maxPan);
      }
    });

    // Touch controls: smooth swipe & drag glide for mobile phones & tablets
    let isTouching = false;
    let touchStartX = 0;
    let touchStartPan = 0;

    window.addEventListener('touchstart', (e) => {
      // Don't drag if user taps interactive buttons or wall control panels
      if (e.target.closest('.wall-btn, .wall-panel, .wall-panel-hitbox, .wall-panel-sprite, .cam-btn, .cam-monitor-bar, button, .custom-btn, .step-btn')) {
        return;
      }
      if (e.touches.length === 1) {
        isTouching = true;
        touchStartX = e.touches[0].clientX;
        touchStartPan = this.targetPanX;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isTouching || e.touches.length !== 1) return;
      const viewWidth = window.innerWidth;
      const stageWidth = this.stage.offsetWidth;
      const maxPan = stageWidth - viewWidth;
      if (maxPan > 0) {
        const deltaX = e.touches[0].clientX - touchStartX;
        // Dragging right reveals left; dragging left reveals right
        const newTarget = touchStartPan + deltaX * 1.5;
        this.targetPanX = Math.max(Math.min(newTarget, 0), -maxPan);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isTouching = false;
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
      isTouching = false;
    }, { passive: true });

    // Window resize
    window.addEventListener('resize', () => {
      const viewWidth = window.innerWidth;
      const stageWidth = this.stage.offsetWidth;
      const maxPan = stageWidth - viewWidth;
      if (maxPan > 0) {
        this.targetPanX = Math.max(Math.min(this.targetPanX, 0), -maxPan);
      }
    });

    // Door Toggle Button Setup (click or tap toggles door)
    const setupDoorBtn = (btn, toggleAction) => {
      if (!btn) return;
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;
      let lastTrigger = 0;

      const triggerAction = (e) => {
        const now = Date.now();
        if (now - lastTrigger < 250) return;
        lastTrigger = now;
        if (e) {
          if (e.stopPropagation) e.stopPropagation();
          if (e.cancelable && e.preventDefault) e.preventDefault();
        }
        toggleAction();
      };

      btn.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();
        }
      }, { passive: true });

      btn.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
          const dt = Date.now() - touchStartTime;
          if (dx > 45 || dy > 45 || dt > 650) return;
        }
        triggerAction(e);
      }, { passive: false });

      btn.addEventListener('click', (e) => {
        triggerAction(e);
      });
    };

    // Light Momentary Hold Setup (press down -> turn ON immediately; release/leave -> turn OFF immediately)
    const setupLightBtn = (btn, setLightAction) => {
      if (!btn) return;

      const turnOn = (e) => {
        if (e) {
          if (e.stopPropagation) e.stopPropagation();
          if (e.cancelable && e.preventDefault) e.preventDefault();
        }
        setLightAction(true);
      };

      const turnOff = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        setLightAction(false);
      };

      // Mouse controls
      btn.addEventListener('mousedown', (e) => {
        if (e.button === 0) turnOn(e);
      });
      btn.addEventListener('mouseup', (e) => {
        turnOff(e);
      });
      btn.addEventListener('mouseleave', (e) => {
        turnOff(e);
      });

      // Touch controls (Mobile): turn on INSTANTLY on touchstart with 0ms delay!
      btn.addEventListener('touchstart', (e) => {
        turnOn(e);
      }, { passive: false });

      btn.addEventListener('touchend', (e) => {
        turnOff(e);
      }, { passive: false });

      btn.addEventListener('touchcancel', (e) => {
        turnOff(e);
      }, { passive: false });
    };

    setupDoorBtn(this.btnLeftDoor, () => this.toggleLeftDoor());
    setupDoorBtn(this.btnRightDoor, () => this.toggleRightDoor());
    setupLightBtn(this.btnLeftLight, (on) => this.setLeftLight(on));
    setupLightBtn(this.btnRightLight, (on) => this.setRightLight(on));

    // Delegated Panel Fallback: top half toggles door, bottom half holds light
    const setupPanelDelegation = (panelId, toggleDoor, setLight) => {
      const panel = document.getElementById(panelId);
      if (!panel) return;
      let pStartX = 0;
      let pStartY = 0;
      let pStartTime = 0;
      let isPressingLight = false;

      // Mouse controls on panel
      panel.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        const r = panel.getBoundingClientRect();
        const relY = e.clientY - r.top;
        if (relY >= r.height * 0.5) {
          isPressingLight = true;
          setLight(true);
          e.stopPropagation();
        }
      });

      panel.addEventListener('mouseup', (e) => {
        if (isPressingLight) {
          isPressingLight = false;
          setLight(false);
          e.stopPropagation();
        }
      });

      panel.addEventListener('mouseleave', (e) => {
        if (isPressingLight) {
          isPressingLight = false;
          setLight(false);
        }
      });

      panel.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        const r = panel.getBoundingClientRect();
        const relY = e.clientY - r.top;
        if (relY < r.height * 0.5) {
          e.stopPropagation();
          toggleDoor();
        }
      });

      // Touch controls on panel
      panel.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        if (e.touches && e.touches[0]) {
          pStartX = e.touches[0].clientX;
          pStartY = e.touches[0].clientY;
          pStartTime = Date.now();
          const r = panel.getBoundingClientRect();
          const relY = pStartY - r.top;
          if (relY >= r.height * 0.5) {
            isPressingLight = true;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            setLight(true);
          }
        }
      }, { passive: false });

      panel.addEventListener('touchend', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        if (isPressingLight) {
          isPressingLight = false;
          setLight(false);
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.changedTouches && e.changedTouches[0]) {
          const dx = Math.abs(e.changedTouches[0].clientX - pStartX);
          const dy = Math.abs(e.changedTouches[0].clientY - pStartY);
          const dt = Date.now() - pStartTime;
          if (dx > 45 || dy > 45 || dt > 650) return;
          const r = panel.getBoundingClientRect();
          const relY = e.changedTouches[0].clientY - r.top;
          if (relY < r.height * 0.5) {
            if (e.cancelable) e.preventDefault();
            toggleDoor();
          }
        }
      }, { passive: false });

      panel.addEventListener('touchcancel', () => {
        if (isPressingLight) {
          isPressingLight = false;
          setLight(false);
        }
      }, { passive: false });
    };

    setupPanelDelegation('left-wall-panel', () => this.toggleLeftDoor(), (on) => this.setLeftLight(on));
    setupPanelDelegation('right-wall-panel', () => this.toggleRightDoor(), (on) => this.setRightLight(on));

    // Global safety release: releasing mouse or touch anywhere turns off lights
    ['mouseup', 'touchend', 'touchcancel', 'pointerup', 'pointercancel'].forEach(evt => {
      window.addEventListener(evt, () => {
        if (this.leftLightOn) this.setLeftLight(false);
        if (this.rightLightOn) this.setRightLight(false);
      }, { passive: true });
    });
  }

  /* ==========================================================================
     DOOR CONTROLS & FRAME ANIMATION
     ========================================================================== */
  toggleLeftDoor() {
    if (this.leftJammed) {
      window.soundEngine.playErrorBuzz();
      return;
    }
    this.leftDoorClosed = !this.leftDoorClosed;
    if (this.ledLeftDoor) this.ledLeftDoor.classList.toggle('active', this.leftDoorClosed);
    this.updatePanelTextures();

    if (this.leftDoorClosed) {
      window.soundEngine.playDoorSlam();
      this.playDoorAnimation('left', true);
      if (this.game && this.game.onDoorClosed) {
        this.game.onDoorClosed('left');
      }
    } else {
      window.soundEngine.playDoorOpen();
      this.playDoorAnimation('left', false);
      if (this.game && this.game.onDoorOpened) {
        this.game.onDoorOpened('left');
      }
    }

    this.updateUsageDisplay();
  }

  toggleRightDoor() {
    if (this.rightJammed) {
      window.soundEngine.playErrorBuzz();
      return;
    }
    this.rightDoorClosed = !this.rightDoorClosed;
    if (this.ledRightDoor) this.ledRightDoor.classList.toggle('active', this.rightDoorClosed);
    this.updatePanelTextures();

    if (this.rightDoorClosed) {
      window.soundEngine.playDoorSlam();
      this.playDoorAnimation('right', true);
      if (this.game && this.game.onDoorClosed) {
        this.game.onDoorClosed('right');
      }
    } else {
      window.soundEngine.playDoorOpen();
      this.playDoorAnimation('right', false);
      if (this.game && this.game.onDoorOpened) {
        this.game.onDoorOpened('right');
      }
    }

    this.updateUsageDisplay();
  }

  playDoorAnimation(side, isClosing) {
    const isLeft = (side === 'left');
    const container = isLeft ? this.leftDoorContainer : this.rightDoorContainer;
    const img = isLeft ? this.leftDoorImg : this.rightDoorImg;
    const totalFrames = isLeft ? this.leftDoorTotalFrames : this.rightDoorTotalFrames;
    const maxIdx = totalFrames - 1;

    // Cancel existing animation loop if running
    if (isLeft && this.leftDoorAnimId) {
      cancelAnimationFrame(this.leftDoorAnimId);
      this.leftDoorAnimId = null;
    } else if (!isLeft && this.rightDoorAnimId) {
      cancelAnimationFrame(this.rightDoorAnimId);
      this.rightDoorAnimId = null;
    }

    container.classList.add('active');

    // Smooth continuation from current position if interrupted
    let currentIdx = isLeft ? this.leftDoorCurrentIndex : this.rightDoorCurrentIndex;
    if (currentIdx < 0) {
      currentIdx = isClosing ? 0 : maxIdx;
    }
    const targetIdx = isClosing ? maxIdx : 0;
    const step = isClosing ? 1 : -1;

    // Shift sprite sheet with 0ms visual latency via GPU transform
    const setFrame = (idx) => {
      const pct = (idx * (100 / totalFrames)).toFixed(4);
      img.style.transform = `translate3d(-${pct}%, 0, 0)`;
      if (isLeft) this.leftDoorCurrentIndex = idx;
      else this.rightDoorCurrentIndex = idx;
    };

    setFrame(currentIdx);

    if (currentIdx === targetIdx) {
      if (!isClosing) {
        container.classList.remove('active');
        if (isLeft) this.leftDoorCurrentIndex = -1;
        else this.rightDoorCurrentIndex = -1;
      }
      return;
    }

    let lastTime = performance.now();
    const frameInterval = 22; // ~45fps, authentic snappy speed

    const stepFrame = (now) => {
      const elapsed = now - lastTime;
      if (elapsed >= frameInterval) {
        currentIdx += step;
        currentIdx = Math.max(0, Math.min(maxIdx, currentIdx));
        setFrame(currentIdx);
        lastTime = now;

        if (currentIdx === targetIdx) {
          if (!isClosing) {
            container.classList.remove('active');
            if (isLeft) this.leftDoorCurrentIndex = -1;
            else this.rightDoorCurrentIndex = -1;
          }
          if (isLeft) this.leftDoorAnimId = null;
          else this.rightDoorAnimId = null;
          return;
        }
      }

      if (isLeft) this.leftDoorAnimId = requestAnimationFrame(stepFrame);
      else this.rightDoorAnimId = requestAnimationFrame(stepFrame);
    };

    if (isLeft) this.leftDoorAnimId = requestAnimationFrame(stepFrame);
    else this.rightDoorAnimId = requestAnimationFrame(stepFrame);
  }

  /* ==========================================================================
     HALLWAY LIGHTING (MOMENTARY HOLD - 0ms LATENCY)
     ========================================================================== */
  setLeftLight(on) {
    if (this.leftJammed && on) {
      window.soundEngine.playErrorBuzz();
      return;
    }
    if (this.leftLightOn === on) return;

    // If turning on left, make sure right is off
    if (on && this.rightLightOn) {
      this.setRightLight(false);
    }

    this.leftLightOn = on;
    if (this.ledLeftLight) this.ledLeftLight.classList.toggle('active', this.leftLightOn);
    this.updatePanelTextures();
    window.soundEngine.setLightHum('left', this.leftLightOn);

    if (this.leftLightOn) {
      // Check if Trevor or Spencer is at left door!
      const trevorAtDoor = (this.game && this.game.friends && this.game.friends.trevor.currentRoom === 'left_door');
      const spencerAtDoor = (this.game && this.game.friends && this.game.friends.spencer.currentRoom === 'left_door');

      if (trevorAtDoor) {
        this.bgImg.src = 'assets/office/office_left_light_trevor.png';
        window.soundEngine.play('window_scare', 0.9);
      } else if (spencerAtDoor) {
        this.bgImg.src = 'assets/office/office_left_light_spencer.png';
        window.soundEngine.play('window_scare', 0.9);
      } else {
        this.bgImg.src = this.leftLightPath;
      }
    } else {
      this.bgImg.src = this.baseOfficePath;
    }

    this.updateUsageDisplay();
  }

  toggleLeftLight() {
    this.setLeftLight(!this.leftLightOn);
  }

  setRightLight(on) {
    if (this.rightJammed && on) {
      window.soundEngine.playErrorBuzz();
      return;
    }
    if (this.rightLightOn === on) return;

    // If turning on right, make sure left is off
    if (on && this.leftLightOn) {
      this.setLeftLight(false);
    }

    this.rightLightOn = on;
    if (this.ledRightLight) this.ledRightLight.classList.toggle('active', this.rightLightOn);
    this.updatePanelTextures();
    window.soundEngine.setLightHum('right', this.rightLightOn);

    if (this.rightLightOn) {
      // Check if Daxon or Chris is at right door!
      const daxonAtDoor = (this.game && this.game.friends && this.game.friends.daxon.currentRoom === 'right_door');
      const chrisAtDoor = (this.game && this.game.friends && this.game.friends.chris.currentRoom === 'right_door');

      if (daxonAtDoor) {
        this.bgImg.src = 'assets/office/office_right_light_daxon_tongue.png';
        window.soundEngine.play('window_scare', 0.9);
      } else if (chrisAtDoor) {
        this.bgImg.src = (Math.random() < 0.5)
          ? 'assets/office/office_right_light_chris_shirtless.png'
          : 'assets/office/office_right_light_chris.png';
        window.soundEngine.play('window_scare', 0.9);
      } else {
        this.bgImg.src = this.rightLightPath;
      }
    } else {
      this.bgImg.src = this.baseOfficePath;
    }

    this.updateUsageDisplay();
  }

  toggleRightLight() {
    this.setRightLight(!this.rightLightOn);
  }

  updatePanelTextures() {
    if (this.panelLeftImg) {
      if (this.leftDoorClosed && this.leftLightOn) {
        this.panelLeftImg.src = 'assets/office/panel_left_both.png';
      } else if (this.leftDoorClosed && !this.leftLightOn) {
        this.panelLeftImg.src = 'assets/office/panel_left_door.png';
      } else if (!this.leftDoorClosed && this.leftLightOn) {
        this.panelLeftImg.src = 'assets/office/panel_left_light.png';
      } else {
        this.panelLeftImg.src = 'assets/office/panel_left_off.png';
      }
    }
    if (this.panelRightImg) {
      if (this.rightDoorClosed && this.rightLightOn) {
        this.panelRightImg.src = 'assets/office/panel_right_both.png';
      } else if (this.rightDoorClosed && !this.rightLightOn) {
        this.panelRightImg.src = 'assets/office/panel_right_door.png';
      } else if (!this.rightDoorClosed && this.rightLightOn) {
        this.panelRightImg.src = 'assets/office/panel_right_light.png';
      } else {
        this.panelRightImg.src = 'assets/office/panel_right_off.png';
      }
    }
  }

  setJammed(side, isJammed) {
    if (side === 'left') {
      this.leftJammed = isJammed;
      const panel = document.getElementById('left-wall-panel');
      if (panel) panel.classList.toggle('jammed', isJammed);
      if (isJammed && this.leftLightOn) this.toggleLeftLight();
    } else if (side === 'right') {
      this.rightJammed = isJammed;
      const panel = document.getElementById('right-wall-panel');
      if (panel) panel.classList.toggle('jammed', isJammed);
      if (isJammed && this.rightLightOn) this.toggleRightLight();
    }
    this.updatePanelTextures();
  }

  /* ==========================================================================
     POWER USAGE
     ========================================================================== */
  getUsageLevel() {
    let usage = 1;
    if (this.leftDoorClosed) usage++;
    if (this.rightDoorClosed) usage++;
    if (this.leftLightOn) usage++;
    if (this.rightLightOn) usage++;
    if (this.game && this.game.cameras && this.game.cameras.isOpen) usage++;
    return Math.min(usage, 5);
  }

  updateUsageDisplay() {
    const level = this.getUsageLevel();
    const pips = this.usageBarsContainer.querySelectorAll('.usage-pip');

    pips.forEach((pip, idx) => {
      pip.className = 'usage-pip';
      if (idx < level) {
        if (level >= 4) pip.classList.add('active-red');
        else if (level === 3) pip.classList.add('active-yellow');
        else pip.classList.add('active-green');
      }
    });
  }

  reset() {
    this.leftDoorClosed = false;
    this.rightDoorClosed = false;
    this.leftLightOn = false;
    this.rightLightOn = false;
    this.leftJammed = false;
    this.rightJammed = false;
    if (this.leftDoorAnimId) cancelAnimationFrame(this.leftDoorAnimId);
    if (this.rightDoorAnimId) cancelAnimationFrame(this.rightDoorAnimId);
    this.leftDoorAnimId = null;
    this.rightDoorAnimId = null;
    this.leftDoorCurrentIndex = -1;
    this.rightDoorCurrentIndex = -1;
    if (this.ledLeftDoor) this.ledLeftDoor.classList.remove('active');
    if (this.ledRightDoor) this.ledRightDoor.classList.remove('active');
    if (this.ledLeftLight) this.ledLeftLight.classList.remove('active');
    if (this.ledRightLight) this.ledRightLight.classList.remove('active');
    if (this.btnLeftDoor) this.btnLeftDoor.classList.remove('jammed');
    if (this.btnLeftLight) this.btnLeftLight.classList.remove('jammed');
    if (this.btnRightDoor) this.btnRightDoor.classList.remove('jammed');
    if (this.btnRightLight) this.btnRightLight.classList.remove('jammed');
    if (this.leftDoorContainer) this.leftDoorContainer.classList.remove('active');
    if (this.rightDoorContainer) this.rightDoorContainer.classList.remove('active');
    if (this.leftDoorImg) this.leftDoorImg.style.transform = 'translate3d(0, 0, 0)';
    if (this.rightDoorImg) this.rightDoorImg.style.transform = 'translate3d(0, 0, 0)';
    if (this.stage) this.stage.style.filter = 'none';
    if (this.bgImg) this.bgImg.src = this.baseOfficePath;
    this.updateUsageDisplay();
  }

  startRenderLoop() {
    if (this.renderLoopId) {
      cancelAnimationFrame(this.renderLoopId);
      this.renderLoopId = null;
    }

    let lastAppliedPan = null;

    const loop = () => {
      // If camera monitor is open, skip panning calculations to keep CPU cool on mobile
      const monitorOpen = (this.game && this.game.cameras && this.game.cameras.isOpen);

      if (!monitorOpen && this.stage) {
        const diff = this.targetPanX - this.currentPanX;
        if (Math.abs(diff) > 0.08) {
          this.currentPanX += diff * 0.085;
          const rounded = this.currentPanX.toFixed(2);
          if (rounded !== lastAppliedPan) {
            this.stage.style.transform = `translate3d(${rounded}px, -50%, 0)`;
            lastAppliedPan = rounded;
          }
        }
      }

      this.renderLoopId = requestAnimationFrame(loop);
    };

    this.renderLoopId = requestAnimationFrame(loop);
  }
}
