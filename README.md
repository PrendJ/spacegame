# Space Game

Space Game is a lightweight Flask-served arcade built on an HTML5 canvas. Battle waves of ships in the familiar 2D grid or switch to a pseudo-3D starfield variant for faster, more cinematic runs.

## Features
- **Dual dimensions:** Classic 2D grid tactics or a 3D starfield projection for a sense of depth.
- **Difficulty presets:** Explorer, Veteran, and Nightmare profiles tune movement speed, enemy spread, and fire cadence.
- **Desktop & mobile controls:** Keyboard/space bar on desktop, drag/tap auto-fire on touch devices.
- **Responsive visuals:** Particle bursts, starfield parallax, and soft gradients optimized for smooth redraws.
- **Local leaderboard:** Save your callsign and score directly in the browser.

## Running locally
1. Ensure Python 3 is available.
2. Install dependencies (Flask):
   ```bash
   pip install -r requirements.txt  # or pip install flask
   ```
3. Start the server:
   ```bash
   python app.py
   ```
4. Open `http://localhost:8000` in your browser.

## Gameplay
- **Move:** WASD / arrow keys (desktop) or drag on the canvas (mobile).
- **Shoot:** Space bar (desktop) or press and hold (mobile).
- **Pause:** `P` or `Esc`, or the pause button.
- **Goals:** Survive incoming waves, avoid collisions, and climb the Hall of Fame.

## Project structure
- `app.py` – Minimal Flask entrypoint serving static assets.
- `static/index.html` – Game shell and UI overlays.
- `static/styles.css` – Layout and visual styling.
- `static/game.js` – Game loop, rendering pipeline, and 2D/3D mechanics.
- `docs/spec.md` – High-level specification and acceptance notes.

## 3D variant
The 3D mode introduces a depth axis that affects rendering scale, starfield motion, and collision radius, creating a sense of distance while keeping the controls identical to 2D.

## Credits
Original concept by Draftapps - Lorenzo Prandi. Refinements and 3D variant by the current maintainer.
