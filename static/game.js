(() => {
  // ======= Config =======
  const difficultyConfig = {
    easy:   { slowFactor: 2.0, bias: 0.25, fanSpread: 0.5, enemyFireMs: 360, playerSpeed: 8, enemySpeed: 3 },
    normal: { slowFactor: 1.4, bias: 0.40, fanSpread: 0.85, enemyFireMs: 240, playerSpeed: 10, enemySpeed: 4 },
    hard:   { slowFactor: 1.1, bias: 0.55, fanSpread: 1.1, enemyFireMs: 170, playerSpeed: 11, enemySpeed: 5 }
  };

  const DIMENSIONS = {
    '2d': { label: '2D Grid', depth: false },
    '3d': { label: '3D Starfield', depth: true }
  };

  const COLS = 16, ROWS = 24;
  const MOBILE_FIRE_PERIOD = 140;
  const MAX_PARTICLES = 80;

  const canvas = document.getElementById('gameCanvas');
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
    panelLives: document.getElementById('lives'),
    panelShots: document.getElementById('shots'),
    panelTime: document.getElementById('time'),
    dimensionLabel: document.getElementById('dimensionLabel'),
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
    blip() { this.tone({ f: 600, t: 0.08 }); }
    boom() { this.tone({ f: 120, t: 0.28, v: 0.25, type: 'sawtooth' }); }
    pickup() { this.tone({ f: 900, t: 0.14, v: 0.18 }); }
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
    constructor(x, y, z = 0) {
      this.x = x; this.y = y; this.z = z;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.alive = true;
    }
  }

  class Particle extends Entity {
    constructor(x,y,z,color) {
      super(x,y,z);
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
      this.player = new Entity(COLS/2, ROWS-2);
      this.enemies = [];
      this.playerShots = [];
      this.enemyShots = [];
      this.particles = [];
      this.rings = [];
      this.shotsFired = 0;
      this.kills = 0;
      this.lives = 3;
      this.score = 0;
      this.mode = 'desktop';
      this.dimension = '2d';
      this.difficulty = difficultyConfig.normal;
      this._enemyTimer = 0;
      this._enemyFireTimer = 0;
      this._fireTimer = 0;
      this._mobileAutoFire = 0;
      this._starfield = Array.from({length:120}, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));
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
      const size = Math.min(window.innerWidth * 0.9, 640);
      this.cell = Math.floor(size / COLS);
      canvas.width = this.cell * COLS;
      canvas.height = this.cell * ROWS;
    }

    prepareGame() {
      this.resetState();
      const diff = document.querySelector('input[name=difficulty]:checked').value;
      const mode = document.querySelector('input[name=mode]:checked').value;
      const dim = document.querySelector('input[name=dimension]:checked').value;
      this.difficulty = difficultyConfig[diff];
      this.mode = mode;
      this.dimension = dim;
      this.input.setMobile(mode === 'mobile');
      elements.dimensionLabel.textContent = DIMENSIONS[dim].label;
      this.showInstructions();
    }

    showInstructions() {
      const txt = this.mode === 'mobile'
        ? 'Use your thumb to steer; hold anywhere to auto-fire. Dodge incoming fire and clear waves.'
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
      this.player.x = COLS/2; this.player.y = ROWS-2; this.player.z = 0.2;
      elements.panelLives.textContent = this.lives;
      elements.panelShots.textContent = this.shotsFired;
      elements.panelTime.textContent = '0';
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
      const s = new Entity(this.player.x, this.player.y - 1, this.player.z);
      s.vy = -12 / this.difficulty.slowFactor;
      this.playerShots.push(s);
      this.audio.blip();
      elements.panelShots.textContent = this.shotsFired;
    }

    _spawnEnemy() {
      const x = Math.floor(randRange(1, COLS-1));
      const e = new Entity(x, 0, Math.random());
      e.vy = (this.difficulty.enemySpeed || 4) / this.difficulty.slowFactor;
      e.vx = randRange(-0.4, 0.4) * this.difficulty.fanSpread;
      this.enemies.push(e);
    }

    _enemyFire(enemy) {
      const s = new Entity(enemy.x, enemy.y + 0.5, enemy.z);
      const bias = this.difficulty.bias;
      const dx = clamp(this.player.x - enemy.x, -1, 1);
      s.vx = dx * bias;
      s.vy = (4.2 + this.difficulty.enemySpeed) / this.difficulty.slowFactor;
      this.enemyShots.push(s);
    }

    _updateEntities(dt) {
      // Player move
      const spd = this.difficulty.playerSpeed / this.difficulty.slowFactor;
      this.player.x = clamp(this.player.x + this.input.dir.x * spd * dt, 1, COLS-2);
      this.player.y = clamp(this.player.y + this.input.dir.y * spd * dt, 6, ROWS-2);

      // Auto fire on mobile
      if (this.mode === 'mobile') {
        this._mobileAutoFire += dt * 1000;
        if (this.input.firing && this._mobileAutoFire > MOBILE_FIRE_PERIOD) {
          this._mobileAutoFire = 0; this._firePlayer();
        }
      }

      // Player shots
      this.playerShots.forEach(s => { s.y += s.vy * dt; s.z = clamp(s.z + 0.2*dt, 0, 1); });
      this.playerShots = this.playerShots.filter(s => s.y > -1 && s.alive);

      // Enemies
      this.enemies.forEach(e => {
        e.y += e.vy * dt;
        e.x = clamp(e.x + e.vx * dt, 1, COLS-2);
        e.z = DIMENSIONS[this.dimension].depth ? clamp(e.z + dt*0.4, 0.05, 1.2) : 0;
        if (Math.random() < 0.003) e.vx *= -1;
      });
      this.enemies = this.enemies.filter(e => e.y < ROWS + 2 && e.alive);

      // Enemy shots
      this.enemyShots.forEach(s => { s.y += s.vy * dt; s.x += s.vx * dt; });
      this.enemyShots = this.enemyShots.filter(s => s.y < ROWS + 1 && s.alive);

      // Particles
      this.particles.forEach(p => p.tick(dt));
      this.particles = this.particles.filter(p => p.life > 0).slice(-MAX_PARTICLES);
    }

    _handleCollisions() {
      const hitRadius = this.dimension === '3d' ? 0.9 : 0.7;
      // Player shots vs enemies
      this.playerShots.forEach(shot => {
        this.enemies.forEach(enemy => {
          if (!enemy.alive || !shot.alive) return;
          const dx = enemy.x - shot.x;
          const dy = enemy.y - shot.y;
          if (Math.hypot(dx, dy) < hitRadius) {
            enemy.alive = false; shot.alive = false;
            this.kills++; this.score += 120;
            this._burst(enemy.x, enemy.y, enemy.z);
            this.audio.boom();
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
    }

    _burst(x,y,z) {
      for (let i=0;i<16;i++) this.particles.push(new Particle(x,y,z,'rgba(255,200,120,0.9)'));
    }

    _hitPlayer() {
      if (!this.running) return;
      this.lives -= 1;
      this._burst(this.player.x, this.player.y, this.player.z);
      this.audio.boom();
      elements.panelLives.textContent = this.lives;
      if (this.lives <= 0) this.gameOver();
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
        if (this._enemyTimer > 600 * this.difficulty.slowFactor) { this._enemyTimer = 0; this._spawnEnemy(); }
        if (this._enemyFireTimer > this.difficulty.enemyFireMs) {
          this._enemyFireTimer = 0; this.enemies.forEach(e => { if (Math.random() < 0.35) this._enemyFire(e); });
        }
        if (this.input.firing && this._fireTimer > 200) { this._fireTimer = 0; this._firePlayer(); }
        this._updateEntities(dt);
        this._handleCollisions();
      }
      this.draw();
      requestAnimationFrame(n => this.loop(n));
    }

    draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      this._drawBackground();
      this._drawEntities();
    }

    _drawBackground() {
      // Grid and stars
      ctx.save();
      ctx.fillStyle = '#000818';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      const gradient = ctx.createLinearGradient(0,0,0,canvas.height);
      gradient.addColorStop(0,'rgba(20,60,120,0.2)');
      gradient.addColorStop(1,'rgba(0,0,0,0.2)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0,0,canvas.width,canvas.height);

      if (this.dimension === '2d') {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let c=0;c<=COLS;c++){ ctx.beginPath(); ctx.moveTo(c*this.cell,0); ctx.lineTo(c*this.cell, canvas.height); ctx.stroke(); }
        for (let r=0;r<=ROWS;r++){ ctx.beginPath(); ctx.moveTo(0,r*this.cell); ctx.lineTo(canvas.width, r*this.cell); ctx.stroke(); }
      } else {
        this._starfield = this._starfield.map(s => {
          s.z -= 0.004;
          if (s.z <= 0) s.z = 1;
          const sx = (s.x - 0.5) * canvas.width / Math.max(s.z,0.1) + canvas.width/2;
          const sy = (s.y - 0.5) * canvas.height / Math.max(s.z,0.1) + canvas.height/2;
          const size = clamp((1 - s.z) * 3, 0.5, 3.2);
          ctx.fillStyle = `rgba(200,230,255,${1 - s.z})`;
          ctx.fillRect(sx, sy, size, size);
          return s;
        });
      }
      ctx.restore();
    }

    _drawEntities() {
      const drawShip = (x,y,color,scale=1) => {
        ctx.save();
        ctx.translate(x*this.cell, y*this.cell);
        ctx.scale(scale, scale);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -0.7*this.cell);
        ctx.lineTo(0.5*this.cell, 0.5*this.cell);
        ctx.lineTo(-0.5*this.cell, 0.5*this.cell);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      const drawShot = (s,color) => {
        ctx.save();
        const [px, py, scale] = this._project(s);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 3*scale, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      };

      // Particles
      this.particles.forEach(p => {
        const [px, py, scale] = this._project(p);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = clamp(p.life,0,1);
        ctx.beginPath();
        ctx.arc(px, py, p.size*scale, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Player
      const [px, py, ps] = this._project(this.player);
      drawShip(px/this.cell, py/this.cell, '#3bf4ff', ps*0.9);

      // Enemies
      this.enemies.forEach(e => {
        const [ex, ey, es] = this._project(e);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.scale(es, es);
        ctx.fillStyle = '#ff658b';
        ctx.beginPath();
        ctx.rect(-0.6*this.cell, -0.4*this.cell, 1.2*this.cell, 0.8*this.cell);
        ctx.fill();
        ctx.restore();
      });

      // Shots
      this.playerShots.forEach(s => drawShot(s, '#7df5ff'));
      this.enemyShots.forEach(s => drawShot(s, '#ffde59'));
    }

    _project(entity) {
      if (this.dimension === '2d') {
        return [entity.x * this.cell, entity.y * this.cell, 1];
      }
      const depth = clamp(1 - entity.z, 0.25, 1.4);
      const cx = canvas.width/2; const cy = canvas.height/2;
      const px = (entity.x - COLS/2) * this.cell * depth + cx;
      const py = (entity.y - ROWS/2) * this.cell * depth + cy;
      return [px, py, depth];
    }
  }

  new Game();
})();
