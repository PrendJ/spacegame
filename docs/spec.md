# Space Game Specification

## Goals
- Provide a performant canvas-based shooter playable on desktop and touch devices.
- Support both a traditional 2D grid view and a pseudo-3D starfield variant without changing controls.
- Keep latency low by minimizing DOM churn and drawing with batched canvas operations.

## Gameplay rules
- Player starts with **3 lives**.
- Collisions with enemy ships or their shots reduce lives by one; reaching zero triggers game over.
- Each enemy destroyed awards **120 points** and increments the kill counter.
- Enemy waves spawn every ~0.6s (scaled by difficulty), and enemies may strafe horizontally.
- Enemies fire periodically according to difficulty bias and fire cadence.
- Desktop: move with **WASD/arrow keys**, shoot with **Space**, pause with **P/Esc**.
- Mobile: drag on canvas to steer; hold the screen to auto-fire; pause with the button or overlay.

## Difficulty profiles
- **Explorer (easy):** slower enemies, gentle spread, slower enemy shots.
- **Veteran (normal):** balanced speed and fire cadence.
- **Nightmare (hard):** aggressive strafing, fast projectiles, tighter player movement window.

## Rendering & performance
- Canvas sized dynamically from viewport, capped for predictable cell scaling.
- 2D mode draws a light grid; 3D mode swaps the grid for a parallax starfield and perspective scaling.
- Starfield positions wrap/reset when projections exit the viewport or approach the camera to keep the field populated.
- Particles are capped to `MAX_PARTICLES` to avoid runaway allocations; old particles are culled.
- The game loop clamps `dt` to avoid spikes on tab refocus.

## Leaderboard
- Scores persist in `localStorage` under `sg_leaderboard`.
- Only the top 8 entries are retained; each save stores name, score, and kills.

## Acceptance checklist
- [ ] Selecting 2D/3D and difficulty updates panel labels correctly.
- [ ] Start overlay -> instructions -> countdown -> game flow works without manual reloads.
- [ ] Pause overlay toggles via button and keyboard shortcuts.
- [ ] Leaderboard saves entries and reorders by score.
- [ ] Mobile auto-fire respects the configured fire period.
