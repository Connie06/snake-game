const API_BASE = '';
const GRID_SIZE = 28;
const TILE_COUNT = 24;
const WEAPON_RANGE = 8;
const LASER_SPEED = 32;
const LASER_LIFE = 2;
const EXPLOSION_DECAY = 0.45;
const EXPLOSION_SHRINK = 0.8;

const AuthState = { user: null, isGuest: false };

let DeviceMode = 'pc';

let GameMode = null;

let CurrentSkin = {
  headType: 'emoji',
  headEmoji: '🐍',
  headPhotoData: null,
  headDiy: { size: 100, eyeSize: 10, eyeSpacing: 32, eyeColor: '#2d3436', mouth: 0, mouthSize: 30, mouthColor: '#c0392b', blush: true, blushColor: '#ff6b9d', headColor1: '#fff4d6', headColor2: '#667eea', extraEmojis: [], emojiPositions: [] },
  bodyShape: 'round',
  bodyColor1: '#667eea',
  bodyColor2: '#764ba2',
  bodyColor3: '#ffffff',
  bodyPhotoData: null,
  bodyPattern: 'gradient'
};

const PRESET_HEADS = ['🐍','🐱','🐶','🦊','🐰','🐻','🐼','🦁','🐸','🐯','🦄','🐙','🐳','🐲','🦋','🐞','🐢','🐧','🦩','🐿'];
const PRESET_COLORS = [
  ['#667eea','#764ba2'],
  ['#f093fb','#f5576c'],
  ['#4facfe','#00f2fe'],
  ['#43e97b','#38f9d7'],
  ['#fa709a','#fee140'],
  ['#a8edea','#fed6e3'],
  ['#ff9a9e','#fecfef'],
  ['#ffecd2','#fcb69f'],
  ['#84fab0','#8fd3f4'],
  ['#a1c4fd','#c2e9fb'],
  ['#f6d365','#fda085'],
  ['#ff6e7f','#bfe9ff'],
  ['#e0c3fc','#8ec5fc'],
  ['#f093fb','#f5576c'],
  ['#fdcbf1','#e6dee9'],
  ['#5ee7df','#b490ca']
];

const EMOJI_QUICK_PICKS = ['👀','😄','😊','😎','🤩','😍','😋','🥺','😇','🤗','👄','💋','⭐','✨','💖','🔥','🌈','🎀','👑','🦄'];

const Adventure = {
  canvas: null, ctx: null,
  snake: [], direction: {x:1,y:0}, nextDirection: {x:1,y:0},
  foods: [], obstacles: [], powerups: [], lasers: [], explosions: [], particles: [],
  score: 0, level: 1, lives: 10, maxLives: 10, ammo: 5,
  highestLevel: 1, totalScore: 0,
  running: false, paused: false, gameOver: false,
  loopTimer: null,
  speedBase: 180
};

const Battle = {
  canvas: null, ctx: null,
  room: null, roomCode: null, myPlayerId: null,
  players: [], items: [], bullets: [],
  myLives: 3, myShield: 0, myAmmo: 5, myLen: 3,
  running: false, loopTimer: null, syncTimer: null,
  aliveCount: 0, totalCount: 0
};

let laserEffects = [];

async function apiCall(endpoint, options = {}) {
  try {
    const url = API_BASE + endpoint;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, message: '网络错误' };
  }
}
function $(id) { return document.getElementById(id); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str == null ? '' : str);
  return div.innerHTML;
}

const _imgCache = {};
function getCachedImage(base64) {
  if (!base64) return null;
  if (_imgCache[base64]) return _imgCache[base64];
  const img = new Image();
  img.src = base64;
  _imgCache[base64] = img;
  return img;
}
function hexToRgb(hex) {
  let h = hex.replace('#','');
  if (h.length === 3) h = h.split('').map(c => c+c).join('');
  const num = parseInt(h, 16);
  return { r: (num>>16)&255, g: (num>>8)&255, b: num&255 };
}
function rgbToHex(r,g,b) {
  const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,'0');
  return '#' + to(r) + to(g) + to(b);
}
function interpolateColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return rgbToHex(
    a.r + (b.r-a.r)*t,
    a.g + (b.g-a.g)*t,
    a.b + (b.b-a.b)*t
  );
}
function lightenColor(hex, pct) {
  const c = hexToRgb(hex);
  return rgbToHex(c.r + (255-c.r)*pct/100, c.g + (255-c.g)*pct/100, c.b + (255-c.b)*pct/100);
}
function darkenColor(hex, pct) {
  const c = hexToRgb(hex);
  return rgbToHex(c.r*(1-pct/100), c.g*(1-pct/100), c.b*(1-pct/100));
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawDiamond(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0,-r); ctx.lineTo(r,0); ctx.lineTo(0,r); ctx.lineTo(-r,0); ctx.closePath();
}
function drawStar(ctx, cx, cy, spikes, outer, inner) {
  let rot = -Math.PI/2; const step = Math.PI/spikes;
  ctx.beginPath(); ctx.moveTo(cx+Math.cos(rot)*outer, cy+Math.sin(rot)*outer);
  for (let i = 0; i < spikes; i++) {
    rot += step; ctx.lineTo(cx+Math.cos(rot)*inner, cy+Math.sin(rot)*inner);
    rot += step; ctx.lineTo(cx+Math.cos(rot)*outer, cy+Math.sin(rot)*outer);
  }
  ctx.closePath();
}
function drawHeart(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(0, size*0.3);
  ctx.bezierCurveTo(-size, -size*0.6, -size*0.4, -size, 0, -size*0.35);
  ctx.bezierCurveTo(size*0.4, -size, size, -size*0.6, 0, size*0.3);
  ctx.closePath();
}
function drawFlower(ctx, r, petals) {
  ctx.save();
  for (let i = 0; i < petals; i++) {
    const a = (i * Math.PI*2)/petals;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a)*r*0.5, Math.sin(a)*r*0.5, r*0.45, r*0.3, a, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#ffeaa7';
  ctx.beginPath(); ctx.arc(0,0,r*0.35,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawSnakeBody(ctx, x, y, gx, gy, index, total, skin) {
  const cx = x + GRID_SIZE/2, cy = y + GRID_SIZE/2;
  const r = GRID_SIZE/2 - 2;
  const t = index / Math.max(1, total-1);
  const col1 = skin.bodyColor1, col2 = skin.bodyColor2;
  const col = interpolateColor(col1, col2, t);
  ctx.save();
  ctx.translate(cx, cy);

  let fillStyle;
  if (skin.bodyPattern === 'photo' && skin.bodyPhotoData) {
    fillStyle = ctx.createRadialGradient(0,0,2, 0,0,r);
    fillStyle.addColorStop(0, lightenColor(col, 20));
    fillStyle.addColorStop(1, col);
  } else {
    fillStyle = ctx.createRadialGradient(-r*0.35, -r*0.35, 2, 0, 0, r);
    fillStyle.addColorStop(0, lightenColor(col, 30));
    fillStyle.addColorStop(0.55, col);
    fillStyle.addColorStop(1, darkenColor(col, 18));
  }

  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = darkenColor(col, 30);
  ctx.lineWidth = 1.5;

  switch (skin.bodyShape) {
    case 'square':   roundedRect(ctx, -r, -r, r*2, r*2, 5); break;
    case 'diamond':  drawDiamond(ctx, r); break;
    case 'star':     drawStar(ctx, 0, 0, 5, r, r*0.5); break;
    case 'heart':    drawHeart(ctx, r*0.9); break;
    case 'flower':   drawFlower(ctx, r*0.95, 6); break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI*2);
  }
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(-r*0.35, -r*0.35, r*0.28, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawSnakeHead(ctx, x, y, skin, direction) {
  const cx = x + GRID_SIZE/2, cy = y + GRID_SIZE/2;
  ctx.save();
  ctx.translate(cx, cy);
  let rot = 0;
  if (direction.x === 1) rot = 0;
  else if (direction.x === -1) rot = Math.PI;
  else if (direction.y === 1) rot = Math.PI/2;
  else if (direction.y === -1) rot = -Math.PI/2;
  ctx.rotate(rot);

  const scale = (skin.headDiy?.size || 100) / 100;
  ctx.scale(scale, scale);

  if (skin.headType === 'photo' && skin.headPhotoData) {
    const img = getCachedImage(skin.headPhotoData);
    if (img && img.complete) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0,0,GRID_SIZE/2-2,0,Math.PI*2);
      ctx.clip();
      ctx.drawImage(img, -GRID_SIZE/2, -GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,215,0,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0,0,GRID_SIZE/2-2,0,Math.PI*2);
      ctx.stroke();
    } else {
      drawDiyHead(ctx, skin);
    }
  } else if (skin.headType === 'diy') {
    drawDiyHead(ctx, skin);
  } else {
    const r = GRID_SIZE/2 - 2;
    const bg = ctx.createRadialGradient(-r*0.3,-r*0.3,2,0,0,r);
    bg.addColorStop(0, skin.bodyColor3 || '#ffffff');
    bg.addColorStop(0.6, lightenColor(skin.bodyColor1, 10));
    bg.addColorStop(1, skin.bodyColor2);
    ctx.fillStyle = bg;
    ctx.strokeStyle = darkenColor(skin.bodyColor2, 25);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.font = `${Math.floor(GRID_SIZE*0.82)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(skin.headEmoji || '🐍', 0, 1);
  }

  ctx.restore();
}

function drawDiyHead(ctx, skin) {
  const d = skin.headDiy || {};
  d.size = d.size || 100;
  d.eyeSize = d.eyeSize !== undefined ? d.eyeSize : 10;
  d.eyeSpacing = d.eyeSpacing || 32;
  d.eyeColor = d.eyeColor || '#2d3436';
  d.mouth = d.mouth || 0;
  d.mouthSize = d.mouthSize || 30;
  d.mouthColor = d.mouthColor || '#c0392b';
  d.blush = d.blush !== false;
  d.blushColor = d.blushColor || '#ff6b9d';
  d.headColor1 = d.headColor1 || '#fff4d6';
  d.headColor2 = d.headColor2 || skin.bodyColor2 || '#667eea';
  d.extraEmojis = d.extraEmojis || [];
  d.emojiPositions = d.emojiPositions || [];

  const r = GRID_SIZE/2 - 2;
  // 头部底色渐变 - 使用自定义颜色
  const g = ctx.createRadialGradient(-r*0.3,-r*0.3,2, 0,0,r);
  g.addColorStop(0, d.headColor1);
  g.addColorStop(0.6, lightenColor(d.headColor2, 15));
  g.addColorStop(1, d.headColor2);
  ctx.fillStyle = g;
  ctx.strokeStyle = darkenColor(d.headColor2, 25);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // 眼睛 - 使用间距、颜色和拖拽位置
  const eyeR = Math.max(0, d.eyeSize);
  if (eyeR > 0) {
    const spacing = (d.eyeSpacing / 100) * r;
    const offX = spacing;
    const offY = (d.eyeY !== undefined ? d.eyeY : -0.12) * r; // 拖拽调整 Y 位置
    for (let sx = -1; sx <= 1; sx += 2) {
      // 眼白
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx*offX, offY, eyeR*0.7, 0, Math.PI*2); ctx.fill();
      // 瞳孔 - 自定义颜色
      ctx.fillStyle = d.eyeColor;
      ctx.beginPath(); ctx.arc(sx*(offX+1.5), offY+1, eyeR*0.38, 0, Math.PI*2); ctx.fill();
      // 高光
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx*(offX+2), offY-1, eyeR*0.15, 0, Math.PI*2); ctx.fill();
    }
  }
  // 嘴巴 - 使用自定义颜色和大小
  ctx.strokeStyle = d.mouthColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const m = d.mouth || 0;
  const mSize = (d.mouthSize / 100) * r;
  ctx.arc(0, r*0.35, mSize, Math.PI*0.15 + m*0.05, Math.PI*0.85 - m*0.05);
  ctx.stroke();
  // 腮红 - 使用自定义颜色和开关
  if (d.blush && m > 3) {
    ctx.fillStyle = d.blushColor + '66'; // 半透明
    ctx.beginPath(); ctx.arc(-r*0.42, r*0.28, r*0.12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.42, r*0.28, r*0.12, 0, Math.PI*2); ctx.fill();
  }
  // 装饰表情 - 支持自定义位置
  (d.extraEmojis || []).forEach((e, i) => {
    ctx.font = `${Math.floor(GRID_SIZE*0.4)}px "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let px, py;
    if (d.emojiPositions && d.emojiPositions[i]) {
      px = d.emojiPositions[i].x * r;
      py = d.emojiPositions[i].y * r;
    } else {
      const ang = (i * Math.PI*2) / Math.max(1, d.extraEmojis.length);
      px = Math.cos(ang)*r*0.7;
      py = Math.sin(ang)*r*0.7;
    }
    ctx.fillText(e, px, py);
  });
}

