const API_BASE = '';

const AuthState = {
    user: null,
    isGuest: false
};

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: '网络连接失败' };
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const gridSize = 28;
    const tileCount = 24;
    canvas.width = gridSize * tileCount;
    canvas.height = gridSize * tileCount;

    const authElements = {
        loginScreen: document.getElementById('loginScreen'),
        loginForm: document.getElementById('loginForm'),
        registerForm: document.getElementById('registerForm'),
        loginPhone: document.getElementById('loginPhone'),
        loginPassword: document.getElementById('loginPassword'),
        loginBtn: document.getElementById('loginBtn'),
        registerPhone: document.getElementById('registerPhone'),
        registerUsername: document.getElementById('registerUsername'),
        registerPassword: document.getElementById('registerPassword'),
        registerConfirmPassword: document.getElementById('registerConfirmPassword'),
        registerBtn: document.getElementById('registerBtn'),
        guestBtn: document.getElementById('guestBtn'),
        leaderboardBtn: document.getElementById('leaderboardBtn'),
        leaderboardOverlay: document.getElementById('leaderboardOverlay'),
        leaderboardContainer: document.getElementById('leaderboardContainer'),
        closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        userInfo: document.getElementById('userInfo'),
        currentUsername: document.getElementById('currentUsername'),
        userHighScore: document.getElementById('userHighScore'),
        userHighLevel: document.getElementById('userHighLevel'),
        logoutBtn: document.getElementById('logoutBtn'),
        usernameCheck: document.getElementById('usernameCheck')
    };

    authElements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            authElements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (tab === 'login') {
                authElements.loginForm.classList.remove('hidden');
                authElements.registerForm.classList.add('hidden');
            } else {
                authElements.loginForm.classList.add('hidden');
                authElements.registerForm.classList.remove('hidden');
            }
        });
    });

    let usernameCheckTimer = null;
    authElements.registerUsername.addEventListener('input', async (e) => {
        const username = e.target.value.trim();
        clearTimeout(usernameCheckTimer);
        if (username.length < 2) {
            authElements.usernameCheck.textContent = '用户名至少2位';
            authElements.usernameCheck.className = 'username-check unavailable';
            return;
        }
        if (username.length > 12) {
            authElements.usernameCheck.textContent = '用户名最多12位';
            authElements.usernameCheck.className = 'username-check unavailable';
            return;
        }
        usernameCheckTimer = setTimeout(async () => {
            const result = await apiCall('/api/check-username', {
                method: 'POST',
                body: JSON.stringify({ username })
            });
            if (result.success && result.available) {
                authElements.usernameCheck.textContent = '✓ 该用户名可用';
                authElements.usernameCheck.className = 'username-check available';
            } else {
                authElements.usernameCheck.textContent = '✗ ' + result.message;
                authElements.usernameCheck.className = 'username-check unavailable';
            }
        }, 500);
    });

    authElements.registerBtn.addEventListener('click', async () => {
        const phone = authElements.registerPhone.value.trim();
        const username = authElements.registerUsername.value.trim();
        const password = authElements.registerPassword.value;
        const confirmPassword = authElements.registerConfirmPassword.value;

        if (!/^1[3-9]\d{9}$/.test(phone)) {
            alert('请输入正确的11位手机号');
            return;
        }
        if (username.length < 2 || username.length > 12) {
            alert('用户名长度应在2-12位之间');
            return;
        }
        if (password.length < 6) {
            alert('密码至少6位');
            return;
        }
        if (password !== confirmPassword) {
            alert('两次密码不一致');
            return;
        }

        const result = await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({ phone, username, password })
        });

        if (result.success) {
            alert('注册成功！请登录');
            authElements.loginPhone.value = phone;
            authElements.loginPassword.focus();
            authElements.tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelector('[data-tab="login"]').classList.add('active');
            authElements.loginForm.classList.remove('hidden');
            authElements.registerForm.classList.add('hidden');
            authElements.registerPhone.value = '';
            authElements.registerUsername.value = '';
            authElements.registerPassword.value = '';
            authElements.registerConfirmPassword.value = '';
            authElements.usernameCheck.textContent = '';
        } else {
            alert(result.message);
        }
    });

    authElements.loginBtn.addEventListener('click', async () => {
        const phone = authElements.loginPhone.value.trim();
        const password = authElements.loginPassword.value;

        if (!phone || !password) {
            alert('请填写手机号和密码');
            return;
        }

        const result = await apiCall('/api/login', {
            method: 'POST',
            body: JSON.stringify({ phone, password })
        });

        if (result.success) {
            AuthState.user = result.user;
            AuthState.isGuest = false;
            showUserInfo();
            authElements.loginScreen.classList.add('hidden');
            startGameScreen();
        } else {
            alert(result.message);
        }
    });

    authElements.guestBtn.addEventListener('click', () => {
        AuthState.user = null;
        AuthState.isGuest = true;
        authElements.loginScreen.classList.add('hidden');
        startGameScreen();
    });

    authElements.logoutBtn.addEventListener('click', () => {
        AuthState.user = null;
        AuthState.isGuest = false;
        authElements.userInfo.classList.add('hidden');
        authElements.loginForm.classList.remove('hidden');
        authElements.registerForm.classList.add('hidden');
        document.querySelector('[data-tab="login"]').classList.add('active');
        authElements.loginScreen.classList.remove('hidden');
    });

    authElements.leaderboardBtn.addEventListener('click', async () => {
        authElements.leaderboardOverlay.classList.remove('hidden');
        const result = await apiCall('/api/leaderboard?limit=20');
        if (result.success && result.leaderboard.length > 0) {
            authElements.leaderboardContainer.innerHTML = result.leaderboard.map((item, index) => `
                <div class="leaderboard-item ${index < 3 ? `top-${index + 1}` : ''}">
                    <div class="leaderboard-rank">${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${item.username}</div>
                        <div class="leaderboard-stats">关卡 ${item.level}</div>
                    </div>
                    <div class="leaderboard-score">${item.score}</div>
                </div>
            `).join('');
        } else {
            authElements.leaderboardContainer.innerHTML = `
                <div class="leaderboard-empty">
                    <div class="empty-icon">🏆</div>
                    <p>暂无排名记录</p>
                    <p style="font-size: 13px; margin-top: 10px;">登录账号开始游戏，创造你的记录吧！</p>
                </div>
            `;
        }
    });

    authElements.closeLeaderboardBtn.addEventListener('click', () => {
        authElements.leaderboardOverlay.classList.add('hidden');
    });

    function showUserInfo() {
        authElements.loginForm.classList.add('hidden');
        authElements.registerForm.classList.add('hidden');
        authElements.userInfo.classList.remove('hidden');
        authElements.currentUsername.textContent = AuthState.user.username;
        authElements.userHighScore.textContent = AuthState.user.highScore;
        authElements.userHighLevel.textContent = AuthState.user.highLevel;
    }

    function startGameScreen() {
        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
            startScreen.classList.remove('hidden');
            if (!AuthState.isGuest && AuthState.user) {
                const startHints = document.querySelector('.start-hints');
                if (startHints) {
                    startHints.innerHTML = `<p>🎉 欢迎，${AuthState.user.username}！最高分：${AuthState.user.highScore} | 最高关：${AuthState.user.highLevel}</p>`;
                }
            }
        }
    }

    const elements = {
        level: document.getElementById('level'),
        score: document.getElementById('score'),
        totalScore: document.getElementById('totalScore'),
        highestLevel: document.getElementById('highestLevel'),
        health: document.getElementById('health'),
        healthText: document.getElementById('healthText'),
        weaponAmmo: document.getElementById('weaponAmmo'),
        currentLevelDisplay: document.getElementById('currentLevelDisplay'),
        lastLevel: document.getElementById('lastLevel'),
        highScore: document.getElementById('highScore'),
        finalScore: document.getElementById('finalScore'),
        finalLevel: document.getElementById('finalLevel'),
        newLevel: document.getElementById('newLevel'),
        rankTitle: document.getElementById('rankTitle'),
        finalRank: document.getElementById('finalRank'),
        startScreen: document.getElementById('startScreen'),
        gameContainer: document.getElementById('gameContainer'),
        gameOver: document.getElementById('gameOver'),
        levelUp: document.getElementById('levelUp'),
        characterSelect: document.getElementById('characterSelect'),
        charactersGrid: document.getElementById('charactersGrid'),
        colorGrid: document.getElementById('colorGrid'),
        mobileControls: document.getElementById('mobileControls'),
        startBtn: document.getElementById('startBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        restartBtn: document.getElementById('restartBtn'),
        continueBtn: document.getElementById('continueBtn'),
        prevLevelBtn: document.getElementById('prevLevel'),
        nextLevelBtn: document.getElementById('nextLevel'),
        playBtn: document.getElementById('playBtn'),
        customBtn: document.getElementById('customBtn'),
        backToMenuBtn: document.getElementById('backToMenuBtn'),
        backToMenuFromGameOverBtn: document.getElementById('backToMenuFromGameOverBtn'),
        backToMenuFromLevelUpBtn: document.getElementById('backToMenuFromLevelUpBtn'),
        backToMenuFromMobileBtn: document.getElementById('backToMenuFromMobileBtn'),
        shootBtn: document.getElementById('shootBtn'),
        controlUp: document.getElementById('controlUp'),
        controlDown: document.getElementById('controlDown'),
        controlLeft: document.getElementById('controlLeft'),
        controlRight: document.getElementById('controlRight'),
        controlCenter: document.getElementById('controlCenter'),
        gameStartOverlay: document.getElementById('gameStartOverlay'),
        confirmStartBtn: document.getElementById('confirmStartBtn')
    };

    const snakeCharacters = [
        { id: 0, emoji: '🐍', name: '经典小蛇', head: '#667eea', body: '#764ba2', accent: '#fff' },
        { id: 1, emoji: '🦊', name: '火狐精灵', head: '#f093fb', body: '#f5576c', accent: '#fff' },
        { id: 2, emoji: '🐰', name: '雪兔仙子', head: '#a8edea', body: '#fed6e3', accent: '#667eea' },
        { id: 3, emoji: '🦄', name: '彩虹独角兽', head: '#f093fb', body: '#f5576c', accent: '#ffeaa7' },
        { id: 4, emoji: '🐼', name: '熊猫宝贝', head: '#2d3436', body: '#dfe6e9', accent: '#fff' },
        { id: 5, emoji: '🦋', name: '蝴蝶仙子', head: '#4facfe', body: '#00f2fe', accent: '#ffeaa7' },
        { id: 6, emoji: '🌸', name: '樱花小蛇', head: '#f093fb', body: '#ff9ff3', accent: '#fff' },
        { id: 7, emoji: '⭐', name: '星星使者', head: '#ffeaa7', body: '#fdcb6e', accent: '#fff' },
        { id: 8, emoji: '🐨', name: '考拉萌萌', head: '#636e72', body: '#dfe6e9', accent: '#2d3436' },
        { id: 9, emoji: '🌺', name: '木槿精灵', head: '#fd79a8', body: '#fab1a0', accent: '#ffeaa7' },
        { id: 10, emoji: '🦩', name: '粉红火烈鸟', head: '#f093fb', body: '#ff9ff3', accent: '#fff' },
        { id: 11, emoji: '🐙', name: '章鱼宝宝', head: '#feca57', body: '#ff9ff3', accent: '#fd79a8' },
        { id: 12, emoji: '🐳', name: '蓝鲸精灵', head: '#74b9ff', body: '#0984e3', accent: '#fff' },
        { id: 13, emoji: '🦜', name: '鹦鹉小蛇', head: '#fdcb6e', body: '#e17055', accent: '#fff' },
        { id: 14, emoji: '🦎', name: '彩虹蜥蜴', head: '#00b894', body: '#fdcb6e', accent: '#fff' },
        { id: 15, emoji: '🐲', name: '神龙宝宝', head: '#fd79a8', body: '#fdcb6e', accent: '#fff' },
        { id: 16, emoji: '🦄', name: '极光独角兽', head: '#a29bfe', body: '#4facfe', accent: '#ffeaa7' },
        { id: 17, emoji: '🌙', name: '月光女神', head: '#6c5ce7', body: '#a29bfe', accent: '#ffeaa7' },
        { id: 18, emoji: '☀️', name: '阳光精灵', head: '#fdcb6e', body: '#f39c12', accent: '#fff' },
        { id: 19, emoji: '❄️', name: '冰雪女王', head: '#74b9ff', body: '#a8edea', accent: '#fff' },
        { id: 20, emoji: '🍓', name: '草莓甜心', head: '#fd79a8', body: '#ff6b6b', accent: '#ffeaa7' },
        { id: 21, emoji: '🍇', name: '葡萄紫蛇', head: '#a29bfe', body: '#6c5ce7', accent: '#ffeaa7' },
        { id: 22, emoji: '🌹', name: '玫瑰女王', head: '#e84393', body: '#fd79a8', accent: '#ffeaa7' },
        { id: 23, emoji: '🌼', name: '小雏菊', head: '#ffeaa7', body: '#fdcb6e', accent: '#2d3436' },
        { id: 24, emoji: '✨', name: '满天星', head: '#fff', body: '#dfe6e9', accent: '#6c5ce7' },
        { id: 25, emoji: '🌷', name: '郁金香', head: '#fd79a8', body: '#f093fb', accent: '#fff' },
        { id: 26, emoji: '🌻', name: '向日葵', head: '#fdcb6e', body: '#f39c12', accent: '#2d3436' },
        { id: 27, emoji: '🪻', name: '薰衣草', head: '#a29bfe', body: '#6c5ce7', accent: '#ffeaa7' },
        { id: 28, emoji: '🌸', name: '桃花仙子', head: '#ff9ff3', body: '#fd79a8', accent: '#ffeaa7' },
        { id: 29, emoji: '🌺', name: '扶桑花', head: '#f5576c', body: '#fd79a8', accent: '#ffeaa7' },
        { id: 30, emoji: '🌼', name: '洋甘菊', head: '#ffeaa7', body: '#fff59d', accent: '#2d3436' },
        { id: 31, emoji: '💐', name: '花束精灵', head: '#f093fb', body: '#fd79a8', accent: '#ffeaa7' },
        { id: 32, emoji: '🌾', name: '麦穗精灵', head: '#ffeaa7', body: '#d4a574', accent: '#2d3436' },
        { id: 33, emoji: '🌱', name: '嫩芽精灵', head: '#7bed9f', body: '#2ed573', accent: '#fff' }
    ];

    const ranks = [
        { name: '新手探险家', minScore: 0, color: '#b2bec3' },
        { name: '食物猎人', minScore: 100, color: '#7bed9f' },
        { name: '贪吃大师', minScore: 300, color: '#74b9ff' },
        { name: '蛇王', minScore: 600, color: '#a29bfe' },
        { name: '传说中的蛇神', minScore: 1000, color: '#ffeaa7' }
    ];

    const bodyColors = [
        { id: 0, body: '#764ba2', head: '#667eea', name: '紫罗兰' },
        { id: 1, body: '#f5576c', head: '#f093fb', name: '粉红玫瑰' },
        { id: 2, body: '#2ed573', head: '#7bed9f', name: '清新绿' },
        { id: 3, body: '#0984e3', head: '#74b9ff', name: '天空蓝' },
        { id: 4, body: '#fdcb6e', head: '#ffeaa7', name: '明亮黄' },
        { id: 5, body: '#e17055', head: '#fab1a0', name: '桃红色' },
        { id: 6, body: '#6c5ce7', head: '#a29bfe', name: '薰衣草紫' },
        { id: 7, body: '#00b894', head: '#00d2d3', name: '青色' },
        { id: 8, body: '#ff7675', head: '#ff9ff3', name: '珊瑚红' },
        { id: 9, body: '#d63031', head: '#ff6b9d', name: '烈焰红' },
        { id: 10, body: '#fd79a8', head: '#e84393', name: '桃粉' },
        { id: 11, body: '#2d3436', head: '#636e72', name: '经典黑' }
    ];

    let gameState = {
        snake: [],
        foods: [],
        obstacles: [],
        powerUps: [],
        lasers: [],
        explosions: [],
        direction: { x: 1, y: 0 },
        nextDirection: { x: 1, y: 0 },
        score: 0,
        totalScore: 0,
        level: 1,
        health: 10,
        maxHealth: 10,
        ammo: 5,
        isGameRunning: false,
        isPaused: false,
        gameLoop: null,
        foodsEatenInLevel: 0,
        foodsToLevelUp: 5,
        selectedCharacter: 0,
        currentCharacter: null,
        selectedBodyColor: 0,
        highestLevel: 1,
        lastPlayedLevel: 1,
        highScore: 0
    };

    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playSound(type) {
        if (!audioCtx) return;
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        switch(type) {
            case 'eat':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.2);
                break;
            case 'shoot':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.08);
                gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.1);
                break;
            case 'destroy':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.35);
                break;
            case 'destroyHeavy':
                const osc1 = audioCtx.createOscillator();
                const gain1 = audioCtx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(300, audioCtx.currentTime);
                osc1.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.4);
                gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
                osc1.connect(gain1);
                gain1.connect(audioCtx.destination);
                osc1.start(audioCtx.currentTime);
                osc1.stop(audioCtx.currentTime + 0.45);
                
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(450, audioCtx.currentTime + 0.05);
                osc2.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.5);
                gain2.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.05);
                gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start(audioCtx.currentTime + 0.05);
                osc2.stop(audioCtx.currentTime + 0.5);
                break;
            case 'hurt':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.2);
                break;
            case 'powerup':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(500, audioCtx.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + 0.2);
                oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.35);
                break;
        }
    }

    function loadSave() {
        gameState.selectedCharacter = parseInt(localStorage.getItem('snakeCharacter')) || 0;
        gameState.selectedBodyColor = parseInt(localStorage.getItem('snakeBodyColor')) || 0;
        gameState.highestLevel = parseInt(localStorage.getItem('snakeHighestLevel')) || 1;
        gameState.lastPlayedLevel = parseInt(localStorage.getItem('snakeLastLevel')) || 1;
        gameState.highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
        gameState.totalScore = parseInt(localStorage.getItem('snakeTotalScore')) || 0;
        gameState.ammo = parseInt(localStorage.getItem('snakeAmmo')) || 5;
        
        gameState.level = gameState.lastPlayedLevel;
        gameState.currentCharacter = { ...snakeCharacters[gameState.selectedCharacter] };
        
        const color = bodyColors[gameState.selectedBodyColor];
        gameState.currentCharacter.body = color.body;
        gameState.currentCharacter.head = color.head;
        
        updateUI();
    }

    function saveGame() {
        localStorage.setItem('snakeCharacter', gameState.selectedCharacter.toString());
        localStorage.setItem('snakeBodyColor', gameState.selectedBodyColor.toString());
        localStorage.setItem('snakeHighestLevel', gameState.highestLevel.toString());
        localStorage.setItem('snakeLastLevel', gameState.lastPlayedLevel.toString());
        localStorage.setItem('snakeHighScore', gameState.highScore.toString());
        localStorage.setItem('snakeTotalScore', gameState.totalScore.toString());
        localStorage.setItem('snakeAmmo', gameState.ammo.toString());
    }

    function createCharacterGrid() {
        elements.charactersGrid.innerHTML = '';
        
        snakeCharacters.forEach((char, idx) => {
            const div = document.createElement('div');
            div.className = 'character-item' + (idx === gameState.selectedCharacter ? ' selected' : '');
            div.dataset.character = idx;
            div.innerHTML = `
                <div class="character-emoji">${char.emoji}</div>
                <div class="character-name">${char.name}</div>
            `;
            elements.charactersGrid.appendChild(div);
        });
    }

    function createColorGrid() {
        elements.colorGrid.innerHTML = '';
        
        bodyColors.forEach((color, idx) => {
            const div = document.createElement('div');
            div.className = 'color-item' + (idx === gameState.selectedBodyColor ? ' selected' : '');
            div.dataset.color = idx;
            div.style.background = `linear-gradient(135deg, ${color.head}, ${color.body})`;
            elements.colorGrid.appendChild(div);
        });
    }

    function selectCharacter(idx) {
        gameState.selectedCharacter = idx;
        gameState.currentCharacter = { ...snakeCharacters[idx] };
        
        const color = bodyColors[gameState.selectedBodyColor];
        gameState.currentCharacter.body = color.body;
        gameState.currentCharacter.head = color.head;
        
        localStorage.setItem('snakeCharacter', idx.toString());
        
        document.querySelectorAll('.character-item').forEach((div, i) => {
            if (i === idx) {
                div.classList.add('selected');
            } else {
                div.classList.remove('selected');
            }
        });
    }

    function selectBodyColor(idx) {
        gameState.selectedBodyColor = idx;
        
        const color = bodyColors[idx];
        gameState.currentCharacter.body = color.body;
        gameState.currentCharacter.head = color.head;
        
        localStorage.setItem('snakeBodyColor', idx.toString());
        
        document.querySelectorAll('.color-item').forEach((div, i) => {
            if (i === idx) {
                div.classList.add('selected');
            } else {
                div.classList.remove('selected');
            }
        });
    }

    function getRank(score) {
        for (let i = ranks.length - 1; i >= 0; i--) {
            if (score >= ranks[i].minScore) {
                return ranks[i];
            }
        }
        return ranks[0];
    }

    function updateUI() {
        elements.level.textContent = gameState.level;
        elements.score.textContent = gameState.score;
        elements.totalScore.textContent = gameState.totalScore + gameState.score;
        elements.highestLevel.textContent = gameState.highestLevel;
        elements.health.style.width = `${(gameState.health / gameState.maxHealth) * 100}%`;
        elements.healthText.textContent = `${gameState.health}/${gameState.maxHealth}`;
        elements.weaponAmmo.textContent = gameState.ammo;
        elements.currentLevelDisplay.textContent = `第 ${gameState.level} 关`;
        elements.lastLevel.textContent = gameState.lastPlayedLevel;
        elements.highScore.textContent = gameState.highScore;
        
        const rank = getRank(gameState.totalScore + gameState.score);
        elements.rankTitle.textContent = rank.name;
        elements.finalRank.textContent = rank.name;
    }

    function initGame() {
        const startX = Math.floor(tileCount / 2);
        const startY = Math.floor(tileCount / 2);
        
        gameState.snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        gameState.direction = { x: 1, y: 0 };
        gameState.nextDirection = { x: 1, y: 0 };
        gameState.foods = [];
        gameState.obstacles = [];
        gameState.powerUps = [];
        gameState.lasers = [];
        gameState.explosions = [];
        gameState.score = 0;
        gameState.health = gameState.maxHealth;
        gameState.foodsEatenInLevel = 0;
        gameState.foodsToLevelUp = Math.max(4, 8 - gameState.level);
        
        if (!gameState.currentCharacter) {
            gameState.currentCharacter = { ...snakeCharacters[gameState.selectedCharacter] };
            const color = bodyColors[gameState.selectedBodyColor];
            gameState.currentCharacter.body = color.body;
            gameState.currentCharacter.head = color.head;
        }
        
        updateUI();
        generateFood(5);
        generateObstacles();
        generatePowerUps();
        
        draw();
    }

    function isPositionOccupied(x, y) {
        if (gameState.snake.some(segment => segment.x === x && segment.y === y)) return true;
        if (gameState.foods.some(food => food.x === x && food.y === y)) return true;
        if (gameState.obstacles.some(obs => obs.x === x && obs.y === y)) return true;
        if (gameState.powerUps.some(pu => pu.x === x && pu.y === y)) return true;
        return false;
    }

    function generateFood(count) {
        for (let i = 0; i < count; i++) {
            placeFood();
        }
    }

    function placeFood() {
        let newFood;
        const types = ['normal', 'grow', 'shrink'];
        const weights = [0.6, 0.2, 0.2];
        
        let type = types[0];
        let total = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * total;
        
        for (let j = 0; j < weights.length; j++) {
            random -= weights[j];
            if (random <= 0) {
                type = types[j];
                break;
            }
        }
        
        do {
            newFood = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount),
                type: type,
                createdAt: Date.now()
            };
        } while (isPositionOccupied(newFood.x, newFood.y));
        
        gameState.foods.push(newFood);
    }

    function generateObstacles() {
        const obstacleCount = Math.min(2 + Math.floor(gameState.level / 2), 8);
        
        for (let i = 0; i < obstacleCount; i++) {
            placeObstacle();
        }
    }

    function placeObstacle() {
        let obstacle;
        do {
            obstacle = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount),
                health: 1,
                createdAt: Date.now()
            };
        } while (isPositionOccupied(obstacle.x, obstacle.y));
        
        gameState.obstacles.push(obstacle);
    }

    function generatePowerUps() {
        const powerUpTypes = ['health', 'weapon'];
        const count = Math.min(1 + Math.floor(gameState.level / 2), 2);
        
        for (let i = 0; i < count; i++) {
            placePowerUp(powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]);
        }
    }

    function placePowerUp(type) {
        let powerUp;
        do {
            powerUp = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount),
                type: type,
                createdAt: Date.now()
            };
        } while (isPositionOccupied(powerUp.x, powerUp.y));
        
        gameState.powerUps.push(powerUp);
    }

    function createExplosion(x, y) {
        const colors = ['#ff6b9d', '#ffeaa7', '#4facfe', '#ff9ff3', '#7bed9f'];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i + Math.random() * 0.3;
            const speed = 8 + Math.random() * 5;
            gameState.explosions.push({
                x: x * gridSize + gridSize / 2,
                y: y * gridSize + gridSize / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1,
                decay: 0.4 + Math.random() * 0.15
            });
        }
    }

    function updateExplosions() {
        gameState.explosions = gameState.explosions.filter(exp => {
            exp.x += exp.vx;
            exp.y += exp.vy;
            exp.vx *= 0.8;
            exp.vy *= 0.8;
            exp.life -= exp.decay;
            exp.size *= 0.82;
            return exp.life > 0;
        });
    }

    function drawBackground() {
        const time = Date.now() / 2000;
        const bgGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width
        );
        bgGradient.addColorStop(0, '#fff5f5');
        bgGradient.addColorStop(0.25, '#a8edea');
        bgGradient.addColorStop(0.5, '#fed6e3');
        bgGradient.addColorStop(0.75, '#ffeaa7');
        bgGradient.addColorStop(1, '#ffecd2');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 添加动态装饰圆点
        for (let i = 0; i < 15; i++) {
            const x = (Math.sin(time + i * 0.7) * 0.5 + 0.5) * canvas.width;
            const y = (Math.cos(time * 0.8 + i * 0.5) * 0.5 + 0.5) * canvas.height;
            const size = 3 + Math.sin(time + i) * 2;
            const alpha = 0.15 + Math.sin(time * 1.2 + i * 0.3) * 0.1;
            
            const colors = ['#ffeaa7', '#f093fb', '#74b9ff', '#7bed9f', '#fd79a8'];
            ctx.fillStyle = colors[i % colors.length];
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        // 柔和的网格线
        ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        for (let i = 0; i <= tileCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridSize, 0);
            ctx.lineTo(i * gridSize, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * gridSize);
            ctx.lineTo(canvas.width, i * gridSize);
            ctx.stroke();
        }
    }

    function drawConeObstacle(obs, age) {
        const x = obs.x;
        const y = obs.y;
        const health = obs.health;
        const centerX = x * gridSize + gridSize / 2;
        const centerY = y * gridSize + gridSize / 2;
        const size = gridSize * 0.42;
        const time = Date.now() / 200;
        
        const flashTime = 20000;
        const shouldFlash = age >= flashTime;
        const alpha = shouldFlash ? 0.65 + Math.sin(time) * 0.25 : 1;
        const pulseScale = 1 + Math.sin(time * 0.5) * 0.05;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = shouldFlash ? 25 : 18;
        
        const gradient = ctx.createRadialGradient(
            centerX - size * 0.3, centerY - size * 0.3, 0,
            centerX, centerY, size * 1.5
        );
        gradient.addColorStop(0, '#ff9ff3');
        gradient.addColorStop(0.3, '#ff6b9d');
        gradient.addColorStop(0.7, '#f5576c');
        gradient.addColorStop(1, '#ee5a24');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        
        // 绘制圆润的多边形障碍物
        const sides = 8;
        for (let i = 0; i <= sides; i++) {
            const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
            const r = size * pulseScale * (0.9 + Math.sin(angle * 3) * 0.1);
            const px = centerX + Math.cos(angle) * r;
            const py = centerY + Math.sin(angle) * r;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // 添加高光效果
        ctx.shadowBlur = 0;
        const highlightGradient = ctx.createRadialGradient(
            centerX - size * 0.3, centerY - size * 0.3, 0,
            centerX, centerY, size
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        if (health > 1) {
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 8;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(health, centerX, centerY);
        }
        
        ctx.restore();
    }

    function drawFoodItem(food, age) {
        const x = food.x;
        const y = food.y;
        const centerX = x * gridSize + gridSize / 2;
        const centerY = y * gridSize + gridSize / 2;
        const time = Date.now() / 200;
        
        let color1, color2, color3, glowColor;
        switch(food.type) {
            case 'normal': 
                color1 = '#7bed9f'; 
                color2 = '#2ed573';
                color3 = '#00b894';
                glowColor = 'rgba(123, 237, 159, 0.6)';
                break;
            case 'grow': 
                color1 = '#74b9ff'; 
                color2 = '#0984e3';
                color3 = '#6c5ce7';
                glowColor = 'rgba(116, 185, 255, 0.6)';
                break;
            case 'shrink': 
                color1 = '#ff7675'; 
                color2 = '#d63031';
                color3 = '#e17055';
                glowColor = 'rgba(255, 118, 117, 0.6)';
                break;
        }
        
        const flashTime = 20000;
        const shouldFlash = age >= flashTime;
        const pulseScale = 1 + Math.sin(time) * 0.1 + (shouldFlash ? Math.sin(time * 1.5) * 0.08 : 0);
        const alpha = shouldFlash ? 0.75 + Math.sin(time * 1.2) * 0.25 : 1;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = shouldFlash ? 28 : 20;
        
        const radius = gridSize * 0.4 * pulseScale;
        
        // 外层光晕
        const outerGradient = ctx.createRadialGradient(
            centerX, centerY, radius * 0.5,
            centerX, centerY, radius * 1.5
        );
        outerGradient.addColorStop(0, glowColor);
        outerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 主体食物
        const gradient = ctx.createRadialGradient(
            centerX - radius * 0.35, centerY - radius * 0.35, 0,
            centerX, centerY, radius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        gradient.addColorStop(0.25, color1);
        gradient.addColorStop(0.6, color2);
        gradient.addColorStop(1, color3);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 添加可爱的高光
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(centerX + radius * 0.2, centerY + radius * 0.2, radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    function drawPowerUpItem(powerUp, age) {
        const x = powerUp.x;
        const y = powerUp.y;
        const centerX = x * gridSize + gridSize / 2;
        const centerY = y * gridSize + gridSize / 2;
        
        const pulseScale = 1 + Math.sin(Date.now() / 300) * 0.1;
        const glowColor = powerUp.type === 'health' ? 'rgba(255, 107, 157, 0.6)' : 'rgba(79, 172, 254, 0.6)';
        
        ctx.save();
        
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 18;
        
        ctx.font = `${gridSize * 0.85 * pulseScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.type === 'health' ? '💖' : '🔫', centerX, centerY);
        
        ctx.restore();
    }

    function drawSnakeSegment() {
        const time = Date.now() / 300;
        const char = gameState.currentCharacter;
        const dir = gameState.direction;
        let headRotation = 0;
        if (dir.x === 1) headRotation = 0;
        else if (dir.x === -1) headRotation = Math.PI;
        else if (dir.y === 1) headRotation = Math.PI / 2;
        else if (dir.y === -1) headRotation = -Math.PI / 2;
        
        for (let i = gameState.snake.length - 1; i >= 0; i--) {
            const segment = gameState.snake[i];
            const isHead = i === 0;
            const centerX = segment.x * gridSize + gridSize / 2;
            const centerY = segment.y * gridSize + gridSize / 2;
            const sizeBase = isHead ? gridSize * 0.45 : gridSize * 0.4;
            const size = sizeBase + (isHead ? Math.sin(time) * 0.02 * gridSize : 0);
            
            ctx.save();
            
            if (isHead) {
                ctx.shadowColor = char.head;
                ctx.shadowBlur = 22;
                ctx.translate(centerX, centerY);
                ctx.rotate(headRotation);
                ctx.shadowBlur = 0;
                ctx.font = `${gridSize * 0.9}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(char.emoji, 0, 0);
            } else {
                ctx.shadowColor = char.body;
                ctx.shadowBlur = 12;
                const gradient = ctx.createRadialGradient(
                    centerX - size * 0.35, centerY - size * 0.35, 0,
                    centerX, centerY, size * 1.1
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
                gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.3)');
                gradient.addColorStop(0.5, char.body);
                gradient.addColorStop(1, char.head);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.shadowBlur = 0;
                const highlightGradient = ctx.createRadialGradient(
                    centerX - size * 0.3, centerY - size * 0.3, 0,
                    centerX - size * 0.3, centerY - size * 0.3, size * 0.5
                );
                highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
                highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = highlightGradient;
                ctx.beginPath();
                ctx.arc(centerX - size * 0.2, centerY - size * 0.2, size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }

    function drawLasers() {
        gameState.lasers.forEach(laser => {
            ctx.save();
            
            const gradient = ctx.createLinearGradient(
                laser.x - laser.vx * 3, laser.y - laser.vy * 3,
                laser.x + laser.vx * 8, laser.y + laser.vy * 8
            );
            gradient.addColorStop(0, 'rgba(79, 172, 254, 0.3)');
            gradient.addColorStop(0.4, '#4facfe');
            gradient.addColorStop(0.8, '#00f2fe');
            gradient.addColorStop(1, 'rgba(79, 172, 254, 0)');
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 9;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#4facfe';
            ctx.shadowBlur = 18;
            
            ctx.beginPath();
            ctx.moveTo(laser.x - laser.vx * 3, laser.y - laser.vy * 3);
            ctx.lineTo(laser.x + laser.vx * 8, laser.y + laser.vy * 8);
            ctx.stroke();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            
            ctx.restore();
        });
    }

    function drawExplosions() {
        gameState.explosions.forEach(exp => {
            ctx.save();
            ctx.globalAlpha = exp.life;
            ctx.fillStyle = exp.color;
            ctx.shadowColor = exp.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function draw() {
        drawBackground();
        
        const now = Date.now();
        
        gameState.foods.forEach(food => {
            drawFoodItem(food, now - food.createdAt);
        });
        
        gameState.obstacles.forEach(obs => {
            drawConeObstacle(obs, now - obs.createdAt);
        });
        
        gameState.powerUps.forEach(pu => {
            drawPowerUpItem(pu, now - pu.createdAt);
        });
        
        drawLasers();
        drawSnakeSegment();
        drawExplosions();
    }

    function updateLasers() {
        const lasersToRemove = [];
        const obstaclesToRemove = [];
        
        gameState.lasers.forEach((laser, laserIdx) => {
            const stepX = laser.vx / 3;
            const stepY = laser.vy / 3;
            let distanceTraveled = 0;
            
            for (let i = 0; i < 3; i++) {
                laser.x += stepX;
                laser.y += stepY;
                distanceTraveled += Math.sqrt(stepX * stepX + stepY * stepY);
                
                if (distanceTraveled > laser.maxDistance) {
                    lasersToRemove.push(laserIdx);
                    return;
                }
                
                for (let j = 0; j < gameState.obstacles.length; j++) {
                    const obs = gameState.obstacles[j];
                    const obsCenterX = obs.x * gridSize + gridSize / 2;
                    const obsCenterY = obs.y * gridSize + gridSize / 2;
                    const dist = Math.sqrt(Math.pow(laser.x - obsCenterX, 2) + Math.pow(laser.y - obsCenterY, 2));
                    
                    if (dist < gridSize) {
                        createExplosion(obs.x, obs.y);
                        playSound('destroyHeavy');
                        obstaclesToRemove.push(j);
                        lasersToRemove.push(laserIdx);
                        return;
                    }
                }
            }
        });
        
        for (let i = obstaclesToRemove.length - 1; i >= 0; i--) {
            gameState.obstacles.splice(obstaclesToRemove[i], 1);
            setTimeout(() => {
                if (gameState.isGameRunning) placeObstacle();
            }, 2000);
        }
        
        for (let i = lasersToRemove.length - 1; i >= 0; i--) {
            gameState.lasers.splice(lasersToRemove[i], 1);
        }
    }

    function updateItemsTimeout() {
        const now = Date.now();
        const expireTime = 25000;
        
        const originalFoodCount = gameState.foods.length;
        gameState.foods = gameState.foods.filter(food => now - food.createdAt < expireTime);
        if (gameState.foods.length < originalFoodCount) {
            setTimeout(() => generateFood(originalFoodCount - gameState.foods.length), 500);
        }
        
        gameState.obstacles = gameState.obstacles.filter(obs => now - obs.createdAt < expireTime);
        
        const originalPowerUpCount = gameState.powerUps.length;
        gameState.powerUps = gameState.powerUps.filter(pu => now - pu.createdAt < expireTime);
        if (gameState.powerUps.length < originalPowerUpCount) {
            setTimeout(() => {
                if (gameState.isGameRunning) generatePowerUps();
            }, 500);
        }
    }

    function update() {
        updateItemsTimeout();
        updateLasers();
        updateExplosions();
        
        gameState.direction = { ...gameState.nextDirection };
        
        const head = { 
            x: gameState.snake[0].x + gameState.direction.x, 
            y: gameState.snake[0].y + gameState.direction.y 
        };
        
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
            takeDamage(2);
            if (gameState.health <= 0) {
                gameOver();
                return;
            }
            draw();
            return;
        }
        
        if (gameState.snake.some((segment, index) => 
            index !== 0 && segment.x === head.x && segment.y === head.y
        )) {
            takeDamage(1);
            if (gameState.health <= 0) {
                gameOver();
                return;
            }
        }
        
        const hitObstacle = gameState.obstacles.find(obs => 
            obs.x === head.x && obs.y === head.y
        );
        if (hitObstacle) {
            takeDamage(1);
            if (gameState.health <= 0) {
                gameOver();
                return;
            }
            draw();
            return;
        }
        
        const hitFood = gameState.foods.find(food => 
            food.x === head.x && food.y === head.y
        );
        if (hitFood) {
            handleFood(hitFood);
            gameState.foods = gameState.foods.filter(food => food !== hitFood);
            placeFood();
        } else {
            gameState.snake.pop();
        }
        
        const hitPowerUp = gameState.powerUps.find(pu => 
            pu.x === head.x && pu.y === head.y
        );
        if (hitPowerUp) {
            handlePowerUp(hitPowerUp);
            gameState.powerUps = gameState.powerUps.filter(pu => pu !== hitPowerUp);
            setTimeout(() => {
                if (gameState.isGameRunning) generatePowerUps();
            }, 1000);
        }
        
        gameState.snake.unshift(head);
        
        if (gameState.foodsEatenInLevel >= gameState.foodsToLevelUp) {
            levelUp();
            return;
        }
        
        updateUI();
        draw();
    }

    function handleFood(food) {
        if (food.type === 'normal') {
            gameState.score += 10;
            gameState.foodsEatenInLevel++;
        } else if (food.type === 'grow') {
            gameState.snake.push({ ...gameState.snake[gameState.snake.length - 1] });
            gameState.snake.push({ ...gameState.snake[gameState.snake.length - 1] });
            gameState.score += 5;
            gameState.foodsEatenInLevel++;
        } else if (food.type === 'shrink') {
            if (gameState.snake.length > 3) {
                gameState.snake.pop();
                gameState.snake.pop();
            }
            gameState.score += 5;
            gameState.foodsEatenInLevel++;
        }
        playSound('eat');
    }

    function handlePowerUp(powerUp) {
        if (powerUp.type === 'health') {
            gameState.health = Math.min(gameState.health + 2, gameState.maxHealth);
            playSound('powerup');
        } else if (powerUp.type === 'weapon') {
            gameState.ammo += 5;
            playSound('powerup');
            saveGame();
        }
    }

    function takeDamage(amount) {
        gameState.health -= amount;
        playSound('hurt');
        updateUI();
    }

    function shootLaser() {
        if (gameState.ammo <= 0 || !gameState.isGameRunning || gameState.isPaused) 
            return;
        
        gameState.ammo--;
        saveGame();
        updateUI();
        
        const head = gameState.snake[0];
        gameState.lasers.push({
            x: head.x * gridSize + gridSize / 2,
            y: head.y * gridSize + gridSize / 2,
            vx: gameState.direction.x * 28,
            vy: gameState.direction.y * 28,
            life: 3,
            maxDistance: gridSize * 8
        });
        
        playSound('shoot');
    }

    function levelUp() {
        gameState.level++;
        if (gameState.level > gameState.highestLevel) {
            gameState.highestLevel = gameState.level;
        }
        
        gameState.foodsEatenInLevel = 0;
        gameState.foodsToLevelUp = Math.max(4, 8 - gameState.level);
        
        gameState.isGameRunning = false;
        clearInterval(gameState.gameLoop);
        
        saveGame();
        
        elements.newLevel.textContent = gameState.level;
        elements.levelUp.classList.remove('hidden');
    }

    function continueToNextLevel() {
        elements.levelUp.classList.add('hidden');
        initGame();
        startGameLoop();
    }

    function gameOver() {
        gameState.isGameRunning = false;
        clearInterval(gameState.gameLoop);
        elements.mobileControls.classList.remove('visible');
        
        if (gameState.score > gameState.highScore) {
            gameState.highScore = gameState.score;
        }
        gameState.totalScore += gameState.score;
        gameState.lastPlayedLevel = gameState.level;
        
        saveGame();
        
        if (AuthState.user && !AuthState.isGuest) {
            saveScoreToServer(gameState.score, gameState.level);
        }
        
        elements.finalScore.textContent = gameState.score;
        elements.finalLevel.textContent = gameState.level;
        elements.gameOver.classList.remove('hidden');
    }

    async function saveScoreToServer(score, level) {
        if (!AuthState.user) return;
        try {
            await apiCall('/api/save-score', {
                method: 'POST',
                body: JSON.stringify({
                    userId: AuthState.user.id,
                    username: AuthState.user.username,
                    score,
                    level
                })
            });
        } catch (error) {
            console.error('Failed to save score:', error);
        }
    }

    function getGameSpeed() {
        return Math.max(100, 300 - gameState.level * 25);
    }

    function startGameLoop() {
        gameState.isGameRunning = true;
        gameState.isPaused = false;
        elements.pauseBtn.textContent = '暂停';
        gameState.gameLoop = setInterval(update, getGameSpeed());
        
        if (window.innerWidth <= 768) {
            elements.mobileControls.classList.add('visible');
        }
    }

    function startGame() {
        if (gameState.isGameRunning && !gameState.isPaused) 
            return;
        
        if (!gameState.isGameRunning) {
            initGame();
            startGameLoop();
            elements.startBtn.textContent = '重新开始';
        } else if (gameState.isPaused) {
            gameState.isPaused = false;
            elements.pauseBtn.textContent = '暂停';
            gameState.gameLoop = setInterval(update, getGameSpeed());
        }
    }

    function togglePause() {
        if (!gameState.isGameRunning) 
            return;
        
        if (gameState.isPaused) {
            gameState.isPaused = false;
            elements.pauseBtn.textContent = '暂停';
            gameState.gameLoop = setInterval(update, getGameSpeed());
        } else {
            gameState.isPaused = true;
            elements.pauseBtn.textContent = '继续';
            clearInterval(gameState.gameLoop);
        }
    }

    function restartGame() {
        elements.gameOver.classList.add('hidden');
        gameState.level = 1;
        initGame();
        startGameLoop();
    }

    function changeLevel(delta) {
        if (gameState.isGameRunning && !gameState.isPaused) 
            return;
        
        const newLevel = gameState.level + delta;
        if (newLevel >= 1 && newLevel <= gameState.highestLevel + 1) {
            gameState.level = newLevel;
            
            if (!gameState.isGameRunning) {
                initGame();
            }
            updateUI();
        }
    }

    function goToStartScreen() {
        gameState.isGameRunning = false;
        clearInterval(gameState.gameLoop);
        elements.mobileControls.classList.remove('visible');
        elements.gameContainer.classList.add('hidden');
        elements.startScreen.classList.remove('hidden');
        elements.gameOver.classList.add('hidden');
        elements.levelUp.classList.add('hidden');
    }

    function startGameFromMenu() {
        elements.gameStartOverlay.classList.remove('hidden');
        drawInstructionIcons();
    }

    function confirmStartGame() {
        initAudio();
        elements.startScreen.classList.add('hidden');
        elements.gameContainer.classList.remove('hidden');
        elements.gameStartOverlay.classList.add('hidden');
        initGame();
        startGameLoop();
    }

    function drawInstructionIcons() {
        const icons = document.querySelectorAll('.instruction-icon');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 32;
        tempCanvas.height = 32;
        const tempCtx = tempCanvas.getContext('2d');
        
        function drawIcon(type, ctx, size, centerX, centerY) {
            const radius = 10;
            ctx.clearRect(0, 0, size, size);
            
            if (type === 'normal-food' || type === 'grow-food' || type === 'shrink-food') {
                let color1, color2, color3, glowColor;
                if (type === 'normal-food') { color1 = '#7bed9f'; color2 = '#2ed573'; color3 = '#00b894'; glowColor = 'rgba(123, 237, 159, 0.6)'; }
                else if (type === 'grow-food') { color1 = '#74b9ff'; color2 = '#0984e3'; color3 = '#6c5ce7'; glowColor = 'rgba(116, 185, 255, 0.6)'; }
                else { color1 = '#ff7675'; color2 = '#d63031'; color3 = '#e17055'; glowColor = 'rgba(255, 118, 117, 0.6)'; }
                
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 8;
                const gradient = ctx.createRadialGradient(
                    centerX - radius * 0.35, centerY - radius * 0.35, 0,
                    centerX, centerY, radius
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
                gradient.addColorStop(0.25, color1);
                gradient.addColorStop(0.6, color2);
                gradient.addColorStop(1, color3);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
                ctx.fill();
            } else if (type === 'health' || type === 'weapon') {
                const emoji = type === 'health' ? '💖' : '🔫';
                const glowColor = type === 'health' ? 'rgba(255, 107, 157, 0.6)' : 'rgba(79, 172, 254, 0.6)';
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 8;
                ctx.font = '22px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(emoji, centerX, centerY);
            } else if (type === 'obstacle') {
                const obsSize = 12;
                ctx.shadowColor = '#ff6b9d';
                ctx.shadowBlur = 8;
                const gradient = ctx.createRadialGradient(
                    centerX - obsSize * 0.3, centerY - obsSize * 0.3, 0,
                    centerX, centerY, obsSize * 1.5
                );
                gradient.addColorStop(0, '#ff9ff3');
                gradient.addColorStop(0.3, '#ff6b9d');
                gradient.addColorStop(0.7, '#f5576c');
                gradient.addColorStop(1, '#ee5a24');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                const sides = 8;
                for (let i = 0; i <= sides; i++) {
                    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
                    const r = obsSize * (0.9 + Math.sin(angle * 3) * 0.1);
                    const px = centerX + Math.cos(angle) * r;
                    const py = centerY + Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                const hlGradient = ctx.createRadialGradient(
                    centerX - obsSize * 0.3, centerY - obsSize * 0.3, 0,
                    centerX, centerY, obsSize
                );
                hlGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                hlGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = hlGradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, obsSize * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        icons.forEach(canvas => {
            const iconCtx = canvas.getContext('2d');
            const type = canvas.dataset.type;
            drawIcon(type, iconCtx, 32, 16, 16);
        });
    }

    function showCharacterSelect() {
        elements.characterSelect.classList.toggle('visible');
        if (elements.characterSelect.classList.contains('visible')) {
            elements.customBtn.textContent = '返回';
        } else {
            elements.customBtn.textContent = '选择形象';
        }
    }

    document.addEventListener('keydown', (e) => {
        if (!elements.gameContainer.classList.contains('hidden')) {
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    e.preventDefault();
                    if (gameState.direction.y !== 1) gameState.nextDirection = { x: 0, y: -1 };
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    e.preventDefault();
                    if (gameState.direction.y !== -1) gameState.nextDirection = { x: 0, y: 1 };
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    e.preventDefault();
                    if (gameState.direction.x !== 1) gameState.nextDirection = { x: -1, y: 0 };
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    e.preventDefault();
                    if (gameState.direction.x !== -1) gameState.nextDirection = { x: 1, y: 0 };
                    break;
                case ' ':
                    e.preventDefault();
                    if (!gameState.isGameRunning) {
                        startGame();
                    } else {
                        togglePause();
                    }
                    break;
                case 'j':
                case 'J':
                    shootLaser();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (!elements.gameOver.classList.contains('hidden')) {
                        restartGame();
                    } else if (!elements.levelUp.classList.contains('hidden')) {
                        continueToNextLevel();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    goToStartScreen();
                    break;
            }
        }
    });

    elements.charactersGrid.addEventListener('click', (e) => {
        const charItem = e.target.closest('.character-item');
        if (charItem) {
            selectCharacter(parseInt(charItem.dataset.character));
        }
    });

    elements.controlUp.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.direction.y !== 1) gameState.nextDirection = { x: 0, y: -1 };
    });
    elements.controlDown.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.direction.y !== -1) gameState.nextDirection = { x: 0, y: 1 };
    });
    elements.controlLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.direction.x !== 1) gameState.nextDirection = { x: -1, y: 0 };
    });
    elements.controlRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.direction.x !== -1) gameState.nextDirection = { x: 1, y: 0 };
    });
    elements.controlCenter.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!gameState.isGameRunning) {
            startGame();
        } else {
            togglePause();
        }
    });
    elements.shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        shootLaser();
    });

    elements.startBtn.addEventListener('click', startGame);
    elements.pauseBtn.addEventListener('click', togglePause);
    elements.restartBtn.addEventListener('click', restartGame);
    elements.continueBtn.addEventListener('click', continueToNextLevel);
    elements.prevLevelBtn.addEventListener('click', () => changeLevel(-1));
    elements.nextLevelBtn.addEventListener('click', () => changeLevel(1));
    elements.playBtn.addEventListener('click', startGameFromMenu);
    elements.confirmStartBtn.addEventListener('click', confirmStartGame);
    elements.customBtn.addEventListener('click', showCharacterSelect);
    elements.backToMenuBtn.addEventListener('click', goToStartScreen);
    elements.backToMenuFromGameOverBtn.addEventListener('click', goToStartScreen);
    elements.backToMenuFromLevelUpBtn.addEventListener('click', goToStartScreen);
    elements.backToMenuFromMobileBtn.addEventListener('click', goToStartScreen);

    function drawItemIcons() {
        const icons = document.querySelectorAll('.item-icon');
        icons.forEach(canvas => {
            const iconCtx = canvas.getContext('2d');
            const size = 32;
            const centerX = size / 2;
            const centerY = size / 2;
            const type = canvas.dataset.type;
            const radius = 10;
            
            iconCtx.clearRect(0, 0, size, size);
            
            if (type === 'normal-food' || type === 'grow-food' || type === 'shrink-food') {
                let color1, color2, color3, glowColor;
                if (type === 'normal-food') { color1 = '#7bed9f'; color2 = '#2ed573'; color3 = '#00b894'; glowColor = 'rgba(123, 237, 159, 0.6)'; }
                else if (type === 'grow-food') { color1 = '#74b9ff'; color2 = '#0984e3'; color3 = '#6c5ce7'; glowColor = 'rgba(116, 185, 255, 0.6)'; }
                else { color1 = '#ff7675'; color2 = '#d63031'; color3 = '#e17055'; glowColor = 'rgba(255, 118, 117, 0.6)'; }
                
                iconCtx.shadowColor = glowColor;
                iconCtx.shadowBlur = 8;
                const gradient = iconCtx.createRadialGradient(
                    centerX - radius * 0.35, centerY - radius * 0.35, 0,
                    centerX, centerY, radius
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
                gradient.addColorStop(0.25, color1);
                gradient.addColorStop(0.6, color2);
                gradient.addColorStop(1, color3);
                iconCtx.fillStyle = gradient;
                iconCtx.beginPath();
                iconCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                iconCtx.fill();
                iconCtx.shadowBlur = 0;
                iconCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                iconCtx.beginPath();
                iconCtx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
                iconCtx.fill();
            } else if (type === 'health' || type === 'weapon') {
                const emoji = type === 'health' ? '💖' : '🔫';
                const glowColor = type === 'health' ? 'rgba(255, 107, 157, 0.6)' : 'rgba(79, 172, 254, 0.6)';
                iconCtx.shadowColor = glowColor;
                iconCtx.shadowBlur = 8;
                iconCtx.font = '22px Arial';
                iconCtx.textAlign = 'center';
                iconCtx.textBaseline = 'middle';
                iconCtx.fillText(emoji, centerX, centerY);
            } else if (type === 'obstacle') {
                const size = 12;
                iconCtx.shadowColor = '#ff6b9d';
                iconCtx.shadowBlur = 8;
                const gradient = iconCtx.createRadialGradient(
                    centerX - size * 0.3, centerY - size * 0.3, 0,
                    centerX, centerY, size * 1.5
                );
                gradient.addColorStop(0, '#ff9ff3');
                gradient.addColorStop(0.3, '#ff6b9d');
                gradient.addColorStop(0.7, '#f5576c');
                gradient.addColorStop(1, '#ee5a24');
                iconCtx.fillStyle = gradient;
                iconCtx.beginPath();
                const sides = 8;
                for (let i = 0; i <= sides; i++) {
                    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
                    const r = size * (0.9 + Math.sin(angle * 3) * 0.1);
                    const px = centerX + Math.cos(angle) * r;
                    const py = centerY + Math.sin(angle) * r;
                    if (i === 0) iconCtx.moveTo(px, py);
                    else iconCtx.lineTo(px, py);
                }
                iconCtx.closePath();
                iconCtx.fill();
                iconCtx.shadowBlur = 0;
                const hlGradient = iconCtx.createRadialGradient(
                    centerX - size * 0.3, centerY - size * 0.3, 0,
                    centerX, centerY, size
                );
                hlGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                hlGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                iconCtx.fillStyle = hlGradient;
                iconCtx.beginPath();
                iconCtx.arc(centerX, centerY, size * 0.8, 0, Math.PI * 2);
                iconCtx.fill();
            }
        });
    }

    loadSave();
    createCharacterGrid();
    createColorGrid();
    drawItemIcons();

    elements.charactersGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.character-item');
        if (item) {
            selectCharacter(parseInt(item.dataset.character));
        }
    });

    elements.colorGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.color-item');
        if (item) {
            selectBodyColor(parseInt(item.dataset.color));
        }
    });
});
