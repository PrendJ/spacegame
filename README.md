# Space Game

Space Game is a lightweight Flask-served arcade built on an HTML5 canvas. The refactored experience focuses on a fast, tactile 2D battlefield with neon visuals and pick-ups that keep each run lively.

## Features
- **Neon 2D dogfights:** Glide along a responsive grid with momentum-based scoring and juicy particle bursts.
- **Difficulty presets:** Explorer, Veteran, and Nightmare profiles tune movement speed, enemy spread, and fire cadence.
- **Desktop & mobile controls:** Keyboard/space bar on desktop, drag/tap auto-fire on touch devices.
- **Pickups & momentum:** Random drops heal or clear the lane; momentum multipliers reward clean streaks.
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
- `static/game.js` – Game loop, rendering pipeline, and 2D arcade mechanics.
- `docs/spec.md` – High-level specification and acceptance notes.

## Credits
Original concept by Draftapps - Lorenzo Prandi. 2D-focused refresh by the current maintainer.