function drawItem(ctx, x, y, type) {
  const cx = x + GRID_SIZE/2, cy = y + GRID_SIZE/2;
  const r = GRID_SIZE/2 - 3;
  const t = Date.now() / 500;
  const bob = Math.sin(t) * 1.5;
  ctx.save();
  ctx.translate(cx, cy + bob);
  switch (type) {
    case 'food_normal': {
      const g = ctx.createRadialGradient(-r*0.3,-r*0.4,2, 0,0,r);
      g.addColorStop(0,'#b8ffb0'); g.addColorStop(0.5,'#55efc4'); g.addColorStop(1,'#00b894');
      ctx.fillStyle = g; ctx.strokeStyle = '#00876b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, r*0.08, r*0.88, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#00b894'; ctx.beginPath();
      ctx.ellipse(r*0.15, -r*0.7, r*0.25, r*0.15, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0,-r*0.78); ctx.lineTo(0,-r*0.55); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(-r*0.35, -r*0.2, r*0.2, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'food_grow': {
      const g = ctx.createRadialGradient(-r*0.3,-r*0.3,2, 0,0,r);
      g.addColorStop(0,'#a29bfe'); g.addColorStop(0.55,'#6c5ce7'); g.addColorStop(1,'#4834d4');
      ctx.fillStyle = g; ctx.strokeStyle = '#2d1b80'; ctx.lineWidth = 1.5;
      drawStar(ctx, 0, 0, 6, r*0.95, r*0.52); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffeaa7'; ctx.font = `${Math.floor(r)}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('+', 0, 1);
      break;
    }
    case 'food_shrink': {
      const g = ctx.createRadialGradient(-r*0.3,-r*0.4,2, 0,0,r);
      g.addColorStop(0,'#ffb8c4'); g.addColorStop(0.5,'#ff6b9d'); g.addColorStop(1,'#c44569');
      ctx.fillStyle = g; ctx.strokeStyle = '#8b2a48'; ctx.lineWidth = 1.5;
      drawHeart(ctx, r*1.0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2ed573'; ctx.beginPath();
      ctx.moveTo(-r*0.4, -r*0.5); ctx.lineTo(0, -r*0.85); ctx.lineTo(r*0.4, -r*0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-r*0.35, -r*0.05, r*0.7, r*0.15);
      break;
    }
    case 'health': {
      const pulse = 1 + Math.sin(t*3)*0.05;
      ctx.save(); ctx.scale(pulse, pulse);
      const g = ctx.createRadialGradient(-r*0.3,-r*0.3,2, 0,0,r);
      g.addColorStop(0,'#fff0f5'); g.addColorStop(0.5,'#fd79a8'); g.addColorStop(1,'#e84393');
      ctx.fillStyle = g; ctx.strokeStyle = '#a5306e'; ctx.lineWidth = 1.5;
      drawHeart(ctx, r*1.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.floor(r*0.9)}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('+', 0, r*0.1);
      ctx.restore();
      break;
    }
    case 'weapon': {
      ctx.rotate(Math.sin(t)*0.08);
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0,'#74b9ff'); g.addColorStop(0.5,'#0984e3'); g.addColorStop(1,'#fdcb6e');
      ctx.fillStyle = g; ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 1.5;
      roundedRect(ctx, -r*0.85, -r*0.7, r*1.7, r*1.4, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.floor(r*1.2)}px "Segoe UI Emoji"`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🔫', 0, 1);
      break;
    }
    case 'shield': {
      const g = ctx.createRadialGradient(0,-r*0.3,2, 0,0,r);
      g.addColorStop(0,'#f5e1ff'); g.addColorStop(0.5,'#a29bfe'); g.addColorStop(1,'#6c5ce7');
      ctx.fillStyle = g; ctx.strokeStyle = '#ffeaa7'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0,-r*0.95);
      ctx.lineTo(r*0.85,-r*0.65);
      ctx.lineTo(r*0.85, r*0.15);
      ctx.lineTo(0, r*0.95);
      ctx.lineTo(-r*0.85, r*0.15);
      ctx.lineTo(-r*0.85,-r*0.65);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffeaa7'; ctx.font = `bold ${Math.floor(r)}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('✦', 0, 0);
      break;
    }
    case 'obstacle': {
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0,'#81ecec'); g.addColorStop(0.4,'#00cec9'); g.addColorStop(1,'#0984e3');
      ctx.fillStyle = g; ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 1.5;
      drawDiamond(ctx, r*0.95); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0,-r*0.9); ctx.lineTo(0, r*0.9);
      ctx.moveTo(-r*0.8, 0); ctx.lineTo(r*0.8, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.moveTo(-r*0.2, -r*0.5); ctx.lineTo(-r*0.05, -r*0.7); ctx.lineTo(r*0.15, -r*0.3); ctx.lineTo(0, -r*0.1); ctx.closePath(); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawLaser(ctx, laser) {
  const startX = laser.startX * GRID_SIZE + GRID_SIZE/2;
  const startY = laser.startY * GRID_SIZE + GRID_SIZE/2;
  const endX = laser.endX * GRID_SIZE + GRID_SIZE/2;
  const endY = laser.endY * GRID_SIZE + GRID_SIZE/2;
  ctx.save();
  const alpha = Math.max(0, laser.life / LASER_LIFE);
  const grad = ctx.createLinearGradient(startX, startY, endX, endY);
  grad.addColorStop(0, `rgba(255,234,167,${alpha})`);
  grad.addColorStop(0.5, `rgba(255,107,157,${alpha})`);
  grad.addColorStop(1, `rgba(102,126,234,${alpha*0.3})`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 5 * alpha + 1;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#ffeaa7';
  ctx.shadowBlur = 20 * alpha;
  ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath(); ctx.arc(endX, endY, 4, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawExplosion(ctx, ex) {
  ctx.save();
  const alpha = Math.max(0, ex.life);
  ctx.globalAlpha = alpha;
  for (let i = 0; i < ex.particles.length; i++) {
    const p = ex.particles[i];
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}
function createExplosion(gx, gy, colors = ['#ffeaa7','#fd79a8','#667eea','#ff6b6b']) {
  const cx = gx * GRID_SIZE + GRID_SIZE/2;
  const cy = gy * GRID_SIZE + GRID_SIZE/2;
  const particles = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI*2)/16 + Math.random()*0.3;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * (2 + Math.random()*3),
      vy: Math.sin(a) * (2 + Math.random()*3),
      size: 3 + Math.random()*3,
      color: colors[Math.floor(Math.random()*colors.length)]
    });
  }
  return { x: cx, y: cy, life: 1, particles };
}
function updateExplosion(ex) {
  ex.life -= EXPLOSION_DECAY;
  for (const p of ex.particles) {
    p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9;
    p.size *= EXPLOSION_SHRINK;
  }
}

function renderInstructionIcons() {
  document.querySelectorAll('canvas.instruction-icon, canvas.item-icon').forEach(cv => {
    const c = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    c.clearRect(0,0,w,h);
    const type = cv.dataset.type;
    const map = {
      'normal-food': 'food_normal',
      'grow-food': 'food_grow',
      'shrink-food': 'food_shrink',
      'health': 'health',
      'weapon': 'weapon',
      'obstacle': 'obstacle'
    };
    c.save();
    const scale = w / GRID_SIZE;
    c.scale(scale, scale);
    drawItem(c, 0, 0, map[type] || 'food_normal');
    c.restore();
  });
}

function renderPresetCharacters() {
  const grid = $('charactersGrid'); if (!grid) return;
  grid.innerHTML = '';
  PRESET_HEADS.forEach((em, i) => {
    const div = document.createElement('div');
    div.className = 'character-item' + (CurrentSkin.headEmoji === em && CurrentSkin.headType === 'emoji' ? ' selected' : '');
    div.innerHTML = `<div class="character-emoji">${em}</div><div class="character-name">形象${i+1}</div>`;
    div.addEventListener('click', () => {
      CurrentSkin.headType = 'emoji';
      CurrentSkin.headEmoji = em;
      renderPresetCharacters();
      renderAllPreviews();
    });
    grid.appendChild(div);
  });
}

function renderPresetColors() {
  const grid = $('colorGrid'); if (!grid) return;
  grid.innerHTML = '';
  PRESET_COLORS.forEach((c, i) => {
    const [c1, c2] = c;
    const div = document.createElement('div');
    div.className = 'color-item' + (CurrentSkin.bodyColor1 === c1 ? ' selected' : '');
    div.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    div.addEventListener('click', () => {
      CurrentSkin.bodyColor1 = c1; CurrentSkin.bodyColor2 = c2;
      renderPresetColors();
      renderAllPreviews();
    });
    grid.appendChild(div);
  });
}

function renderEmojiQuickPicker() {
  const grid = $('emojiQuickPicker'); if (!grid) return;
  grid.innerHTML = '';
  EMOJI_QUICK_PICKS.forEach(em => {
    const chip = document.createElement('div');
    chip.className = 'emoji-pick-item';
    const selected = CurrentSkin.headDiy.extraEmojis.includes(em);
    if (selected) chip.classList.add('active');
    chip.textContent = em;
    chip.addEventListener('click', () => {
      const list = CurrentSkin.headDiy.extraEmojis;
      const idx = list.indexOf(em);
      if (idx >= 0) list.splice(idx,1); else list.push(em);
      renderEmojiQuickPicker();
      drawHeadPreview();
    });
    grid.appendChild(chip);
  });
}

function renderGradientPresets() {
  const el = $('gradientPresets'); if (!el) return;
  el.innerHTML = '';
  PRESET_COLORS.forEach(([c1,c2]) => {
    const d = document.createElement('div');
    d.className = 'gradient-preset-item';
    d.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    d.addEventListener('click', () => {
      CurrentSkin.bodyColor1 = c1; CurrentSkin.bodyColor2 = c2;
      if ($('bodyColor1')) $('bodyColor1').value = c1;
      if ($('bodyColor2')) $('bodyColor2').value = c2;
      drawBodyPreview();
    });
    el.appendChild(d);
  });
}

function bindBodyShapes() {
  document.querySelectorAll('.shape-item').forEach(it => {
    it.addEventListener('click', () => {
      document.querySelectorAll('.shape-item').forEach(x => x.classList.remove('selected'));
      it.classList.add('selected');
      CurrentSkin.bodyShape = it.dataset.shape;
      drawBodyPreview();
    });
  });
}

function drawHeadPreview() {
  const cv = $('headPreviewCanvas'); if (!cv) return;
  const c = cv.getContext('2d');
  c.clearRect(0,0,cv.width, cv.height);
  const bg = c.createRadialGradient(cv.width/2,cv.height/2,10, cv.width/2,cv.height/2, cv.width/2);
  bg.addColorStop(0,'#fff'); bg.addColorStop(1,'rgba(102,126,234,0.3)');
  c.fillStyle = bg; c.fillRect(0,0,cv.width,cv.height);
  c.save();
  // 居中绘制，使用缩放适配 canvas
  const scale = cv.width / (GRID_SIZE * 1.6);
  c.translate(cv.width/2 - GRID_SIZE*scale/2, cv.height/2 - GRID_SIZE*scale/2);
  c.scale(scale, scale);
  // 预览始终显示 DIY 或照片模式（不修改 headType）
  const previewSkin = JSON.parse(JSON.stringify(CurrentSkin));
  if (previewSkin.headPhotoData) previewSkin.headType = 'photo';
  else previewSkin.headType = 'diy';
  drawSnakeHead(c, 0, 0, previewSkin, { x:1, y:0 });
  c.restore();
}

function drawBodyPreview() {
  const cv = $('bodyPreviewCanvas'); if (!cv) return;
  const c = cv.getContext('2d');
  c.clearRect(0,0,cv.width, cv.height);
  const bg = c.createRadialGradient(cv.width/2,cv.height/2,10, cv.width/2,cv.height/2, cv.width/2);
  bg.addColorStop(0,'#fff'); bg.addColorStop(1,'rgba(240,147,251,0.3)');
  c.fillStyle = bg; c.fillRect(0,0,cv.width,cv.height);
  const startX = 20, y = cv.height/2 - GRID_SIZE/2;
  for (let i = 0; i < 7; i++) {
    drawSnakeBody(c, startX + i*(GRID_SIZE*0.75), y, 0, 0, i, 7, CurrentSkin);
  }
  drawSnakeHead(c, startX + 7*(GRID_SIZE*0.75), y, CurrentSkin, { x:1, y:0 });
}

function renderProfileAvatar() {
  const cv = $('profileAvatarCanvas'); if (!cv) return;
  const c = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  c.clearRect(0,0,w,h);
  const bg = c.createRadialGradient(w/2,h/2,10, w/2,h/2, w/2);
  bg.addColorStop(0,'#fff'); bg.addColorStop(1,'rgba(240,147,251,0.25)');
  c.fillStyle = bg; c.fillRect(0,0,w,h);
  c.save();
  const scale = (w/GRID_SIZE) * 0.8;
  c.translate(w/2 - GRID_SIZE*scale/2, h/2 - GRID_SIZE*scale/2);
  c.scale(scale, scale);
  drawSnakeHead(c, 0, 0, CurrentSkin, { x:1, y:0 });
  c.restore();
}

function renderAllPreviews() {
  drawHeadPreview();
  drawBodyPreview();
  renderProfileAvatar();
}

function bindDiySliders() {
  // 头部大小
  const s1 = $('headSizeSlider'), v1 = $('headSizeVal');
  if (s1) s1.addEventListener('input', e => { v1.textContent = e.target.value; CurrentSkin.headDiy.size = +e.target.value; drawHeadPreview(); });
  // 眼睛大小
  const s2 = $('eyeSizeSlider'), v2 = $('eyeSizeVal');
  if (s2) s2.addEventListener('input', e => { v2.textContent = e.target.value; CurrentSkin.headDiy.eyeSize = +e.target.value; drawHeadPreview(); });
  // 眼睛间距（新增）
  const sE = $('eyeSpacingSlider'), vE = $('eyeSpacingVal');
  if (sE) sE.addEventListener('input', e => { vE.textContent = e.target.value; CurrentSkin.headDiy.eyeSpacing = +e.target.value; drawHeadPreview(); });
  // 嘴巴弧度
  const s3 = $('mouthSlider'), v3 = $('mouthVal');
  if (s3) s3.addEventListener('input', e => { v3.textContent = e.target.value; CurrentSkin.headDiy.mouth = +e.target.value; drawHeadPreview(); });
  // 嘴巴大小（新增）
  const sM = $('mouthSizeSlider'), vM = $('mouthSizeVal');
  if (sM) sM.addEventListener('input', e => { vM.textContent = e.target.value; CurrentSkin.headDiy.mouthSize = +e.target.value; drawHeadPreview(); });

  // 颜色选择器（新增）
  const eyeC = $('eyeColorPicker');
  if (eyeC) eyeC.addEventListener('input', e => { CurrentSkin.headDiy.eyeColor = e.target.value; drawHeadPreview(); });
  const mouthC = $('mouthColorPicker');
  if (mouthC) mouthC.addEventListener('input', e => { CurrentSkin.headDiy.mouthColor = e.target.value; drawHeadPreview(); });
  const headC1 = $('headColor1Picker');
  if (headC1) headC1.addEventListener('input', e => { CurrentSkin.headDiy.headColor1 = e.target.value; drawHeadPreview(); });
  const headC2 = $('headColor2Picker');
  if (headC2) headC2.addEventListener('input', e => { CurrentSkin.headDiy.headColor2 = e.target.value; drawHeadPreview(); });
  const blushC = $('blushColorPicker');
  if (blushC) blushC.addEventListener('input', e => { CurrentSkin.headDiy.blushColor = e.target.value; drawHeadPreview(); });
  // 腮红开关
  const blushT = $('blushToggle');
  if (blushT) blushT.addEventListener('change', e => { CurrentSkin.headDiy.blush = e.target.checked; drawHeadPreview(); });

  // 身体颜色
  const bc1 = $('bodyColor1'), bc2 = $('bodyColor2'), bc3 = $('bodyColor3');
  if (bc1) bc1.addEventListener('input', e => { CurrentSkin.bodyColor1 = e.target.value; drawBodyPreview(); });
  if (bc2) bc2.addEventListener('input', e => { CurrentSkin.bodyColor2 = e.target.value; drawBodyPreview(); });
  if (bc3) bc3.addEventListener('input', e => { CurrentSkin.bodyColor3 = e.target.value; drawBodyPreview(); });

  // 照片上传
  const hUp = $('headPhotoUpload');
  if (hUp) hUp.addEventListener('change', e => handlePhotoUpload(e, 'head'));
  const bUp = $('bodyPhotoUpload');
  if (bUp) bUp.addEventListener('change', e => handlePhotoUpload(e, 'body'));

  // 应用按钮 - 不锁定，只是确认并切换类型
  const applyHead = $('applyHeadBtn');
  if (applyHead) applyHead.addEventListener('click', () => {
    if (CurrentSkin.headPhotoData) CurrentSkin.headType = 'photo';
    else CurrentSkin.headType = 'diy';
    renderAllPreviews();
    // 不弹 alert，改为按钮文字反馈
    applyHead.textContent = '✓ 已应用！';
    setTimeout(() => { applyHead.textContent = '✓ 应用此头部'; }, 1500);
  });
  const applyBody = $('applyBodyBtn');
  if (applyBody) applyBody.addEventListener('click', () => {
    renderAllPreviews();
    applyBody.textContent = '✓ 已应用！';
    setTimeout(() => { applyBody.textContent = '✓ 应用此身体'; }, 1500);
  });

  // 拖拽预览画布 - 拖拽调整眼睛位置和装饰位置
  bindHeadPreviewDrag();
}

// 拖拽头部预览：点击/拖拽调整眼睛位置（X控制间距，Y控制垂直位置）和装饰位置
function bindHeadPreviewDrag() {
  const cv = $('headPreviewCanvas');
  if (!cv) return;
  let dragging = false;
  let dragTarget = null; // 'eyes' | 'emoji_0' | 'emoji_1' | ...
  // 用于点击命中检测的命中半径（归一化坐标）
  const EYE_HIT_RADIUS = 0.45;
  const EMOJI_HIT_RADIUS = 0.35;

  function getPos(e) {
    const rect = cv.getBoundingClientRect();
    const sx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const sy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    // drawHeadPreview 中：scale = cv.width / (GRID_SIZE * 1.6)，head 居中绘制
    // 头部半径（世界坐标）= GRID_SIZE/2 - 2，画布像素半径 = (GRID_SIZE/2 - 2) * scale
    const scale = cv.width / (GRID_SIZE * 1.6);
    const headRadiusPx = (GRID_SIZE / 2 - 2) * scale;
    // 归一化到 -1 ~ 1（头部边缘）
    const x = (sx - cv.width / 2) / headRadiusPx;
    const y = (sy - cv.height / 2) / headRadiusPx;
    return { x: Math.max(-1.4, Math.min(1.4, x)), y: Math.max(-1.4, Math.min(1.4, y)) };
  }

  // 计算当前两只眼睛的归一化坐标（用于点击命中检测）
  function getEyePositions() {
    const d = CurrentSkin.headDiy;
    const r = 1; // 已归一化
    const spacing = (d.eyeSpacing || 32) / 100 * r;
    const offX = spacing;
    const offY = d.eyeY !== undefined ? d.eyeY : -0.12;
    return [
      { x: -offX, y: offY },
      { x: offX, y: offY }
    ];
  }

  function onStart(e) {
    e.preventDefault();
    const pos = getPos(e);
    // 1. 检查是否点击在装饰表情上（从后向前，最上层优先）
    const emojis = CurrentSkin.headDiy.extraEmojis || [];
    const positions = CurrentSkin.headDiy.emojiPositions || [];
    for (let i = emojis.length - 1; i >= 0; i--) {
      const ep = positions[i];
      if (ep) {
        const dx = pos.x - ep.x, dy = pos.y - ep.y;
        if (Math.sqrt(dx*dx + dy*dy) < EMOJI_HIT_RADIUS) {
          dragTarget = 'emoji_' + i;
          dragging = true;
          cv.style.cursor = 'grabbing';
          return;
        }
      }
    }
    // 2. 检查是否点击在眼睛上
    const eyes = getEyePositions();
    for (let i = 0; i < eyes.length; i++) {
      const dx = pos.x - eyes[i].x, dy = pos.y - eyes[i].y;
      if (Math.sqrt(dx*dx + dy*dy) < EYE_HIT_RADIUS) {
        dragTarget = 'eyes';
        dragging = true;
        cv.style.cursor = 'grabbing';
        return;
      }
    }
    // 3. 默认也允许拖拽眼睛（点头部任意位置都可调整眼睛）
    dragTarget = 'eyes';
    dragging = true;
    cv.style.cursor = 'grabbing';
    updateEyesFromPos(pos);
  }

  function updateEyesFromPos(pos) {
    // X 控制眼睛间距（0.15~0.95），Y 控制垂直位置（-0.6~0.4）
    const absX = Math.abs(pos.x);
    const newSpacing = Math.max(0.15, Math.min(0.95, absX));
    CurrentSkin.headDiy.eyeSpacing = Math.round(newSpacing * 100);
    CurrentSkin.headDiy.eyeY = Math.max(-0.6, Math.min(0.4, pos.y));
    // 同步 UI
    if ($('eyeSpacingSlider')) $('eyeSpacingSlider').value = CurrentSkin.headDiy.eyeSpacing;
    if ($('eyeSpacingVal')) $('eyeSpacingVal').textContent = CurrentSkin.headDiy.eyeSpacing;
    drawHeadPreview();
  }

  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const pos = getPos(e);
    if (dragTarget === 'eyes') {
      updateEyesFromPos(pos);
    } else if (dragTarget && dragTarget.startsWith('emoji_')) {
      const idx = parseInt(dragTarget.split('_')[1]);
      if (!CurrentSkin.headDiy.emojiPositions) CurrentSkin.headDiy.emojiPositions = [];
      CurrentSkin.headDiy.emojiPositions[idx] = { x: pos.x, y: pos.y };
      drawHeadPreview();
    }
  }

  function onEnd() {
    dragging = false; dragTarget = null; cv.style.cursor = 'grab';
  }

  cv.addEventListener('mousedown', onStart);
  cv.addEventListener('mousemove', onMove);
  cv.addEventListener('mouseup', onEnd);
  cv.addEventListener('mouseleave', onEnd);
  cv.addEventListener('touchstart', onStart, { passive: false });
  cv.addEventListener('touchmove', onMove, { passive: false });
  cv.addEventListener('touchend', onEnd);
}

function handlePhotoUpload(e, which) {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const b64 = ev.target.result;
    if (which === 'head') {
      CurrentSkin.headPhotoData = b64;
      drawHeadPreview();
    } else {
      CurrentSkin.bodyPhotoData = b64;
      CurrentSkin.bodyPattern = 'photo';
      drawBodyPreview();
    }
  };
  reader.readAsDataURL(f);
}

function bindSkinSaveLoad() {
  const saveBtn = $('saveSkinBtn');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const name = $('skinNameInput').value.trim();
    if (!name) { alert('请输入皮肤名称'); return; }
    if (!AuthState.user) {
      localStorage.setItem('skin_' + name, JSON.stringify(CurrentSkin));
      alert('已保存到本地（登录后可云端保存）');
    } else {
      const r = await apiCall('/api/snake-skin/save', {
        method: 'POST',
        body: JSON.stringify({ userId: AuthState.user.id, skinName: name, skinData: CurrentSkin })
      });
      alert(r.message || (r.success ? '保存成功' : '保存失败'));
    }
    renderSavedSkins();
  });
}

