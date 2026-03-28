const TILE_SIZE = 40;
const WALL_MARGIN = 60;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 48;
const SCROLL_SPEED = 300;
const GRAVITY = 800;
const OBSTACLE_WIDTH = 24;
const OBSTACLE_HEIGHT = 40;
const SPAWN_INTERVAL = 1800;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.score = 0;
    this.isAlive = true;
  }

  create() {
    const { width, height } = this.scale;

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

    // Score text (fixed to camera)
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '20px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setScrollFactor(0);
  }

  update(time, delta) {
    if (!this.isAlive) return;

    const dt = delta / 1000;

    this._scrollWalls(dt);
    this._scrollObstacles(dt);

    // Space: flip gravity, only when touching a surface
    const onSurface = this.player.body.blocked.down || this.player.body.blocked.up;
    if (onSurface && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.gravityDir *= -1;
      this.physics.world.gravity.y = GRAVITY * this.gravityDir;
      this.player.body.setVelocityY(0);
      this._playFlipAnim();
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
      // Death frames: spinning skater
      const deathAngles = [45, 90, 135, 180];
      const angle = deathAngles[frameIndex - 6];
      this._drawSkaterRotated(g, ox, angle, true);
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
    const spawnX = this.cameras.main.scrollX + width + OBSTACLE_WIDTH;
    const floorSurface = height - WALL_MARGIN - TILE_SIZE;
    const ceilingSurface = WALL_MARGIN + TILE_SIZE;

    if (Phaser.Math.Between(0, 1) === 0) {
      this._addObstacle(spawnX, floorSurface - OBSTACLE_HEIGHT / 2);
    } else {
      this._addObstacle(spawnX, ceilingSurface + OBSTACLE_HEIGHT / 2);
    }
  }

  _addObstacle(x, y) {
    const obs = this.add.rectangle(x, y, OBSTACLE_WIDTH, OBSTACLE_HEIGHT, 0xff4757);
    this.physics.add.existing(obs, true);
    this.obstacles.add(obs);
  }

  _scrollObstacles(dt) {
    const shift = SCROLL_SPEED * dt;
    const camX = this.cameras.main.scrollX;

    this.obstacles.getChildren().forEach(obs => {
      obs.x -= shift;
      obs.body.reset(obs.x, obs.y);

      if (obs.x < camX - OBSTACLE_WIDTH) {
        obs.destroy();
      }
    });
  }

  _gameOver() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.spawnTimer.remove();
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

    this.add.text(width / 2, height / 2 + 60, 'Press R to restart', {
      fontSize: '18px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setOrigin(0.5);

    this.input.keyboard.once('keydown-R', () => {
      this.score = 0;
      this.isAlive = true;
      this.scene.restart();
    });
  }
}
