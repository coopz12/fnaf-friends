/**
 * Authentic FNAF 1 Camera Monitor Controller
 * Features exact 11-frame tablet flip animation, CRT static noise,
 * authentic pizzeria minimap, interactive camera buttons, and live friend feeds.
 */

class CameraController {
  constructor(gameManager) {
    this.game = gameManager;

    // DOM Elements
    this.monitorEl = document.getElementById('camera-monitor');
    this.camScreenEl = document.getElementById('cam-screen');
    this.camFeedImg = document.getElementById('cam-feed-img');
    this.camFeedContainer = document.getElementById('cam-feed-container');
    this.camStaticImg = document.getElementById('cam-static-img');
    this.camStaticCanvas = document.getElementById('cam-static-canvas');
    this.staticCtx = this.camStaticCanvas ? this.camStaticCanvas.getContext('2d') : null;
    this.flipAnimEl = document.getElementById('cam-flip-anim');
    this.flipImg = document.getElementById('cam-flip-img');

    this.titleCodeEl = document.getElementById('cam-title-code');
    this.titleNameEl = document.getElementById('cam-title-name');
    this.kitchenOverlay = document.getElementById('cam-kitchen-overlay');
    this.camButtons = document.querySelectorAll('.cam-btn');

    // State
    this.isOpen = false;
    this.isAnimating = false;
    this.activeCam = '1A';

    // Panning state for wide room feeds (1600x720)
    this.panX = 0;
    this.panDirection = -1; // -1 = moving right (panX decreases), 1 = moving left
    this.maxPan = 320; // 1600 - 1280
    this.panSpeed = 22; // pixels per second

    // Static frames loop (9 genuine FNAF 1 static frames)
    this.staticFrames = [];
    for (let i = 0; i < 9; i++) {
      this.staticFrames.push(`assets/cameras/static_frames/frame_${i}.png?v=2`);
    }
    this.staticFrameIdx = 0;
    this.staticInterval = null;

    // Tablet flip animation frames (11 genuine FNAF 1 frames)
    this.flipFrames = [];
    for (let i = 0; i <= 10; i++) {
      this.flipFrames.push(`assets/cameras/tablet/frame_${i}.png`);
    }

    // Room info
    this.roomNames = {
      '1A': 'Show Stage',
      '1B': 'Dining Area',
      '1C': 'Pirate Cove',
      '2A': 'West Hall',
      '2B': 'W. Hall Corner',
      '3':  'Supply Closet',
      '4A': 'East Hall',
      '4B': 'E. Hall Corner',
      '5':  'Backstage',
      '6':  'Kitchen',
      '7':  'Restrooms'
    };

    this.kitchenAudio = null;
    this.lastPanTime = performance.now();
    this.camSwitchId = 0;
    this.currentFeedSrc = '';
    this.staticBurstTimer = null;

    this.preloadAllFeeds();
    this.setupEvents();
    this.startStaticLoop();
    this.startPanLoop();
  }