async function renderSavedSkins() {
  const grid = $('savedSkinsGrid'); if (!grid) return;
  grid.innerHTML = '';
  const skins = [];
  if (AuthState.user) {
    const r = await apiCall('/api/snake-skin/' + AuthState.user.id);
    if (r.success) (r.skins || []).forEach(s => skins.push({ id: s.id, name: s.skinName, data: s.skinData, cloud: true }));
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('skin_')) {
      try { skins.push({ name: k.slice(5), data: JSON.parse(localStorage.getItem(k)), local: true }); } catch(e){}
    }
  }
  if (skins.length === 0) { grid.innerHTML = '<p style="text-align:center;color:#fff;opacity:0.8;">还没有保存的皮肤，快去捏一个吧！</p>'; return; }
  skins.forEach(sk => {
    const card = document.createElement('div');
    card.className = 'saved-skin-item';
    card.innerHTML = `<button class="saved-skin-delete" title="删除">×</button>
      <div class="saved-skin-preview"><canvas width="120" height="80"></canvas></div>
      <div class="saved-skin-info">
        <div class="saved-skin-name">${escapeHtml(sk.name)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);">${sk.cloud ? '☁️ 云端' : '💾 本地'}</div>
      </div>
      <button class="btn btn-primary saved-skin-use" style="padding:6px 16px;font-size:12px;letter-spacing:0;">使用</button>`;
    // 画预览缩略图：身体 + 头
    const cv = card.querySelector('canvas');
    const c = cv.getContext('2d');
    c.clearRect(0,0,cv.width,cv.height);
    const bg = c.createLinearGradient(0,0,cv.width,cv.height);
    bg.addColorStop(0,'rgba(255,255,255,0.15)'); bg.addColorStop(1,'rgba(255,255,255,0.05)');
    c.fillStyle = bg; c.fillRect(0,0,cv.width,cv.height);
    // 缩放绘制
    const sc = 0.8;
    c.save(); c.scale(sc, sc);
    for (let i = 0; i < 4; i++) drawSnakeBody(c, 5 + i*GRID_SIZE*0.8, 20, 0,0, i, 4, sk.data);
    drawSnakeHead(c, 5 + 4*GRID_SIZE*0.8, 20, sk.data, { x:1, y:0 });
    c.restore();
    // 删除按钮
    card.querySelector('.saved-skin-delete').addEventListener('click', async () => {
      if (!confirm('删除皮肤 "' + sk.name + '"？')) return;
      if (sk.cloud && sk.id && AuthState.user) {
        await apiCall('/api/snake-skin/' + sk.id, { method: 'DELETE' });
      } else if (sk.local) {
        localStorage.removeItem('skin_' + sk.name);
      }
      renderSavedSkins();
    });
    // 使用按钮
    card.querySelector('.saved-skin-use').addEventListener('click', () => {
      // 深拷贝并合并 headDiy 默认值
      const loaded = JSON.parse(JSON.stringify(sk.data));
      Object.assign(CurrentSkin, loaded);
      // 确保 headDiy 包含所有字段
      const defaults = { size:100, eyeSize:10, eyeSpacing:32, eyeColor:'#2d3436', eyeY:-0.12, mouth:0, mouthSize:30, mouthColor:'#c0392b', blush:true, blushColor:'#ff6b9d', headColor1:'#fff4d6', headColor2:'#667eea', extraEmojis:[], emojiPositions:[] };
      CurrentSkin.headDiy = Object.assign({}, defaults, loaded.headDiy || {});
      // 同步 UI 控件
      if ($('headSizeSlider')) $('headSizeSlider').value = CurrentSkin.headDiy.size;
      if ($('headSizeVal')) $('headSizeVal').textContent = CurrentSkin.headDiy.size;
      if ($('eyeSizeSlider')) $('eyeSizeSlider').value = CurrentSkin.headDiy.eyeSize;
      if ($('eyeSizeVal')) $('eyeSizeVal').textContent = CurrentSkin.headDiy.eyeSize;
      if ($('eyeColorPicker')) $('eyeColorPicker').value = CurrentSkin.headDiy.eyeColor;
      if ($('mouthColorPicker')) $('mouthColorPicker').value = CurrentSkin.headDiy.mouthColor;
      if ($('headColor1Picker')) $('headColor1Picker').value = CurrentSkin.headDiy.headColor1;
      if ($('headColor2Picker')) $('headColor2Picker').value = CurrentSkin.headDiy.headColor2;
      if ($('bodyColor1')) $('bodyColor1').value = CurrentSkin.bodyColor1;
      if ($('bodyColor2')) $('bodyColor2').value = CurrentSkin.bodyColor2;
      renderPresetCharacters(); renderPresetColors(); renderAllPreviews();
      alert('已加载皮肤: ' + sk.name);
    });
    grid.appendChild(card);
  });
}

