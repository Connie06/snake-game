const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// 数据目录：Render 部署时使用 /tmp（可写）；本地使用项目目录
const DATA_DIR = process.env.RENDER ? '/tmp' : __dirname;
const DATA_FILE = path.join(DATA_DIR, 'game_data.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms_data.json');

// ===== 数据持久化 =====
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return { users: [], scores: [], battles: [], friends: [], snakeSkins: [], invites: [] };
    }
    try {
        const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!d.battles) d.battles = [];
        if (!d.friends) d.friends = [];
        if (!d.snakeSkins) d.snakeSkins = [];
        if (!d.invites) d.invites = [];
        return d;
    } catch (error) {
        console.error('Error loading data:', error);
        return { users: [], scores: [], battles: [], friends: [], snakeSkins: [], invites: [] };
    }
}

function saveData(data) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }
    catch (e) { console.error('Save data error:', e); }
}

function loadRooms() {
    if (!fs.existsSync(ROOMS_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8')); }
    catch (e) { return {}; }
}
function saveRooms(rooms) {
    try { fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2), 'utf8'); }
    catch (e) { console.error('Save rooms error:', e); }
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

// ===== 内存对战房间（实时） =====
const liveRooms = {};
const matchmakingQueue = [];

// ===== 鉴权 =====
app.post('/api/register', (req, res) => {
    try {
        const { phone, username, password } = req.body;
        const data = loadData();

        if (!phone || !username || !password)
            return res.status(400).json({ success: false, message: '请填写完整信息' });
        if (!/^1[3-9]\d{9}$/.test(phone))
            return res.status(400).json({ success: false, message: '请输入正确的11位手机号' });
        if (username.length < 2 || username.length > 12)
            return res.status(400).json({ success: false, message: '用户名长度应在2-12位之间' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: '密码至少6位' });
        if (data.users.find(u => u.phone === phone))
            return res.status(400).json({ success: false, message: '该手机号已注册' });
        if (data.users.find(u => u.username === username))
            return res.status(400).json({ success: false, message: '该用户名已被占用，请换一个' });

        const newUser = {
            id: generateId(), phone, username, password,
            crowns: 0, wins: 0, totalBattles: 0,
            createdAt: new Date().toISOString()
        };
        data.users.push(newUser);
        saveData(data);

        res.json({
            success: true, message: '注册成功',
            user: { id: newUser.id, username: newUser.username, phone: newUser.phone, crowns: 0, wins: 0 }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.post('/api/login', (req, res) => {
    try {
        const { phone, password } = req.body;
        const data = loadData();

        if (!phone || !password)
            return res.status(400).json({ success: false, message: '请填写手机号和密码' });

        const user = data.users.find(u => u.phone === phone);
        if (!user) return res.status(404).json({ success: false, message: '账号不存在，请先注册' });
        if (user.password !== password)
            return res.status(401).json({ success: false, message: '密码错误' });

        const userScores = data.scores.filter(s => s.userId === user.id);
        const highScore = userScores.length > 0 ? Math.max(...userScores.map(s => s.score)) : 0;
        const highLevel = userScores.length > 0 ? Math.max(...userScores.map(s => s.level)) : 1;

        res.json({
            success: true, message: '登录成功',
            user: {
                id: user.id, username: user.username, phone: user.phone,
                highScore, highLevel,
                crowns: user.crowns || 0, wins: user.wins || 0, totalBattles: user.totalBattles || 0
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.post('/api/check-username', (req, res) => {
    try {
        const { username } = req.body;
        const data = loadData();
        if (!username) return res.status(400).json({ success: false, message: '请输入用户名' });
        const existing = data.users.find(u => u.username === username);
        res.json({ success: true, available: !existing, message: existing ? '该用户名已被占用' : '该用户名可用' });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ===== 闯关分数 =====
app.post('/api/save-score', (req, res) => {
    try {
        const { userId, username, score, level } = req.body;
        const data = loadData();
        if (!userId || score === undefined || level === undefined)
            return res.status(400).json({ success: false, message: '参数错误' });

        data.scores.push({
            id: generateId(), userId, username, score, level,
            createdAt: new Date().toISOString()
        });
        saveData(data);
        res.json({ success: true, message: '分数保存成功' });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ===== 双排行榜 =====
// 闯关榜（按最高分数）
app.get('/api/leaderboard/adventure', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const data = loadData();
        const map = {};
        data.scores.forEach(s => {
            if (!map[s.userId] || s.score > map[s.userId].score) {
                map[s.userId] = { username: s.username, score: s.score, level: s.level };
            }
        });
        const list = Object.values(map)
            .sort((a, b) => b.score - a.score || b.level - a.level)
            .slice(0, limit);
        res.json({ success: true, leaderboard: list });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 对战皇冠榜
app.get('/api/leaderboard/battle', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const data = loadData();
        const list = data.users
            .map(u => ({
                username: u.username,
                crowns: u.crowns || 0,
                wins: u.wins || 0,
                totalBattles: u.totalBattles || 0
            }))
            .sort((a, b) => b.crowns - a.crowns || b.wins - a.wins)
            .slice(0, limit);
        res.json({ success: true, leaderboard: list });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ===== 用户统计 =====
app.get('/api/user-stats/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = loadData();
        const user = data.users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

        const userScores = data.scores.filter(s => s.userId === userId);
        const highScore = userScores.length > 0 ? Math.max(...userScores.map(s => s.score)) : 0;
        const highLevel = userScores.length > 0 ? Math.max(...userScores.map(s => s.level)) : 1;

        res.json({
            success: true,
            stats: {
                username: user.username,
                highScore, highLevel,
                totalGames: userScores.length,
                crowns: user.crowns || 0,
                wins: user.wins || 0,
                totalBattles: user.totalBattles || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ===== 蛇皮肤保存 =====
app.post('/api/snake-skin/save', (req, res) => {
    try {
        const { userId, skinName, skinData } = req.body;
        const data = loadData();
        if (!userId || !skinName || !skinData)
            return res.status(400).json({ success: false, message: '参数错误' });

        const skin = {
            id: generateId(),
            userId, skinName, skinData,
            createdAt: new Date().toISOString()
        };
        data.snakeSkins.push(skin);
        saveData(data);
        res.json({ success: true, message: '皮肤保存成功', skin });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.get('/api/snake-skin/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = loadData();
        const skins = data.snakeSkins.filter(s => s.userId === userId);
        res.json({ success: true, skins });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.delete('/api/snake-skin/:skinId', (req, res) => {
    try {
        const skinId = req.params.skinId;
        const data = loadData();
        const idx = data.snakeSkins.findIndex(s => s.id === skinId);
        if (idx < 0) return res.status(404).json({ success: false, message: '皮肤不存在' });
        data.snakeSkins.splice(idx, 1);
        saveData(data);
        res.json({ success: true, message: '皮肤已删除' });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ===== 好友系统 =====
// 搜索用户（按用户名）
app.get('/api/users/search', (req, res) => {
    try {
        const { q } = req.query;
        const data = loadData();
        if (!q) return res.json({ success: true, users: [] });
        const users = data.users
            .filter(u => u.username.includes(q))
            .slice(0, 10)
            .map(u => ({ id: u.id, username: u.username, crowns: u.crowns || 0 }));
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 发送好友邀请
app.post('/api/friends/invite', (req, res) => {
    try {
        const { fromUserId, toUserId } = req.body;
        const data = loadData();
        if (!fromUserId || !toUserId)
            return res.status(400).json({ success: false, message: '参数错误' });
        if (fromUserId === toUserId)
            return res.status(400).json({ success: false, message: '不能添加自己为好友' });

        // 检查是否已经是好友
        const isFriend = data.friends.some(f =>
            (f.userId1 === fromUserId && f.userId2 === toUserId) ||
            (f.userId1 === toUserId && f.userId2 === fromUserId)
        );
        if (isFriend) return res.json({ success: false, message: '已经是好友了' });

        // 检查是否已有邀请
        const existInvite = data.invites.find(i =>
            i.fromUserId === fromUserId && i.toUserId === toUserId && i.status === 'pending'
        );
        if (existInvite) return res.json({ success: false, message: '已发送过邀请' });

        const fromUser = data.users.find(u => u.id === fromUserId);
        const toUser = data.users.find(u => u.id === toUserId);

        const invite = {
            id: generateId(),
            fromUserId, toUserId,
            fromUsername: fromUser ? fromUser.username : '未知用户',
            toUsername: toUser ? toUser.username : '未知用户',
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        data.invites.push(invite);
        saveData(data);
        res.json({ success: true, message: '邀请已发送' });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 处理邀请（接受/拒绝）
app.post('/api/friends/handle-invite', (req, res) => {
    try {
        const { inviteId, accept, userId } = req.body;
        const data = loadData();
        const invite = data.invites.find(i => i.id === inviteId);
        if (!invite) return res.status(404).json({ success: false, message: '邀请不存在' });

        invite.status = accept ? 'accepted' : 'rejected';

        if (accept) {
            data.friends.push({
                id: generateId(),
                userId1: invite.fromUserId,
                userId2: invite.toUserId,
                createdAt: new Date().toISOString()
            });
        }
        saveData(data);
        res.json({ success: true, message: accept ? '已添加好友' : '已拒绝邀请' });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取好友列表
app.get('/api/friends/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = loadData();
        const friendIds = new Set();
        data.friends.forEach(f => {
            if (f.userId1 === userId) friendIds.add(f.userId2);
            if (f.userId2 === userId) friendIds.add(f.userId1);
        });
        const friends = data.users
            .filter(u => friendIds.has(u.id))
            .map(u => ({
                id: u.id, username: u.username,
                crowns: u.crowns || 0, online: false
            }));
        res.json({ success: true, friends });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取邀请列表
app.get('/api/friends/invites/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = loadData();
        const invites = data.invites
            .filter(i => i.toUserId === userId && i.status === 'pending')
            .map(i => ({
                id: i.id, fromUserId: i.fromUserId,
                fromUsername: i.fromUsername, createdAt: i.createdAt
            }));
        res.json({ success: true, invites });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 删除好友
app.post('/api/friends/remove', (req, res) => {
    try {
        const { userId, friendId } = req.body;
        const data = loadData();
        data.friends = data.friends.filter(f =>
            !((f.userId1 === userId && f.userId2 === friendId) ||
              (f.userId1 === friendId && f.userId2 === userId))
        );
        saveData(data);
        res.json({ success: true, message: '已删除好友' });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ===== 对战房间系统 =====
// 创建房间
app.post('/api/rooms/create', (req, res) => {
    try {
        const { userId, username, maxPlayers = 10, skinData } = req.body;
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            hostId: userId,
            maxPlayers: Math.max(2, Math.min(10, maxPlayers)),
            players: [{
                id: userId, username, skinData: skinData || null,
                ready: false, lives: 3, shield: 0, position: null
            }],
            status: 'lobby', // lobby, playing, finished
            createdAt: Date.now(),
            winner: null,
            bullets: []
        };
        liveRooms[roomCode] = room;
        saveRooms(liveRooms);
        res.json({ success: true, room });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 加入房间
app.post('/api/rooms/join', (req, res) => {
    try {
        const { code, userId, username, skinData } = req.body;
        const room = liveRooms[code];
        if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
        if (room.status !== 'lobby')
            return res.status(400).json({ success: false, message: '游戏已开始' });
        if (room.players.length >= room.maxPlayers)
            return res.status(400).json({ success: false, message: '房间已满' });
        if (room.players.some(p => p.id === userId))
            return res.json({ success: true, room });

        room.players.push({
            id: userId, username, skinData: skinData || null,
            ready: false, lives: 3, shield: 0, position: null
        });
        saveRooms(liveRooms);
        res.json({ success: true, room });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 房间心跳 / 获取房间状态
app.get('/api/rooms/:code', (req, res) => {
    try {
        const code = req.params.code;
        const room = liveRooms[code];
        if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
        res.json({ success: true, room });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 准备/取消准备
app.post('/api/rooms/ready', (req, res) => {
    try {
        const { code, userId, ready } = req.body;
        const room = liveRooms[code];
        if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
        const player = room.players.find(p => p.id === userId);
        if (player) player.ready = ready;
        saveRooms(liveRooms);
        res.json({ success: true, room });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 开始游戏
app.post('/api/rooms/start', (req, res) => {
    try {
        const { code, userId } = req.body;
        const room = liveRooms[code];
        if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
        if (room.hostId !== userId)
            return res.status(403).json({ success: false, message: '只有房主能开始' });
        if (room.players.length < 2)
            return res.status(400).json({ success: false, message: '至少需要2人' });
        if (!room.players.every(p => p.ready || p.id === room.hostId))
            return res.status(400).json({ success: false, message: '有玩家未准备' });

        // 初始化玩家位置（24x24网格，分散）
        const tileCount = 24;
        const positions = [
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

        room.players.forEach((p, i) => {
            const pos = positions[i % positions.length];
            p.lives = 3;
            p.shield = 0;
            p.position = { x: pos.x, y: pos.y };
            p.direction = pos.dir;
            p.snake = [
                { x: pos.x, y: pos.y },
                { x: pos.x - pos.dir.x, y: pos.y - pos.dir.y },
                { x: pos.x - pos.dir.x * 2, y: pos.y - pos.dir.y * 2 }
            ];
            p.nextDirection = { ...pos.dir };
            p.score = 0;
            p.alive = true;
        });

        room.status = 'playing';
        room.startedAt = Date.now();
        room.items = generateRoomItems();
        saveRooms(liveRooms);
        res.json({ success: true, room });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

function generateRoomItems() {
    const items = [];
    const tileCount = 24;
    const types = ['food_normal', 'food_grow', 'food_shrink', 'health', 'weapon', 'shield'];
    for (let i = 0; i < 15; i++) {
        items.push({
            id: generateId(),
            type: types[Math.floor(Math.random() * types.length)],
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        });
    }
    return items;
}

// 对战同步（客户端上传自己的状态）
app.post('/api/rooms/sync', (req, res) => {
    try {
        const { code, userId, playerState } = req.body;
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

        // 检查是否只有1人存活
        const alivePlayers = room.players.filter(p => p.alive !== false && p.lives > 0);
        if (alivePlayers.length === 1 && room.status === 'playing') {
            room.status = 'finished';
            room.winner = alivePlayers[0].id;
            // 写入用户数据
            const data = loadData();
            const winnerUser = data.users.find(u => u.id === alivePlayers[0].id);
            if (winnerUser) {
                winnerUser.crowns = (winnerUser.crowns || 0) + 1;
                winnerUser.wins = (winnerUser.wins || 0) + 1;
            }
            room.players.forEach(p => {
                const u = data.users.find(x => x.id === p.id);
                if (u) u.totalBattles = (u.totalBattles || 0) + 1;
            });
            saveData(data);

            data.battles.push({
                id: generateId(),
                roomCode: code,
                winnerId: alivePlayers[0].id,
                winnerName: alivePlayers[0].username,
                playerCount: room.players.length,
                createdAt: new Date().toISOString()
            });
            saveData(data);
        }

        // 房间物品同步（谁吃了就删谁）
        if (req.body.consumedItemId) {
            room.items = room.items.filter(i => i.id !== req.body.consumedItemId);
            // 补充新物品
            if (room.items.length < 15) {
                const tileCount = 24;
                const types = ['food_normal', 'food_grow', 'food_shrink', 'health', 'weapon', 'shield'];
                room.items.push({
                    id: generateId(),
                    type: types[Math.floor(Math.random() * types.length)],
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount)
                });
            }
        }

        saveRooms(liveRooms);
        res.json({ success: true, room, aliveCount: alivePlayers.length });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 离开房间
app.post('/api/rooms/leave', (req, res) => {
    try {
        const { code, userId } = req.body;
        const room = liveRooms[code];
        if (!room) return res.json({ success: true });
        room.players = room.players.filter(p => p.id !== userId);
        if (room.players.length === 0) {
            delete liveRooms[code];
        } else if (room.hostId === userId) {
            room.hostId = room.players[0].id;
        }
        saveRooms(liveRooms);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 对战射击命中
app.post('/api/rooms/shoot', (req, res) => {
    try {
        const { code, fromUserId, toUserId, damage = 1 } = req.body;
        const room = liveRooms[code];
        if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
        if (room.status !== 'playing')
            return res.status(400).json({ success: false, message: '游戏未开始' });

        const fromPlayer = room.players.find(p => p.id === fromUserId);
        if (!fromPlayer) return res.status(404).json({ success: false, message: '攻击者不在房间' });

        const targetPlayer = room.players.find(p => p.id === toUserId);
        if (!targetPlayer) return res.status(404).json({ success: false, message: '目标不在房间' });

        if (targetPlayer.shield > 0) {
            targetPlayer.shield -= 1;
            saveRooms(liveRooms);
            return res.json({
                success: true,
                shielded: true,
                targetLives: targetPlayer.lives,
                targetAlive: targetPlayer.alive !== false,
                targetShield: targetPlayer.shield
            });
        }

        targetPlayer.lives -= damage;
        if (targetPlayer.lives <= 0) {
            targetPlayer.alive = false;
            targetPlayer.lives = 0;
        }

        const alivePlayers = room.players.filter(p => p.alive !== false && p.lives > 0);
        if (alivePlayers.length === 1 && room.status === 'playing') {
            room.status = 'finished';
            room.winner = alivePlayers[0].id;
            const data = loadData();
            const winnerUser = data.users.find(u => u.id === alivePlayers[0].id);
            if (winnerUser) {
                winnerUser.crowns = (winnerUser.crowns || 0) + 1;
                winnerUser.wins = (winnerUser.wins || 0) + 1;
            }
            room.players.forEach(p => {
                const u = data.users.find(x => x.id === p.id);
                if (u) u.totalBattles = (u.totalBattles || 0) + 1;
            });
            saveData(data);
            data.battles.push({
                id: generateId(),
                roomCode: code,
                winnerId: alivePlayers[0].id,
                winnerName: alivePlayers[0].username,
                playerCount: room.players.length,
                createdAt: new Date().toISOString()
            });
            saveData(data);
        }

        saveRooms(liveRooms);
        res.json({
            success: true,
            targetLives: targetPlayer.lives,
            targetAlive: targetPlayer.alive !== false,
            targetShield: targetPlayer.shield
        });
    } catch (error) {
        console.error('Shoot error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 新增子弹/射击记录
app.post('/api/rooms/add-shot', (req, res) => {
    try {
        const { code, fromUserId, bulletId, x, y, dx, dy } = req.body;
        const room = liveRooms[code];
        if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
        if (!room.bullets) room.bullets = [];

        const now = Date.now();
        room.bullets = room.bullets.filter(b => now - b.createdAt < 3000);
        room.bullets.push({
            bulletId,
            fromUserId,
            x, y, dx, dy,
            createdAt: now
        });
        saveRooms(liveRooms);
        res.json({ success: true, bullets: room.bullets });
    } catch (error) {
        console.error('Add shot error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 匹配队列
app.post('/api/matchmaking/join', (req, res) => {
    try {
        const { userId, username, skinData } = req.body;
        const existing = matchmakingQueue.findIndex(q => q.userId === userId);
        if (existing >= 0) matchmakingQueue.splice(existing, 1);
        matchmakingQueue.push({ userId, username, skinData, joinedAt: Date.now() });

        // 尝试凑局
        if (matchmakingQueue.length >= 2) {
            const groupSize = matchmakingQueue.length >= 10 ? 10 : matchmakingQueue.length;
            const players = matchmakingQueue.splice(0, groupSize);
            const roomCode = generateRoomCode();
            const positions = [
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
            const room = {
                code: roomCode,
                hostId: players[0].userId,
                maxPlayers: groupSize,
                players: players.map((p, i) => {
                    const pos = positions[i % positions.length];
                    return {
                        id: p.userId, username: p.username, skinData: p.skinData,
                        ready: true, lives: 3, shield: 0,
                        position: { x: pos.x, y: pos.y },
                        direction: pos.dir,
                        snake: [
                            { x: pos.x, y: pos.y },
                            { x: pos.x - pos.dir.x, y: pos.y - pos.dir.y },
                            { x: pos.x - pos.dir.x * 2, y: pos.y - pos.dir.y * 2 }
                        ],
                        nextDirection: { ...pos.dir },
                        score: 0, alive: true
                    };
                }),
                status: 'playing',
                createdAt: Date.now(),
                startedAt: Date.now(),
                winner: null,
                items: generateRoomItems(),
                bullets: []
            };
            liveRooms[roomCode] = room;
            saveRooms(liveRooms);
            return res.json({ success: true, matched: true, roomCode });
        }
        res.json({ success: true, matched: false, queuePosition: matchmakingQueue.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.post('/api/matchmaking/leave', (req, res) => {
    try {
        const { userId } = req.body;
        const idx = matchmakingQueue.findIndex(q => q.userId === userId);
        if (idx >= 0) matchmakingQueue.splice(idx, 1);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.get('/api/matchmaking/status/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const pos = matchmakingQueue.findIndex(q => q.userId === userId);
        if (pos < 0) return res.json({ success: true, inQueue: false });
        res.json({ success: true, inQueue: true, position: pos + 1, total: matchmakingQueue.length });
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 定时清理过期房间
setInterval(() => {
    const now = Date.now();
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const THIRTY_MINUTES = 30 * 60 * 1000;
    let changed = false;
    for (const code of Object.keys(liveRooms)) {
        const room = liveRooms[code];
        let expired = false;
        if (room.status === 'finished') {
            const finishedAt = room.startedAt || room.createdAt;
            if (now - finishedAt > THIRTY_MINUTES) expired = true;
        } else if (room.status !== 'playing') {
            if (now - room.createdAt > THREE_HOURS) expired = true;
        }
        if (expired) {
            delete liveRooms[code];
            changed = true;
        }
    }
    if (changed) saveRooms(liveRooms);
}, 60 * 1000);

// 动态获取局域网 IP（兼容 Windows/Mac/Linux）
function getLocalIPs() {
  const os = require('os');
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // 跳过 IPv6 和回环地址
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`🐍 萌蛇大觅食 - 服务器已启动`);
  console.log(`========================================`);
  console.log(`本机访问:   http://localhost:${PORT}`);
  const ips = getLocalIPs();
  if (ips.length > 0) {
    console.log(`\n📱 手机/平板访问（同一WiFi下）:`);
    ips.forEach(ip => console.log(`   http://${ip}:${PORT}`));
  } else {
    console.log(`\n⚠️  未检测到局域网IP`);
  }
  console.log(`\n💡 提示: 手机和电脑需连接同一WiFi`);
  console.log(`========================================\n`);
});
