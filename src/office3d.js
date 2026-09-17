/**
 * 3D Office Controller for Five Nights at Friends
 * Powered by Three.js - true 3D spatial room, diegetic CRT monitor, 3D blast doors, and lighting.
 */

class Office3D {
  constructor(gameManager) {
    this.game = gameManager;
    this.canvas = document.getElementById('game-canvas');
    this.container = document.getElementById('viewport');

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040508);
    this.scene.fog = new THREE.FogExp2(0x040508, 0.08);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 30);
    this.camera.position.set(0, 1.4, 0.3); // Sitting position in office chair

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Head rotation / mouse look state
    this.targetYaw = 0;
    this.currentYaw = 0;
    this.targetPitch = 0;
    this.currentPitch = 0;
    this.maxYaw = 1.35; // ~77 degrees left and right
    this.maxPitch = 0.28; // ~16 degrees up and down

    // Interactive 3D Objects
    this.interactables = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Door and light states
    this.leftDoorClosed = false;
    this.rightDoorClosed = false;
    this.leftLightOn = false;
    this.rightLightOn = false;

    // Blast door animation targets
    this.doorOpenY = 3.6;
    this.doorClosedY = 1.15;
    this.leftDoorTargetY = this.doorOpenY;
    this.rightDoorTargetY = this.doorOpenY;

    // Procedural Textures & Materials
    this.materials = this.initMaterials();

    // Build the 3D World
    this.buildOffice();
    this.buildDoors();
    this.buildHallways();
    this.buildDeskAndComputer();
    this.buildFan();
    this.buildLighting();

    // Setup input listeners
    this.setupInputs();

    // Start render loop
    this.lastTime = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /* ==========================================================================
     PROCEDURAL TEXTURES & MATERIALS
     ========================================================================== */
  initMaterials() {
    // Checker floor canvas
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const fCtx = floorCanvas.getContext('2d');
    fCtx.fillStyle = '#1c1f24';
    fCtx.fillRect(0, 0, 256, 256);
    fCtx.fillStyle = '#111317';
    fCtx.fillRect(0, 0, 128, 128);
    fCtx.fillRect(128, 128, 128, 128);
    // Add grime
    for (let i = 0; i < 400; i++) {
      fCtx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.04)';
      fCtx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 6);

    // Metal wall canvas
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 256;
    wallCanvas.height = 256;
    const wCtx = wallCanvas.getContext('2d');
    wCtx.fillStyle = '#181b22';
    wCtx.fillRect(0, 0, 256, 256);
    // Industrial panel seams
    wCtx.strokeStyle = '#0d0f13';
    wCtx.lineWidth = 4;
    wCtx.strokeRect(4, 4, 248, 248);
    wCtx.fillStyle = '#262c37';
    wCtx.fillRect(6, 6, 244, 12);
    const wallTex = new THREE.CanvasTexture(wallCanvas);
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 2);

    return {
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8, metalness: 0.1 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.95 }),
      wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, metalness: 0.2 }),
      doorFrame: new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.7, metalness: 0.6 }),
      blastDoor: new THREE.MeshStandardMaterial({ color: 0x222730, roughness: 0.5, metalness: 0.8 }),
      desk: new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.6, metalness: 0.4 }),
      computerCase: new THREE.MeshStandardMaterial({ color: 0x2d333d, roughness: 0.7, metalness: 0.3 }),
      buttonPanel: new THREE.MeshStandardMaterial({ color: 0x1c212a, roughness: 0.5, metalness: 0.6 }),
      btnRedOff: new THREE.MeshStandardMaterial({ color: 0x5a1111, roughness: 0.4, metalness: 0.2 }),
      btnRedOn: new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1111, emissiveIntensity: 0.8 }),
      btnWhiteOff: new THREE.MeshStandardMaterial({ color: 0x444438, roughness: 0.4, metalness: 0.2 }),
      btnWhiteOn: new THREE.MeshStandardMaterial({ color: 0xfff6aa, emissive: 0xfff6aa, emissiveIntensity: 0.9 }),
      poster: new THREE.MeshStandardMaterial({ roughness: 0.8 })
    };
  }

  /* ==========================================================================
     BUILD OFFICE ROOM GEOMETRY
     ========================================================================== */
  buildOffice() {
    const roomW = 7.0; // Left to Right
    const roomH = 3.2; // Floor to Ceiling
    const roomD = 5.5; // Back to Front

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floor = new THREE.Mesh(floorGeo, this.materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -0.5);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(floorGeo, this.materials.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, roomH, -0.5);
    this.scene.add(ceiling);

    // Front Wall (in front of desk, Z = -3.2)
    const frontWallGeo = new THREE.PlaneGeometry(roomW, roomH);
    const frontWall = new THREE.Mesh(frontWallGeo, this.materials.wall);
    frontWall.position.set(0, roomH / 2, -3.2);
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    // Back Wall (behind player, Z = +2.2)
    const backWall = new THREE.Mesh(frontWallGeo, this.materials.wall);
    backWall.rotation.y = Math.PI;
    backWall.position.set(0, roomH / 2, 2.2);
    this.scene.add(backWall);

    // Left Wall with Door Cutout
    this.buildSideWall(-roomW / 2, 1);
    // Right Wall with Door Cutout
    this.buildSideWall(roomW / 2, -1);

    // Front Wall Poster ("Friends Forever")
    this.buildPoster();
  }

  buildSideWall(xPos, normalDir) {
    const wallMat = this.materials.wall;
    const roomH = 3.2;

    // Top beam above doorway
    const topBeamGeo = new THREE.BoxGeometry(0.3, 0.9, 5.5);
    const topBeam = new THREE.Mesh(topBeamGeo, wallMat);
    topBeam.position.set(xPos, 2.75, -0.5);
    this.scene.add(topBeam);

    // Front wall pillar
    const pillarFrontGeo = new THREE.BoxGeometry(0.3, roomH, 1.8);
    const pillarFront = new THREE.Mesh(pillarFrontGeo, wallMat);
    pillarFront.position.set(xPos, roomH / 2, -2.35);
    pillarFront.receiveShadow = true;
    this.scene.add(pillarFront);

    // Back wall pillar
    const pillarBackGeo = new THREE.BoxGeometry(0.3, roomH, 1.7);
    const pillarBack = new THREE.Mesh(pillarBackGeo, wallMat);
    pillarBack.position.set(xPos, roomH / 2, 1.4);
    pillarBack.receiveShadow = true;
    this.scene.add(pillarBack);

    // Window Divider Pillar between door and window
    const winDividerGeo = new THREE.BoxGeometry(0.25, 2.3, 0.2);
    const winDivider = new THREE.Mesh(winDividerGeo, this.materials.doorFrame);
    winDivider.position.set(xPos, 1.15, -0.1);
    this.scene.add(winDivider);

    // Window sill
    const sillGeo = new THREE.BoxGeometry(0.28, 0.8, 0.9);
    const sill = new THREE.Mesh(sillGeo, wallMat);
    sill.position.set(xPos, 0.4, -0.65);
    this.scene.add(sill);

    // Doorway opening frame
    const frameGeo = new THREE.BoxGeometry(0.35, 2.3, 1.1);
    const doorFrame = new THREE.Mesh(frameGeo, this.materials.doorFrame);
    doorFrame.position.set(xPos, 1.15, 0.55);
    doorFrame.castShadow = true;
    this.scene.add(doorFrame);
  }

  buildPoster() {
    const posterCanvas = document.createElement('canvas');
    posterCanvas.width = 512;
    posterCanvas.height = 320;
    const pCtx = posterCanvas.getContext('2d');

    pCtx.fillStyle = '#10141c';
    pCtx.fillRect(0, 0, 512, 320);

    // Border
    pCtx.strokeStyle = '#ffdd44';
    pCtx.lineWidth = 8;
    pCtx.strokeRect(10, 10, 492, 300);

    // Stars & Header
    pCtx.fillStyle = '#ff4444';
    pCtx.font = 'bold 36px monospace';
    pCtx.textAlign = 'center';
    pCtx.fillText('★ ★ ★', 256, 55);

    pCtx.fillStyle = '#ffdd44';
    pCtx.font = 'bold 44px monospace';
    pCtx.fillText('FRIENDS FOREVER', 256, 110);

    // Character Roster
    pCtx.fillStyle = '#ffffff';
    pCtx.font = '24px monospace';
    pCtx.fillText('TREVOR  •  CHRIS', 256, 175);
    pCtx.fillText('SPENCER  •  DAXON', 256, 215);

    pCtx.fillStyle = '#7a8b9e';
    pCtx.font = '16px monospace';
    pCtx.fillText('SECURITY MONITORING ZONE 1', 256, 275);

    const posterTex = new THREE.CanvasTexture(posterCanvas);
    const posterGeo = new THREE.PlaneGeometry(1.6, 1.0);
    const posterMat = new THREE.MeshBasicMaterial({ map: posterTex });
    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.set(0, 2.1, -3.18);
    this.scene.add(poster);
  }

  /* ==========================================================================
     BUILD 3D BLAST DOORS & BUTTON PANELS
     ========================================================================== */
  buildDoors() {
    const doorGeo = new THREE.BoxGeometry(0.12, 2.3, 1.05);

    // Left Door
    this.leftBlastDoor = new THREE.Mesh(doorGeo, this.materials.blastDoor);
    this.leftBlastDoor.position.set(-3.5, this.doorOpenY, 0.55);
    this.leftBlastDoor.castShadow = true;
    this.scene.add(this.leftBlastDoor);

    // Right Door
    this.rightBlastDoor = new THREE.Mesh(doorGeo, this.materials.blastDoor);
    this.rightBlastDoor.position.set(3.5, this.doorOpenY, 0.55);
    this.rightBlastDoor.castShadow = true;
    this.scene.add(this.rightBlastDoor);

    // Left Wall Control Panel Box
    this.buildButtonPanel(-3.35, 1.35, -0.05, Math.PI / 2, 'left');
    // Right Wall Control Panel Box
    this.buildButtonPanel(3.35, 1.35, -0.05, -Math.PI / 2, 'right');
  }

  buildButtonPanel(x, y, z, rotY, side) {
    const panelGroup = new THREE.Group();
    panelGroup.position.set(x, y, z);
    panelGroup.rotation.y = rotY;

    // Panel Backplate
    const plateGeo = new THREE.BoxGeometry(0.35, 0.55, 0.08);
    const plate = new THREE.Mesh(plateGeo, this.materials.buttonPanel);
    panelGroup.add(plate);

    // Red Door Button (Top)
    const btnGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
    btnGeo.rotateX(Math.PI / 2);

    const doorBtnMat = this.materials.btnRedOff.clone();
    const doorBtn = new THREE.Mesh(btnGeo, doorBtnMat);
    doorBtn.position.set(0, 0.12, 0.04);
    doorBtn.name = `btn_${side}_door`;
    panelGroup.add(doorBtn);
    this.interactables.push(doorBtn);

    // White Light Button (Bottom)
    const lightBtnMat = this.materials.btnWhiteOff.clone();
    const lightBtn = new THREE.Mesh(btnGeo, lightBtnMat);
    lightBtn.position.set(0, -0.12, 0.04);
    lightBtn.name = `btn_${side}_light`;
    panelGroup.add(lightBtn);
    this.interactables.push(lightBtn);

    // Store references
    if (side === 'left') {
      this.meshLeftDoorBtn = doorBtn;
      this.meshLeftLightBtn = lightBtn;
    } else {
      this.meshRightDoorBtn = doorBtn;
      this.meshRightLightBtn = lightBtn;
    }

    this.scene.add(panelGroup);
  }

  /* ==========================================================================
     BUILD CORRIDORS & 3D HALLWAY LIGHTING
     ========================================================================== */
  buildHallways() {
    const hallMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.9 });
    const corridorGeo = new THREE.BoxGeometry(4.0, 2.8, 2.0);

    // Left Corridor Box
    const leftHall = new THREE.Mesh(corridorGeo, hallMat);
    leftHall.position.set(-5.5, 1.4, 0.55);
    this.scene.add(leftHall);

    // Right Corridor Box
    const rightHall = new THREE.Mesh(corridorGeo, hallMat);
    rightHall.position.set(5.5, 1.4, 0.55);
    this.scene.add(rightHall);

    // Left Hallway Spotlight (reveals corridor when light button active)
    this.leftSpotlight = new THREE.SpotLight(0xffecc2, 0, 10, Math.PI / 4, 0.4, 1.2);
    this.leftSpotlight.position.set(-3.7, 2.5, 0.55);
    this.leftSpotlight.target.position.set(-6.5, 0.5, 0.55);
    this.scene.add(this.leftSpotlight);
    this.scene.add(this.leftSpotlight.target);

    // Right Hallway Spotlight
    this.rightSpotlight = new THREE.SpotLight(0xffecc2, 0, 10, Math.PI / 4, 0.4, 1.2);
    this.rightSpotlight.position.set(3.7, 2.5, 0.55);
    this.rightSpotlight.target.position.set(6.5, 0.5, 0.55);
    this.scene.add(this.rightSpotlight);
    this.scene.add(this.rightSpotlight.target);
  }

  /* ==========================================================================
     BUILD DESK & DIEGETIC COMPUTER MONITOR
     ========================================================================== */
  buildDeskAndComputer() {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(0, 0, -1.8);

    // Desk Table Top
    const topGeo = new THREE.BoxGeometry(3.2, 0.1, 1.4);
    const deskTop = new THREE.Mesh(topGeo, this.materials.desk);
    deskTop.position.set(0, 0.85, 0);
    deskTop.receiveShadow = true;
    deskTop.castShadow = true;
    deskGroup.add(deskTop);

    // Desk Legs & Side Panels
    const legGeo = new THREE.BoxGeometry(0.1, 0.85, 1.3);
    const leftLeg = new THREE.Mesh(legGeo, this.materials.desk);
    leftLeg.position.set(-1.5, 0.425, 0);
    deskGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, this.materials.desk);
    rightLeg.position.set(1.5, 0.425, 0);
    deskGroup.add(rightLeg);

    // Desk modesty backboard
    const backboardGeo = new THREE.BoxGeometry(3.0, 0.7, 0.08);
    const backboard = new THREE.Mesh(backboardGeo, this.materials.desk);
    backboard.position.set(0, 0.45, -0.6);
    deskGroup.add(backboard);

    // -------------------------------------------------------------
    // DIEGETIC COMPUTER MONITOR
    // -------------------------------------------------------------
    const monitorGroup = new THREE.Group();
    monitorGroup.position.set(0.1, 0.9, 0.1);
    monitorGroup.rotation.y = -0.05; // Slightly angled toward player

    // Monitor Base
    const baseGeo = new THREE.BoxGeometry(0.4, 0.05, 0.35);
    const base = new THREE.Mesh(baseGeo, this.materials.computerCase);
    base.position.set(0, 0.025, 0);
    monitorGroup.add(base);

    // Monitor Neck
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15);
    const neck = new THREE.Mesh(neckGeo, this.materials.computerCase);
    neck.position.set(0, 0.1, 0);
    monitorGroup.add(neck);

    // CRT Monitor Housing (Deep box)
    const crtGeo = new THREE.BoxGeometry(0.85, 0.65, 0.6);
    const crtHousing = new THREE.Mesh(crtGeo, this.materials.computerCase);
    crtHousing.position.set(0, 0.45, -0.1);
    crtHousing.castShadow = true;
    monitorGroup.add(crtHousing);

    // Dynamic Canvas for CRT Screen
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 512;
    this.screenCtx = this.screenCanvas.getContext('2d');

    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;

    // Glowing screen plane
    const screenGeo = new THREE.PlaneGeometry(0.74, 0.54);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 0.45, 0.205);
    this.screenMesh.name = "computer_monitor";
    monitorGroup.add(this.screenMesh);
    this.interactables.push(this.screenMesh);

    // Soft PointLight shining from the monitor onto desk
    this.screenLight = new THREE.PointLight(0x44ff88, 0.7, 2.5);
    this.screenLight.position.set(0, 0.45, 0.35);
    monitorGroup.add(this.screenLight);

    deskGroup.add(monitorGroup);

    // Soda Cup Prop
    const cupGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.15, 16);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 });
    const cup = new THREE.Mesh(cupGeo, cupMat);
    cup.position.set(0.8, 0.975, 0.2);
    deskGroup.add(cup);

    // Soda straw
    const strawGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.2);
    const strawMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const straw = new THREE.Mesh(strawGeo, strawMat);
    straw.position.set(0.81, 1.05, 0.21);
    straw.rotation.z = 0.2;
    deskGroup.add(straw);

    this.scene.add(deskGroup);

    // Initial render of computer screen
    this.updateComputerScreen(12, 1, 99, 1);
  }

  /* ==========================================================================
     UPDATE DIEGETIC COMPUTER MONITOR CANVAS
     ========================================================================== */
  updateComputerScreen(hour, night, power, usageLevel) {
    if (!this.screenCtx) return;
    const ctx = this.screenCtx;
    const w = 512;
    const h = 512;

    // Background phosphor CRT dark green
    ctx.fillStyle = '#06140b';
    ctx.fillRect(0, 0, w, h);

    // CRT Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2);
    }

    // Border Frame
    ctx.strokeStyle = '#22ee66';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    // Header
    ctx.fillStyle = '#22ee66';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('■ FREDDY FAZBEAR SEC-OS v2.4', 30, 48);
    ctx.fillRect(30, 60, w - 60, 2);

    // TIME DISPLAY (Prominent & Clear)
    const hourString = hour === 0 ? '12:00 AM' : `${hour}:00 AM`;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(hourString, 30, 130);

    // NIGHT READOUT
    ctx.fillStyle = '#88ffaa';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`NIGHT ${night}`, 30, 175);

    ctx.fillRect(30, 200, w - 60, 2);

    // POWER PERCENTAGE READOUT
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('POWER LEFT:', 30, 260);

    ctx.fillStyle = power > 20 ? '#39ff14' : '#ff3333';
    ctx.font = 'bold 50px monospace';
    ctx.fillText(`${Math.floor(power)}%`, 310, 260);

    // USAGE LEVEL BARS
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('USAGE:', 30, 320);

    for (let i = 1; i <= 5; i++) {
      if (i <= usageLevel) {
        if (usageLevel >= 4) ctx.fillStyle = '#ff2222';
        else if (usageLevel === 3) ctx.fillStyle = '#ffcc00';
        else ctx.fillStyle = '#39ff14';
      } else {
        ctx.fillStyle = '#10301a';
      }
      ctx.fillRect(140 + (i - 1) * 36, 298, 28, 28);
    }

    ctx.fillRect(30, 360, w - 60, 2);

    // CAMERA ACCESS PROMPT BUTTON
    ctx.fillStyle = '#164024';
    ctx.fillRect(30, 390, w - 60, 80);
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 390, w - 60, 80);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ [ CLICK TO OPEN CAMS ] ⚡', w / 2, 440);
    ctx.textAlign = 'left';

    this.screenTexture.needsUpdate = true;
  }

  /* ==========================================================================
     BUILD DESK FAN (SPINNING ANIMATION)
     ========================================================================== */
  buildFan() {
    this.fanGroup = new THREE.Group();
    this.fanGroup.position.set(-0.8, 0.9, -1.7);

    // Base
    const baseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.04, 16);
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x222730, roughness: 0.5, metalness: 0.5 });
    const base = new THREE.Mesh(baseGeo, fanMat);
    base.position.set(0, 0.02, 0);
    this.fanGroup.add(base);

    // Stand neck
    const neckGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25);
    const neck = new THREE.Mesh(neckGeo, fanMat);
    neck.position.set(0, 0.15, 0);
    this.fanGroup.add(neck);

    // Motor head
    const motorGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12);
    motorGeo.rotateX(Math.PI / 2);
    const motor = new THREE.Mesh(motorGeo, fanMat);
    motor.position.set(0, 0.28, 0);
    this.fanGroup.add(motor);

    // Wire Cage
    const cageGeo = new THREE.TorusGeometry(0.18, 0.015, 8, 24);
    const cage = new THREE.Mesh(cageGeo, fanMat);
    cage.position.set(0, 0.28, 0.08);
    this.fanGroup.add(cage);

    // Fan Blades (Rotated in animate loop)
    this.fanBlades = new THREE.Group();
    this.fanBlades.position.set(0, 0.28, 0.08);

    const bladeGeo = new THREE.BoxGeometry(0.04, 0.16, 0.005);
    bladeGeo.rotateZ(0.2);

    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeo, fanMat);
      blade.rotation.z = (i * Math.PI * 2) / 3;
      blade.position.y = 0.07;
      this.fanBlades.add(blade);
    }

    this.fanGroup.add(this.fanBlades);
    this.scene.add(this.fanGroup);
  }

  /* ==========================================================================
     BUILD OFFICE LIGHTING
     ========================================================================== */
  buildLighting() {
    // Ambient light (Dim, claustrophobic)
    this.ambientLight = new THREE.AmbientLight(0x101520, 0.6);
    this.scene.add(this.ambientLight);

    // Overhead ceiling fluorescent strip
    this.overheadLight = new THREE.PointLight(0xddeeff, 1.2, 8);
    this.overheadLight.position.set(0, 2.9, -0.5);
    this.overheadLight.castShadow = true;
    this.overheadLight.shadow.mapSize.width = 1024;
    this.overheadLight.shadow.mapSize.height = 1024;
    this.scene.add(this.overheadLight);
  }

  /* ==========================================================================
     INPUT HANDLING (MOUSE LOOK & RAYCASTING)
     ========================================================================== */
  setupInputs() {
    // Mouse movement: calculates Yaw and Pitch for head turning
    window.addEventListener('mousemove', (e) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1; // -1 (left) to +1 (right)
      const normY = -(e.clientY / window.innerHeight) * 2 + 1; // -1 (bottom) to +1 (top)

      // Target head rotation angles
      this.targetYaw = -normX * this.maxYaw;
      this.targetPitch = normY * this.maxPitch;

      // Update raycaster mouse coordinates
      this.mouse.x = normX;
      this.mouse.y = normY;
    });

    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Click Raycaster for 3D buttons & computer monitor
    window.addEventListener('click', (e) => {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.interactables, true);

      if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        this.handleObjectClick(clickedObj.name);
      }
    });
  }

  handleObjectClick(name) {
    if (!name) return;

    if (name === 'btn_left_door') {
      this.toggleLeftDoor();
    } else if (name === 'btn_left_light') {
      this.toggleLeftLight();
    } else if (name === 'btn_right_door') {
      this.toggleRightDoor();
    } else if (name === 'btn_right_light') {
      this.toggleRightLight();
    } else if (name === 'computer_monitor') {
      this.triggerCameras();
    }
  }

  triggerCameras() {
    window.soundEngine.playButtonClick();
    if (this.game) {
      this.game.toggleCameras();
    }
  }

  /* ==========================================================================
     DOOR & LIGHT TOGGLES
     ========================================================================== */
  toggleLeftDoor() {
    this.leftDoorClosed = !this.leftDoorClosed;
    this.leftDoorTargetY = this.leftDoorClosed ? this.doorClosedY : this.doorOpenY;

    if (this.meshLeftDoorBtn) {
      this.meshLeftDoorBtn.material = this.leftDoorClosed ? this.materials.btnRedOn : this.materials.btnRedOff;
    }

    window.soundEngine.playButtonClick();
    if (this.leftDoorClosed) {
      window.soundEngine.playDoorSlam();
      if (this.game && this.game.onDoorClosed) this.game.onDoorClosed('left');
    } else {
      window.soundEngine.playDoorOpen();
      if (this.game && this.game.onDoorOpened) this.game.onDoorOpened('left');
    }

    if (this.game) this.game.onPowerStateChanged();
  }

  toggleRightDoor() {
    this.rightDoorClosed = !this.rightDoorClosed;
    this.rightDoorTargetY = this.rightDoorClosed ? this.doorClosedY : this.doorOpenY;

    if (this.meshRightDoorBtn) {
      this.meshRightDoorBtn.material = this.rightDoorClosed ? this.materials.btnRedOn : this.materials.btnRedOff;
    }

    window.soundEngine.playButtonClick();
    if (this.rightDoorClosed) {
      window.soundEngine.playDoorSlam();
      if (this.game && this.game.onDoorClosed) this.game.onDoorClosed('right');
    } else {
      window.soundEngine.playDoorOpen();
      if (this.game && this.game.onDoorOpened) this.game.onDoorOpened('right');
    }

    if (this.game) this.game.onPowerStateChanged();
  }

  toggleLeftLight() {
    this.leftLightOn = !this.leftLightOn;
    this.leftSpotlight.intensity = this.leftLightOn ? 4.5 : 0;

    if (this.meshLeftLightBtn) {
      this.meshLeftLightBtn.material = this.leftLightOn ? this.materials.btnWhiteOn : this.materials.btnWhiteOff;
    }

    window.soundEngine.playButtonClick();
    window.soundEngine.setLightHum('left', this.leftLightOn);

    if (this.game) this.game.onPowerStateChanged();
  }

  toggleRightLight() {
    this.rightLightOn = !this.rightLightOn;
    this.rightSpotlight.intensity = this.rightLightOn ? 4.5 : 0;

    if (this.meshRightLightBtn) {
      this.meshRightLightBtn.material = this.rightLightOn ? this.materials.btnWhiteOn : this.materials.btnWhiteOff;
    }

    window.soundEngine.playButtonClick();
    window.soundEngine.setLightHum('right', this.rightLightOn);

    if (this.game) this.game.onPowerStateChanged();
  }

  getUsageLevel() {
    let usage = 1;
    if (this.leftDoorClosed) usage++;
    if (this.rightDoorClosed) usage++;
    if (this.leftLightOn) usage++;
    if (this.rightLightOn) usage++;
    return Math.min(usage, 5);
  }

  /* ==========================================================================
     MAIN 3D ANIMATION LOOP
     ========================================================================== */
  animate(currentTime) {
    const delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Smooth head turning (yaw and pitch)
    this.currentYaw += (this.targetYaw - this.currentYaw) * 0.08;
    this.currentPitch += (this.targetPitch - this.currentPitch) * 0.08;

    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.currentYaw;
    this.camera.rotation.x = this.currentPitch;

    // Animate blast doors sliding on Y axis
    this.leftBlastDoor.position.y += (this.leftDoorTargetY - this.leftBlastDoor.position.y) * 0.22;
    this.rightBlastDoor.position.y += (this.rightDoorTargetY - this.rightBlastDoor.position.y) * 0.22;

    // Spin fan blades
    if (this.fanBlades) {
      this.fanBlades.rotation.z += 0.35;
    }

    // Hover cursor feedback
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactables, true);
    if (intersects.length > 0) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'crosshair';
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.animate);
  }
}