function bindCustomizeTabs() {
  document.querySelectorAll('.c-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.c-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.c-tab-content').forEach(c => c.classList.add('hidden'));
      const t = btn.dataset.ctab;
      const target = document.querySelector(`.c-tab-content[data-ctab="${t}"]`);
      if (target) target.classList.remove('hidden');
      if (t === 'skins') renderSavedSkins();
    });
  });
  const customBtn = $('customBtn');
  if (customBtn) customBtn.addEventListener('click', () => {
    const cs = $('characterSelect'); if (!cs) return;
    cs.classList.toggle('visible');
    cs.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function initAdventure() {
  Adventure.canvas = $('gameCanvas');
  Adventure.ctx = Adventure.canvas ? Adventure.canvas.getContext('2d') : null;
  if (!Adventure.canvas) return;
  Adventure.canvas.width = GRID_SIZE * TILE_COUNT;
  Adventure.canvas.height = GRID_SIZE * TILE_COUNT;
}

function resetAdventure() {
  Adventure.snake = [{x:12,y:12},{x:11,y:12},{x:10,y:12}];
  Adventure.direction = { x:1, y:0 };
  Adventure.nextDirection = { x:1, y:0 };
  Adventure.score = 0;
  Adventure.lives = 10; Adventure.maxLives = 10;
  Adventure.ammo = 5;
  Adventure.foods = [];
  Adventure.obstacles = [];
  Adventure.powerups = [];
  Adventure.lasers = [];
  Adventure.explosions = [];
  Adventure.particles = [];
  Adventure.gameOver = false;
  Adventure.paused = false;
  spawnLevelItems();
  updateAdventureHUD();
}

function spawnLevelItems() {
  Adventure.foods = [];
  Adventure.obstacles = [];
  Adventure.powerups = [];
  const foodCount = 3 + Adventure.level;
  for (let i = 0; i < foodCount; i++) spawnFood('food_normal');
  const obsCount = Math.min(18, 2 + Adventure.level * 2);
  for (let i = 0; i < obsCount; i++) spawnObstacle();
  spawnPowerup('food_grow'); spawnPowerup('food_shrink');
  spawnPowerup('health'); spawnPowerup('weapon');
}

function randomEmptyTile() {
  const occ = new Set();
  Adventure.snake.forEach(s => occ.add(s.x+','+s.y));
  Adventure.foods.forEach(f => occ.add(f.x+','+f.y));
  Adventure.obstacles.forEach(o => occ.add(o.x+','+o.y));
  Adventure.powerups.forEach(p => occ.add(p.x+','+p.y));
  let tries = 0, x, y;
  do {
    x = Math.floor(Math.random() * TILE_COUNT);
    y = Math.floor(Math.random() * TILE_COUNT);
    tries++;
  } while (occ.has(x+','+y) && tries < 200);
  return { x, y };
}

function spawnFood(type = 'food_normal') {
  const p = randomEmptyTile();
  Adventure.foods.push({ type, x: p.x, y: p.y });
}
function spawnObstacle() {
  const p = randomEmptyTile();
  Adventure.obstacles.push({ x: p.x, y: p.y, hp: 1 });
}
function spawnPowerup(type) {
  const p = randomEmptyTile();
  Adventure.powerups.push({ type, x: p.x, y: p.y });
}

function shootAdventure() {
  if (Adventure.ammo <= 0 || Adventure.paused || Adventure.gameOver) return;
  Adventure.ammo--;
  const head = Adventure.snake[0];
  const dx = Adventure.direction.x, dy = Adventure.direction.y;
  const startX = head.x, startY = head.y;
  let endX = startX, endY = startY;
  let hitObstacle = null;
  for (let i = 1; i <= WEAPON_RANGE; i++) {
    const nx = startX + dx*i, ny = startY + dy*i;
    if (nx < 0 || nx >= TILE_COUNT || ny < 0 || ny >= TILE_COUNT) break;
    endX = nx; endY = ny;
    const obs = Adventure.obstacles.findIndex(o => o.x === nx && o.y === ny);
    if (obs >= 0) { hitObstacle = obs; break; }
  }
  Adventure.lasers.push({
    startX, startY, endX, endY,
    dx, dy,
    life: LASER_LIFE,
    traveled: 0,
    speed: LASER_SPEED
  });
  if (hitObstacle !== null) {
    const o = Adventure.obstacles[hitObstacle];
    Adventure.explosions.push(createExplosion(o.x, o.y));
    Adventure.obstacles.splice(hitObstacle, 1);
  }
  updateAdventureHUD();
}

function updateAdventureStep() {
  if (Adventure.paused || Adventure.gameOver) return;
  Adventure.direction = Adventure.nextDirection;
  const head = Adventure.snake[0];
  const newHead = { x: head.x + Adventure.direction.x, y: head.y + Adventure.direction.y };

  if (newHead.x < 0 || newHead.x >= TILE_COUNT || newHead.y < 0 || newHead.y >= TILE_COUNT) {
    damageAdventure(1, '撞墙了！');
    return;
  }
  if (Adventure.snake.some((s, i) => i > 0 && s.x === newHead.x && s.y === newHead.y)) {
    damageAdventure(1, '咬到自己了！');
    return;
  }
  const obsIdx = Adventure.obstacles.findIndex(o => o.x === newHead.x && o.y === newHead.y);
  if (obsIdx >= 0) {
    Adventure.explosions.push(createExplosion(newHead.x, newHead.y, ['#81ecec','#00cec9','#0984e3']));
    Adventure.obstacles.splice(obsIdx, 1);
    damageAdventure(1, '撞到晶石路障！');
    return;
  }

  Adventure.snake.unshift(newHead);

  const fi = Adventure.foods.findIndex(f => f.x === newHead.x && f.y === newHead.y);
  if (fi >= 0) {
    Adventure.score += 10;
    Adventure.foods.splice(fi,1);
    spawnFood('food_normal');
    if (Adventure.score % 100 === 0 && Adventure.score > 0) {
      levelUp();
    }
  } else {
    const pi = Adventure.powerups.findIndex(p => p.x === newHead.x && p.y === newHead.y);
    if (pi >= 0) {
      const pu = Adventure.powerups[pi];
      handlePowerup(pu.type, newHead);
      Adventure.powerups.splice(pi,1);
      if (Math.random() < 0.7) {
        const types = ['food_grow','food_shrink','health','weapon','shield'];
        spawnPowerup(types[Math.floor(Math.random()*types.length)]);
      }
    } else {
      Adventure.snake.pop();
    }
  }

  updateAdventureHUD();
}

function handlePowerup(type, head) {
  switch (type) {
    case 'food_grow':
      Adventure.snake.push({...Adventure.snake[Adventure.snake.length-1]});
      Adventure.snake.push({...Adventure.snake[Adventure.snake.length-1]});
      Adventure.score += 5;
      Adventure.explosions.push(createExplosion(head.x, head.y, ['#a29bfe','#6c5ce7']));
      break;
    case 'food_shrink':
      if (Adventure.snake.length > 3) Adventure.snake.pop();
      Adventure.score += 3;
      Adventure.explosions.push(createExplosion(head.x, head.y, ['#ff6b9d','#c44569']));
      break;
    case 'health':
      Adventure.lives = Math.min(Adventure.maxLives, Adventure.lives + 1);
      Adventure.explosions.push(createExplosion(head.x, head.y, ['#fd79a8','#ffeaa7']));
      break;
    case 'weapon':
      Adventure.ammo += 5;
      Adventure.explosions.push(createExplosion(head.x, head.y, ['#74b9ff','#fdcb6e']));
      break;
    case 'shield':
      Adventure.lives = Math.min(Adventure.maxLives, Adventure.lives + 1);
      Adventure.explosions.push(createExplosion(head.x, head.y, ['#a29bfe','#ffeaa7']));
      break;
  }
}

function damageAdventure(dmg, reason) {
  Adventure.lives -= dmg;
  Adventure.explosions.push(createExplosion(Adventure.snake[0].x, Adventure.snake[0].y, ['#ff6b6b','#ee5253','#ff9ff3']));
  if (Adventure.lives <= 0) {
    endAdventureGame();
  } else {
    Adventure.snake = [{x:12,y:12},{x:11,y:12},{x:10,y:12}];
    Adventure.direction = {x:1,y:0};
    Adventure.nextDirection = {x:1,y:0};
  }
  updateAdventureHUD();
}

function levelUp() {
  Adventure.level++;
  Adventure.highestLevel = Math.max(Adventure.highestLevel, Adventure.level);
  Adventure.paused = true;
  const ov = $('levelUp'); if (ov) ov.classList.remove('hidden');
  if ($('newLevel')) $('newLevel').textContent = Adventure.level;
  clearInterval(Adventure.loopTimer);
  spawnLevelItems();
}

function endAdventureGame() {
  Adventure.gameOver = true;
  Adventure.running = false;
  clearInterval(Adventure.loopTimer);
  if (AuthState.user) {
    apiCall('/api/save-score', {
      method: 'POST',
      body: JSON.stringify({
        userId: AuthState.user.id, username: AuthState.user.username,
        score: Adventure.score, level: Adventure.level
      })
    });
    AuthState.user.highScore = Math.max(AuthState.user.highScore || 0, Adventure.score);
    AuthState.user.highLevel = Math.max(AuthState.user.highLevel || 0, Adventure.level);
  }
  Adventure.totalScore = Math.max(Adventure.totalScore, Adventure.score);
  Adventure.highestLevel = Math.max(Adventure.highestLevel, Adventure.level);
  if ($('finalScore')) $('finalScore').textContent = Adventure.score;
  if ($('finalLevel')) $('finalLevel').textContent = Adventure.level;
  if ($('finalRank')) $('finalRank').textContent = getRankTitle(Adventure.score);
  const go = $('gameOver'); if (go) go.classList.remove('hidden');
}

function getRankTitle(score) {
  if (score >= 500) return '传说贪吃蛇';
  if (score >= 300) return '大师觅食者';
  if (score >= 200) return '高级探险家';
  if (score >= 100) return '熟练挑战者';
  if (score >= 50) return '初级冒险者';
  return '新手探险家';
}

function updateAdventureHUD() {
  if ($('score')) $('score').textContent = Adventure.score;
  if ($('level')) $('level').textContent = Adventure.level;
  if ($('totalScore')) $('totalScore').textContent = Math.max(Adventure.totalScore, Adventure.score);
  if ($('highestLevel')) $('highestLevel').textContent = Adventure.highestLevel;
  if ($('rankTitle')) $('rankTitle').textContent = getRankTitle(Adventure.score);
  if ($('currentLevelDisplay')) $('currentLevelDisplay').textContent = `第 ${Adventure.level} 关`;
  const h = $('health'); if (h) { const pct = Math.max(0, Adventure.lives/Adventure.maxLives*100); h.style.width = pct + '%'; }
  if ($('healthText')) $('healthText').textContent = Math.max(0, Adventure.lives);
  if ($('weaponAmmo')) $('weaponAmmo').textContent = Adventure.ammo;
  if ($('lastLevel')) $('lastLevel').textContent = Adventure.highestLevel;
  if ($('highScore')) $('highScore').textContent = Math.max(Adventure.totalScore, Adventure.score);
}

function renderAdventureFrame() {
  if (!Adventure.ctx) return;
  const ctx = Adventure.ctx;
  const W = Adventure.canvas.width, H = Adventure.canvas.height;
  ctx.fillStyle = '#1a1535';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(102,126,234,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= TILE_COUNT; i++) {
    ctx.beginPath(); ctx.moveTo(i*GRID_SIZE, 0); ctx.lineTo(i*GRID_SIZE, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*GRID_SIZE); ctx.lineTo(W, i*GRID_SIZE); ctx.stroke();
  }
  Adventure.obstacles.forEach(o => drawItem(ctx, o.x*GRID_SIZE, o.y*GRID_SIZE, 'obstacle'));
  Adventure.foods.forEach(f => drawItem(ctx, f.x*GRID_SIZE, f.y*GRID_SIZE, f.type));
  Adventure.powerups.forEach(p => drawItem(ctx, p.x*GRID_SIZE, p.y*GRID_SIZE, p.type));
  for (let i = Adventure.snake.length-1; i >= 0; i--) {
    const s = Adventure.snake[i];
    if (i === 0) drawSnakeHead(ctx, s.x*GRID_SIZE, s.y*GRID_SIZE, CurrentSkin, Adventure.direction);
    else drawSnakeBody(ctx, s.x*GRID_SIZE, s.y*GRID_SIZE, s.x, s.y, i, Adventure.snake.length, CurrentSkin);
  }
  Adventure.lasers.forEach(l => drawLaser(ctx, l));
  Adventure.lasers = Adventure.lasers.filter(l => {
    l.life -= 1; return l.life > 0;
  });
  Adventure.explosions.forEach(e => drawExplosion(ctx, e));
  Adventure.explosions.forEach(e => updateExplosion(e));
  Adventure.explosions = Adventure.explosions.filter(e => e.life > 0);
}

function startAdventureLoop() {
  clearInterval(Adventure.loopTimer);
  const interval = Math.max(60, Adventure.speedBase - (Adventure.level-1)*12);
  Adventure.loopTimer = setInterval(() => {
    updateAdventureStep();
  }, interval);
  function render() {
    if (!Adventure.running && !Adventure.gameOver && !Adventure.paused) return;
    renderAdventureFrame();
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function startAdventureGame() {
  if (!Adventure.canvas) initAdventure();
  resetAdventure();
  Adventure.running = true;
  const ov = $('gameStartOverlay'); if (ov) ov.classList.remove('hidden');
  renderInstructionIcons();
}

function continueAfterInstructions() {
  if ($('gameStartOverlay')) $('gameStartOverlay').classList.add('hidden');
  startAdventureLoop();
}

function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (GameMode === 'adventure' && Adventure.running) {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (Adventure.direction.y !== 1) Adventure.nextDirection = {x:0,y:-1}; break;
        case 'ArrowDown': case 's': case 'S':
          if (Adventure.direction.y !== -1) Adventure.nextDirection = {x:0,y:1}; break;
        case 'ArrowLeft': case 'a': case 'A':
          if (Adventure.direction.x !== 1) Adventure.nextDirection = {x:-1,y:0}; break;
        case 'ArrowRight': case 'd': case 'D':
          if (Adventure.direction.x !== -1) Adventure.nextDirection = {x:1,y:0}; break;
        case ' ':
          e.preventDefault();
          if (Adventure.gameOver) return;
          Adventure.paused = !Adventure.paused;
          alert(Adventure.paused ? '已暂停（按空格继续）' : '继续');
          break;
        case 'j': case 'J':
          shootAdventure(); break;
        case 'Escape':
          backToMenu(); break;
      }
    } else if (GameMode === 'battle' && Battle.running) {
      const me = getMyBattlePlayer();
      if (!me) return;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': if (me.direction.y !== 1) me.nextDirection = {x:0,y:-1}; break;
        case 'ArrowDown': case 's': case 'S': if (me.direction.y !== -1) me.nextDirection = {x:0,y:1}; break;
        case 'ArrowLeft': case 'a': case 'A': if (me.direction.x !== 1) me.nextDirection = {x:-1,y:0}; break;
        case 'ArrowRight': case 'd': case 'D': if (me.direction.x !== -1) me.nextDirection = {x:1,y:0}; break;
        case 'j': case 'J': shootBattle(); break;
      }
    }
  });
}

