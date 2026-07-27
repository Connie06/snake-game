const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DATA_DIR = process.env.RENDER || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'game_data.json');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return { users: [], scores: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        console.error('Error loading data:', error);
        return { users: [], scores: [] };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

app.post('/api/register', (req, res) => {
    try {
        const { phone, username, password } = req.body;
        const data = loadData();
        
        if (!phone || !username || !password) {
            return res.status(400).json({ success: false, message: '请填写完整信息' });
        }
        
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ success: false, message: '请输入正确的11位手机号' });
        }
        
        if (username.length < 2 || username.length > 12) {
            return res.status(400).json({ success: false, message: '用户名长度应在2-12位之间' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: '密码至少6位' });
        }
        
        if (data.users.find(u => u.phone === phone)) {
            return res.status(400).json({ success: false, message: '该手机号已注册' });
        }
        
        if (data.users.find(u => u.username === username)) {
            return res.status(400).json({ success: false, message: '该用户名已被占用，请换一个' });
        }
        
        const newUser = {
            id: generateId(),
            phone,
            username,
            password,
            createdAt: new Date().toISOString()
        };
        
        data.users.push(newUser);
        saveData(data);
        
        res.json({
            success: true,
            message: '注册成功',
            user: { id: newUser.id, username: newUser.username, phone: newUser.phone }
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
        
        if (!phone || !password) {
            return res.status(400).json({ success: false, message: '请填写手机号和密码' });
        }
        
        const user = data.users.find(u => u.phone === phone);
        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在，请先注册' });
        }
        
        if (user.password !== password) {
            return res.status(401).json({ success: false, message: '密码错误' });
        }
        
        const userScores = data.scores.filter(s => s.userId === user.id);
        const highScore = userScores.length > 0 ? Math.max(...userScores.map(s => s.score)) : 0;
        const highLevel = userScores.length > 0 ? Math.max(...userScores.map(s => s.level)) : 1;
        
        res.json({
            success: true,
            message: '登录成功',
            user: {
                id: user.id,
                username: user.username,
                phone: user.phone,
                highScore,
                highLevel
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
        
        if (!username) {
            return res.status(400).json({ success: false, message: '请输入用户名' });
        }
        
        const existing = data.users.find(u => u.username === username);
        
        if (existing) {
            return res.json({ success: true, available: false, message: '该用户名已被占用，请换一个' });
        }
        
        res.json({ success: true, available: true, message: '该用户名可用' });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.post('/api/save-score', (req, res) => {
    try {
        const { userId, username, score, level } = req.body;
        const data = loadData();
        
        if (!userId || score === undefined || level === undefined) {
            return res.status(400).json({ success: false, message: '参数错误' });
        }
        
        data.scores.push({
            id: generateId(),
            userId,
            username,
            score,
            level,
            createdAt: new Date().toISOString()
        });
        
        saveData(data);
        res.json({ success: true, message: '分数保存成功' });
    } catch (error) {
        console.error('Save score error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.get('/api/leaderboard', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const data = loadData();
        
        const leaderboardMap = {};
        data.scores.forEach(score => {
            if (!leaderboardMap[score.userId] || score.score > leaderboardMap[score.userId].score) {
                leaderboardMap[score.userId] = {
                    username: score.username,
                    score: score.score,
                    level: score.level
                };
            }
        });
        
        const leaderboard = Object.values(leaderboardMap)
            .sort((a, b) => b.score - a.score || b.level - a.level)
            .slice(0, limit);
        
        res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.get('/api/user-stats/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = loadData();
        
        const user = data.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        const userScores = data.scores.filter(s => s.userId === userId);
        const highScore = userScores.length > 0 ? Math.max(...userScores.map(s => s.score)) : 0;
        const highLevel = userScores.length > 0 ? Math.max(...userScores.map(s => s.level)) : 1;
        
        res.json({
            success: true,
            stats: {
                username: user.username,
                highScore,
                highLevel,
                totalGames: userScores.length
            }
        });
    } catch (error) {
        console.error('User stats error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🐍 萌蛇大觅食游戏服务器已启动: http://localhost:${PORT}`);
});
