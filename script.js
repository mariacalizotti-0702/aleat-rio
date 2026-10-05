const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 500;

// Elementos de UI
const scoreEl = document.getElementById('score-val');
const timeEl = document.getElementById('time-val');
const accEl = document.getElementById('acc-val');
const comboEl = document.getElementById('combo-val');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const finalScoreEl = document.getElementById('final-score');
const finalShotsEl = document.getElementById('final-shots');
const finalHitsEl = document.getElementById('final-hits');
const finalAccEl = document.getElementById('final-acc');
const highScoreEl = document.getElementById('high-score');

// Áudio via Web Audio API
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
}

function playSound(type) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  if (type === 'shot') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'hit') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'miss') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

// Estado do Jogo
let isPlaying = false;
let score = 0;
let shots = 0;
let hits = 0;
let combo = 1;
let timeLeft = 30;
let timerInterval = null;

let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

let targets = [];
let particles = [];
let floatingTexts = [];

// Classe do Alvo
class Target {
  constructor() {
    this.radius = Math.floor(Math.random() * 15) + 35; // Raio entre 35px e 50px
    this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
    this.y = Math.random() * (canvas.height - this.radius * 2) + this.radius;

    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;

    this.baseY = this.y;
    this.waveAngle = Math.random() * Math.PI * 2;

    // A área de acerto válida é de exatamente 35% da área total
    // A_bullseye / A_total = 0.35 => (r_bullseye / R)^2 = 0.35 => r_bullseye = R * sqrt(0.35)
    this.bullseyeRadius = this.radius * Math.sqrt(0.35);
  }

  update() {
    this.x += this.vx;
    this.waveAngle += 0.05;
    this.y += this.vy + Math.sin(this.waveAngle) * 1.5;

    // Rebater nas bordas
    if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
      this.vx *= -1;
    }
    if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
      this.vy *= -1;
    }
  }

  draw() {
    // Anel Externo (Área de Erro/Quase) - Vermelho
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ff0055';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Anel Intermediário - Branco
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Anel Interno - Vermelho
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff0055';
    ctx.fill();

    // Centro / Bullseye (Área Válida de 35%) - Amarelo Neon
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.bullseyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe600';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  checkHit(px, py) {
    const dist = Math.hypot(px - this.x, py - this.y);
    if (dist <= this.bullseyeRadius) {
      return 'HIT'; // Acerto nos 35% do centro
    } else if (dist <= this.radius) {
      return 'OUTER'; // Clique no alvo, mas fora da área de 35%
    }
    return 'MISS'; // Errou o alvo
  }
}

// Partículas ao Atirar
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.radius = Math.random() * 3 + 1;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.alpha = 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.03;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

// Texto Flutuante
class FloatingText {
  constructor(text, x, y, color) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.alpha = 1;
    this.vy = -1.5;
  }

  update() {
    this.y += this.vy;
    this.alpha -= 0.025;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

function spawnTargets(count = 3) {
  targets = [];
  for (let i = 0; i < count; i++) {
    targets.push(new Target());
  }
}

function createSparks(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// Eventos do Mouse
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
  if (!isPlaying) return;
  initAudio();

  shots++;
  playSound('shot');

  let hitTargetIndex = -1;
  let hitType = 'MISS';

  for (let i = targets.length - 1; i >= 0; i--) {
    const res = targets[i].checkHit(mouseX, mouseY);
    if (res === 'HIT' || res === 'OUTER') {
      hitTargetIndex = i;
      hitType = res;
      break;
    }
  }

  if (hitType === 'HIT') {
    hits++;
    const pts = 100 * combo;
    score += pts;
    combo++;

    playSound('hit');
    createSparks(mouseX, mouseY, '#ffe600', 15);
    floatingTexts.push(new FloatingText(`ACERTO! +${pts}`, mouseX, mouseY - 10, '#ffe600'));

    // Substituir alvo destruído
    targets.splice(hitTargetIndex, 1);
    targets.push(new Target());
  } else if (hitType === 'OUTER') {
    combo = 1;
    playSound('miss');
    createSparks(mouseX, mouseY, '#ff0055', 8);
    floatingTexts.push(new FloatingText(`QUASE! (Fora dos 35%)`, mouseX, mouseY - 10, '#ff0055'));
  } else {
    combo = 1;
    playSound('miss');
    createSparks(mouseX, mouseY, '#888888', 5);
    floatingTexts.push(new FloatingText(`ERROU!`, mouseX, mouseY - 10, '#aaaaaa'));
  }

  updateUI();
});

function updateUI() {
  scoreEl.textContent = score;
  comboEl.textContent = `x${combo}`;
  const acc = shots > 0 ? ((hits / shots) * 100).toFixed(1) : '0.0';
  accEl.textContent = `${acc}%`;
}

function startGame() {
  initAudio();
  score = 0;
  shots = 0;
  hits = 0;
  combo = 1;
  timeLeft = 30;
  isPlaying = true;

  updateUI();
  timeEl.textContent = `${timeLeft}s`;

  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  spawnTargets(4);

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    timeEl.textContent = `${timeLeft}s`;

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  isPlaying = false;
  clearInterval(timerInterval);

  const acc = shots > 0 ? ((hits / shots) * 100).toFixed(1) : '0.0';

  const highScore = localStorage.getItem('target_highscore') || 0;
  if (score > highScore) {
    localStorage.setItem('target_highscore', score);
    highScoreEl.textContent = score;
  } else {
    highScoreEl.textContent = highScore;
  }

  finalScoreEl.textContent = score;
  finalShotsEl.textContent = shots;
  finalHitsEl.textContent = hits;
  finalAccEl.textContent = `${acc}%`;

  gameOverScreen.classList.remove('hidden');
}

// Desenhar Mira
function drawCrosshair() {
  ctx.save();
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.5;

  // Círculo interno
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Ponto central
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ff0055';
  ctx.fill();

  // Linhas da mira
  ctx.beginPath();
  ctx.moveTo(mouseX - 18, mouseY);
  ctx.lineTo(mouseX - 4, mouseY);

  ctx.moveTo(mouseX + 4, mouseY);
  ctx.lineTo(mouseX + 18, mouseY);

  ctx.moveTo(mouseX, mouseY - 18);
  ctx.lineTo(mouseX, mouseY - 4);

  ctx.moveTo(mouseX, mouseY + 4);
  ctx.lineTo(mouseX, mouseY + 18);
  ctx.stroke();

  ctx.restore();
}

// Loop Principal do Jogo
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Desenhar fundo reticulado
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  if (isPlaying) {
    // Atualizar e desenhar alvos
    targets.forEach((t) => {
      t.update();
      t.draw();
    });

    // Partículas
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].alpha <= 0) particles.splice(i, 1);
    }

    // Textos flutuantes
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].update();
      floatingTexts[i].draw();
      if (floatingTexts[i].alpha <= 0) floatingTexts.splice(i, 1);
    }
  }

  // Desenhar Mira por cima de tudo
  drawCrosshair();

  requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Iniciar Loop do Canvas
requestAnimationFrame(gameLoop);