function bindAdventureMobileControls() {
  const set = (dir) => {
    if (GameMode !== 'adventure' || !Adventure.running) return;
    if (dir.x !== 0 && Adventure.direction.x === -dir.x) return;
    if (dir.y !== 0 && Adventure.direction.y === -dir.y) return;
    Adventure.nextDirection = dir;
  };
  const addTouch = (id, dir) => {
    const el = $(id); if (!el) return;
    const handler = (e) => { e.preventDefault(); set(dir); };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('click', handler);
  };
  addTouch('aControlUp', {x:0,y:-1});
  addTouch('aControlDown', {x:0,y:1});
  addTouch('aControlLeft', {x:-1,y:0});
  addTouch('aControlRight', {x:1,y:0});
  addTouch('controlUp', {x:0,y:-1});
  addTouch('controlDown', {x:0,y:1});
  addTouch('controlLeft', {x:-1,y:0});
  addTouch('controlRight', {x:1,y:0});
  const s = $('aShootBtn'); if (s) s.addEventListener('click', () => shootAdventure());
  const s2 = $('shootBtn'); if (s2) s2.addEventListener('click', () => shootAdventure());
  const p = $('aPauseBtn'); if (p) p.addEventListener('click', () => {
    Adventure.paused = !Adventure.paused;
    alert(Adventure.paused ? '已暂停' : '继续');
  });
  const cv = $('gameCanvas');
  if (cv) bindSwipe(cv, set);
}

function bindBattleMobileControls() {
  const set = (dir) => {
    const me = getMyBattlePlayer();
    if (!me || !Battle.running) return;
    if (dir.x !== 0 && me.direction.x === -dir.x) return;
    if (dir.y !== 0 && me.direction.y === -dir.y) return;
    me.nextDirection = dir;
  };
  const addTouch = (id, dir) => {
    const el = $(id); if (!el) return;
    const handler = (e) => { e.preventDefault(); set(dir); };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('click', handler);
  };
  addTouch('bControlUp', {x:0,y:-1});
  addTouch('bControlDown', {x:0,y:1});
  addTouch('bControlLeft', {x:-1,y:0});
  addTouch('bControlRight', {x:1,y:0});
  const s = $('bShootBtn'); if (s) s.addEventListener('click', () => shootBattle());
  const cv = $('battleCanvas');
  if (cv) bindSwipe(cv, set);
}

function bindSwipe(el, setDir) {
  let sx = 0, sy = 0, active = false;
  el.addEventListener('touchstart', e => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; active = true;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const TH = 25;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir({ x: dx>0?1:-1, y:0 });
    else setDir({ x:0, y: dy>0?1:-1 });
    sx = t.clientX; sy = t.clientY;
  }, { passive: true });
  el.addEventListener('touchend', () => { active = false; });
}

function getMyBattlePlayer() {
  if (!Battle.players || !Battle.myPlayerId) return null;
  return Battle.players.find(p => p.id === Battle.myPlayerId);
}
function shootBattle() {
}
function backToMenu() {
}

document.addEventListener('DOMContentLoaded', function() {
  initAdventure();

  renderPresetCharacters();
  renderPresetColors();
  renderEmojiQuickPicker();
  renderGradientPresets();
  bindBodyShapes();
  bindDiySliders();
  bindSkinSaveLoad();
  bindCustomizeTabs();
  renderAllPreviews();

  bindKeyboard();
  bindAdventureMobileControls();
  bindBattleMobileControls();

  const confirmBtn = $('confirmStartBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', continueAfterInstructions);

  const continueBtn = $('continueBtn');
  if (continueBtn) continueBtn.addEventListener('click', () => {
    $('levelUp').classList.add('hidden');
    Adventure.paused = false;
    startAdventureLoop();
  });

  const startBtn = $('startBtn');
  if (startBtn) startBtn.addEventListener('click', () => {
    startAdventureGame();
  });

  const pauseBtn = $('pauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', () => {
    if (Adventure.gameOver) return;
    Adventure.paused = !Adventure.paused;
    alert(Adventure.paused ? '已暂停' : '继续');
  });

  const restartBtn = $('restartBtn');
  if (restartBtn) restartBtn.addEventListener('click', () => {
    $('gameOver').classList.add('hidden');
    startAdventureGame();
  });

  setTimeout(renderInstructionIcons, 100);

  window.__partA_initialized = true;
  if (typeof window.__runPartB === 'function') window.__runPartB();
});

