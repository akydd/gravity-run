const TILE_SIZE = 40;
const WALL_MARGIN = 60;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 48;
const SCROLL_SPEED = 300;
const GRAVITY = 800;
const OBSTACLE_WIDTH = 24;
const SPAWN_INTERVAL = 1800;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.score = 0;
    this.isAlive = true;
  }

  preload() {
    this.load.audio('gameplay', 'src/music/gameplay.mp3');
  }

  create() {
    this.isAlive = true;
    this.score = 0;
    this.physics.world.gravity.y = GRAVITY;

    const { width, height } = this.scale;

    const gap = height - 2 * WALL_MARGIN - 2 * TILE_SIZE;
    const maxObstacleHeight = gap / 2;
    this.obstacleSizes = [
      { w: OBSTACLE_WIDTH, h: Math.round(maxObstacleHeight / 3), type: 'cone' },
      { w: OBSTACLE_WIDTH, h: Math.round(maxObstacleHeight * 2 / 3), type: 'stopSign' },
      { w: Math.round(maxObstacleHeight * 1.5), h: maxObstacleHeight, type: 'dumpster' },
    ];

    const { w: cw, h: ch } = this.obstacleSizes[0];
    this._createConeTexture(cw, ch);

    const { w: sw, h: sh } = this.obstacleSizes[1];
    this._createStopSignTexture(sw, sh);

    const { w: dw, h: dh } = this.obstacleSizes[2];
    this._createDumpsterTexture(dw, dh);

    this._createSkaterTexture();

    // Animations
    this.anims.create({
      key: 'ride',
      frames: this.anims.generateFrameNumbers('skater', { start: 0, end: 1 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: 'flip',
      frames: this.anims.generateFrameNumbers('skater', { start: 2, end: 5 }),
      frameRate: 24,
      repeat: 0,
    });
    this.anims.create({
      key: 'die',
      frames: this.anims.generateFrameNumbers('skater', { start: 6, end: 9 }),
      frameRate: 12,
      repeat: 0,
    });

    // Floor and ceiling tiles share one static group
    this.walls = this.physics.add.staticGroup();
    this._buildWallRow(width, height - WALL_MARGIN - TILE_SIZE / 2);
    this._buildWallRow(width, WALL_MARGIN + TILE_SIZE / 2);

    // Player sprite
    const midY = height / 2 + TILE_SIZE / 2;
    this.player = this.physics.add.sprite(120, midY, 'skater');
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(PLAYER_WIDTH - 6, PLAYER_HEIGHT - 8);
    this.player.play('ride');

    this.physics.add.collider(this.player, this.walls);

    // Obstacles
    this.obstacles = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.obstacles, () => this._gameOver());

    // Dumpsters are landable — only kill on side hit
    this.dumpsters = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.dumpsters, null, this._processDumpsterCollision, this);

    this.spawnTimer = this.time.addEvent({
      delay: SPAWN_INTERVAL,
      callback: this._spawnObstacle,
      callbackScope: this,
      loop: true,
    });

    this.gravityDir = 1;

    // Camera follows player with player pinned at 25% of screen width
    this.cameras.main.startFollow(this.player, true, 1, 0);
    this.cameras.main.setFollowOffset(width * 0.25 - width * 0.5, 0);

    // Input
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on('pointerdown', () => this._tryFlipGravity());

    // Music
    this.music = this.sound.add('gameplay', { loop: true, volume: 0.6 });
    this.music.play();

    // Score text (fixed to camera)
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '20px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setScrollFactor(0);

    // Pause button (top-right, fixed to camera)
    this.isPaused = false;
    const btnSize = 44;
    const margin = 10;
    this.pauseBtnBg = this.add.rectangle(width - margin - btnSize / 2, margin + btnSize / 2, btnSize, btnSize, 0x333355)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }).setDepth(10);
    this.pauseBtnText = this.add.text(width - margin - btnSize / 2, margin + btnSize / 2, 'II', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setScrollFactor(0).setOrigin(0.5).setDepth(10);

    this.pauseBtnBg.on('pointerdown', () => this._togglePause());

    this.pausedLabel = this.add.text(width / 2, height / 2, 'PAUSED', {
      fontSize: '48px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setScrollFactor(0).setOrigin(0.5).setDepth(10).setVisible(false);
  }

  update(time, delta) {
    this.pauseJustToggled = false;
    if (!this.isAlive || this.isPaused) return;

    const dt = delta / 1000;

    this._scrollWalls(dt);
    this._scrollObstacles(dt);

    // Space: flip gravity, only when touching a surface
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this._tryFlipGravity();
    }

    this.score += SCROLL_SPEED * dt;
    this.scoreText.setText('Score: ' + Math.floor(this.score));
  }

  // ─── sprite texture ───────────────────────────────────────────────────────

  _createSkaterTexture() {
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;
    // 10 frames total: 0-1 ride, 2-5 flip, 6-9 die
    const totalFrames = 10;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    for (let i = 0; i < totalFrames; i++) {
      this._drawSkaterFrame(g, i * w, i);
    }

    g.generateTexture('skater', w * totalFrames, h);
    g.destroy();

    // Register individual frames so generateFrameNumbers works
    const texture = this.textures.get('skater');
    for (let i = 0; i < totalFrames; i++) {
      texture.add(i, 0, i * w, 0, w, h);
    }
  }

  _drawSkaterFrame(g, ox, frameIndex) {
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;

    // frameIndex 0-1: riding, 2-5: gravity flip rotation, 6-9: death spin
    if (frameIndex <= 1) {
      this._drawSkater(g, ox, frameIndex === 1);
    } else if (frameIndex <= 5) {
      // Flip frames: rotate the skater drawing using a mid-flip pose
      const flipAngles = [45, 90, 135, 180];
      const angle = flipAngles[frameIndex - 2];
      this._drawSkaterRotated(g, ox, angle);
    } else {
      // Death frames: person falling off board
      this._drawDeathFrame(g, ox, frameIndex - 6);
    }
  }

  _drawSkater(g, ox, altPose) {
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;

    // Wheels
    g.fillStyle(0x222222);
    g.fillCircle(ox + 7,     h - 4, 4);
    g.fillCircle(ox + w - 7, h - 4, 4);

    // Board deck
    g.fillStyle(0xc0813a);
    g.fillRoundedRect(ox + 2, h - 12, w - 4, 6, 2);
    // Board grip tape stripe
    g.fillStyle(0x8a5a28);
    g.fillRect(ox + 4, h - 12, w - 8, 2);

    // Legs
    g.fillStyle(0x1a2a6c);
    if (altPose) {
      g.fillRect(ox + w / 2 - 9, h - 24, 7, 13);
      g.fillRect(ox + w / 2 + 2, h - 21, 7, 10);
    } else {
      g.fillRect(ox + w / 2 - 9, h - 21, 7, 10);
      g.fillRect(ox + w / 2 + 2, h - 24, 7, 13);
    }

    // Shoes
    g.fillStyle(0xcc2200);
    g.fillRect(ox + w / 2 - 10, h - 13, 8, 4);
    g.fillRect(ox + w / 2 + 2,  h - 13, 8, 4);

    // Torso
    g.fillStyle(0x2980b9);
    g.fillRect(ox + w / 2 - 7, h - 36, 14, 13);

    // Arms
    g.fillStyle(0x2980b9);
    g.fillRect(ox + w / 2 - 13, h - 35, 7, 4);
    g.fillRect(ox + w / 2 + 6,  h - 33, 7, 4);

    // Hands
    g.fillStyle(0xf5c97a);
    g.fillCircle(ox + w / 2 - 11, h - 33, 3);
    g.fillCircle(ox + w / 2 + 13, h - 31, 3);

    // Neck
    g.fillStyle(0xf5c97a);
    g.fillRect(ox + w / 2 - 3, h - 40, 6, 5);

    // Head
    g.fillStyle(0xf5c97a);
    g.fillCircle(ox + w / 2, h - 44, 7);

    // Helmet
    g.fillStyle(0xe74c3c);
    g.fillEllipse(ox + w / 2, h - 48, 16, 9);

    // Visor
    g.fillStyle(0xc0392b);
    g.fillRect(ox + w / 2 - 7, h - 44, 14, 3);

    // Eye
    g.fillStyle(0x111111);
    g.fillCircle(ox + w / 2 + 3, h - 42, 2);
  }

  _drawSkaterRotated(g, ox, angleDeg, tint = false) {
    // Approximate a rotated skater with a simple silhouette
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;
    const cx = ox + w / 2;
    const cy = h / 2;
    const rad = (angleDeg * Math.PI) / 180;

    const color = tint ? 0xff4444 : 0x2980b9;

    // Body silhouette as a rotated capsule shape
    g.fillStyle(color);
    const bw = 12;
    const bh = 38;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Draw rotated rectangle as 4-point polygon
    const hw = bw / 2;
    const hh = bh / 2;
    const corners = [
      [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
    ].map(([x, y]) => ({
      x: cx + x * cos - y * sin,
      y: cy + x * sin + y * cos,
    }));

    g.fillPoints(corners, true);

    // Helmet circle
    g.fillStyle(0xe74c3c);
    const headOff = { x: cx + (-hh + 5) * (-sin), y: cy + (-hh + 5) * cos };
    g.fillCircle(headOff.x, headOff.y, 7);

    // Board
    g.fillStyle(0xc0813a);
    const boardOff = { x: cx + (hh - 4) * (-sin), y: cy + (hh - 4) * cos };
    const brd = 14;
    const boardCorners = [
      [-brd, -3], [brd, -3], [brd, 3], [-brd, 3],
    ].map(([x, y]) => ({
      x: boardOff.x + x * cos - y * sin,
      y: boardOff.y + x * sin + y * cos,
    }));
    g.fillPoints(boardCorners, true);
  }

  _drawDeathFrame(g, ox, frameIndex) {
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;

    // Each frame: person rotates backward, board slides away separately
    const bodyAngle  = [20,  60, 110, 160][frameIndex]; // person tipping back (degrees)
    const bodyRise   = [ 0,   4,   8,  12][frameIndex]; // person floats upward (px)
    const boardSlide = [ 2,   6,  11,  16][frameIndex]; // board slides left (px)
    const boardTilt  = [ 5,  25,  50,  80][frameIndex]; // board tilts (degrees)

    const cx = ox + w / 2;
    const bRad = (bodyAngle * Math.PI) / 180;
    const bCos = Math.cos(bRad);
    const bSin = Math.sin(bRad);
    const bodyCY = h / 2 - bodyRise;

    // ── Person body ───────────────────────────────────────────────────────
    const bw = 10, bh = 30;
    const hw = bw / 2, hh = bh / 2;
    g.fillStyle(0x2980b9);
    g.fillPoints([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({
      x: cx + x * bCos - y * bSin,
      y: bodyCY + x * bSin + y * bCos,
    })), true);

    // Head
    const headX = cx + (-hh + 5) * (-bSin);
    const headY = bodyCY + (-hh + 5) * bCos;
    g.fillStyle(0xf5c97a);
    g.fillCircle(headX, headY, 6);

    // Helmet
    g.fillStyle(0xe74c3c);
    const helmRad = (bodyAngle - 10) * Math.PI / 180;
    g.fillEllipse(
      headX - Math.sin(helmRad) * 3,
      headY - Math.cos(helmRad) * 3,
      14, 8
    );

    // Arms flailing outward as they fall
    const armSpread = [8, 13, 16, 18][frameIndex];
    g.fillStyle(0x2980b9);
    const armBaseX = cx + (hh - 12) * (-bSin);
    const armBaseY = bodyCY + (hh - 12) * bCos;
    const perpX = bCos, perpY = bSin;
    g.fillRect(armBaseX - perpX * armSpread - 3, armBaseY - perpY * armSpread - 1, 6, 3);
    g.fillRect(armBaseX + perpX * armSpread - 3, armBaseY + perpY * armSpread - 1, 6, 3);

    // ── Board (slides left and tilts independently) ───────────────────────
    const boardX = cx - boardSlide;
    const boardY = h - 10;
    const tRad = (boardTilt * Math.PI) / 180;
    const tCos = Math.cos(tRad);
    const tSin = Math.sin(tRad);
    const brd = 13;
    g.fillStyle(0xc0813a);
    g.fillPoints([[-brd, -3], [brd, -3], [brd, 3], [-brd, 3]].map(([x, y]) => ({
      x: boardX + x * tCos - y * tSin,
      y: boardY + x * tSin + y * tCos,
    })), true);

    // Wheels
    g.fillStyle(0x222222);
    g.fillCircle(boardX + (-brd + 3) * tCos, boardY + (-brd + 3) * tSin, 3);
    g.fillCircle(boardX + (brd - 3) * tCos, boardY + (brd - 3) * tSin, 3);
  }

  _togglePause() {
    this.pauseJustToggled = true;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.pause();
      this.spawnTimer.paused = true;
      this.music.pause();
      this.pauseBtnText.setText('\u25B6');
      this.pausedLabel.setVisible(true);
    } else {
      this.physics.resume();
      this.spawnTimer.paused = false;
      this.music.resume();
      this.pauseBtnText.setText('II');
      this.pausedLabel.setVisible(false);
    }
  }

  _tryFlipGravity() {
    if (!this.isAlive || this.isPaused || this.pauseJustToggled) return;
    this.pauseJustToggled = false;
    const onSurface = this.player.body.blocked.down || this.player.body.blocked.up;
    if (!onSurface) return;
    this.gravityDir *= -1;
    this.physics.world.gravity.y = GRAVITY * this.gravityDir;
    this.player.body.setVelocityY(0);
    this._playFlipAnim();
  }

  // ─── gravity flip animation ───────────────────────────────────────────────

  _playFlipAnim() {
    // Play flip sprite frames then return to ride
    this.player.play('flip');
    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.isAlive) {
        // Flip the sprite vertically to match new gravity direction
        this.player.setFlipY(this.gravityDir === -1);
        this.player.play('ride');
      }
    });
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  _buildWallRow(width, tileY) {
    const tileCount = Math.ceil((width * 2) / TILE_SIZE) + 2;
    for (let i = 0; i < tileCount; i++) {
      const tile = this.add.rectangle(
        i * TILE_SIZE + TILE_SIZE / 2,
        tileY,
        TILE_SIZE,
        TILE_SIZE,
        0x16213e
      );
      this.physics.add.existing(tile, true);
      this.walls.add(tile);
    }
  }

  _scrollWalls(dt) {
    const shift = SCROLL_SPEED * dt;
    const camX = this.cameras.main.scrollX;

    const rows = new Map();
    this.walls.getChildren().forEach(tile => {
      const row = tile.y;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push(tile);
    });

    rows.forEach(tiles => {
      tiles.forEach(tile => {
        tile.x -= shift;
        tile.body.reset(tile.x, tile.y);

        if (tile.x < camX - TILE_SIZE) {
          const rightmost = tiles.reduce((max, t) => Math.max(max, t.x), -Infinity);
          tile.x = rightmost + TILE_SIZE;
          tile.body.reset(tile.x, tile.y);
        }
      });
    });
  }

  _spawnObstacle() {
    const { width, height } = this.scale;
    const floorSurface = height - WALL_MARGIN - TILE_SIZE;
    const ceilingSurface = WALL_MARGIN + TILE_SIZE;
    const { w, h, type } = Phaser.Utils.Array.GetRandom(this.obstacleSizes);
    const spawnX = this.cameras.main.scrollX + width + w;
    const fromCeiling = Phaser.Math.Between(0, 1) === 1;
    const y = fromCeiling ? ceilingSurface + h / 2 : floorSurface - h / 2;
    this._addObstacle(spawnX, y, w, h, type, fromCeiling);
  }

  _addObstacle(x, y, w, h, type, fromCeiling) {
    let obs;
    if (type === 'dumpster') {
      obs = this.add.image(x, y, 'dumpster');
      obs.setFlipY(fromCeiling);
      this.physics.add.existing(obs, true);
      this.dumpsters.add(obs);
      return;
    } else if (type === 'cone') {
      obs = this.add.image(x, y, 'cone');
      obs.setFlipY(fromCeiling);
    } else if (type === 'stopSign') {
      obs = this.add.image(x, y, 'stopSign');
      obs.setFlipY(fromCeiling);
    } else {
      obs = this.add.rectangle(x, y, w, h, 0xff4757);
    }
    this.physics.add.existing(obs, true);
    this.obstacles.add(obs);
  }

  _processDumpsterCollision(player, dumpster) {
    const pb = player.body;
    const db = dumpster.body;
    const playerCenterY = pb.top + pb.height / 2;
    if (playerCenterY > db.top && playerCenterY < db.bottom) {
      // Player centre is inside the dumpster's vertical range → side hit
      this._gameOver();
      return false;
    }
    return true; // player centre is above or below → top/bottom surface hit
  }

  _createStopSignTexture(w, h) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const signSize = w; // octagon fits in w×w square
    const cut = Math.round(signSize * 0.22);
    const poleW = Math.round(w * 0.15);
    const poleX = Math.round((w - poleW) / 2);

    // Pole
    g.fillStyle(0x999999);
    g.fillRect(poleX, signSize, poleW, h - signSize);

    // White octagon border
    g.fillStyle(0xffffff);
    g.fillPoints([
      { x: cut,          y: 0          },
      { x: w - cut,      y: 0          },
      { x: w,            y: cut        },
      { x: w,            y: signSize - cut },
      { x: w - cut,      y: signSize   },
      { x: cut,          y: signSize   },
      { x: 0,            y: signSize - cut },
      { x: 0,            y: cut        },
    ], true);

    // Red octagon inset by border
    const b = 2;
    g.fillStyle(0xcc0000);
    g.fillPoints([
      { x: cut + b,      y: b          },
      { x: w - cut - b,  y: b          },
      { x: w - b,        y: cut + b    },
      { x: w - b,        y: signSize - cut - b },
      { x: w - cut - b,  y: signSize - b },
      { x: cut + b,      y: signSize - b },
      { x: b,            y: signSize - cut - b },
      { x: b,            y: cut + b    },
    ], true);

    // "STOP" lettering — four white rectangles suggesting the word
    const lx = Math.round(w * 0.18);
    const lw = Math.round(w * 0.64);
    const ly = Math.round(signSize * 0.35);
    const lh = Math.round(signSize * 0.28);
    g.fillStyle(0xffffff);
    // Top bar
    g.fillRect(lx, ly, lw, Math.round(lh * 0.22));
    // Middle bar
    g.fillRect(lx, ly + Math.round(lh * 0.39), lw, Math.round(lh * 0.22));
    // Bottom bar
    g.fillRect(lx, ly + Math.round(lh * 0.78), lw, Math.round(lh * 0.22));

    g.generateTexture('stopSign', w, h);
    g.destroy();
  }

  _createConeTexture(w, h) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const baseH = Math.round(h * 0.18);
    const coneH = h - baseH;
    const cx = Math.round(w / 2);

    // Base
    g.fillStyle(0x222222);
    g.fillRect(0, coneH, w, baseH);

    // Cone body (orange)
    g.fillStyle(0xff6a00);
    g.fillTriangle(cx, 0, 0, coneH, w, coneH);

    // White stripe (trapezoid across middle of cone)
    const sTop = Math.round(coneH * 0.45);
    const sBot = Math.round(coneH * 0.68);
    const wTop = Math.round(w * sTop / coneH);
    const wBot = Math.round(w * sBot / coneH);
    g.fillStyle(0xffffff);
    g.fillPoints([
      { x: cx - Math.round(wTop / 2), y: sTop },
      { x: cx + Math.round(wTop / 2), y: sTop },
      { x: cx + Math.round(wBot / 2), y: sBot },
      { x: cx - Math.round(wBot / 2), y: sBot },
    ], true);

    g.generateTexture('cone', w, h);
    g.destroy();
  }

  _createDumpsterTexture(w, h) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const lidH = Math.round(h * 0.15);
    const wheelR = Math.round(h * 0.09);
    const bodyTop = lidH;
    const bodyH = h - lidH - wheelR * 2;

    // Main body
    g.fillStyle(0x2d6b1f);
    g.fillRect(6, bodyTop, w - 12, bodyH);

    // Side walls (darker)
    g.fillStyle(0x1f4d15);
    g.fillRect(6, bodyTop, 8, bodyH);
    g.fillRect(w - 14, bodyTop, 8, bodyH);

    // Horizontal ribs
    g.fillStyle(0x1a4010);
    g.fillRect(6, bodyTop + Math.round(bodyH * 0.33), w - 12, 3);
    g.fillRect(6, bodyTop + Math.round(bodyH * 0.66), w - 12, 3);

    // Metallic rim at top of body
    g.fillStyle(0x777777);
    g.fillRect(6, bodyTop, w - 12, 3);

    // Lid
    g.fillStyle(0x3a8a28);
    g.fillRect(0, 0, w, lidH);

    // Lid shadow at bottom edge
    g.fillStyle(0x1a4010);
    g.fillRect(6, lidH - 3, w - 12, 3);

    // Lid handle
    g.fillStyle(0x888888);
    g.fillRect(Math.round(w / 2) - 12, Math.round(lidH * 0.2), 24, Math.round(lidH * 0.55));

    // Wheels
    g.fillStyle(0x222222);
    g.fillCircle(20, h - wheelR, wheelR);
    g.fillCircle(w - 20, h - wheelR, wheelR);

    // Axle
    g.fillStyle(0x555555);
    g.fillRect(20, h - wheelR - 2, w - 40, 4);

    g.generateTexture('dumpster', w, h);
    g.destroy();
  }

  _scrollObstacles(dt) {
    const shift = SCROLL_SPEED * dt;
    const camX = this.cameras.main.scrollX;

    const scrollGroup = (group) => {
      group.getChildren().forEach(obs => {
        obs.x -= shift;
        obs.body.reset(obs.x, obs.y);
        if (obs.x < camX - obs.width) {
          obs.destroy();
        }
      });
    };

    scrollGroup(this.obstacles);
    scrollGroup(this.dumpsters);
  }

  _gameOver() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.music.stop();
    this.spawnTimer.remove();
    this.pauseBtnBg.setVisible(false);
    this.pauseBtnText.setVisible(false);
    this.player.body.setVelocity(0, 0);
    this.player.body.setGravityY(-GRAVITY * this.gravityDir);

    // Death animation — play frames then spin/fade out
    this.player.play('die');
    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({
        targets: this.player,
        angle: 540,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeIn',
        onComplete: () => this._showGameOverScreen(),
      });
    });
  }

  _showGameOverScreen() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height / 2 - 40, 'GAME OVER', {
      fontSize: '48px',
      fill: '#ff4757',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 20, `Score: ${Math.floor(this.score)}`, {
      fontSize: '24px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setOrigin(0.5);

    const btnY = height / 2 + 70;
    const btnW = 160;
    const btnH = 44;
    const gap = 20;

    // Restart button
    const restartBg = this.add.rectangle(width / 2 - btnW / 2 - gap / 2, btnY, btnW, btnH, 0xf0c040)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.add.text(width / 2 - btnW / 2 - gap / 2, btnY, 'RESTART', {
      fontSize: '18px',
      fill: '#000000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setScrollFactor(0).setOrigin(0.5);

    // Home button
    const homeBg = this.add.rectangle(width / 2 + btnW / 2 + gap / 2, btnY, btnW, btnH, 0x4a90d9)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.add.text(width / 2 + btnW / 2 + gap / 2, btnY, 'HOME', {
      fontSize: '18px',
      fill: '#000000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setScrollFactor(0).setOrigin(0.5);

    restartBg.on('pointerdown', () => {
      this.score = 0;
      this.isAlive = true;
      this.scene.restart();
    });

    homeBg.on('pointerdown', () => this.scene.start('HomeScene'));
  }
}