  preloadAllFeeds() {
    const feeds = [
      'assets/cameras/feeds/cam1a_spencer_chris_daxon.png',
      'assets/cameras/feeds/cam1a_chris_daxon.png',
      'assets/cameras/feeds/cam1a_spencer_daxon.png',
      'assets/cameras/feeds/cam1a_spencer_chris.png',
      'assets/cameras/feeds/cam1a_chris.png',
      'assets/cameras/feeds/cam1a_spencer.png',
      'assets/cameras/feeds/cam1a_daxon.png',
      'assets/cameras/feeds/cam1a_empty.png',
      'assets/cameras/feeds/cam1a.png',
      'assets/cameras/feeds/cam1b_spencer_chris.png',
      'assets/cameras/feeds/cam1b_spencer.png',
      'assets/cameras/feeds/cam1b_chris.png',
      'assets/cameras/feeds/cam1b_daxon.png',
      'assets/cameras/feeds/cam1b_empty.png',
      'assets/cameras/feeds/cam1c_stage1.png',
      'assets/cameras/feeds/cam1c_stage2.png',
      'assets/cameras/feeds/cam1c_stage2_blue_eyes.png',
      'assets/cameras/feeds/cam1c_stage3.png',
      'assets/cameras/feeds/cam1c_stage4.png',
      'assets/cameras/feeds/cam2a_trevor.png',
      'assets/cameras/feeds/cam2a_trevor_blue_eyes.png',
      'assets/cameras/feeds/cam2a_empty.png',
      'assets/cameras/feeds/cam2b_spencer.png',
      'assets/cameras/feeds/cam2b_empty.png',
      'assets/cameras/feeds/cam3_spencer_chocolate.png',
      'assets/cameras/feeds/cam3_spencer.png',
      'assets/cameras/feeds/cam3_empty.png',
      'assets/cameras/feeds/cam5_bunny.png',
      'assets/cameras/feeds/cam5_spencer.png',
      'assets/cameras/feeds/cam5_empty.png',
      'assets/cameras/feeds/cam6.png',
      'assets/cameras/feeds/cam7_daxon.png',
      'assets/cameras/feeds/cam7_empty.png',
      'assets/cameras/feeds/cam4a_daxon_smirk.png',
      'assets/cameras/feeds/cam4a_chris.png',
      'assets/cameras/feeds/cam4a_empty.png',
      'assets/cameras/feeds/cam4b_daxon.png',
      'assets/cameras/feeds/cam4b_chris_stare.png',
      'assets/cameras/feeds/cam4b_empty.png'
    ];
    this.preloadedImages = {};
    feeds.forEach(src => {
      const img = new Image();
      img.src = src;
      this.preloadedImages[src] = img;
    });
  }

  setupEvents() {
    // Interactive Camera Buttons with touch and click optimization
    let lastCamTouchTime = 0;
    this.camButtons.forEach(btn => {
      let touchStartX = 0;
      let touchStartY = 0;

      btn.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      btn.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
          if (dx > 25 || dy > 25) return; // Ignore drag gesture
        }
        lastCamTouchTime = Date.now();
        e.stopPropagation();
        e.preventDefault();
        const camCode = btn.getAttribute('data-cam');
        if (camCode) this.switchCamera(camCode);
      }, { passive: false });

