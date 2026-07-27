# 🐍 萌蛇大觅食 - 部署指南

## 方案一：Render.com（推荐，永久免费）

### 1. 注册账号
1. 访问 https://render.com
2. 使用 GitHub 账号注册（需要先注册 GitHub）
3. 或者使用邮箱直接注册

### 2. 创建 GitHub 仓库
1. 访问 https://github.com/new
2. Repository name 填写：`snake-game`
3. 选择 Public 或 Private
4. 创建后，将本地文件推送到 GitHub

**在项目目录执行以下命令：**
```bash
cd 你的项目路径
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/snake-game.git
git push -u origin main
```

### 3. 在 Render 上部署
1. 登录 https://render.com
2. 点击 **New +** 选择 **Web Service**
3. 选择你的 GitHub 仓库
4. Configure 页面配置：
   - Environment: **Node**
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. 点击 **Create Web Service**
6. 等待部署完成（约1分钟）
7. 获得永久公网地址：`https://your-app-name.onrender.app`

### 4. 保存数据（重要）
Render 的免费版文件系统是临时的，重启后会丢失数据。

**解决方法：** 使用 Render 的 PostgreSQL 数据库（免费）
1. 在 Render 点击 **New +** 选择 **Database** → **PostgreSQL**
2. 创建后，在服务的 Environment 变量中添加：
   - `DATABASE_URL` = 数据库连接字符串
3. （可选）后续升级代码使用数据库

---

## 方案二：Railway.app（支持长时运行）

### 1. 注册账号
1. 访问 https://railway.app
2. 使用 GitHub 账号注册

### 2. 部署
1. 点击 **+ New Project**
2. 选择 **Deploy from GitHub repo**
3. 选择你的 snake-game 仓库
4. 等待部署完成
5. 在 Settings → Networking 获取公网 URL

### 3. 设置持久化存储
1. 在项目中添加 **Volume**（持久化卷）
2. 将 `/data` 路径挂载
3. 修改 server.js 中的 DATA_FILE 为 `/data/game_data.json`

---

## 方案三：本地运行 + 内网穿透（最简单）

### 1. 安装 ngrok（国内可用）
```bash
# 下载 ngrok
# 访问 https://ngrok.com 注册账号
# 下载后运行
ngrok http 3000
```

### 2. 使用国内替代方案
```bash
# 使用 cpolar（国内服务）
# 访问 https://www.cpolar.com 注册
# 启动后获得公网地址
```

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动服务器
node server.js

# 访问
# http://localhost:3000
```

## 项目结构

```
snake-game/
├── index.html          # 游戏页面
├── styles.css          # 样式文件
├── script.js           # 游戏逻辑
├── server.js           # 后端服务器
├── game_data.json      # 用户数据（自动生成）
├── package.json        # 依赖配置
└── render.yaml         # Render 部署配置
```

## API 接口

- `POST /api/register` - 注册账号
- `POST /api/login` - 登录
- `POST /api/check-username` - 检查用户名
- `POST /api/save-score` - 保存分数
- `GET /api/leaderboard` - 获取排行榜
- `GET /api/user-stats/:userId` - 获取用户统计

## 注意事项

1. **免费版限制**：Render 免费版会自动休眠，访问时需等待唤醒
2. **数据备份**：定期导出 game_data.json 备份
3. **HTTPS**：部署平台自动提供 HTTPS
4. **CORS**：已配置支持跨域访问
