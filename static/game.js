(() => {
  // ======= Config =======
  const difficultyConfig = {
    easy:   { slowFactor: 2.0, bias: 0.2, fanSpread: 0.4, enemyFireMs: 420, playerSpeed: 8, enemySpeed: 3 },
    normal: { slowFactor: 1.3, bias: 0.35, fanSpread: 0.75, enemyFireMs: 260, playerSpeed: 10, enemySpeed: 4 },
    hard:   { slowFactor: 1.05, bias: 0.5, fanSpread: 1.0, enemyFireMs: 180, playerSpeed: 11, enemySpeed: 5 }
  };

  const COLS = 16, ROWS = 24;
  const MOBILE_FIRE_PERIOD = 140;
  const MAX_PARTICLES = 120;
  const PICKUP_CHANCE = 0.16;

  const shipBase = new Image();
  shipBase.src = 'Favicon.png';
  const tintedShips = {};
  const tintShip = (color) => {
    const off = document.createElement('canvas');
    const size = 64;
    off.width = off.height = size;
    const oc = off.getContext('2d');
    oc.clearRect(0, 0, size, size);
    oc.drawImage(shipBase, 0, 0, size, size);
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = color;
    oc.fillRect(0, 0, size, size);
    oc.globalCompositeOperation = 'source-over';
    return off;
  };
  shipBase.onload = () => {
    tintedShips.gold = tintShip('#d4af37');
    tintedShips.red = tintShip('#d94a4a');
  };

  const canvas = document.getElementById('gameCanvas');
  const containerEl = document.getElementById('container');
  const ctx = canvas.getContext('2d');

  const elements = {
    menu: document.getElementById('menu'),
    instructions: document.getElementById('instructions'),
    instructionsText: document.getElementById('instructionsText'),
    countdown: document.getElementById('countdown'),
    pause: document.getElementById('pauseOverlay'),
    resumeBtn: document.getElementById('resumeBtn'),
    gameOver: document.getElementById('gameOver'),
    endMsg: document.getElementById('endMsg'),
    stats: {
      kills: document.getElementById('statKills'),
      time: document.getElementById('statTimeOver'),
      lives: document.getElementById('statLives'),
      score: document.getElementById('statScore')
    },
    panel: document.getElementById('panel'),
    panelLives: document.getElementById('lives'),
    panelShots: document.getElementById('shots'),
    panelTime: document.getElementById('time'),
    panelWave: document.getElementById('wave'),
    panelMomentum: document.getElementById('momentum'),
    announcer: document.getElementById('ariaAnnouncer'),
    nameInput: document.getElementById('playerName'),
    saveBtn: document.getElementById('saveScore'),
    leaderboard: document.getElementById('leaderboard'),
    pauseBtn: document.getElementById('pauseBtn'),
    startBtn: document.getElementById('startGame')
  };

  // ======= Utilities =======
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const randRange = (min, max) => Math.random() * (max - min) + min;

  class AudioFx {
    constructor() { this.ctx = null; }
    ensure() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    tone({ type = 'square', f = 440, t = 0.2, v = 0.15 }) {
      const ac = this.ensure();
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(v, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t);
      osc.connect(gain).connect(ac.destination);
      osc.start(now);
      osc.stop(now + t + 0.05);
    }
    blip() { this.tone({ f: 620, t: 0.08 }); }
    boom() { this.tone({ f: 120, t: 0.28, v: 0.25, type: 'sawtooth' }); }
    pickup() { this.tone({ f: 940, t: 0.14, v: 0.18 }); }
  }

  class InputManager {
    constructor(canvas) {
      this.canvas = canvas;
      this.dir = { x: 0, y: 0 };
      this.firing = false;
      this.sinceMove = 0;
      this.modeMobile = false;
      this.keyMap = { ArrowLeft: [-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1], a:[-1,0], d:[1,0], w:[0,-1], s:[0,1] };
      this._bind();
    }
    _bind() {
      window.addEventListener('keydown', e => {
        if (e.code === 'Space') { this.firing = true; return; }
        const m = this.keyMap[e.key];
        if (m) { this.dir.x = m[0]; this.dir.y = m[1]; this.sinceMove = 0; }
      });
      window.addEventListener('keyup', e => {
        if (e.code === 'Space') this.firing = false;
        if (this.keyMap[e.key]) { this.dir.x = 0; this.dir.y = 0; }
      });

      this.canvas.addEventListener('pointerdown', e => {
        if (!this.modeMobile) return;
        this.firing = true; this._updateDirFromPointer(e);
      });
      this.canvas.addEventListener('pointermove', e => { if (this.modeMobile) this._updateDirFromPointer(e); });
      this.canvas.addEventListener('pointerup', () => { if (this.modeMobile) this.firing = false; });
    }
    setMobile(enabled) { this.modeMobile = enabled; }
    _updateDirFromPointer(e) {
      const rect = this.canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.8;
      this.dir.x = Math.sign(e.clientX - cx);
      this.dir.y = Math.sign(e.clientY - cy);
    }
  }

  class Entity {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.alive = true;
    }
  }

  class Particle extends Entity {
    constructor(x,y,color) {
      super(x,y);
      this.life = randRange(0.4, 0.9);
      this.color = color;
      this.vx = randRange(-0.8,0.8);
      this.vy = randRange(-0.8,0.8);
      this.size = randRange(2,4);
    }
    tick(dt) {
      this.x += this.vx * dt*60;
      this.y += this.vy * dt*60;
      this.life -= dt;
      this.size *= 0.98;
    }
  }

  class Pickup extends Entity {
    constructor(x, y, type) {
      super(x, y);
      this.type = type;
      this.vy = 1.6;
      this.phase = Math.random();
    }
    tick(dt) {
      this.y += this.vy * dt;
      this.x += Math.sin((this.phase += dt*6)) * 0.01;
    }
  }

  class Game {
    constructor() {
      this.cell = 26;
      this.resetState();
      this.input = new InputManager(canvas);
      this.audio = new AudioFx();
      this._bindUI();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      requestAnimationFrame(ts => this.loop(ts));
    }

    resetState() {
      this.running = false;
      this.paused = false;
      this.lastTs = 0;
      this.elapsed = 0;
      this.player = new Entity(COLS-2, ROWS-2);
      this.enemies = [];
      this.pickups = [];
      this.playerShots = [];
      this.enemyShots = [];
      this.particles = [];
      this.shotsFired = 0;
      this.kills = 0;
      this.lives = 3;
      this.score = 0;
      this.wave = 1;
      this.momentum = 1;
      this.momentumTimer = 0;
      this.mode = 'desktop';
      this.difficulty = difficultyConfig.normal;
      this._enemyTimer = 0;
      this._enemyFireTimer = 0;
      this._fireTimer = 0;
      this._mobileAutoFire = 0;
      this._bgPhase = 0;
      this._playerStepElapsed = 0;
      this._enemyStepElapsed = 0;
      this.playerStepMs = 200;
      this.enemyStepMs = 340;
    }

    _bindUI() {
      elements.startBtn.addEventListener('click', () => this.prepareGame());
      elements.resumeBtn.addEventListener('click', () => this.togglePause(false));
      elements.pauseBtn.addEventListener('click', () => this.togglePause(true));
      elements.saveBtn.addEventListener('click', () => this.saveScore());
      window.addEventListener('keydown', e => {
        if (['p','P','Escape'].includes(e.key) && this.running) this.togglePause(!this.paused);
        if (this.running && !this.paused && e.key === ' ') this._firePlayer();
      });
    }

    resize() {
      const styles = getComputedStyle(containerEl);
      const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const gap = parseFloat(styles.gap) || 0;
      const panelRect = elements.panel.getBoundingClientRect();

      let availableWidth = window.innerWidth - paddingX;
      let availableHeight = window.innerHeight - paddingY;

      if (window.innerWidth > 900) {
        availableWidth -= panelRect.width + gap;
      } else {
        availableHeight -= panelRect.height + gap;
      }

      availableWidth = Math.max(availableWidth, 0);
      availableHeight = Math.max(availableHeight, 0);

      const maxCanvasWidth = Math.min(640, availableWidth);
      const cellCandidate = Math.floor(Math.min(maxCanvasWidth / COLS, availableHeight / ROWS));
      this.cell = Math.max(1, cellCandidate);
      const cssWidth = this.cell * COLS;
      const cssHeight = this.cell * ROWS;
      const dpr = window.devicePixelRatio || 1;

      this.width = cssWidth;
      this.height = cssHeight;

      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    prepareGame() {
      this.resetState();
      const diff = document.querySelector('input[name=difficulty]:checked').value;
      const mode = document.querySelector('input[name=mode]:checked').value;
      this.difficulty = difficultyConfig[diff];
      this.mode = mode;
      this.input.setMobile(mode === 'mobile');
      this.playerStepMs = 180 * this.difficulty.slowFactor;
      this.enemyStepMs = 260 * this.difficulty.slowFactor / (this.difficulty.enemySpeed / 4);
      this.showInstructions();
    }

    showInstructions() {
      const txt = this.mode === 'mobile'
        ? 'Drag to steer; hold anywhere to auto-fire. Dodge incoming fire and collect drops.'
        : 'Use WASD or arrow keys to move, press SPACE to shoot. Toggle pause with P or Esc.';
      elements.instructionsText.textContent = txt;
      elements.menu.style.display = 'none';
      elements.instructions.style.display = 'flex';
      const resume = () => {
        elements.instructions.style.display = 'none';
        window.removeEventListener('keydown', resume);
        window.removeEventListener('pointerdown', resume);
        this.startCountdown();
      };
      window.addEventListener('keydown', resume);
      window.addEventListener('pointerdown', resume);
    }

    startCountdown() {
      let n = 3;
      elements.countdown.textContent = n;
      elements.countdown.style.display = 'flex';
      const t = setInterval(() => {
        n -= 1; elements.countdown.textContent = n || 'Go!';
        if (n < 0) {
          clearInterval(t);
          elements.countdown.style.display = 'none';
          this.startGame();
        }
      }, 550);
    }

    startGame() {
      this.running = true;
      this.lastTs = performance.now();
      this.elapsed = 0;
      this.player.x = COLS-2; this.player.y = ROWS-2;
      elements.panelLives.textContent = this.lives;
      elements.panelShots.textContent = this.shotsFired;
      elements.panelTime.textContent = '0';
      elements.panelWave.textContent = this.wave;
      elements.panelMomentum.textContent = `${this.momentum.toFixed(1)}x`;
      elements.pauseBtn.textContent = 'Pause';
      this.announce('Game started');
    }

    togglePause(force) {
      if (!this.running) return;
      this.paused = force;
      elements.pause.style.display = this.paused ? 'flex' : 'none';
      elements.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
    }

    _firePlayer() {
      if (!this.running || this.paused) return;
      this.shotsFired++;
      const s = new Entity(this.player.x, this.player.y - 1);
      s.vy = -12 / this.difficulty.slowFactor;
      this.playerShots.push(s);
      this.audio.blip();
      elements.panelShots.textContent = this.shotsFired;
    }

    _spawnEnemy() {
      const x = Math.floor(randRange(1, COLS-1));
      const e = new Entity(x, 0);
      e.stepDir = { x: 0, y: 1 };
      this.enemies.push(e);
    }

    _spawnPickup(x, y) {
      const type = Math.random() > 0.5 ? 'heal' : 'pulse';
      this.pickups.push(new Pickup(x, y, type));
    }

    _enemyFire(enemy) {
      const s = new Entity(enemy.x, enemy.y + 0.5);
      const bias = this.difficulty.bias;
      const dx = clamp(this.player.x - enemy.x, -1, 1);
      s.vx = dx * bias;
      s.vy = (4.2 + this.difficulty.enemySpeed) / this.difficulty.slowFactor;
      this.enemyShots.push(s);
    }

    _movePlayerGrid() {
      const dirX = Math.sign(this.input.dir.x);
      const dirY = Math.sign(this.input.dir.y);
      let stepX = dirX, stepY = dirY;
      if (dirX && dirY) {
        if (Math.abs(this.input.dir.x) >= Math.abs(this.input.dir.y)) {
          stepY = 0;
        } else {
          stepX = 0;
        }
      }
      if (!stepX && !stepY) return;
      const targetX = clamp(Math.round(this.player.x + stepX), 1, COLS-2);
      const targetY = clamp(Math.round(this.player.y + stepY), 6, ROWS-2);
      this.player.x = targetX;
      this.player.y = targetY;
    }

    _stepEnemy(enemy) {
      const dir = enemy.stepDir || { x: 0, y: 1 };
      if (dir.y !== 0) {
        enemy.y += dir.y;
        const chase = Math.sign(this.player.x - enemy.x);
        if (Math.random() < 0.25) {
          enemy.stepDir = { x: chase || (Math.random() > 0.5 ? 1 : -1), y: 0 };
        } else {
          enemy.stepDir = dir;
        }
      } else {
        enemy.x = clamp(enemy.x + dir.x, 1, COLS-2);
        if (enemy.x <= 1 || enemy.x >= COLS-2) enemy.stepDir.x *= -1;
        enemy.stepDir = { x: 0, y: 1 };
      }
    }

    _updateEntities(dt) {
      this._playerStepElapsed += dt * 1000;
      while (this._playerStepElapsed >= this.playerStepMs) {
        this._playerStepElapsed -= this.playerStepMs;
        this._movePlayerGrid();
      }

      // Auto fire on mobile
      if (this.mode === 'mobile') {
        this._mobileAutoFire += dt * 1000;
        if (this.input.firing && this._mobileAutoFire > MOBILE_FIRE_PERIOD) {
          this._mobileAutoFire = 0; this._firePlayer();
        }
      }

      // Player shots
      this.playerShots.forEach(s => { s.y += s.vy * dt; });
      this.playerShots = this.playerShots.filter(s => s.y > -1 && s.alive);

      // Enemies
      this._enemyStepElapsed += dt * 1000;
      while (this._enemyStepElapsed >= this.enemyStepMs) {
        this._enemyStepElapsed -= this.enemyStepMs;
        this.enemies.forEach(e => this._stepEnemy(e));
      }
      this.enemies = this.enemies.filter(e => e.y < ROWS + 1 && e.alive);

      // Enemy shots
      this.enemyShots.forEach(s => { s.y += s.vy * dt; s.x += s.vx * dt; });
      this.enemyShots = this.enemyShots.filter(s => s.y < ROWS + 1 && s.alive);

      // Pickups
      this.pickups.forEach(p => p.tick(dt));
      this.pickups = this.pickups.filter(p => p.y < ROWS && p.alive);

      // Particles
      this.particles.forEach(p => p.tick(dt));
      this.particles = this.particles.filter(p => p.life > 0).slice(-MAX_PARTICLES);

      // Momentum decay
      this.momentumTimer -= dt;
      if (this.momentumTimer <= 0 && this.momentum > 1) {
        this.momentum = Math.max(1, this.momentum - 0.1);
        this.momentumTimer = 0.4;
        elements.panelMomentum.textContent = `${this.momentum.toFixed(1)}x`;
      }
    }

    _handleCollisions() {
      const hitRadius = 0.7;
      // Player shots vs enemies
      this.playerShots.forEach(shot => {
        this.enemies.forEach(enemy => {
          if (!enemy.alive || !shot.alive) return;
          const dx = enemy.x - shot.x;
          const dy = enemy.y - shot.y;
          if (Math.hypot(dx, dy) < hitRadius) {
            enemy.alive = false; shot.alive = false;
            this.kills++; this.score += Math.floor(120 * this.momentum);
            this._burst(enemy.x, enemy.y);
            this.audio.boom();
            if (Math.random() < PICKUP_CHANCE) this._spawnPickup(enemy.x, enemy.y);
            this._increaseMomentum();
          }
        });
      });
      this.playerShots = this.playerShots.filter(s => s.alive);
      this.enemies = this.enemies.filter(e => e.alive);

      // Enemy shots vs player
      this.enemyShots.forEach(s => {
        const dx = s.x - this.player.x;
        const dy = s.y - this.player.y;
        if (Math.hypot(dx, dy) < hitRadius && this.running) {
          s.alive = false;
          this._hitPlayer();
        }
      });
      this.enemyShots = this.enemyShots.filter(s => s.alive);

      // Enemy collision with player
      this.enemies.forEach(e => {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        if (Math.hypot(dx, dy) < hitRadius && e.alive) {
          e.alive = false; this._hitPlayer();
        }
      });

      // Pickups
      this.pickups.forEach(p => {
        const dx = p.x - this.player.x;
        const dy = p.y - this.player.y;
        if (Math.hypot(dx, dy) < hitRadius) {
          p.alive = false;
          this._collectPickup(p.type);
        }
      });
      this.pickups = this.pickups.filter(p => p.alive);
    }

    _burst(x,y) {
      for (let i=0;i<16;i++) this.particles.push(new Particle(x,y,'rgba(255,200,120,0.9)'));
    }

    _hitPlayer() {
      if (!this.running) return;
      this.lives -= 1;
      this.momentum = 1; this.momentumTimer = 0.8;
      this._burst(this.player.x, this.player.y);
      this.audio.boom();
      elements.panelLives.textContent = this.lives;
      elements.panelMomentum.textContent = `${this.momentum.toFixed(1)}x`;
      if (this.lives <= 0) this.gameOver();
    }

    _increaseMomentum() {
      this.momentum = clamp(this.momentum + 0.1, 1, 4);
      this.momentumTimer = 1.6;
      elements.panelMomentum.textContent = `${this.momentum.toFixed(1)}x`;
    }

    _collectPickup(type) {
      if (type === 'heal') {
        this.lives = Math.min(5, this.lives + 1);
        elements.panelLives.textContent = this.lives;
        this.announce('Life boosted');
      } else if (type === 'pulse') {
        this.enemyShots.forEach(s => s.alive = false);
        this.announce('Pulse wave clears the lane');
      }
      this.audio.pickup();
    }

    gameOver() {
      this.running = false;
      elements.gameOver.style.display = 'flex';
      elements.endMsg.textContent = this.score > 0 ? 'Mission Complete' : 'Mission Failed';
      elements.stats.kills.textContent = this.kills;
      elements.stats.time.textContent = this.elapsed.toFixed(1);
      elements.stats.lives.textContent = Math.max(this.lives,0);
      elements.stats.score.textContent = this.score;
      this.renderLeaderboard();
    }

    saveScore() {
      const name = elements.nameInput.value.trim() || 'Pilot';
      const entry = { name, score: this.score, kills: this.kills };
      const data = JSON.parse(localStorage.getItem('sg_leaderboard') || '[]');
      data.push(entry);
      data.sort((a,b) => b.score - a.score);
      localStorage.setItem('sg_leaderboard', JSON.stringify(data.slice(0,8)));
      elements.gameOver.style.display = 'none';
      elements.menu.style.display = 'flex';
    }

    renderLeaderboard() {
      const data = JSON.parse(localStorage.getItem('sg_leaderboard') || '[]');
      const div = elements.leaderboard;
      div.innerHTML = '<h4>Hall of Fame</h4>' + data.map((e,i) => `<div class="score-row"><span>${i+1}. ${e.name}</span><span>${e.score}</span></div>`).join('');
    }

    announce(msg) { elements.announcer.textContent = msg; }

    loop(ts) {
      const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
      this.lastTs = ts;
      if (this.running && !this.paused) {
        this.elapsed += dt; elements.panelTime.textContent = this.elapsed.toFixed(1);
        this._enemyTimer += dt * 1000; this._enemyFireTimer += dt * 1000; this._fireTimer += dt * 1000;
        if (this._enemyTimer > 620 / this.difficulty.slowFactor) { this._enemyTimer = 0; this._spawnEnemy(); }
      if (this._enemyFireTimer > this.difficulty.enemyFireMs) {
        this._enemyFireTimer = 0; this.enemies.forEach(e => { if (Math.random() < 0.35) this._enemyFire(e); });
      }
        if (this.input.firing && this._fireTimer > 200) { this._fireTimer = 0; this._firePlayer(); }
        if (this.kills && this.kills % 12 === 0) { this.wave = Math.floor(this.kills / 12) + 1; elements.panelWave.textContent = this.wave; }
        this._updateEntities(dt);
        this._handleCollisions();
      }
      this.draw();
      requestAnimationFrame(n => this.loop(n));
    }

    draw() {
      ctx.clearRect(0,0,this.width,this.height);
      this._drawBackground();
      this._drawEntities();
    }

    _drawBackground() {
      ctx.save();
      ctx.fillStyle = '#041021';
      ctx.fillRect(0,0,this.width,this.height);
      const verticalGlow = ctx.createLinearGradient(0,0,0,this.height);
      verticalGlow.addColorStop(0,'rgba(90,150,255,0.15)');
      verticalGlow.addColorStop(1,'rgba(0,0,0,0.25)');
      ctx.fillStyle = verticalGlow;
      ctx.fillRect(0,0,this.width,this.height);

      const playerStart = { x: COLS - 2, y: ROWS - 2 };
      for (let y = 0; y < ROWS; y++) {
        const depth = y / Math.max(ROWS - 1, 1);
        const baseR = 6 + depth * 10;
        const baseG = 58 + depth * 34;
        const baseB = 90 + depth * 48;
        for (let x = 0; x < COLS; x++) {
          const px = x * this.cell;
          const py = y * this.cell;
          const noise = (x % 2 === 0 ? 6 : -4) + (y % 2 === 0 ? 4 : 0);
          let fillStyle = `rgba(${Math.round(baseR + noise)}, ${Math.round(baseG + noise)}, ${Math.round(baseB + noise)}, 0.94)`;
          if (y === 0) {
            const redNoise = (x % 2 === 0 ? 12 : -8);
            fillStyle = `rgba(${178 + redNoise}, ${54 + redNoise * 0.1}, ${54 + redNoise * 0.08}, 0.9)`;
          }
          if (x === playerStart.x && y === playerStart.y) {
            fillStyle = 'rgba(212, 175, 55, 0.9)';
          }
          ctx.fillStyle = fillStyle;
          ctx.fillRect(px + 1, py + 1, this.cell - 2, this.cell - 2);
        }
      }

      this._bgPhase += 0.35;
      ctx.strokeStyle = 'rgba(255,255,255,0.26)';
      ctx.lineWidth = 1.1;
      const cross = this.cell * 0.18;
      for (let c = 0; c <= COLS; c++) {
        const cx = c * this.cell;
        for (let r = 0; r <= ROWS; r++) {
          const cy = r * this.cell;
          const pulse = Math.sin((this._bgPhase + c + r) * 0.08) * 0.03;
          ctx.globalAlpha = 0.7 + pulse;
          ctx.beginPath();
          ctx.moveTo(cx - cross, cy);
          ctx.lineTo(cx + cross, cy);
          ctx.moveTo(cx, cy - cross);
          ctx.lineTo(cx, cy + cross);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#55f5ff';
      for (let i=0;i<6;i++) {
        const w = randRange(10,40);
        const h = randRange(4,10);
        const x = randRange(0, this.width - w);
        const y = randRange(0, this.height - h);
        ctx.fillRect(x,y,w,h);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _drawEntities() {
      const drawShip = (x,y,color) => {
        ctx.save();
        ctx.translate(x*this.cell, y*this.cell);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -0.7*this.cell);
        ctx.lineTo(0.55*this.cell, 0.55*this.cell);
        ctx.lineTo(0, 0.2*this.cell);
        ctx.lineTo(-0.55*this.cell, 0.55*this.cell);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      const drawShot = (s,color) => {
        ctx.save();
        const px = s.x * this.cell;
        const py = s.y * this.cell;
        ctx.fillStyle = color;
        ctx.shadowBlur = 8; ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      };

      // Particles
      this.particles.forEach(p => {
        const px = p.x * this.cell;
        const py = p.y * this.cell;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = clamp(p.life,0,1);
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Player trail
      ctx.save();
      ctx.strokeStyle = 'rgba(85,245,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(this.player.x*this.cell, this.player.y*this.cell + 6);
      ctx.lineTo(this.player.x*this.cell, this.player.y*this.cell + this.cell*0.7);
      ctx.stroke();
      ctx.restore();

      // Player
      const playerSprite = tintedShips.gold || (shipBase.complete ? shipBase : null);
      if (playerSprite) {
        ctx.drawImage(playerSprite, this.player.x*this.cell - this.cell/2, this.player.y*this.cell - this.cell/2, this.cell, this.cell);
      } else {
        drawShip(this.player.x, this.player.y, '#d4af37');
      }

      // Enemies
      this.enemies.forEach(e => {
        const enemySprite = tintedShips.red || (shipBase.complete ? shipBase : null);
        if (enemySprite) {
          ctx.drawImage(enemySprite, e.x*this.cell - this.cell/2, e.y*this.cell - this.cell/2, this.cell, this.cell);
        } else {
          drawShip(e.x, e.y, '#d94a4a');
        }
      });

      // Pickups
      this.pickups.forEach(p => {
        ctx.save();
        ctx.translate(p.x * this.cell, p.y * this.cell);
        ctx.fillStyle = p.type === 'heal' ? '#7cf58a' : '#ffd166';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
        ctx.restore();
      });

      // Shots
      this.playerShots.forEach(s => drawShot(s, '#7df5ff'));
      this.enemyShots.forEach(s => drawShot(s, '#ffde59'));
    }
  }

  new Game();
})();
