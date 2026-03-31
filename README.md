# Sk8r-dude

A side-scrolling survival game built with [Phaser 3](https://phaser.io). You play as a skateboarder hurtling through a tunnel. Press Space to flip gravity and avoid the obstacles ahead.

## Controls

| Key | Action |
|-----|--------|
| `Space` | Flip gravity (only when touching a surface) |
| `R` | Restart after game over |

## Running locally

The game uses ES modules and must be served over HTTP.

**Option 1 — Node:**
```bash
npx serve .
```

**Option 2 — Python:**
```bash
python3 -m http.server
```

Then open `http://localhost:3000` (or whichever port is shown) in your browser.
