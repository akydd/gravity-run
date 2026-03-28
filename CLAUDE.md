# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

The project uses ES modules (`type="module"`), so it must be served via a local HTTP server — opening `index.html` directly will fail.

```bash
npx serve .
# or
python3 -m http.server
```

No build step, no bundler, no dependencies to install.

## Architecture

**Entry point:** `index.html` loads Phaser 3 from CDN, then `src/game.js` as an ES module.

**`src/game.js`** — Phaser game config only. Sets canvas size (800×450), arcade physics with gravity, and registers scenes.

**`src/scenes/GameScene.js`** — the entire game lives here. Key design decisions:

- **Scrolling:** The world moves left; the player stays at a fixed x. Walls and obstacles are shifted manually each frame (`tile.x -= shift; tile.body.reset(...)`) rather than using Phaser's camera scroll or physics velocity. Wall tiles recycle off the left edge back to the right.
- **Gravity flip:** World gravity (`this.physics.world.gravity.y`) is toggled between `+GRAVITY` and `-GRAVITY`. Spacebar is only accepted when `body.blocked.down || body.blocked.up`.
- **Sprite texture:** The `skater` spritesheet is generated entirely in code via Phaser `Graphics.generateTexture()` in `create()`. After generation, frames are registered manually with `texture.add(i, 0, i * w, 0, w, h)` — this is required because `generateTexture` produces a flat texture with no frame data.
- **Obstacles:** Spawned on a timer off the right edge, scrolled manually, destroyed when off the left edge (no recycling).
- **Camera:** `setFollowOffset(width * 0.25 - width * 0.5, 0)` keeps the player at 25% of the screen width.

Constants at the top of `GameScene.js` control all tunable gameplay values (`TILE_SIZE`, `WALL_MARGIN`, `SCROLL_SPEED`, `GRAVITY`, `OBSTACLE_HEIGHT`, `SPAWN_INTERVAL`).