/* ===== Part B: 对战 / 排行 / 路由 / UI事件 ===== */
window.__runPartB = function () {

  function showScreen(id) {
    ['loginScreen','startScreen','battleLobbyScreen','battleRoomScreen','gameContainer'].forEach(s => {
      const el = $(s); if (el) el.classList.add('hidden');
    });
    const el = $(id); if (el) el.classList.remove('hidden');
    window.scrollTo(0,0);
  }

  function showUserInfoCard() {
    if (!AuthState.user) return;
    const u = AuthState.user;
    if ($('currentUsername')) $('currentUsername').textContent = u.username;
    if ($('userCrowns')) $('userCrowns').textContent = u.crowns || 0;
    if ($('userHighScore')) $('userHighScore').textContent = u.highScore || 0;
    if ($('userHighLevel')) $('userHighLevel').textContent = u.highLevel || 1;
    const loginContainer = document.querySelector('.login-container');
    if (loginContainer) loginContainer.classList.add('hidden');
    const userInfo = $('userInfo');
    if (userInfo) userInfo.classList.remove('hidden');
  }

  function stopAll() {
    clearInterval(Adventure.loopTimer);
    clearInterval(Battle.loopTimer);
    clearInterval(Battle.syncTimer);
    Adventure.running = false;
    Battle.running = false;
  }

  window.backToMenu = function () {
    stopAll();
    showScreen('startScreen');
  };

  // ===== 登录/注册按钮事件（匹配 HTML 实际 id） =====
  // Tab 切换：HTML 用 .tab-btn[data-tab]
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lf = $('loginForm'); const rf = $('registerForm');
      if (tab === 'login') {
        if (lf) lf.classList.remove('hidden');
        if (rf) rf.classList.add('hidden');
      } else {
        if (lf) lf.classList.add('hidden');
        if (rf) rf.classList.remove('hidden');
      }
    });
  });

  // 用户名实时查重
  let _usernameCheckTimer = null;
  const registerUsernameInput = $('registerUsername');
  if (registerUsernameInput) {
    registerUsernameInput.addEventListener('input', (e) => {
      const username = e.target.value.trim();
      clearTimeout(_usernameCheckTimer);
      const checkEl = $('usernameCheck');
      if (!checkEl) return;
      if (username.length < 2) {
        checkEl.textContent = '用户名至少2位';
        checkEl.className = 'username-check unavailable';
        return;
      }
      if (username.length > 12) {
        checkEl.textContent = '用户名最多12位';
        checkEl.className = 'username-check unavailable';
        return;
      }
      _usernameCheckTimer = setTimeout(async () => {
        const r = await apiCall('/api/check-username', {
          method: 'POST', body: JSON.stringify({ username })
        });
        if (r.success && r.available) {
          checkEl.textContent = '✓ 该用户名可用';
          checkEl.className = 'username-check available';
        } else {
          checkEl.textContent = '✗ ' + (r.message || '已被占用');
          checkEl.className = 'username-check unavailable';
        }
      }, 500);
    });
  }

  // 登录：HTML 用 loginBtn，API 是 /api/login，需 phone + password
  const loginBtn = $('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', async () => {
    const phone = $('loginPhone').value.trim();
    const password = $('loginPassword').value;
    if (!phone || !password) { alert('请填写手机号和密码'); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { alert('请输入正确的11位手机号'); return; }
    loginBtn.disabled = true; loginBtn.textContent = '登录中...';
    const r = await apiCall('/api/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    loginBtn.disabled = false; loginBtn.textContent = '登录';
    if (r.success) {
      AuthState.user = r.user;
      AuthState.isGuest = false;
      showUserInfoCard();
      showScreen('startScreen');
    } else {
      alert(r.message || '登录失败');
    }
  });

  // 注册：HTML 用 registerBtn，API 是 /api/register，需 phone + username + password
  const registerBtn = $('registerBtn');
  if (registerBtn) registerBtn.addEventListener('click', async () => {
    const phone = $('registerPhone').value.trim();
    const username = $('registerUsername').value.trim();
    const password = $('registerPassword').value;
    const confirmPassword = $('registerConfirmPassword').value;

    if (!/^1[3-9]\d{9}$/.test(phone)) { alert('请输入正确的11位手机号'); return; }
    if (username.length < 2 || username.length > 12) { alert('用户名长度应在2-12位之间'); return; }
    if (password.length < 6) { alert('密码至少6位'); return; }
    if (password !== confirmPassword) { alert('两次密码不一致'); return; }

    registerBtn.disabled = true; registerBtn.textContent = '注册中...';
    const r = await apiCall('/api/register', {
      method: 'POST',
      body: JSON.stringify({ phone, username, password })
    });
    registerBtn.disabled = false; registerBtn.textContent = '注册';
    if (r.success) {
      alert('注册成功！请登录');
      // 自动填充手机号并切到登录 Tab
      $('loginPhone').value = phone;
      $('loginPassword').focus();
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelector('.tab-btn[data-tab="login"]').classList.add('active');
      $('loginForm').classList.remove('hidden');
      $('registerForm').classList.add('hidden');
      // 清空注册表单
      $('registerPhone').value = '';
      $('registerUsername').value = '';
      $('registerPassword').value = '';
      $('registerConfirmPassword').value = '';
      const checkEl = $('usernameCheck'); if (checkEl) checkEl.textContent = '';
    } else {
      alert(r.message || '注册失败');
    }
  });

  // 游客模式
  const guestBtn = $('guestBtn');
  if (guestBtn) guestBtn.addEventListener('click', () => {
    AuthState.isGuest = true;
    AuthState.user = null;
    showScreen('startScreen');
  });

  if ($('leaderboardBtnLogin')) $('leaderboardBtnLogin').addEventListener('click', () => {
    $('leaderboardOverlay').classList.remove('hidden');
    currentLbTab = 'adventure';
    document.querySelectorAll('.lb-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.lb === 'adventure'));
    loadLeaderboard('adventure');
  });

  if ($('profileBtn')) $('profileBtn').addEventListener('click', async () => {
    if (!AuthState.user) { alert('登录后可查看个人中心'); return; }
    $('profileOverlay').classList.remove('hidden');
    const r = await apiCall('/api/user-stats/' + AuthState.user.id);
    if ($('profileUsername')) $('profileUsername').textContent = AuthState.user.username;
    if (r.success) {
      const s = r.stats;
      if ($('pCrowns')) $('pCrowns').textContent = s.crowns||0;
      if ($('pWins')) $('pWins').textContent = s.wins||0;
      if ($('pTotalBattles')) $('pTotalBattles').textContent = s.totalBattles||0;
      if ($('pHighScore')) $('pHighScore').textContent = s.highScore||0;
      if ($('pHighLevel')) $('pHighLevel').textContent = s.highLevel||1;
      const rate = s.totalBattles>0 ? Math.round(s.wins*100/s.totalBattles) : 0;
      if ($('pWinRate')) $('pWinRate').textContent = rate + '%';
    }
    renderProfileAvatar();
  });
  if ($('closeProfileBtn')) $('closeProfileBtn').addEventListener('click', () => $('profileOverlay').classList.add('hidden'));

  const logoutBtn = $('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    AuthState.user = null;
    AuthState.isGuest = false;
    const loginContainer = document.querySelector('.login-container');
    if (loginContainer) loginContainer.classList.remove('hidden');
    const userInfo = $('userInfo');
    if (userInfo) userInfo.classList.add('hidden');
    showScreen('loginScreen');
  });

  // ===== 设备模式切换 =====
  document.querySelectorAll('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      DeviceMode = btn.dataset.device;
      document.body.dataset.device = DeviceMode;
      const show = DeviceMode === 'mobile';
      document.querySelectorAll('.mobile-controls').forEach(mc => {
        if (show) mc.classList.add('show-on-mobile');
        else mc.classList.remove('show-on-mobile');
      });
    });
  });

  // ===== 主大厅按钮 =====
  document.querySelectorAll('.mode-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === 'adventure') {
        GameMode = 'adventure';
        showScreen('gameContainer');
        startAdventureGame();
      } else if (mode === 'battle') {
        GameMode = 'battle';
        showScreen('battleLobbyScreen');
        loadFriendsAndInvites();
      }
    });
  });

  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('mode-play-btn')) return;
      const mode = card.dataset.mode;
      if (mode === 'adventure') {
        GameMode = 'adventure';
        showScreen('gameContainer');
        startAdventureGame();
      } else if (mode === 'battle') {
        GameMode = 'battle';
        showScreen('battleLobbyScreen');
        loadFriendsAndInvites();
      }
    });
  });

  if ($('startBtn')) $('startBtn').addEventListener('click', startAdventureGame);
  if ($('pauseBtn')) $('pauseBtn').addEventListener('click', () => {
    if (!Adventure.running) return;
    Adventure.paused = !Adventure.paused;
    $('pauseBtn').textContent = Adventure.paused ? '继续' : '暂停';
  });
  if ($('restartBtn')) $('restartBtn').addEventListener('click', () => {
    $('gameOver').classList.add('hidden');
    startAdventureGame();
  });
  if ($('continueBtn')) $('continueBtn').addEventListener('click', () => {
    $('levelUp').classList.add('hidden');
    Adventure.paused = false;
    startAdventureLoop();
  });
  if ($('backToMenuBtn')) $('backToMenuBtn').addEventListener('click', () => { stopAll(); backToMenu(); });
  if ($('backToMenuFromGameOverBtn')) $('backToMenuFromGameOverBtn').addEventListener('click', () => { $('gameOver').classList.add('hidden'); stopAll(); backToMenu(); });
  if ($('backToMenuFromLevelUpBtn')) $('backToMenuFromLevelUpBtn').addEventListener('click', () => { $('levelUp').classList.add('hidden'); stopAll(); backToMenu(); });
  if ($('confirmStartBtn')) $('confirmStartBtn').addEventListener('click', continueAfterInstructions);

  if ($('prevLevel')) $('prevLevel').addEventListener('click', () => {
    if (Adventure.level > 1) { Adventure.level--; updateAdventureHUD(); }
  });
  if ($('nextLevel')) $('nextLevel').addEventListener('click', () => {
    const maxLvl = Math.max(1, Adventure.highestLevel || 1);
    if (Adventure.level < maxLvl) { Adventure.level++; updateAdventureHUD(); }
    else { alert('先闯关解锁更高关卡吧！'); }
  });

  // ===== 双排行榜 =====
  let currentLbTab = 'adventure';
  document.querySelectorAll('.lb-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLbTab = btn.dataset.lb;
      loadLeaderboard(currentLbTab);
    });
  });

  async function loadLeaderboard(type) {
    const r = await apiCall('/api/leaderboard/' + type);
    const c = $('leaderboardContainer');
    if (!r.success || !r.leaderboard || r.leaderboard.length === 0) {
      if (c) c.innerHTML = '<div class="leaderboard-empty">暂无数据，快去玩一局吧！</div>';
      return;
    }
    if (c) c.innerHTML = r.leaderboard.map((it, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
      if (type === 'adventure') {
        return `<div class="leaderboard-item ${i<3?`top-${i+1}`:''}">
          <div class="leaderboard-rank">${medal}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${escapeHtml(it.username)}</div>
            <div class="leaderboard-stats">关卡 ${it.level}</div>
          </div>
          <div class="leaderboard-score">${it.score}</div>
        </div>`;
      } else {
        return `<div class="leaderboard-item ${i<3?`top-${i+1}`:''}">
          <div class="leaderboard-rank">${medal}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${escapeHtml(it.username)}</div>
            <div class="leaderboard-stats">胜 ${it.wins||0} · 总 ${it.totalBattles||0}</div>
          </div>
          <div class="leaderboard-score">👑 ${it.crowns||0}</div>
        </div>`;
      }
    }).join('');
  }

  if ($('leaderboardBtn')) $('leaderboardBtn').addEventListener('click', () => {
    $('leaderboardOverlay').classList.remove('hidden');
    currentLbTab = 'adventure';
    document.querySelectorAll('.lb-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.lb === 'adventure'));
    loadLeaderboard('adventure');
  });
  if ($('closeLeaderboardBtn')) $('closeLeaderboardBtn').addEventListener('click', () => $('leaderboardOverlay').classList.add('hidden'));

  // ===== 对战大厅 =====
  if ($('backFromLobbyBtn')) $('backFromLobbyBtn').addEventListener('click', () => {
    clearMatchmaking();
    showScreen('startScreen');
  });

  if ($('quickMatchBtn')) $('quickMatchBtn').addEventListener('click', async () => {
    if (!AuthState.user) { alert('请先登录账号才能对战哦～'); return; }
    const btn = $('quickMatchBtn'); btn.disabled = true;
    btn.textContent = '匹配中...';
    if ($('matchStatusText')) $('matchStatusText').textContent = '正在寻找对手...';
    const r = await apiCall('/api/matchmaking/join', {
      method: 'POST',
      body: JSON.stringify({ userId: AuthState.user.id, username: AuthState.user.username, skinData: CurrentSkin })
    });
    if (r.success && r.matched) {
      if ($('matchStatusText')) $('matchStatusText').textContent = '匹配成功！进入房间...';
      setTimeout(() => joinRoomDirect(r.roomCode), 500);
    } else {
      pollMatchmaking();
    }
    btn.disabled = false; btn.textContent = '快速匹配';
  });

  async function pollMatchmaking() {
    let polls = 0;
    const timer = setInterval(async () => {
      polls++;
      if (polls > 30) { clearInterval(timer); if ($('matchStatusText')) $('matchStatusText').textContent = '暂无对手，稍后再试'; return; }
      const r = await apiCall('/api/matchmaking/join', {
        method: 'POST',
        body: JSON.stringify({ userId: AuthState.user.id, username: AuthState.user.username, skinData: CurrentSkin })
      });
      if (r.success && r.matched) {
        clearInterval(timer);
        if ($('matchStatusText')) $('matchStatusText').textContent = '匹配成功！';
        setTimeout(() => joinRoomDirect(r.roomCode), 500);
      } else {
        if ($('matchStatusText')) $('matchStatusText').textContent = `排队中... 你的位置 ${r.queuePosition || '?'}`;
      }
    }, 2000);
  }

  function clearMatchmaking() {
    if (AuthState.user) apiCall('/api/matchmaking/leave', { method: 'POST', body: JSON.stringify({ userId: AuthState.user.id }) });
  }

  if ($('createRoomBtn')) $('createRoomBtn').addEventListener('click', async () => {
    if (!AuthState.user) { alert('请先登录账号才能创建房间哦～'); return; }
    const max = parseInt($('maxPlayersSel').value) || 10;
    const r = await apiCall('/api/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ userId: AuthState.user.id, username: AuthState.user.username, maxPlayers: max, skinData: CurrentSkin })
    });
    if (r.success) enterRoom(r.room);
    else alert(r.message);
  });

  if ($('joinRoomBtn')) $('joinRoomBtn').addEventListener('click', () => {
    const code = $('roomCodeInput').value.trim().toUpperCase();
    if (!code || code.length < 4) { alert('请输入有效的房间号'); return; }
    joinRoomDirect(code);
  });

  async function joinRoomDirect(code) {
    if (!AuthState.user) { alert('请先登录账号'); return; }
    const r = await apiCall('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code, userId: AuthState.user.id, username: AuthState.user.username, skinData: CurrentSkin })
    });
    if (r.success) enterRoom(r.room);
    else alert(r.message);
  }

  function enterRoom(room) {
    Battle.roomCode = room.code;
    Battle.room = room;
    Battle.myPlayerId = AuthState.user.id;
    showScreen('battleRoomScreen');
    if ($('roomCodeDisplay')) $('roomCodeDisplay').textContent = room.code;
    if ($('shareRoomCodeText')) $('shareRoomCodeText').textContent = room.code;
    renderRoomLobby(room);
    startRoomPolling();
  }

  function startRoomPolling() {
    clearInterval(Battle.syncTimer);
    Battle.syncTimer = setInterval(async () => {
      if (!Battle.roomCode) return;
      const r = await apiCall('/api/rooms/' + Battle.roomCode);
      if (!r.success) return;
      const room = r.room;
      Battle.room = room;
      if (room.status === 'lobby') {
        renderRoomLobby(room);
      } else if (room.status === 'playing') {
        if (!Battle.running) startBattleGame(room);
        Battle.players = room.players;
        Battle.items = room.items || [];
        updateBattleHUD();
      } else if (room.status === 'finished') {
        endBattleGame(room);
        clearInterval(Battle.syncTimer);
      }
    }, 800);
  }

  function renderRoomLobby(room) {
    if ($('roomLobbyContent')) $('roomLobbyContent').classList.remove('hidden');
    if ($('battleGameContent')) $('battleGameContent').classList.add('hidden');
    Battle.players = room.players;
    const grid = $('roomPlayersLobby'); if (!grid) return;
    let html = '';
    for (let i = 0; i < room.maxPlayers; i++) {
      const p = room.players[i];
      if (!p) {
        html += `<div class="lobby-player-card empty-slot"><div style="font-size:48px;opacity:0.4;">➕</div><div>等待玩家...</div></div>`;
      } else {
        const isMe = p.id === (AuthState.user && AuthState.user.id);
        const isHost = p.id === room.hostId;
        const ready = p.ready ? 'ready' : 'not-ready';
        html += `<div class="lobby-player-card ${isMe?'me':''}">
          <div class="player-avatar-sm">
            <canvas width="64" height="64" data-pid="${p.id}"></canvas>
          </div>
          <div class="player-name-row">
            ${isHost ? '<span class="host-badge">👑</span>' : ''}
            <strong>${escapeHtml(p.username)}</strong>
            ${isMe ? '<span style="font-size:12px;color:#667eea;">(我)</span>' : ''}
          </div>
          <div class="ready-indicator ${ready}">${p.ready ? '已准备' : '未准备'}</div>
        </div>`;
      }
    }
    grid.innerHTML = html;
    setTimeout(() => {
      room.players.forEach(p => {
        const cv = grid.querySelector(`canvas[data-pid="${p.id}"]`);
        if (!cv) return;
        const c = cv.getContext('2d');
        const s = p.skinData || CurrentSkin;
        c.save(); c.scale(64/GRID_SIZE, 64/GRID_SIZE);
        drawSnakeHead(c, 0, 0, s, { x:1, y:0 });
        c.restore();
      });
    }, 50);
    const startBtn = $('startBattleBtn');
    if (startBtn) startBtn.style.display = (AuthState.user && AuthState.user.id === room.hostId) ? '' : 'none';
  }

  if ($('roomReadyBtn')) $('roomReadyBtn').addEventListener('click', async () => {
    const me = Battle.players.find(p => p.id === Battle.myPlayerId);
    if (!me) return;
    const r = await apiCall('/api/rooms/ready', {
      method: 'POST',
      body: JSON.stringify({ code: Battle.roomCode, userId: Battle.myPlayerId, ready: !me.ready })
    });
    if (r.success) renderRoomLobby(r.room);
  });

  if ($('startBattleBtn')) $('startBattleBtn').addEventListener('click', async () => {
    const r = await apiCall('/api/rooms/start', {
      method: 'POST',
      body: JSON.stringify({ code: Battle.roomCode, userId: Battle.myPlayerId })
    });
    if (!r.success) alert(r.message);
  });

  if ($('copyRoomBtn')) $('copyRoomBtn').addEventListener('click', () => {
    const code = Battle.roomCode;
    const link = `${location.origin}${location.pathname}?room=${code}`;
    const text = `🐍 萌蛇大觅食 邀请你加入对战房间！\n房间号：${code}\n链接：${link}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('邀请链接已复制！快发给好友吧 📨\n\n' + text));
    } else {
      prompt('复制以下邀请：', text);
    }
  });

  if ($('leaveRoomBtn')) $('leaveRoomBtn').addEventListener('click', async () => {
    if (!confirm('确定离开房间？')) return;
    await apiCall('/api/rooms/leave', {
      method: 'POST', body: JSON.stringify({ code: Battle.roomCode, userId: Battle.myPlayerId })
    });
    clearInterval(Battle.syncTimer);
    Battle.roomCode = null; Battle.room = null; Battle.running = false;
    showScreen('battleLobbyScreen');
  });

  if ($('battleExitBtn')) $('battleExitBtn').addEventListener('click', async () => {
    if (!confirm('确定退出战斗？会判定为战败哦')) return;
    await apiCall('/api/rooms/leave', {
      method: 'POST', body: JSON.stringify({ code: Battle.roomCode, userId: Battle.myPlayerId })
    });
    clearInterval(Battle.syncTimer); clearInterval(Battle.loopTimer);
    Battle.running = false;
    showScreen('battleLobbyScreen');
  });
  if ($('battleBackBtn')) $('battleBackBtn').addEventListener('click', () => {
    if ($('battleResult')) $('battleResult').classList.add('hidden');
    stopAll();
    showScreen('battleLobbyScreen');
  });

  // ===== 好友系统 =====
  async function loadFriendsAndInvites() {
    if (!AuthState.user) {
      if ($('friendsList')) $('friendsList').innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.8);padding:20px;">登录后可添加好友</p>';
      return;
    }
    const fr = await apiCall('/api/friends/' + AuthState.user.id);
    const inv = await apiCall('/api/friends/invites/' + AuthState.user.id);
    const list = $('friendsList');
    if (fr.success && fr.friends.length > 0) {
      if (list) list.innerHTML = fr.friends.map(f => `
        <div class="friend-item">
          <div class="friend-avatar">${(f.username||'U').slice(0,1)}</div>
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(f.username)} <span style="font-size:11px;color:#ffeaa7;">👑${f.crowns||0}</span></div>
            <div class="friend-status offline">离线</div>
          </div>
          <div class="friend-actions">
            <button class="btn btn-secondary invite-friend-btn" style="padding:6px 12px;font-size:12px;letter-spacing:0;" data-fid="${f.id}" data-fname="${escapeHtml(f.username)}">📩 邀请</button>
            <button class="btn btn-secondary remove-friend-btn" style="padding:6px 12px;font-size:12px;letter-spacing:0;" data-fid="${f.id}">❌</button>
          </div>
        </div>
      `).join('');
      if (list) {
        list.querySelectorAll('.invite-friend-btn').forEach(b => {
          b.addEventListener('click', () => {
            alert(`已发送邀请给 ${b.dataset.fname}！\n让好友进入"对战大厅"→ 加入房间，输入房间号：${Battle.roomCode || '（先创建房间）'}`);
          });
        });
        list.querySelectorAll('.remove-friend-btn').forEach(b => {
          b.addEventListener('click', async (e) => {
            if (!confirm('删除该好友？')) return;
            await apiCall('/api/friends/remove', {
              method: 'POST', body: JSON.stringify({ userId: AuthState.user.id, friendId: b.dataset.fid })
            });
            loadFriendsAndInvites();
          });
        });
      }
    } else {
      if (list) list.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.8);padding:20px;">暂无好友，搜索用户名添加吧～</p>';
    }
    const invSec = $('invitesSection');
    const invList = $('invitesList');
    if (inv.success && inv.invites && inv.invites.length > 0) {
      if (invSec) invSec.classList.remove('hidden');
      if (invList) invList.innerHTML = inv.invites.map(i => `
        <div class="invite-item">
          <div>📬 <strong>${escapeHtml(i.fromUsername)}</strong> 想加你为好友</div>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button class="btn btn-primary accept-btn" data-iid="${i.id}" style="padding:5px 14px;font-size:12px;letter-spacing:0;">接受</button>
            <button class="btn btn-secondary decline-btn" data-iid="${i.id}" style="padding:5px 14px;font-size:12px;letter-spacing:0;">拒绝</button>
          </div>
        </div>
      `).join('');
      if (invList) {
        invList.querySelectorAll('.accept-btn').forEach(b => b.addEventListener('click', () => handleInvite(b.dataset.iid, true)));
        invList.querySelectorAll('.decline-btn').forEach(b => b.addEventListener('click', () => handleInvite(b.dataset.iid, false)));
      }
      if ($('newInviteBadge')) $('newInviteBadge').classList.remove('hidden');
    } else {
      if (invSec) invSec.classList.add('hidden');
      if ($('newInviteBadge')) $('newInviteBadge').classList.add('hidden');
    }
  }

  async function handleInvite(inviteId, accept) {
    await apiCall('/api/friends/handle-invite', {
      method: 'POST', body: JSON.stringify({ inviteId, accept, userId: AuthState.user.id })
    });
    loadFriendsAndInvites();
  }

  if ($('searchFriendBtn')) $('searchFriendBtn').addEventListener('click', doSearchFriend);
  if ($('friendSearchInput')) $('friendSearchInput').addEventListener('keydown', e => { if (e.key==='Enter') doSearchFriend(); });

  async function doSearchFriend() {
    if (!AuthState.user) { alert('请先登录'); return; }
    const q = $('friendSearchInput').value.trim();
    if (!q) return;
    const r = await apiCall('/api/users/search?q=' + encodeURIComponent(q));
    const box = $('friendSearchResults');
    if (!r.success || !r.users || r.users.length === 0) {
      if (box) box.innerHTML = '<p style="padding:10px;text-align:center;color:#fff;">没找到相关用户</p>';
    } else {
      if (box) box.innerHTML = r.users.filter(u => u.id !== AuthState.user.id).map(u => `
        <div class="search-user-item">
          <span>${escapeHtml(u.username)} 👑${u.crowns||0}</span>
          <button class="btn btn-primary add-friend-btn" style="padding:5px 14px;font-size:12px;letter-spacing:0;" data-tuid="${u.id}">+ 好友</button>
        </div>
      `).join('');
      if (box) {
        box.querySelectorAll('.add-friend-btn').forEach(b => b.addEventListener('click', async () => {
          const r2 = await apiCall('/api/friends/invite', {
            method: 'POST', body: JSON.stringify({ fromUserId: AuthState.user.id, toUserId: b.dataset.tuid })
          });
          alert(r2.message);
        }));
      }
    }
    if (box) {
      box.classList.remove('hidden');
      setTimeout(() => { document.addEventListener('click', function h(e){ if (!box.contains(e.target)) { box.classList.add('hidden'); document.removeEventListener('click',h); } }); }, 0);
    }
  }

  if ($('friendInviteBtn')) $('friendInviteBtn').addEventListener('click', () => {
    alert('提示：\n\n📌 在搜索框输入好友用户名 → 点击🔍 → 添加好友\n📌 或创建房间后点"📋 复制邀请链接"发给好友');
  });

  // ===== 对战游戏核心 =====
  function startBattleGame(room) {
    if ($('roomLobbyContent')) $('roomLobbyContent').classList.add('hidden');
    if ($('battleGameContent')) $('battleGameContent').classList.remove('hidden');
    if ($('battleRoomCode')) $('battleRoomCode').textContent = room.code;
    if ($('battleTotalCount')) $('battleTotalCount').textContent = room.players.length;

    Battle.canvas = $('battleCanvas');
    Battle.ctx = Battle.canvas ? Battle.canvas.getContext('2d') : null;
    if (Battle.canvas) {
      Battle.canvas.width = GRID_SIZE * TILE_COUNT;
      Battle.canvas.height = GRID_SIZE * TILE_COUNT;
    }

    Battle.players = room.players.map(p => ({ ...p, alive: p.alive !== false }));
    Battle.items = room.items || [];
    Battle.bullets = [];
    Battle.myPlayerId = AuthState.user.id;
    Battle.running = true;
    Battle.totalCount = room.players.length;
    Battle.myAmmo = 5;
    updateBattleHUD();

    clearInterval(Battle.loopTimer);
    Battle.loopTimer = setInterval(battleStep, 180);

    function renderLoop() {
      if (!Battle.running) return;
      renderBattleFrame();
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
  }

  function battleStep() {
    const me = getMyBattlePlayer();
    if (!me || !me.alive) return;
    me.direction = me.nextDirection || me.direction;
    const hd = me.snake[0];
    const nh = { x: hd.x + me.direction.x, y: hd.y + me.direction.y };

    if (nh.x < 0 || nh.x >= TILE_COUNT || nh.y < 0 || nh.y >= TILE_COUNT) {
      battleDamage(me, 1);
      syncMyState();
      return;
    }
    if (me.snake.some((s, i) => i > 0 && s.x === nh.x && s.y === nh.y)) {
      battleDamage(me, 1); syncMyState(); return;
    }
    for (const other of Battle.players) {
      if (other.id === me.id || !other.alive) continue;
      if (other.snake && other.snake.some(s => s.x === nh.x && s.y === nh.y)) {
        battleDamage(me, 1); syncMyState(); return;
      }
    }

    me.snake.unshift(nh);

    const iIdx = Battle.items.findIndex(i => i.x === nh.x && i.y === nh.y);
    if (iIdx >= 0) {
      const it = Battle.items[iIdx];
      handleBattleItem(me, it);
      apiCall('/api/rooms/sync', {
        method: 'POST',
        body: JSON.stringify({ code: Battle.roomCode, userId: Battle.myPlayerId, playerState: extractPlayerState(me), consumedItemId: it.id })
      });
      Battle.items.splice(iIdx, 1);
    } else {
      me.snake.pop();
      syncMyState();
    }
    updateBattleHUD();
  }

  function extractPlayerState(p) {
    return { snake: p.snake, direction: p.direction, nextDirection: p.nextDirection, lives: p.lives, shield: p.shield, alive: p.alive, score: p.score };
  }

  function syncMyState() {
    const me = getMyBattlePlayer(); if (!me) return;
    apiCall('/api/rooms/sync', {
      method: 'POST',
      body: JSON.stringify({ code: Battle.roomCode, userId: Battle.myPlayerId, playerState: extractPlayerState(me) })
    });
  }

  function handleBattleItem(p, it) {
    switch (it.type) {
      case 'food_normal': p.score = (p.score||0) + 10; break;
      case 'food_grow':
        p.snake.push({...p.snake[p.snake.length-1]});
        p.snake.push({...p.snake[p.snake.length-1]});
        p.score = (p.score||0) + 5;
        break;
      case 'food_shrink':
        if (p.snake.length > 3) p.snake.pop();
        break;
      case 'health': p.lives = Math.min(99, (p.lives||3) + 1); break;
      case 'weapon':
        if (p.id === Battle.myPlayerId) Battle.myAmmo = (Battle.myAmmo||0) + 5;
        break;
      case 'shield':
        p.shield = (p.shield||0) + 1; break;
    }
    Battle.explosions = Battle.explosions || [];
    Battle.explosions.push(createExplosion(it.x, it.y));
  }

  function battleDamage(p, dmg) {
    if (!Battle.explosions) Battle.explosions = [];
    if (p.shield > 0) { p.shield -= 1; Battle.explosions.push(createExplosion(p.snake[0].x, p.snake[0].y, ['#a29bfe','#ffeaa7'])); return; }
    p.lives = (p.lives||3) - dmg;
    Battle.explosions.push(createExplosion(p.snake[0].x, p.snake[0].y, ['#ff6b6b','#ee5253']));
    if (p.lives <= 0) {
      p.alive = false;
      p.lives = 0;
    } else {
      p.snake = [{x: Math.floor(TILE_COUNT/2), y: Math.floor(TILE_COUNT/2)},{x:11,y:12},{x:10,y:12}];
      p.direction = { x:1, y:0 }; p.nextDirection = { x:1, y:0 };
    }
  }

  function shootBattle() {
    const me = getMyBattlePlayer();
    if (!me || !me.alive || !Battle.running) return;
    if ((Battle.myAmmo||0) <= 0) return;
    Battle.myAmmo--;
    const hd = me.snake[0]; const dx = me.direction.x, dy = me.direction.y;
    const startX = hd.x, startY = hd.y;
    let endX = startX, endY = startY;
    let hitPlayerId = null;
    for (let i = 1; i <= WEAPON_RANGE; i++) {
      const nx = startX + dx*i, ny = startY + dy*i;
      if (nx < 0 || nx >= TILE_COUNT || ny < 0 || ny >= TILE_COUNT) break;
      endX = nx; endY = ny;
      for (const op of Battle.players) {
        if (op.id === me.id || !op.alive) continue;
        if (op.snake && op.snake.some(s => s.x === nx && s.y === ny)) {
          hitPlayerId = op.id;
          break;
        }
      }
      if (hitPlayerId) break;
    }
    Battle.lasers = Battle.lasers || [];
    Battle.lasers.push({ startX, startY, endX, endY, dx, dy, life: LASER_LIFE, speed: LASER_SPEED });
    if (hitPlayerId) {
      apiCall('/api/rooms/shoot', {
        method: 'POST',
        body: JSON.stringify({ code: Battle.roomCode, fromUserId: me.id, toUserId: hitPlayerId, damage: 1 })
      }).then(r => {
        if (r && r.success) {
          const target = Battle.players.find(p => p.id === hitPlayerId);
          if (target) {
            target.lives = r.targetLives;
            target.alive = r.targetAlive;
            target.shield = r.targetShield;
          }
          if (r.shielded && Battle.explosions) {
            Battle.explosions.push(createExplosion(endX, endY, ['#a29bfe','#6c5ce7']));
          } else if (Battle.explosions) {
            Battle.explosions.push(createExplosion(endX, endY, ['#ff6b6b','#ffeaa7']));
          }
        }
      });
    }
    updateBattleHUD();
  }

  window.shootBattle = shootBattle;

  function updateBattleHUD() {
    const me = getMyBattlePlayer();
    if (me) {
      if ($('battleMyLives')) $('battleMyLives').textContent = me.lives || 0;
      if ($('battleMyShield')) $('battleMyShield').textContent = me.shield || 0;
      if ($('battleMyAmmo')) $('battleMyAmmo').textContent = Battle.myAmmo || 0;
      if ($('battleMyLen')) $('battleMyLen').textContent = me.snake ? me.snake.length : 0;
    }
    const alive = Battle.players.filter(p => p.alive !== false && (p.lives||0) > 0).length;
    if ($('battleAliveCount')) $('battleAliveCount').textContent = alive;
    Battle.aliveCount = alive;

    const list = $('battlePlayerList'); if (!list) return;
    list.innerHTML = Battle.players.map(p => {
      const isMe = p.id === Battle.myPlayerId;
      const alive = p.alive !== false && (p.lives||0) > 0;
      return `<div class="battle-player-item ${alive?'alive':'dead'} ${isMe?'me':''}">
        <canvas width="40" height="40" data-bid="${p.id}"></canvas>
        <div class="bp-info">
          <div class="bp-name">${escapeHtml(p.username)}${isMe?' (我)':''}</div>
          <div class="bp-stats">❤️${p.lives||0} 🛡${p.shield||0} 📏${p.snake?p.snake.length:0}</div>
        </div>
      </div>`;
    }).join('');
    setTimeout(() => {
      Battle.players.forEach(p => {
        const cv = list.querySelector(`canvas[data-bid="${p.id}"]`);
        if (!cv) return;
        const c = cv.getContext('2d');
        const s = p.skinData || CurrentSkin;
        c.save(); c.scale(40/GRID_SIZE, 40/GRID_SIZE);
        drawSnakeHead(c, 0, 0, s, { x:1, y:0 });
        c.restore();
      });
    }, 20);
  }

  function renderBattleFrame() {
    const ctx = Battle.ctx; if (!ctx) return;
    const W = Battle.canvas.width, H = Battle.canvas.height;
    ctx.fillStyle = '#0f0c24'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(240,147,251,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i <= TILE_COUNT; i++) {
      ctx.beginPath(); ctx.moveTo(i*GRID_SIZE,0); ctx.lineTo(i*GRID_SIZE,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*GRID_SIZE); ctx.lineTo(W,i*GRID_SIZE); ctx.stroke();
    }
    (Battle.items||[]).forEach(it => drawItem(ctx, it.x*GRID_SIZE, it.y*GRID_SIZE, it.type));
    [...Battle.players].reverse().forEach(p => {
      if (!p.alive && p.snake && (p.lives||0) <= 0) return;
      const skin = p.skinData || CurrentSkin;
      if (p.snake) {
        for (let i = p.snake.length-1; i >= 0; i--) {
          const s = p.snake[i];
          if (i === 0) drawSnakeHead(ctx, s.x*GRID_SIZE, s.y*GRID_SIZE, skin, p.direction || {x:1,y:0});
          else drawSnakeBody(ctx, s.x*GRID_SIZE, s.y*GRID_SIZE, s.x, s.y, i, p.snake.length, skin);
        }
        if ((p.shield||0) > 0 && p.snake.length > 0) {
          const hd = p.snake[0];
          const cx = hd.x*GRID_SIZE + GRID_SIZE/2;
          const cy = hd.y*GRID_SIZE + GRID_SIZE/2;
          ctx.save();
          ctx.strokeStyle = `rgba(162,155,254,${0.5 + Math.sin(Date.now()/200)*0.3})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cx, cy, GRID_SIZE*0.8, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        }
      }
    });
    (Battle.lasers||[]).forEach(l => drawLaser(ctx, l));
    Battle.lasers = (Battle.lasers||[]).filter(l => { l.life -= 1; return l.life > 0; });
    (Battle.explosions||[]).forEach(e => drawExplosion(ctx, e));
    (Battle.explosions||[]).forEach(e => updateExplosion(e));
    Battle.explosions = (Battle.explosions||[]).filter(e => e.life > 0);
  }

  function endBattleGame(room) {
    Battle.running = false;
    clearInterval(Battle.loopTimer);
    const win = room.winner === Battle.myPlayerId;
    const resEl = $('battleResult');
    const titleEl = $('battleResultTitle');
    const descEl = $('battleResultDesc');
    if (win) {
      if (titleEl) { titleEl.textContent = '🎉 胜利！你获得了 1 个 👑 皇冠！'; titleEl.className = 'win crown'; }
      if (descEl) descEl.textContent = '恭喜你在这场战斗中成为最后存活的玩家！荣誉已记录到排行榜。';
      if (AuthState.user) AuthState.user.crowns = (AuthState.user.crowns||0) + 1;
    } else {
      const winner = room.players.find(p => p.id === room.winner);
      if (titleEl) { titleEl.textContent = '💀 战斗结束'; titleEl.className = 'lose'; }
      if (descEl) descEl.textContent = winner ? `胜者是：${winner.username}。再接再厉！` : '战斗结束';
    }
    if (resEl) resEl.classList.remove('hidden');
  }

  // ===== 个人中心头像渲染 =====
  function renderProfileAvatar() {
    const cv = $('profileAvatarCanvas'); if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0,0,cv.width, cv.height);
    const g = c.createRadialGradient(cv.width/2, cv.height/2, 5, cv.width/2, cv.height/2, cv.width/2);
    g.addColorStop(0,'#ffeaa7'); g.addColorStop(0.5,'#f093fb'); g.addColorStop(1,'#667eea');
    c.fillStyle = g; c.beginPath(); c.arc(cv.width/2,cv.height/2, cv.width/2, 0, Math.PI*2); c.fill();
    c.save();
    const scale = cv.width / GRID_SIZE;
    c.scale(scale, scale);
    drawSnakeHead(c, 0, 0, CurrentSkin, { x:1, y:0 });
    c.restore();
  }
  window.renderProfileAvatar = renderProfileAvatar;

  // ===== URL 参数自动加入房间 =====
  const urlParams = new URLSearchParams(location.search);
  const autoRoom = urlParams.get('room');
  if (autoRoom) {
    setTimeout(() => {
      if (AuthState.user) joinRoomDirect(autoRoom.toUpperCase());
    }, 2000);
  }

  // ===== 覆盖全局占位 =====
  window.backToMenu = function () { stopAll(); showScreen('startScreen'); };
  window.shootBattle = shootBattle;
};
