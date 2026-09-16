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

    // Right Controls
    this.rightDoorContainer = document.getElementById('right-door-container');
    this.rightDoorImg = document.getElementById('right-door-img');
    this.btnRightDoor = document.getElementById('btn-right-door');
    this.btnRightLight = document.getElementById('btn-right-light');
    this.ledRightDoor = document.getElementById('led-right-door');
    this.ledRightLight = document.getElementById('led-right-light');

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

    // Panning state (Center of 1600px stage on 1280px viewport is -160px)
    this.currentPanX = -160;
    this.targetPanX = -160;

    // Base asset paths
    this.baseOfficePath = 'assets/office/office_boys.png';
    this.leftLightPath = 'assets/office/office_left_light.png';
    this.rightLightPath = 'assets/office/office_right_light.png';

    // Door animation frame lists
    this.leftDoorFrames = [];
    for (let i = 91; i <= 102; i++) this.leftDoorFrames.push(`assets/doors/${i}.png`);

    this.rightDoorFrames = [];
    for (let i = 103; i <= 118; i++) this.rightDoorFrames.push(`assets/doors/${i}.png`);

    this.leftDoorAnimTimer = null;
    this.rightDoorAnimTimer = null;

    // Set initial rock-solid background
    this.bgImg.src = this.baseOfficePath;

    if (window.location.search.includes('pan=left')) {
      this.currentPanX = 0;
      this.targetPanX = 0;
    } else if (window.location.search.includes('pan=right')) {
      this.currentPanX = -320;
      this.targetPanX = -320;
    }

    // Apply transform immediately so headless capture and first frame are perfectly positioned
    this.stage.style.transform = `translate3d(${this.currentPanX.toFixed(2)}px, 0, 0)`;

    this.setupEvents();
    this.startRenderLoop();
  }

  setupEvents() {
    // Mouse movement: smooth panoramic glide across office
    window.addEventListener('mousemove', (e) => {
      const viewWidth = window.innerWidth;
      const stageWidth = this.stage.offsetWidth;
      const maxPan = stageWidth - viewWidth;

      if (maxPan > 0) {
        const norm = Math.min(Math.max(e.clientX / viewWidth, 0), 1);
        this.targetPanX = - (norm * maxPan);
      }
    });

    // Touch controls: smooth swipe & drag glide for mobile phones & tablets
    let isTouching = false;
    let touchStartX = 0;
    let touchStartPan = 0;

    window.addEventListener('touchstart', (e) => {
      // Don't drag if user taps interactive buttons
      if (e.target.closest('.wall-btn, .cam-btn, .cam-monitor-bar, button, .custom-btn, .step-btn')) {
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

    // Wall Buttons Click (supports both mouse click and mobile tap)
    this.btnLeftDoor.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLeftDoor();
    });

    this.btnRightDoor.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleRightDoor();
    });

    this.btnLeftLight.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLeftLight();
    });

    this.btnRightLight.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleRightLight();
    });

    // Keyboard Shortcuts (Q: Left Door, A: Left Light, E: Right Door, D: Right Light)
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'q') this.toggleLeftDoor();
      else if (key === 'a') this.toggleLeftLight();
      else if (key === 'e') this.toggleRightDoor();
      else if (key === 'd') this.toggleRightLight();
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
    this.ledLeftDoor.classList.toggle('active', this.leftDoorClosed);

    if (this.leftDoorClosed) {
      window.soundEngine.playDoorSlam();
      this.playDoorAnimation(this.leftDoorContainer, this.leftDoorImg, this.leftDoorFrames, true);
      if (this.game && this.game.onDoorClosed) {
        this.game.onDoorClosed('left');
      }
    } else {
      window.soundEngine.playDoorOpen();
      this.playDoorAnimation(this.leftDoorContainer, this.leftDoorImg, this.leftDoorFrames, false);
    }

    this.updateUsageDisplay();
  }

  toggleRightDoor() {
    if (this.rightJammed) {
      window.soundEngine.playErrorBuzz();
      return;
    }
    this.rightDoorClosed = !this.rightDoorClosed;
    this.ledRightDoor.classList.toggle('active', this.rightDoorClosed);

    if (this.rightDoorClosed) {
      window.soundEngine.playDoorSlam();
      this.playDoorAnimation(this.rightDoorContainer, this.rightDoorImg, this.rightDoorFrames, true);
      if (this.game && this.game.onDoorClosed) {
        this.game.onDoorClosed('right');
      }
    } else {
      window.soundEngine.playDoorOpen();
      this.playDoorAnimation(this.rightDoorContainer, this.rightDoorImg, this.rightDoorFrames, false);
    }

    this.updateUsageDisplay();
  }

  playDoorAnimation(container, img, frames, isClosing) {
    container.classList.add('active');
    let idx = isClosing ? 0 : frames.length - 1;
    const targetIdx = isClosing ? frames.length - 1 : 0;
    const step = isClosing ? 1 : -1;

    if (container === this.leftDoorContainer && this.leftDoorAnimTimer) clearInterval(this.leftDoorAnimTimer);
    if (container === this.rightDoorContainer && this.rightDoorAnimTimer) clearInterval(this.rightDoorAnimTimer);

    const timer = setInterval(() => {
      img.src = frames[idx];
      if (idx === targetIdx) {
        clearInterval(timer);
        if (!isClosing) {
          container.classList.remove('active');
        }
      } else {
        idx += step;
      }
    }, 28);

    if (container === this.leftDoorContainer) this.leftDoorAnimTimer = timer;
    else this.rightDoorAnimTimer = timer;
  }

  /* ==========================================================================
     HALLWAY LIGHTING
     ========================================================================== */
  toggleLeftLight() {
    if (this.leftJammed) {
      window.soundEngine.playErrorBuzz();
      return;
    }
    // If right light is on, turn it off first
    if (this.rightLightOn) {
      this.rightLightOn = false;
      this.ledRightLight.classList.remove('active');
      window.soundEngine.setLightHum('right', false);
    }

    this.leftLightOn = !this.leftLightOn;
    this.ledLeftLight.classList.toggle('active', this.leftLightOn);
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

  toggleRightLight() {
    if (this.rightJammed) {
      window.soundEngine.playErrorBuzz();
      return;
    }
    // If left light is on, turn it off first
    if (this.leftLightOn) {
      this.leftLightOn = false;
      this.ledLeftLight.classList.remove('active');
      window.soundEngine.setLightHum('left', false);
    }

    this.rightLightOn = !this.rightLightOn;
    this.ledRightLight.classList.toggle('active', this.rightLightOn);
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

  setJammed(side, isJammed) {
    if (side === 'left') {
      this.leftJammed = isJammed;
      this.btnLeftDoor.classList.toggle('jammed', isJammed);
      this.btnLeftLight.classList.toggle('jammed', isJammed);
      if (isJammed && this.leftLightOn) this.toggleLeftLight();
    } else if (side === 'right') {
      this.rightJammed = isJammed;
      this.btnRightDoor.classList.toggle('jammed', isJammed);
      this.btnRightLight.classList.toggle('jammed', isJammed);
      if (isJammed && this.rightLightOn) this.toggleRightLight();
    }
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
    if (this.stage) this.stage.style.filter = 'none';
    if (this.bgImg) this.bgImg.src = this.baseOfficePath;
    this.updateUsageDisplay();
  }

  startRenderLoop() {
    const loop = () => {
      // Smooth interpolation for head panning
      this.currentPanX += (this.targetPanX - this.currentPanX) * 0.085;
      this.stage.style.transform = `translate3d(${this.currentPanX.toFixed(2)}px, 0, 0)`;

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
