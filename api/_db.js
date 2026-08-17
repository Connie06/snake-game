// api/_db.js - 共享数据层（Vercel /tmp 持久化，单实例内存兜底）
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/tmp';
const DATA_FILE = path.join(DATA_DIR, 'game_data.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms_data.json');

let cacheData = null;
let cacheRooms = {};
// 对战房间内存（匹配队列/实时房间）
const liveRooms = {};
const matchmakingQueue = [];

function loadData() {
  if (cacheData) return cacheData;
  if (!fs.existsSync(DATA_FILE)) {
    cacheData = { users: [], scores: [], battles: [], friends: [], snakeSkins: [], invites: [] };
    return cacheData;
  }
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!d.battles) d.battles = [];
    if (!d.friends) d.friends = [];
    if (!d.snakeSkins) d.snakeSkins = [];
    if (!d.invites) d.invites = [];
    cacheData = d;
    return d;
  } catch (e) {
    console.error('loadData error', e);
    cacheData = { users: [], scores: [], battles: [], friends: [], snakeSkins: [], invites: [] };
    return cacheData;
  }
}

function saveData(data) {
  cacheData = data;
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('saveData error', e); }
}

function loadRooms() {
  if (Object.keys(cacheRooms).length > 0) return cacheRooms;
  if (!fs.existsSync(ROOMS_FILE)) { cacheRooms = {}; return cacheRooms; }
  try { cacheRooms = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8')); return cacheRooms; }
  catch (e) { cacheRooms = {}; return cacheRooms; }
}

function saveRooms(rooms) {
  cacheRooms = rooms;
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2), 'utf8'); }
  catch (e) { console.error('saveRooms error', e); }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function ok(res, payload) { return res.status(200).json({ success: true, ...payload }); }
function fail(res, message, status = 400) { return res.status(status).json({ success: false, message }); }
function body(req) { return req.body || {}; }

module.exports = {
  loadData, saveData, loadRooms, saveRooms,
  generateId, generateRoomCode,
  liveRooms, matchmakingQueue,
  ok, fail, body
};
