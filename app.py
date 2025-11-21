from flask import Flask, Response

app = Flask(__name__)

@app.route('/')
def index():
    html = '''<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content">
  <title>Space Game</title>
  <link rel="icon" href="/static/Fvicon.ico">
  <link rel="apple-touch-icon" href="/static/Favicon.png">
  <link rel="manifest" href="/static/manifest.json">
  <meta name="theme-color" content="#001022">
  <style>
    :root{ --bg:#001022; --fg:#fff; --silver:#c0c0c0; --panel:#0a1d33; }
    *{ box-sizing:border-box; }
    html,body{ height:100%; }
    body{
      margin:0; background:var(--bg); color:var(--fg);
      display:flex; justify-content:center; align-items:center;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Arial;
      overscroll-behavior:none;
    }
    #container{
      display:flex; align-items:flex-start; gap:12px; width:100%; height:100%;
      padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right))
              max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));
      justify-content:center;
    }
    canvas{
      display:block; background:#001022; border:2px solid var(--silver);
      touch-action:none; outline:none; border-radius:8px;
    }
    #panel{
      background:var(--panel); border:2px solid var(--silver); border-radius:8px;
      min-width:140px; padding:10px; font-size:14px; height:fit-content;
    }
    #panel h3{ margin:0 0 8px 0; font-size:14px; }
    #panel div{ margin:6px 0; }
    .btn,button{
      padding:10px 16px; margin:6px; cursor:pointer; font-size:1em; border-radius:10px;
      border:1px solid var(--silver); background:#06203a; color:#fff;
    }
    button:focus-visible{ outline:3px solid #7fd; }
    input[type=text]{ padding:8px; margin:6px; font-size:1em; border-radius:8px; border:1px solid #456; background:#081b2f; color:#fff; }
    .overlay{
      position:fixed; inset:0; background:rgba(0,0,0,.82); z-index:1000;
      display:flex; justify-content:center; align-items:center; flex-direction:column;
      color:#fff; text-align:center; padding:24px;
    }
    hr.dashed{ border:0; border-top:3px dashed #445; width:100%; max-width:440px; }
    #instructions, #countdown, #pauseOverlay, #gameOver{ display:none; }

    .sr-only{
      position:absolute !important; width:1px; height:1px; padding:0; margin:-1px;
      overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
    }
    @media (max-width:900px){
      #container{ flex-direction:column; align-items:center; }
      #panel{ width:100%; max-width:520px; }
    }
  </style>
</head>
<body>
  <div id="ariaAnnouncer" class="sr-only" aria-live="polite"></div>

  <!-- MENU -->
  <div id="menu" class="overlay" role="dialog" aria-modal="true" aria-labelledby="ttl">
    <h1 id="ttl">Space Game</h1>
    <p><strong>Regole</strong></p>
    <ul style="text-align:left; max-width:480px;">
      <li>Muovi la navetta e spara ai nemici</li>
      <li>Evita colpi e collisioni ❌</li>
      <li>3 Vite 🧡</li>
    </ul>
    <hr class="dashed">
    <div role="group" aria-label="Seleziona difficoltà">
      <label><input type="radio" name="difficulty" value="easy" checked> Normale</label>
      <label><input type="radio" name="difficulty" value="normal"> Serio</label>
      <label><input type="radio" name="difficulty" value="hard"> Difficile</label>
    </div>
    <hr class="dashed">
    <div role="group" aria-label="Modalità dispositivo">
      <label><input type="radio" name="mode" value="desktop" checked> Desktop</label>
      <label><input type="radio" name="mode" value="mobile"> Mobile</label>
    </div>
    <button id="startGame">Gioca</button>
  </div>

  <!-- ISTRUZIONI -->
  <div id="instructions" class="overlay" role="dialog" aria-modal="true" aria-labelledby="instrT">
    <h2 id="instrT">Istruzioni</h2>
    <p id="instructionsText"></p>
    <p>Premi un tasto (desktop) o tocca lo schermo (mobile) per continuare</p>
  </div>

  <!-- COUNTDOWN -->
  <div id="countdown" class="overlay" aria-live="assertive">3</div>

  <!-- PAUSA -->
  <div id="pauseOverlay" class="overlay" aria-live="polite">
    <h2>In Pausa</h2>
    <p>Premi <kbd>P</kbd> o <kbd>Esc</kbd> (o il bottone) per riprendere</p>
    <button id="resumeBtn">Riprendi</button>
  </div>

  <!-- GAME OVER -->
  <div id="gameOver" class="overlay">
    <h2 id="endMsg"></h2>
    <div id="stats" aria-live="polite">
      <div>Eliminazioni: <span id="statKills"></span></div>
      <div>Tempo: <span id="statTimeOver"></span>s</div>
      <div>Vite rimanenti: <span id="statLives"></span></div>
      <div>Punteggio: <span id="statScore"></span></div>
    </div>
    <div>Inserisci il tuo nome:</div>
    <input id="playerName" type="text" maxlength="10" aria-label="Nome giocatore"/>
    <button id="saveScore">Salva e torna al menu</button>
    <div id="leaderboard" aria-label="Classifica"></div>
    <div class="credits" style="margin-top:8px;">By Draftapps - Lorenzo Prandi</div>
  </div>

  <div id="container" role="application" aria-label="Campo di gioco">
    <canvas id="gameCanvas" tabindex="0" aria-label="Canvas di gioco"></canvas>
    <div id="panel" aria-live="polite">
      <h3>Stato</h3>
      <div>Vite: <span id="lives">—</span></div>
      <div>Colpi: <span id="shots">—</span></div>
      <div>Tempo: <span id="time">—</span>s</div>
      <button id="pauseBtn" class="btn" style="margin-top:8px;">Pausa</button>
    </div>
  </div>

  <script>
  // ======= Configurazione difficoltà (easy più lento) =======
  const difficultyConfig = {
    easy:   { slowFactor: 2.2, bias: 0.30, fanSpread: 0.6, enemyFireMs: 320 },
    normal: { slowFactor: 1.4, bias: 0.45, fanSpread: 0.85, enemyFireMs: 220 },
    hard:   { slowFactor: 1.1, bias: 0.58, fanSpread: 1.1, enemyFireMs: 160 }
  };

  // ======= Costanti base =======
  const COLS=16, ROWS=24;
  const dirPersistTime=800; // ms
  const MOBILE_FIRE_PERIOD=170; // auto fire mobile

  // ======= Stato =======
  let modeMobile=false, cellSize=24, gameRunning=false, paused=false;
  let moveInterval, shotSpeedInterval, enemyBias, fanSpread, enemyFirePeriod;
  let player, enemies, playerShots, enemyShots;
  let killedCount, totalShots, lives, startTime, finalScore=0;

  // Effetti (particelle & shockwave)
  let particles=[], rings=[];

  // ======= DOM =======
  const canvas=document.getElementById('gameCanvas');
  const ctx=canvas.getContext('2d');
  const menu=document.getElementById('menu');
  const instructions=document.getElementById('instructions');
  const instructionsText=document.getElementById('instructionsText');
  const countdown=document.getElementById('countdown');
  const pauseOverlay=document.getElementById('pauseOverlay');
  const resumeBtn=document.getElementById('resumeBtn');
  const gameOver=document.getElementById('gameOver');
  const endMsg=document.getElementById('endMsg');
  const panelLives=document.getElementById('lives');
  const panelShots=document.getElementById('shots');
  const panelTime=document.getElementById('time');
  const nameInput=document.getElementById('playerName');
  const saveBtn=document.getElementById('saveScore');
  const lbDiv=document.getElementById('leaderboard');
  const pauseBtn=document.getElementById('pauseBtn');
  const announcer=document.getElementById('ariaAnnouncer');

  // ======= Audio (nuovo jingle di avvio) =======
  let audioCtx=null;
  function ensureAudio(){
    if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
    if(audioCtx.state==='suspended'){ audioCtx.resume(); }
    return audioCtx;
  }
  function tone({type='sine', f=440, t=0.25, v=0.2, a=0.01, d=0.06, s=0.4, r=0.06, start=0}={}){
    const ac=ensureAudio(), now=ac.currentTime+start;
    const osc=ac.createOscillator(), gain=ac.createGain();
    osc.type=type; osc.frequency.setValueAtTime(f, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(v, now+a);
    gain.gain.linearRampToValueAtTime(v*s, now+a+d);
    gain.gain.linearRampToValueAtTime(0.0001, now+t+r);
    osc.connect(gain).connect(ac.destination);
    osc.start(now); osc.stop(now+t+r+0.02);
  }
  function noiseSweep({t=0.35, v=0.25, f0=500, f1=2000, start=0}={}){
  
    const ac=ensureAudio(), now=ac.currentTime+start;
    const buffer=ac.createBuffer(1, ac.sampleRate*t, ac.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){ data[i]=Math.random()*2-1; }
    const src=ac.createBufferSource(); src.buffer=buffer;
    const filter=ac.createBiquadFilter(); filter.type='bandpass'; filter.frequency.setValueAtTime(f0, now);
    filter.frequency.linearRampToValueAtTime(f1, now+t);
    const gain=ac.createGain(); gain.gain.setValueAtTime(v, now); gain.gain.linearRampToValueAtTime(0.001, now+t);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(now);
  }
  // Pluck morbido per il countdown (breve, non invasivo)
function pluck({f=520, t=0.15, v=0.16, start=0}={}) {
  const ac = ensureAudio(), now = ac.currentTime + start;
  const osc = ac.createOscillator();
  const lpf = ac.createBiquadFilter();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f, now);
  // lieve “pitch bend” discendente per un attacco naturale
  osc.frequency.exponentialRampToValueAtTime(Math.max(120, f*0.6), now + t*0.9);
  lpf.type = 'lowpass'; lpf.frequency.setValueAtTime(2400, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(v, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + t);
  osc.connect(lpf).connect(gain).connect(ac.destination);
  osc.start(now); osc.stop(now + t + 0.02);
}

const sfx = {
  countdown(c){
    // tonalità leggermente calanti: 3→2→1
    const seq = [480, 420, 360];              // per c = 3,2,1
    pluck({ f: seq[3 - c], t: 0.16, v: 0.16 });
  },
  start(){ /* lascia la tua versione “jingle” attuale */ },
  pshot(){ tone({type:'square', f:920, t:0.08, v:0.12}); },
  eshot(){ tone({type:'sawtooth', f:420, t:0.1, v:0.1}); },
  hit(){   tone({type:'triangle', f:180, t:0.1, v:0.18}); },
  explode(){ noiseSweep({t:0.22, v:0.28, f0:1200, f1:2000}); },
  over(v){ if(v){ tone({type:'triangle', f:440, t:0.25, v:0.18}); setTimeout(()=>tone({type:'triangle', f:660, t:0.25, v:0.18}),300); } else { tone({type:'square', f:140, t:0.5, v:0.22}); } }
};

  // ======= Hi-DPI & Resize =======
  function resize(){
    const cssH=Math.floor(window.innerHeight*0.88);
    const cssW=Math.floor(window.innerWidth*0.95);
    const cellH=Math.floor(cssH/ROWS), cellW=Math.floor(cssW/COLS);
    const cssCell=Math.max(14, Math.min(cellH, cellW));
    cellSize=cssCell;
    const cssCanvasW=cellSize*COLS, cssCanvasH=cellSize*ROWS;
    const dpr=Math.max(1, Math.min(2, window.devicePixelRatio||1));
    canvas.style.width=cssCanvasW+'px'; canvas.style.height=cssCanvasH+'px';
    canvas.width=Math.floor(cssCanvasW*dpr); canvas.height=Math.floor(cssCanvasH*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  // ======= Rendering =======
  function drawGrid(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='#1f334e'; ctx.lineWidth=1;
    for(let c=0;c<=COLS;c++){ const x=c*cellSize; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ROWS*cellSize); ctx.stroke(); }
    for(let r=0;r<=ROWS;r++){ const y=r*cellSize; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(COLS*cellSize,y); ctx.stroke(); }
  }

  // Player (gradienti + thruster)
  function drawPlayer(x,y,dir){
    const cx=x*cellSize+cellSize/2, cy=y*cellSize+cellSize/2;
    const w=cellSize*0.68, h=cellSize*0.98;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(dir*Math.PI/2);
    const grad=ctx.createLinearGradient(0,-h/2,0,h/2);
    grad.addColorStop(0,'#7ae1ff'); grad.addColorStop(1,'#1eb7ff');
    ctx.fillStyle=grad; ctx.strokeStyle='#02263f'; ctx.lineWidth=Math.max(1, cellSize*0.04);
    ctx.beginPath();
    ctx.moveTo(0,-h/2);
    ctx.lineTo(w/2,h/4);
    ctx.lineTo(w*0.22,h/2);
    ctx.lineTo(-w*0.22,h/2);
    ctx.lineTo(-w/2,h/4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#c8f0ff';
    ctx.beginPath(); ctx.moveTo(0,-h*0.35); ctx.lineTo(w*0.12,-h*0.12); ctx.lineTo(-w*0.12,-h*0.12); ctx.closePath(); ctx.fill();
    const flameLen = h*0.22*(0.8+0.2*Math.sin(performance.now()/60));
    const flameGrad = ctx.createLinearGradient(0,h/2,0,h/2+flameLen);
    flameGrad.addColorStop(0,'#ffe066'); flameGrad.addColorStop(1,'#ff3b3b');
    ctx.fillStyle=flameGrad;
    ctx.beginPath(); ctx.moveTo(-w*0.12,h/2); ctx.lineTo(0,h/2+flameLen); ctx.lineTo(w*0.12,h/2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Nemico (rosso)
  function drawEnemy(x,y,dir){
    const cx=x*cellSize+cellSize/2, cy=y*cellSize+cellSize/2;
    const w=cellSize*0.64, h=cellSize*0.9;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(dir*Math.PI/2);
    const grad=ctx.createLinearGradient(0,-h/2,0,h/2);
    grad.addColorStop(0,'#ff8a8a'); grad.addColorStop(1,'#cc2929');
    ctx.fillStyle=grad; ctx.strokeStyle='#300'; ctx.lineWidth=Math.max(1, cellSize*0.035);
    ctx.beginPath();
    ctx.moveTo(0,-h/2);
    ctx.lineTo(w/2,h/3);
    ctx.lineTo(0,h/2);
    ctx.lineTo(-w/2,h/3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#a00';
    ctx.beginPath(); ctx.moveTo(0,-h*0.2); ctx.lineTo(w*0.18,0); ctx.lineTo(0,h*0.15); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-h*0.2); ctx.lineTo(-w*0.18,0); ctx.lineTo(0,h*0.15); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Particelle & shockwave
  function spawnExplosion(type, gx, gy){
    const px = gx*cellSize + cellSize/2;
    const py = gy*cellSize + cellSize/2;
    if(type==='hit'){ // colpo a segno (giallo/arancio/bianco)
      for(let i=0;i<22;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = 0.7 + Math.random()*2.2;
        particles.push({
          x:px, y:py, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp,
          life:260+Math.random()*160, size:1+Math.random()*2,
          color: (i%3===0)?'#fff7a8': (i%3===1)?'#ffb21a':'#ffd36b'
        });
      }
      rings.push({x:px, y:py, r:0, max:cellSize*1.2, alpha:0.8, color:'rgba(255,220,120,'});
    } else if(type==='crash'){ // collisione navicelle (rosso/arancio + anello più grande)
      for(let i=0;i<34;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = 1.2 + Math.random()*3.0;
        particles.push({
          x:px, y:py, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp,
          life:380+Math.random()*200, size:1.5+Math.random()*2.5,
          color: (i%2===0)?'#ff6b6b':'#ff9a3b'
        });
      }
      rings.push({x:px, y:py, r:0, max:cellSize*2.0, alpha:0.9, color:'rgba(255,120,90,'});
    }
  }
  function updateEffects(dt){
    // particelle
    for(const p of particles){
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.985; p.vy *= 0.985;
      p.life -= dt;
    }
    particles = particles.filter(p=>p.life>0);
    // shockwave
    for(const r of rings){ r.r += 0.8; r.alpha *= 0.96; }
    rings = rings.filter(r=>r.r < r.max && r.alpha > 0.02);
  }
  function drawEffects(){
    for(const p of particles){
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    for(const r of rings){
      ctx.strokeStyle = r.color + r.alpha + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
    }
  }

  function updatePanel(){
    panelLives.textContent=lives;
    panelShots.textContent=totalShots;
    panelTime.textContent=Math.floor((Date.now()-startTime)/1000);
  }

  // ======= Logiche =======
  function movePlayer(){
    if(player.dir===null) return;
    const nx = player.x + (player.dir===1?1:player.dir===3?-1:0);
    const ny = player.y + (player.dir===2?1:player.dir===0?-1:0);
    if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS){ player.x=nx; player.y=ny; }
    checkCollision();
  }

  function moveEnemies(){
    const now=Date.now(); const mid=(enemies._spawnMid||(COLS-1)/2);
    enemies.forEach(e=>{
      if(!e) return;
      if(now-e.lastChange>=dirPersistTime){
        const desiredX=Math.max(0, Math.min(COLS-1, Math.round(player.x + e.fanIndex*fanSpread)));
        const dx=desiredX-e.x, dy=player.y-e.y;
        if(Math.random()<enemyBias){ e.dir = Math.abs(dx)>Math.abs(dy) ? (dx>0?1:3) : (dy>=0?2:0); }
        else { e.dir = [0,1,2,3][Math.floor(Math.random()*4)]; }
        e.lastChange=now;
      }
      const nx=e.x+(e.dir===1?1:e.dir===3?-1:0);
      const ny=e.y+(e.dir===2?1:e.dir===0?-1:0);
      if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS){ e.x=nx; e.y=ny; }
    });
    checkCollision();
  }

  function firePlayer(){
    playerShots.push({x:player.x,y:player.y,dir:player.dir,active:true,px:player.x,py:player.y});
    totalShots++; sfx.pshot();
  }

  function enemyFireCheck(){
    enemies.forEach(e=>{
      if(!e) return;
      if((e.dir===1||e.dir===3)&&e.y===player.y){
        const dx=player.x-e.x;
        if((dx>0&&e.dir===1)||(dx<0&&e.dir===3)){
          enemyShots.push({x:e.x,y:e.y,dir:e.dir,active:true,px:e.x,py:e.y}); sfx.eshot();
        }
      }
      if((e.dir===0||e.dir===2)&&e.x===player.x){
        const dy=player.y-e.y;
        if((dy>0&&e.dir===2)||(dy<0&&e.dir===0)){
          setTimeout(()=>{ enemyShots.push({x:e.x,y:e.y,dir:e.dir,active:true,px:e.x,py:e.y}); sfx.eshot(); }, 180);
        }
      }
    });
  }

  function stepShots(){
    for(const s of playerShots){ if(!s.active) continue; s.px=s.x; s.py=s.y; }
    for(const s of enemyShots){ if(!s.active) continue; s.px=s.x; s.py=s.y; }

    for(const s of playerShots){ if(!s.active) continue;
      s.x+=(s.dir===1?1:s.dir===3?-1:0); s.y+=(s.dir===2?1:s.dir===0?-1:0);
      if(s.x<0||s.x>=COLS||s.y<0||s.y>=ROWS) s.active=false;
    }
    for(const s of enemyShots){ if(!s.active) continue;
      s.x+=(s.dir===1?1:s.dir===3?-1:0); s.y+=(s.dir===2?1:s.dir===0?-1:0);
      if(s.x<0||s.x>=COLS||s.y<0||s.y>=ROWS) s.active=false;
    }

    // incrocio proiettili
    for(let i=0;i<playerShots.length;i++){
      const p=playerShots[i]; if(!p||!p.active) continue;
      for(let j=0;j<enemyShots.length;j++){
        const e=enemyShots[j]; if(!e||!e.active) continue;
        if(p.px===e.x && p.py===e.y && e.px===p.x && e.py===p.y){ p.active=false; e.active=false; }
      }
    }

    // hit nemici
    for(const p of playerShots){
      if(!p.active) continue;
      for(let ei=0; ei<enemies.length; ei++){
        const e=enemies[ei];
        if(e && e.x===p.x && e.y===p.y){
          enemies[ei]=null; killedCount++; p.active=false;
          spawnExplosion('hit', e.x, e.y); sfx.explode();
        }
      }
    }

    // hit player
    for(const s of enemyShots){
      if(!s.active) continue;
      if(s.x===player.x && s.y===player.y){
        s.active=false; lives--; sfx.hit();
        spawnExplosion('hit', player.x, player.y);
        if(navigator.vibrate){ navigator.vibrate(35); }
      }
    }

    playerShots=playerShots.filter(s=>s&&s.active);
    enemyShots=enemyShots.filter(s=>s&&s.active);

    if(lives<=0) endGame(false);
    if(enemies.every(e=>!e)) endGame(true);
  }

  // collisione navicelle ⇒ esplosione "crash"
  function checkCollision(){
    for(const e of enemies){
      if(e && e.x===player.x && e.y===player.y){
        // mostra l'esplosione prima della fine
        spawnExplosion('crash', player.x, player.y);
        sfx.explode();
        setTimeout(()=>endGame(false), 280);
        return;
      }
    }
  }

  // ======= Draw =======
  function render(){
    drawGrid();
    // proiettili
    for(const s of playerShots){
      ctx.fillStyle='#9cff57';
      ctx.fillRect(s.x*cellSize+cellSize*0.4, s.y*cellSize+cellSize*0.4, cellSize*0.22, cellSize*0.22);
    }
    for(const s of enemyShots){
      ctx.fillStyle='#ff4444';
      ctx.fillRect(s.x*cellSize+cellSize*0.4, s.y*cellSize+cellSize*0.4, cellSize*0.22, cellSize*0.22);
    }
    // effetti sotto/tra navi e proiettili
    drawEffects();
    // nemici
    enemies.forEach(e=>{ if(e) drawEnemy(e.x,e.y,e.dir); });
    // player
    drawPlayer(player.x,player.y,player.dir);
    updatePanel();
  }

  // ======= Game loop (delta) =======
  let lastT=0, accPlayer=0, accEnemy=0, accShots=0, accEnemyFire=0, accMobileFire=0;
  function gameLoop(ts){
    if(!gameRunning){ requestAnimationFrame(gameLoop); return; }
    if(!lastT) lastT=ts;
    const dt=ts-lastT; lastT=ts;

    if(!paused){
      accPlayer+=dt; accEnemy+=dt; accShots+=dt; accEnemyFire+=dt; if(modeMobile) accMobileFire+=dt;
      if(accPlayer>=moveInterval){ movePlayer(); accPlayer-=moveInterval; }
      if(accEnemy>=moveInterval){ moveEnemies(); accEnemy-=moveInterval; }
      if(accShots>=shotSpeedInterval){ stepShots(); accShots-=shotSpeedInterval; }
      if(accEnemyFire>=enemyFirePeriod){ enemyFireCheck(); accEnemyFire=0; }
      if(modeMobile && accMobileFire>=MOBILE_FIRE_PERIOD){ firePlayer(); accMobileFire=0; }
      updateEffects(dt);
      render();
    }
    requestAnimationFrame(gameLoop);
  }

  // ======= Input tastiera (desktop) =======
  window.addEventListener('keydown', e=>{
    if(modeMobile) return;
    if(e.key==='ArrowUp'||e.key==='w'){ player.dir=0; e.preventDefault(); }
    if(e.key==='ArrowRight'||e.key==='d'){ player.dir=1; e.preventDefault(); }
    if(e.key==='ArrowDown'||e.key==='s'){ player.dir=2; e.preventDefault(); }
    if(e.key==='ArrowLeft'||e.key==='a'){ player.dir=3; e.preventDefault(); }
    if(e.key===' '||e.code==='Space'){ firePlayer(); e.preventDefault(); }
    if(e.key==='p'||e.key==='P'||e.key==='Escape'){ togglePause(); e.preventDefault(); }
  });

  // ======= Swipe brevi per direzione (mobile) =======
  let tStart=0, sx=0, sy=0;
  const SWIPE_MIN_DIST=18; // px
  const SWIPE_MAX_TIME=450; // ms
  canvas.addEventListener('touchstart', e=>{
    if(!modeMobile) return;
    const t=e.touches[0]; tStart=performance.now(); sx=t.clientX; sy=t.clientY;
  }, {passive:true});
  canvas.addEventListener('touchend', e=>{
    if(!modeMobile) return;
    const t=e.changedTouches[0]; const dt=performance.now()-tStart;
    const dx=t.clientX-sx, dy=t.clientY-sy;
    if(dt<=SWIPE_MAX_TIME && Math.hypot(dx,dy)>=SWIPE_MIN_DIST){
      if(Math.abs(dx)>Math.abs(dy)) player.dir = (dx>0?1:3);
      else player.dir = (dy>0?2:0);
      e.preventDefault();
    }
  }, {passive:false});

  // ======= Pausa =======
  function togglePause(){
    if(!gameRunning) return;
    paused=!paused;
    pauseOverlay.style.display = paused ? 'flex' : 'none';
    announcer.textContent = paused ? 'Gioco in pausa' : 'Gioco ripreso';
  }
  pauseBtn.addEventListener('click', togglePause);
  resumeBtn.addEventListener('click', togglePause);

  // ======= Flusso di avvio =======
  document.getElementById('startGame').addEventListener('click', ()=>{
    const diff=document.querySelector('input[name="difficulty"]:checked').value;
    const mode=document.querySelector('input[name="mode"]:checked').value;
    const cfg=difficultyConfig[diff];
    modeMobile=(mode==='mobile');
    moveInterval=150*cfg.slowFactor;
    shotSpeedInterval=moveInterval/2;
    enemyBias=cfg.bias;
    fanSpread=cfg.fanSpread;
    enemyFirePeriod=cfg.enemyFireMs;

    // sblocco audio su gesto
    ensureAudio();

    menu.style.display='none';
    instructions.style.display='flex';
    instructionsText.textContent = modeMobile
      ? 'Su mobile: cambia direzione con **breve swipe** (alto/basso/sinistra/destra). Fuoco automatico.'
      : 'Desktop: frecce o WASD per muoverti, Spazio per sparare. P o Esc per pausa.';
    const onProceed=(ev)=>{
      ev.preventDefault();
      if(ev.type==='keydown'){ window.removeEventListener('keydown', onProceed); }
      else { instructions.removeEventListener('touchstart', onProceed); }
      startAfterInstructions();
    };
    if(!modeMobile){ window.addEventListener('keydown', onProceed, {once:true}); }
    else { instructions.addEventListener('touchstart', onProceed, {once:true, passive:false}); }
  });

  function startAfterInstructions(){
    instructions.style.display='none';
    startCountdownAndGame();
  }

  async function startCountdownAndGame(){
    countdown.style.display='flex';
    let c=3;
    while(c>0){
      countdown.textContent=c; sfx.countdown(c);
      announcer.textContent='Partenza tra '+c;
      await new Promise(r=>setTimeout(r, 1000));
      c--;
    }
    countdown.style.display='none';
    sfx.start(); initGame();
  }

  // ======= Init/End =======
  function initGame(){
    player={x:COLS-1,y:ROWS-1,dir:0};
    enemies=[]; const mid=(COLS-1)/2; enemies._spawnMid=mid;
    for(let i=0;i<COLS;i++){ const fanIndex=(i-mid)/Math.max(1,mid);
      enemies.push({x:i,y:0,dir:2,lastChange:Date.now(),fanIndex});
    }
    playerShots=[]; enemyShots=[];
    particles=[]; rings=[];
    killedCount=0; totalShots=0; lives=3; startTime=Date.now(); finalScore=0;

    // loop reset
    lastT=0; accPlayer=accEnemy=accShots=accEnemyFire=accMobileFire=0;
    gameRunning=true; paused=false;

    render(); requestAnimationFrame(gameLoop);
    canvas.focus({preventScroll:true});
  }

  function endGame(victory){
    if(!gameRunning) return;
    gameRunning=false; sfx.over(victory);
    const elapsed=Math.floor((Date.now()-startTime)/1000);
    finalScore = killedCount*150 + lives*300 - elapsed*3 - totalShots*2;
    document.getElementById('statKills').textContent=killedCount;
    document.getElementById('statTimeOver').textContent=elapsed;
    document.getElementById('statLives').textContent=lives;
    document.getElementById('statScore').textContent=finalScore;
    endMsg.textContent = victory ? 'Vittoria!' : 'Game Over';
    nameInput.style.display='block'; saveBtn.style.display='block';
    gameOver.style.display='flex'; showLeaderboard(); nameInput.focus();
    announcer.textContent = victory ? 'Hai vinto' : 'Game over';
  }

  function showLeaderboard(){
    let lb=JSON.parse(localStorage.getItem('leaderboard')||'[]');
    lb.sort((a,b)=>b.score-a.score);
    lbDiv.innerHTML='<h3>Leaderboard</h3>'+lb.slice(0,10).map(e=>`<div>${e.name}: ${e.score}</div>`).join('');
  }
  saveBtn.addEventListener('click', ()=>{
    const name=(nameInput.value||'Anonimo').trim();
    let lb=JSON.parse(localStorage.getItem('leaderboard')||'[]');
    lb.push({name, score:finalScore, ts:Date.now()});
    localStorage.setItem('leaderboard', JSON.stringify(lb));
    showLeaderboard();
    gameOver.style.display='none'; menu.style.display='flex'; nameInput.value='';
  });

  // ======= PWA =======
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('/static/service-worker.js').catch(console.error);
    });
  }
  </script>
</body>
</html>'''
    return Response(html, mimetype='text/html')

if __name__ == '__main__':
    # Nota: disattiva debug in produzione
    app.run(host='0.0.0.0', port=5000, debug=True)