      btn.addEventListener('click', (e) => {
        if (Date.now() - lastCamTouchTime < 450) return; // Prevent emulated click after touch
        e.stopPropagation();
        const camCode = btn.getAttribute('data-cam');
        if (camCode) this.switchCamera(camCode);
      });
    });

    if (this.camFeedContainer) {
      this.camFeedContainer.addEventListener('click', () => {
        if (this.camFeedImg && (this.camFeedImg.src.includes('cam3_dog') || this.camFeedImg.src.includes('cam5_bunny'))) {
          window.soundEngine.playSqueak();
        }
      });
    }

    // Hover / click handle bar at bottom
    const camBar = document.getElementById('cam-monitor-bar');
    if (camBar) {
      let lastToggleTime = 0;
      let isHovered = false;

      const doToggle = () => {
        const now = Date.now();
        if (now - lastToggleTime < 300) return;
        if (!this.isAnimating) {
          lastToggleTime = now;
          this.toggleMonitor();
        }
      };

      camBar.addEventListener('click', (e) => {
        e.stopPropagation();
        doToggle();
      });

      camBar.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        doToggle();
      }, { passive: false });

      camBar.addEventListener('mouseenter', () => {
        if (!isHovered) {
          isHovered = true;
          doToggle();
        }
      });

      camBar.addEventListener('mouseleave', () => {
        isHovered = false;
      });
    }

    // Keyboard controls: SPACE, S, ESC, ArrowDown
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 's') {
        e.preventDefault();
        this.toggleMonitor();
      } else if (key === 'escape' || key === 'arrowdown') {
        if (this.isOpen) {
          e.preventDefault();
          this.closeMonitor();
        }
      }
    });
  }

  toggleMonitor() {
    if (this.game && this.game.isPowerOut) return;
    if (this.isAnimating) return;

    if (this.isOpen) {
      this.closeMonitor();
    } else {
      this.openMonitor();
    }
  }

  openMonitor(instant = false) {
    if (this.isOpen || this.isAnimating) return;

    const camBar = document.getElementById('cam-monitor-bar');
    if (camBar) {
      camBar.classList.add('open');
      const icon = camBar.querySelector('.cam-bar-icon');
      if (icon) icon.textContent = '▼';
      const text = camBar.querySelector('.cam-bar-text');
      if (text) text.textContent = 'PUT DOWN MONITOR';
    }

    if (instant || window.location.search.includes('instant=1')) {
      this.flipAnimEl.classList.add('hidden');
      this.monitorEl.classList.remove('hidden');
      this.camScreenEl.classList.remove('hidden');
      this.isOpen = true;
      this.isAnimating = false;
      this.updateFeedDisplay();
      if (this.game && this.game.office) {
        this.game.office.updateUsageDisplay();
      }
      if (this.game && this.game.onMonitorOpened) {
        this.game.onMonitorOpened();
      }
      return;
    }

    this.isAnimating = true;

    // Play authentic tablet open audio
    window.soundEngine.play('camera_open', 0.85);

    // Show flip animation container
    this.flipAnimEl.classList.remove('hidden');
    this.monitorEl.classList.remove('hidden');
    this.camScreenEl.classList.add('hidden');

    // Animate flip up: 0 -> 10
    let frame = 0;
    const interval = setInterval(() => {
      this.flipImg.src = this.flipFrames[frame];
      frame++;
      if (frame > 10) {
        clearInterval(interval);
        this.flipAnimEl.classList.add('hidden');
        this.camScreenEl.classList.remove('hidden');
        this.isOpen = true;
        this.isAnimating = false;

        // Flash static burst
        this.triggerStaticBurst();

        // Update active feed
        this.updateFeedDisplay();

        // Update power usage
        if (this.game && this.game.office) {
          this.game.office.updateUsageDisplay();
        }

        if (this.game && this.game.onMonitorOpened) {
          this.game.onMonitorOpened();
        }
      }
    }, 18); // ~180ms total animation
  }

  closeMonitor() {
    if (!this.isOpen || this.isAnimating) return;

    const camBar = document.getElementById('cam-monitor-bar');
    if (camBar) {
      camBar.classList.remove('open');
      const icon = camBar.querySelector('.cam-bar-icon');
      if (icon) icon.textContent = '▲';
      const text = camBar.querySelector('.cam-bar-text');
      if (text) text.textContent = 'CAMERA MONITOR';
    }

    this.isAnimating = true;

    // Play authentic tablet close audio
    window.soundEngine.play('camera_close', 0.85);

    // Stop kitchen audio if active
    this.stopKitchenAudio();

    // Show flip animation in reverse: 10 -> 0
    this.camScreenEl.classList.add('hidden');
    this.flipAnimEl.classList.remove('hidden');

    let frame = 10;
    const interval = setInterval(() => {
      this.flipImg.src = this.flipFrames[frame];
      frame--;
      if (frame < 0) {
        clearInterval(interval);
        this.flipAnimEl.classList.add('hidden');
        this.monitorEl.classList.add('hidden');
        this.isOpen = false;
        this.isAnimating = false;

        // Update power usage
        if (this.game && this.game.office) {
          this.game.office.updateUsageDisplay();
        }

        if (this.game && this.game.onMonitorClosed) {
          this.game.onMonitorClosed();
        }
      }
    }, 16);
  }

  switchCamera(camCode, force = false) {
    if (this.activeCam === camCode && !force) {
      this.updateFeedDisplay();
      return;
    }

    // Play camera button blip
    window.soundEngine.play('blip', 0.8);

    // Trigger authentic brief CRT static glitch
    this.triggerStaticBurst(200);

    this.activeCam = camCode;

    // Update buttons
    this.camButtons.forEach(btn => {
      if (btn.getAttribute('data-cam') === camCode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update HUD
    this.titleCodeEl.textContent = `CAM ${camCode}`;
    this.titleNameEl.textContent = this.roomNames[camCode] || '';

    // Update Feed Image
    this.updateFeedDisplay(force);
  }

  updateFeedDisplay(force = false) {
    const cam = this.activeCam;

    // Handle CAM 6 (Kitchen: CAMERA DISABLED - AUDIO ONLY)
    if (cam === '6') {
      this.kitchenOverlay.classList.remove('hidden');
      const chrisInKitchen = (this.game && this.game.friends && this.game.friends.chris.currentRoom === '6');
      if (chrisInKitchen) {
        this.startKitchenAudio();
      } else {
        this.stopKitchenAudio();
      }
      this.currentFeedSrc = 'assets/cameras/feeds/cam6.png';
      this.camFeedImg.src = this.currentFeedSrc;
      this.camFeedImg.style.opacity = '1';
      return;
    } else {
      this.kitchenOverlay.classList.add('hidden');
      this.stopKitchenAudio();
    }

    // Single Active Variant checks for each friend
    const spencerRoom = this.game && this.game.friends ? this.game.friends.spencer.currentRoom : '1A';
    const chrisRoom = this.game && this.game.friends ? this.game.friends.chris.currentRoom : '1A';
    const daxonRoom = this.game && this.game.friends ? this.game.friends.daxon.currentRoom : '1A';
    const trevor = this.game && this.game.friends ? this.game.friends.trevor : { currentRoom: '1C', coveStage: 1, isSprinting: false };

    let feedSrc = '';

    switch (cam) {
      case '1A': { // Show Stage (Dynamic Trio: Spencer, Chris, Daxon - ZERO Trevor)
        const hasSpencer = (spencerRoom === '1A');
        const hasChris = (chrisRoom === '1A');
        const hasDaxon = (daxonRoom === '1A');

        if (hasSpencer && hasChris && hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1a_spencer_chris_daxon.png';
        } else if (!hasSpencer && hasChris && hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1a_chris_daxon.png';
        } else if (hasSpencer && !hasChris && hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1a_spencer_daxon.png';
        } else if (hasSpencer && hasChris && !hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1a_spencer_chris.png';
        } else if (!hasSpencer && hasChris && !hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1a_chris.png';
        } else if (hasSpencer && !hasChris && !hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1a_spencer.png';
        } else if (!hasSpencer && !hasChris && hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1a_daxon.png';
        } else {
          feedSrc = 'assets/cameras/feeds/cam1a_empty.png';
        }
        break;
      }

      case '1B': { // Dining Area (Spencer, Chris, Daxon seated at party tables)
        const hasSpencer = (spencerRoom === '1B');
        const hasChris = (chrisRoom === '1B');
        const hasDaxon = (daxonRoom === '1B');
        if (hasSpencer && hasChris) {
          feedSrc = 'assets/cameras/feeds/cam1b_spencer_chris.png';
        } else if (hasSpencer) {
          feedSrc = 'assets/cameras/feeds/cam1b_spencer.png';
        } else if (hasChris) {
          feedSrc = 'assets/cameras/feeds/cam1b_chris.png';
        } else if (hasDaxon) {
          feedSrc = 'assets/cameras/feeds/cam1b_daxon.png';
        } else {
          feedSrc = 'assets/cameras/feeds/cam1b_empty.png';
        }
        break;
      }

      case '1C': { // Pirate Cove (Trevor / Foxy stages 1..4)
        // Whenever Trevor is sprinting, at the office door, or has left: Pirate Cove is 100% EMPTY (Stage 4)!
        if (trevor.isSprinting || trevor.currentRoom !== '1C' || trevor.coveStage >= 4) {
          feedSrc = 'assets/cameras/feeds/cam1c_stage4.png';
        } else if (trevor.coveStage === 3) {
          feedSrc = 'assets/cameras/feeds/cam1c_stage3.png';
        } else if (trevor.coveStage === 2) {
          feedSrc = (Math.random() < 0.5) ? 'assets/cameras/feeds/cam1c_stage2_blue_eyes.png' : 'assets/cameras/feeds/cam1c_stage2.png';
        } else {
          feedSrc = 'assets/cameras/feeds/cam1c_stage1.png';
        }
        break;
      }

      case '2A': { // West Hall (Trevor hallway sprint)
        if (trevor.isSprinting || trevor.currentRoom === '2A') {
          feedSrc = (Math.random() < 0.5) ? 'assets/cameras/feeds/cam2a_trevor_blue_eyes.png' : 'assets/cameras/feeds/cam2a_trevor.png';
        } else {
          feedSrc = 'assets/cameras/feeds/cam2a_empty.png';
        }
        break;
      }

      case '2B': { // West Hall Corner
        feedSrc = (spencerRoom === '2B') ? 'assets/cameras/feeds/cam2b_spencer.png' : 'assets/cameras/feeds/cam2b_empty.png';
        break;
      }

      case '3': { // Supply Closet (Spencer melting chocolate or green shirt, with subtle Dog in Jordans wall poster)
        if (spencerRoom === '3') {
          feedSrc = (Math.random() < 0.6) ? 'assets/cameras/feeds/cam3_spencer_chocolate.png' : 'assets/cameras/feeds/cam3_spencer.png';
        } else {
          feedSrc = 'assets/cameras/feeds/cam3_empty.png';
        }
        break;
      }

      case '5': { // Backstage (Spencer Gaming Headset or Spencer with Judy Hopps Bunny Easter Egg!)
        if (spencerRoom === '5') {
          feedSrc = (Math.random() < 0.35) ? 'assets/cameras/feeds/cam5_bunny.png' : 'assets/cameras/feeds/cam5_spencer.png';
        } else {
          feedSrc = (Math.random() < 0.15) ? 'assets/cameras/feeds/cam5_bunny.png' : 'assets/cameras/feeds/cam5_empty.png';
        }
        break;
      }

      case '7': { // Restrooms
        feedSrc = (daxonRoom === '7') ? 'assets/cameras/feeds/cam7_daxon.png' : 'assets/cameras/feeds/cam7_empty.png';
        break;
      }

      case '4A': { // East Hall (Daxon Arched Eyebrow Smirk or Chris Carhartt)
        if (daxonRoom === '4A') {
          feedSrc = 'assets/cameras/feeds/cam4a_daxon_smirk.png';
        } else if (chrisRoom === '4A') {
          feedSrc = 'assets/cameras/feeds/cam4a_chris.png';
        } else {
          feedSrc = 'assets/cameras/feeds/cam4a_empty.png';
        }
        break;
      }

      case '4B': { // East Hall Corner
        if (daxonRoom === '4B') {
          feedSrc = 'assets/cameras/feeds/cam4b_daxon.png';
        } else if (chrisRoom === '4B') {
          feedSrc = 'assets/cameras/feeds/cam4b_chris_stare.png';
        } else {
          feedSrc = 'assets/cameras/feeds/cam4b_empty.png';
        }
        break;
      }

      default:
        feedSrc = 'assets/cameras/feeds/cam1a.png';
        break;
    }

    if (this.currentFeedSrc === feedSrc && !force) {
      return;
    }

    const currentSwitchId = ++this.camSwitchId;

    // Immediately hide previous room so it NEVER lingers while new room is loading/decoding
    if (this.currentFeedSrc !== feedSrc) {
      this.camFeedImg.style.opacity = '0';
    }

    const targetSrc = feedSrc;
    const pre = (this.preloadedImages && this.preloadedImages[targetSrc]) ? this.preloadedImages[targetSrc] : new Image();
    if (!pre.src) pre.src = targetSrc;

    const commitFeed = () => {
      // Discard stale asynchronous load if player switched cameras again
      if (this.camSwitchId !== currentSwitchId) return;
      this.currentFeedSrc = targetSrc;
      this.camFeedImg.src = targetSrc;
      this.camFeedImg.style.opacity = '1';
    };

    if (pre.complete && pre.naturalWidth > 0) {
      commitFeed();
    } else {
      pre.onload = commitFeed;
      pre.onerror = commitFeed;
    }
  }

  startKitchenAudio() {
    if (this.kitchenAudio) return;
    window.soundEngine.play('kitchen1', 0.8);
    this.kitchenAudio = setInterval(() => {
      if (this.isOpen && this.activeCam === '6') {
        const soundKey = Math.random() > 0.5 ? 'kitchen1' : 'kitchen2';
        window.soundEngine.play(soundKey, 0.7);
      }
    }, 2800);
  }

  stopKitchenAudio() {
    if (this.kitchenAudio) {
      clearInterval(this.kitchenAudio);
      this.kitchenAudio = null;
    }
  }

  triggerStaticBurst(duration = 180) {
    const target = this.camStaticCanvas || this.camStaticImg;
    if (target) {
      target.style.opacity = '0.85';
      if (this.staticBurstTimer) clearTimeout(this.staticBurstTimer);
      this.staticBurstTimer = setTimeout(() => {
        if (target) {
          target.style.opacity = '0.16';
        }
      }, duration);
    }
  }

  startStaticLoop() {
    if (this.camStaticCanvas && this.staticCtx) {
      const w = this.camStaticCanvas.width;
      const h = this.camStaticCanvas.height;
      this.noiseFrames = [];
      for (let f = 0; f < 10; f++) {
        const imgData = this.staticCtx.createImageData(w, h);
        const buf = new Uint32Array(imgData.data.buffer);
        for (let i = 0; i < buf.length; i++) {
          const row = (i / w) | 0;
          const scanline = (row % 2 === 0) ? 0.82 : 1.0;
          const val = ((Math.random() * 235 + 20) * scanline) | 0;
          buf[i] = (255 << 24) | (val << 16) | (val << 8) | val;
        }
        this.noiseFrames.push(imgData);
      }

      let fIdx = 0;
      this.staticInterval = setInterval(() => {
        if (this.isOpen || this.isAnimating) {
          this.staticCtx.putImageData(this.noiseFrames[fIdx], 0, 0);
          fIdx = (fIdx + 1) % this.noiseFrames.length;
        }
      }, 33); // ~30 fps silky-smooth canvas noise: ZERO DOM decode flash, 100% clean!
      return;
    }

    this.staticInterval = setInterval(() => {
      this.staticFrameIdx = (this.staticFrameIdx + 1) % this.staticFrames.length;
      if (this.camStaticImg) {
        this.camStaticImg.src = this.staticFrames[this.staticFrameIdx];
      }
    }, 45);
  }

  reset() {
    if (this.isOpen) {
      this.closeMonitor();
    }
    this.activeCam = '1A';
    this.currentFeedSrc = '';
    this.updateFeedDisplay(true);
  }

  startPanLoop() {
    const loop = () => {
      if (this.isOpen && !this.isAnimating) {
        const now = performance.now();
        const dt = (now - this.lastPanTime) / 1000;
        this.lastPanTime = now;

        // Smoothly sway the camera feed left and right
        this.panX += this.panDirection * this.panSpeed * dt;

        if (this.panX <= -this.maxPan) {
          this.panX = -this.maxPan;
          this.panDirection = 1; // Reverse toward left
        } else if (this.panX >= 0) {
          this.panX = 0;
          this.panDirection = -1; // Reverse toward right
        }

        this.camFeedContainer.style.transform = `translateX(${this.panX.toFixed(1)}px)`;
      } else {
        this.lastPanTime = performance.now();
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
