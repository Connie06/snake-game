// api/index.js - Vercel Serverless Function (wraps server.js Express app)
// 直接复用 server.js 的 Express app
process.env.RENDER = '1'; // 用 /tmp 当数据目录
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const server = require(path.join(__dirname, '..', 'server.js'));
// server.js export的是listen过的，如果没export app，就用下面的方式
let app;
try {
  app = require(path.join(__dirname, '..', 'server.js'));
} catch (e) { app = null; }

// 如果server.js不export app，则重建
if (!app || !app.handle) {
  const express = require('express');
  const cors = require('cors');
  const fs = require('fs');
  const crypto = require('crypto');

  app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const DATA_DIR = '/tmp';
  const DATA_FILE = path.join(DATA_DIR, 'game_data.json');
  const ROOMS_FILE = path.join(DATA_DIR, 'rooms_data.json');

  function loadData() {
    if (!fs.existsSync(DATA_FILE)) return { users: [], scores: [], battles: [], friends: [], snakeSkins: [], invites: [] };
    try {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!d.battles) d.battles = [];
      if (!d.friends) d.friends = [];
      if (!d.snakeSkins) d.snakeSkins = [];
      if (!d.invites) d.invites = [];
      return d;
    } catch (e) { return { users: [], scores: [], battles: [], friends: [], snakeSkins: [], invites: [] }; }
  }
  function saveData(data) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {} }
  function loadRooms() {
    if (!fs.existsSync(ROOMS_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8')); } catch (e) { return {}; }
  }
  function saveRooms(rooms) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2), 'utf8'); } catch (e) {} }
  function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
  const liveRooms = {};
  const matchmakingQueue = [];
  function generateRoomItems() {
    const items = [];
    const types = ['food_normal','food_grow','food_shrink','health','weapon','shield'];
    for (let i = 0; i < 15; i++) items.push({
      id: generateId(), type: types[Math.floor(Math.random()*types.length)],
      x: Math.floor(Math.random()*24), y: Math.floor(Math.random()*24)
    });
    return items;
  }
  function ok(res, p) { return res.json({ success: true, ...p }); }
  function fail(res, m, s=400) { return res.status(s).json({ success: false, message: m }); }

  // ===== 所有 API =====
  app.post('/api/register', (req, res) => {
    try {
      const { phone, username, password } = req.body || {};
      const data = loadData();
      if (!phone || !username || !password) return fail(res, '请填写完整信息');
      if (!/^1[3-9]\d{9}$/.test(phone)) return fail(res, '请输入正确的11位手机号');
      if (username.length < 2 || username.length > 12) return fail(res, '用户名长度应在2-12位之间');
      if (password.length < 6) return fail(res, '密码至少6位');
      if (data.users.find(u => u.phone === phone)) return fail(res, '该手机号已注册');
      if (data.users.find(u => u.username === username)) return fail(res, '该用户名已被占用，请换一个');
      const newUser = { id: generateId(), phone, username, password, crowns: 0, wins: 0, totalBattles: 0, createdAt: new Date().toISOString() };
      data.users.push(newUser); saveData(data);
      res.json({ success: true, message: '注册成功', user: { id: newUser.id, username: newUser.username, phone: newUser.phone, crowns: 0, wins: 0 } });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/login', (req, res) => {
    try {
      const { phone, password } = req.body || {};
      const data = loadData();
      if (!phone || !password) return fail(res, '请填写手机号和密码');
      const user = data.users.find(u => u.phone === phone);
      if (!user) return res.status(404).json({ success: false, message: '账号不存在，请先注册' });
      if (user.password !== password) return res.status(401).json({ success: false, message: '密码错误' });
      const us = data.scores.filter(s => s.userId === user.id);
      const hs = us.length > 0 ? Math.max(...us.map(s => s.score)) : 0;
      const hl = us.length > 0 ? Math.max(...us.map(s => s.level)) : 1;
      res.json({ success: true, message: '登录成功', user: {
        id: user.id, username: user.username, phone: user.phone, highScore: hs, highLevel: hl,
        crowns: user.crowns || 0, wins: user.wins || 0, totalBattles: user.totalBattles || 0
      } });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/check-username', (req, res) => {
    try {
      const { username } = req.body || {};
      const data = loadData();
      if (!username) return fail(res, '请输入用户名');
      const ex = data.users.find(u => u.username === username);
      res.json({ success: true, available: !ex, message: ex ? '该用户名已被占用' : '该用户名可用' });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/save-score', (req, res) => {
    try {
      const { userId, username, score, level } = req.body || {};
      const data = loadData();
      if (!userId || score === undefined || level === undefined) return fail(res, '参数错误');
      data.scores.push({ id: generateId(), userId, username, score, level, createdAt: new Date().toISOString() });
      saveData(data);
      res.json({ success: true, message: '分数保存成功' });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/leaderboard/adventure', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const data = loadData();
      const m = {};
      data.scores.forEach(s => { if (!m[s.userId] || s.score > m[s.userId].score) m[s.userId] = { username: s.username, score: s.score, level: s.level }; });
      const list = Object.values(m).sort((a,b) => b.score - a.score || b.level - a.level).slice(0, limit);
      res.json({ success: true, leaderboard: list });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/leaderboard/battle', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const data = loadData();
      const list = data.users.map(u => ({ username: u.username, crowns: u.crowns||0, wins: u.wins||0, totalBattles: u.totalBattles||0 }))
        .sort((a,b) => b.crowns - a.crowns || b.wins - a.wins).slice(0, limit);
      res.json({ success: true, leaderboard: list });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/user-stats/:userId', (req, res) => {
    try {
      const userId = req.params.userId;
      const data = loadData();
      const user = data.users.find(u => u.id === userId);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
      const us = data.scores.filter(s => s.userId === userId);
      res.json({ success: true, stats: {
        username: user.username,
        highScore: us.length>0 ? Math.max(...us.map(s=>s.score)) : 0,
        highLevel: us.length>0 ? Math.max(...us.map(s=>s.level)) : 1,
        totalGames: us.length,
        crowns: user.crowns||0, wins: user.wins||0, totalBattles: user.totalBattles||0
      } });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/snake-skin/save', (req, res) => {
    try {
      const { userId, skinName, skinData } = req.body || {};
      const data = loadData();
      if (!userId || !skinName || !skinData) return fail(res, '参数错误');
      const skin = { id: generateId(), userId, skinName, skinData, createdAt: new Date().toISOString() };
      data.snakeSkins.push(skin); saveData(data);
      res.json({ success: true, message: '皮肤保存成功', skin });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/snake-skin/:userId', (req, res) => {
    try {
      const data = loadData();
      res.json({ success: true, skins: data.snakeSkins.filter(s => s.userId === req.params.userId) });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.delete('/api/snake-skin/:skinId', (req, res) => {
    try {
      const data = loadData();
      const idx = data.snakeSkins.findIndex(s => s.id === req.params.skinId);
      if (idx < 0) return res.status(404).json({ success: false, message: '皮肤不存在' });
      data.snakeSkins.splice(idx, 1); saveData(data);
      res.json({ success: true, message: '皮肤已删除' });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/users/search', (req, res) => {
    try {
      const { q } = req.query;
      const data = loadData();
      if (!q) return res.json({ success: true, users: [] });
      const users = data.users.filter(u => u.username.includes(q)).slice(0,10)
        .map(u => ({ id: u.id, username: u.username, crowns: u.crowns||0 }));
      res.json({ success: true, users });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/friends/invite', (req, res) => {
    try {
      const { fromUserId, toUserId } = req.body || {};
      const data = loadData();
      if (!fromUserId || !toUserId) return fail(res, '参数错误');
      if (fromUserId === toUserId) return fail(res, '不能添加自己为好友');
      const isFriend = data.friends.some(f => (f.userId1===fromUserId&&f.userId2===toUserId)||(f.userId1===toUserId&&f.userId2===fromUserId));
      if (isFriend) return res.json({ success: false, message: '已经是好友了' });
      const ex = data.invites.find(i => i.fromUserId===fromUserId && i.toUserId===toUserId && i.status==='pending');
      if (ex) return res.json({ success: false, message: '已发送过邀请' });
      const fu = data.users.find(u => u.id===fromUserId), tu = data.users.find(u => u.id===toUserId);
      const inv = { id: generateId(), fromUserId, toUserId, fromUsername: fu?fu.username:'未知用户', toUsername: tu?tu.username:'未知用户', status:'pending', createdAt: new Date().toISOString() };
      data.invites.push(inv); saveData(data);
      res.json({ success: true, message: '邀请已发送' });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/friends/handle-invite', (req, res) => {
    try {
      const { inviteId, accept, userId } = req.body || {};
      const data = loadData();
      const inv = data.invites.find(i => i.id === inviteId);
      if (!inv) return res.status(404).json({ success: false, message: '邀请不存在' });
      inv.status = accept ? 'accepted' : 'rejected';
      if (accept) data.friends.push({ id: generateId(), userId1: inv.fromUserId, userId2: inv.toUserId, createdAt: new Date().toISOString() });
      saveData(data);
      res.json({ success: true, message: accept ? '已添加好友' : '已拒绝邀请' });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/friends/:userId', (req, res) => {
    try {
      const userId = req.params.userId;
      const data = loadData();
      const ids = new Set();
      data.friends.forEach(f => { if (f.userId1===userId) ids.add(f.userId2); if (f.userId2===userId) ids.add(f.userId1); });
      const friends = data.users.filter(u => ids.has(u.id)).map(u => ({ id: u.id, username: u.username, crowns: u.crowns||0, online: false }));
      res.json({ success: true, friends });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/friends/invites/:userId', (req, res) => {
    try {
      const userId = req.params.userId;
      const data = loadData();
      const invites = data.invites.filter(i => i.toUserId===userId && i.status==='pending')
        .map(i => ({ id: i.id, fromUserId: i.fromUserId, fromUsername: i.fromUsername, createdAt: i.createdAt }));
      res.json({ success: true, invites });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/friends/remove', (req, res) => {
    try {
      const { userId, friendId } = req.body || {};
      const data = loadData();
      data.friends = data.friends.filter(f => !((f.userId1===userId && f.userId2===friendId) || (f.userId1===friendId && f.userId2===userId)));
      saveData(data);
      res.json({ success: true, message: '已删除好友' });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  function ensureLR() {
    // 将 rooms 文件里的房间同步到内存
    const fromFile = loadRooms();
    for (const code of Object.keys(fromFile)) { if (!liveRooms[code]) liveRooms[code] = fromFile[code]; }
  }
  function persistLR() { saveRooms(liveRooms); }

  app.post('/api/rooms/create', (req, res) => {
    try {
      ensureLR();
      const { userId, username, maxPlayers = 10, skinData } = req.body || {};
      const roomCode = generateRoomCode();
      const room = { code: roomCode, hostId: userId, maxPlayers: Math.max(2, Math.min(10, maxPlayers)),
        players: [{ id: userId, username, skinData: skinData||null, ready: false, lives: 3, shield: 0, position: null }],
        status: 'lobby', createdAt: Date.now(), winner: null, bullets: [] };
      liveRooms[roomCode] = room; persistLR();
      res.json({ success: true, room });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/rooms/join', (req, res) => {
    try {
      ensureLR();
      const { code, userId, username, skinData } = req.body || {};
      const room = liveRooms[code];
      if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
      if (room.status !== 'lobby') return fail(res, '游戏已开始');
      if (room.players.length >= room.maxPlayers) return fail(res, '房间已满');
      if (room.players.some(p => p.id === userId)) return res.json({ success: true, room });
      room.players.push({ id: userId, username, skinData: skinData||null, ready: false, lives: 3, shield: 0, position: null });
      persistLR();
      res.json({ success: true, room });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/rooms/:code', (req, res) => {
    try {
      ensureLR();
      const room = liveRooms[req.params.code];
      if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
      res.json({ success: true, room });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/rooms/ready', (req, res) => {
    try {
      ensureLR();
      const { code, userId, ready } = req.body || {};
      const room = liveRooms[code];
      if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
      const p = room.players.find(x => x.id === userId);
      if (p) p.ready = ready;
      persistLR();
      res.json({ success: true, room });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  const POSITIONS = [
    { x: 3, y: 3, dir: { x: 1, y: 0 } },
    { x: 20, y: 20, dir: { x: -1, y: 0 } },
    { x: 3, y: 20, dir: { x: 1, y: 0 } },
    { x: 20, y: 3, dir: { x: -1, y: 0 } },
    { x: 12, y: 3, dir: { x: 0, y: 1 } },
    { x: 12, y: 20, dir: { x: 0, y: -1 } },
    { x: 3, y: 12, dir: { x: 1, y: 0 } },
    { x: 20, y: 12, dir: { x: -1, y: 0 } },
    { x: 7, y: 7, dir: { x: 1, y: 0 } },
    { x: 16, y: 16, dir: { x: -1, y: 0 } }
  ];

  function writeWinner(alivePlayers, code, roomPlayers) {
    const data = loadData();
    const wu = data.users.find(u => u.id === alivePlayers[0].id);
    if (wu) { wu.crowns = (wu.crowns||0)+1; wu.wins = (wu.wins||0)+1; }
    roomPlayers.forEach(p => { const u = data.users.find(x => x.id===p.id); if (u) u.totalBattles = (u.totalBattles||0)+1; });
    saveData(data);
    data.battles.push({ id: generateId(), roomCode: code, winnerId: alivePlayers[0].id, winnerName: alivePlayers[0].username, playerCount: roomPlayers.length, createdAt: new Date().toISOString() });
    saveData(data);
  }

  app.post('/api/rooms/start', (req, res) => {
    try {
      ensureLR();
      const { code, userId } = req.body || {};
      const room = liveRooms[code];
      if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
      if (room.hostId !== userId) return res.status(403).json({ success: false, message: '只有房主能开始' });
      if (room.players.length < 2) return fail(res, '至少需要2人');
      if (!room.players.every(p => p.ready || p.id === room.hostId)) return fail(res, '有玩家未准备');
      room.players.forEach((p, i) => {
        const pos = POSITIONS[i % POSITIONS.length];
        p.lives = 3; p.shield = 0;
        p.position = { x: pos.x, y: pos.y };
        p.direction = pos.dir;
        p.snake = [{x:pos.x,y:pos.y},{x:pos.x-pos.dir.x,y:pos.y-pos.dir.y},{x:pos.x-pos.dir.x*2,y:pos.y-pos.dir.y*2}];
        p.nextDirection = { ...pos.dir };
        p.score = 0; p.alive = true;
      });
      room.status = 'playing';
      room.startedAt = Date.now();
      room.items = generateRoomItems();
      persistLR();
      res.json({ success: true, room });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/rooms/sync', (req, res) => {
    try {
      ensureLR();
      const { code, userId, playerState, consumedItemId } = req.body || {};
      const room = liveRooms[code];
      if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
      const player = room.players.find(p => p.id === userId);
      if (!player) return res.status(404).json({ success: false, message: '玩家不在房间' });
      if (playerState) {
        if (playerState.snake !== undefined) player.snake = playerState.snake;
        if (playerState.direction !== undefined) player.direction = playerState.direction;
        if (playerState.nextDirection !== undefined) player.nextDirection = playerState.nextDirection;
        if (playerState.lives !== undefined) player.lives = playerState.lives;
        if (playerState.shield !== undefined) player.shield = playerState.shield;
        if (playerState.alive !== undefined) player.alive = playerState.alive;
        if (playerState.score !== undefined) player.score = playerState.score;
      }
      const alive = room.players.filter(p => p.alive !== false && p.lives > 0);
      if (alive.length === 1 && room.status === 'playing') {
        room.status = 'finished';
        room.winner = alive[0].id;
        writeWinner(alive, code, room.players);
      }
      if (consumedItemId) {
        room.items = room.items.filter(i => i.id !== consumedItemId);
        if (room.items.length < 15) {
          const types = ['food_normal','food_grow','food_shrink','health','weapon','shield'];
          room.items.push({ id: generateId(), type: types[Math.floor(Math.random()*types.length)], x: Math.floor(Math.random()*24), y: Math.floor(Math.random()*24) });
        }
      }
      persistLR();
      res.json({ success: true, room, aliveCount: alive.length });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/rooms/leave', (req, res) => {
    try {
      ensureLR();
      const { code, userId } = req.body || {};
      const room = liveRooms[code];
      if (!room) return res.json({ success: true });
      room.players = room.players.filter(p => p.id !== userId);
      if (room.players.length === 0) delete liveRooms[code];
      else if (room.hostId === userId) room.hostId = room.players[0].id;
      persistLR();
      res.json({ success: true });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/rooms/shoot', (req, res) => {
    try {
      ensureLR();
      const { code, fromUserId, toUserId, damage = 1 } = req.body || {};
      const room = liveRooms[code];
      if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
      if (room.status !== 'playing') return fail(res, '游戏未开始');
      const fp = room.players.find(p => p.id === fromUserId);
      const tp = room.players.find(p => p.id === toUserId);
      if (!fp || !tp) return res.status(404).json({ success: false, message: '玩家不在房间' });
      if (tp.shield > 0) {
        tp.shield -= 1; persistLR();
        return res.json({ success: true, shielded: true, targetLives: tp.lives, targetAlive: tp.alive !== false, targetShield: tp.shield });
      }
      tp.lives -= damage;
      if (tp.lives <= 0) { tp.alive = false; tp.lives = 0; }
      const alive = room.players.filter(p => p.alive !== false && p.lives > 0);
      if (alive.length === 1 && room.status === 'playing') {
        room.status = 'finished';
        room.winner = alive[0].id;
        writeWinner(alive, code, room.players);
      }
      persistLR();
      res.json({ success: true, targetLives: tp.lives, targetAlive: tp.alive !== false, targetShield: tp.shield });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/rooms/add-shot', (req, res) => {
    try {
      ensureLR();
      const { code, fromUserId, bulletId, x, y, dx, dy } = req.body || {};
      const room = liveRooms[code];
      if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
      if (!room.bullets) room.bullets = [];
      const now = Date.now();
      room.bullets = room.bullets.filter(b => now - b.createdAt < 3000);
      room.bullets.push({ bulletId, fromUserId, x, y, dx, dy, createdAt: now });
      persistLR();
      res.json({ success: true, bullets: room.bullets });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/matchmaking/join', (req, res) => {
    try {
      ensureLR();
      const { userId, username, skinData } = req.body || {};
      const ex = matchmakingQueue.findIndex(q => q.userId === userId);
      if (ex >= 0) matchmakingQueue.splice(ex, 1);
      matchmakingQueue.push({ userId, username, skinData, joinedAt: Date.now() });
      if (matchmakingQueue.length >= 2) {
        const groupSize = matchmakingQueue.length >= 10 ? 10 : matchmakingQueue.length;
        const players = matchmakingQueue.splice(0, groupSize);
        const roomCode = generateRoomCode();
        const room = {
          code: roomCode, hostId: players[0].userId, maxPlayers: groupSize,
          players: players.map((p, i) => {
            const pos = POSITIONS[i % POSITIONS.length];
            return { id: p.userId, username: p.username, skinData: p.skinData, ready: true, lives: 3, shield: 0,
              position: { x: pos.x, y: pos.y }, direction: pos.dir,
              snake: [{x:pos.x,y:pos.y},{x:pos.x-pos.dir.x,y:pos.y-pos.dir.y},{x:pos.x-pos.dir.x*2,y:pos.y-pos.dir.y*2}],
              nextDirection: { ...pos.dir }, score: 0, alive: true };
          }),
          status: 'playing', createdAt: Date.now(), startedAt: Date.now(), winner: null,
          items: generateRoomItems(), bullets: []
        };
        liveRooms[roomCode] = room; persistLR();
        return res.json({ success: true, matched: true, roomCode });
      }
      res.json({ success: true, matched: false, queuePosition: matchmakingQueue.length });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.post('/api/matchmaking/leave', (req, res) => {
    try {
      const { userId } = req.body || {};
      const idx = matchmakingQueue.findIndex(q => q.userId === userId);
      if (idx >= 0) matchmakingQueue.splice(idx, 1);
      res.json({ success: true });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  app.get('/api/matchmaking/status/:userId', (req, res) => {
    try {
      const userId = req.params.userId;
      const pos = matchmakingQueue.findIndex(q => q.userId === userId);
      if (pos < 0) return res.json({ success: true, inQueue: false });
      res.json({ success: true, inQueue: true, position: pos+1, total: matchmakingQueue.length });
    } catch (e) { fail(res, '服务器错误', 500); }
  });

  // 静态根目录 fallback（Vercel 已经托管了，但保留路由）
  app.get('/health', (req, res) => res.json({ ok: true }));
}

module.exports = app;
// Vercel 会调用 module.exports = app
