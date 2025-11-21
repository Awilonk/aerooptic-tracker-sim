# 部署指南

本项目支持多种一键部署方式，推荐使用 Vercel 或 Netlify。

## 🚀 方案1：Vercel 部署（推荐）

### 一键部署步骤

1. **访问 Vercel**
   - 打开 [https://vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "Add New..." → "Project"
   - 选择你的 GitHub 仓库：`Awilonk/aerooptic-tracker-sim`
   - 点击 "Import"

3. **配置项目**（通常自动检测，无需修改）
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **部署**
   - 点击 "Deploy" 按钮
   - 等待 2-3 分钟
   - 完成！会得到一个 `.vercel.app` 域名

### 自动部署

配置完成后，每次推送到 `main` 分支都会自动部署！

### Vercel CLI 部署（可选）

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel

# 部署到生产环境
vercel --prod
```

### 优势
- ✅ 自动检测 Vite 项目
- ✅ 全球 CDN 加速
- ✅ 自动 HTTPS
- ✅ 每次 git push 自动部署
- ✅ 预览部署（PR 自动生成预览链接）
- ✅ 免费额度充足

---

## 🌐 方案2：Netlify 部署

### 一键部署

点击下面的按钮直接部署：

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Awilonk/aerooptic-tracker-sim)

### 手动部署步骤

1. **访问 Netlify**
   - 打开 [https://app.netlify.com](https://app.netlify.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "Add new site" → "Import an existing project"
   - 选择 "GitHub"
   - 选择仓库：`Awilonk/aerooptic-tracker-sim`

3. **配置构建设置**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - 点击 "Deploy site"

4. **完成**
   - 等待部署完成
   - 获得 `.netlify.app` 域名

### Netlify CLI 部署（可选）

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 初始化
netlify init

# 部署
netlify deploy

# 部署到生产环境
netlify deploy --prod
```

---

## 🐳 方案3：Docker 部署（自有服务器）

如果你有自己的服务器，可以使用 Docker 部署。

### Dockerfile 已配置

项目已包含 `Dockerfile`，直接使用：

```bash
# 构建镜像
docker build -t aerooptic-tracker-sim .

# 运行容器
docker run -d -p 3000:3000 aerooptic-tracker-sim
```

### Docker Compose

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down
```

访问 `http://your-server-ip:3000`

---

## 📦 方案4：传统服务器部署

### 构建项目

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build
```

### 部署到 Nginx

1. 将 `dist` 文件夹内容上传到服务器
2. 配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/aerooptic-tracker-sim;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 处理大文件（GLB模型）
    client_max_body_size 50M;
    
    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

3. 重启 Nginx：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## ⚡ 性能优化建议

### 1. GLB 文件优化

当前 GLB 文件较大（F-117: 26MB），建议优化：

```bash
# 使用 gltf-pipeline 压缩
npm install -g gltf-pipeline

# 压缩 GLB 文件
gltf-pipeline -i input.glb -o output.glb -d
```

### 2. 启用 CDN

- Vercel 和 Netlify 自动提供 CDN
- 自有服务器可使用 Cloudflare CDN

### 3. 环境变量

如果需要配置环境变量，创建 `.env.production`：

```env
VITE_API_URL=https://your-api.com
```

---

## 🔧 故障排查

### 部署失败

1. **检查 Node 版本**
   - 确保使用 Node 18 或更高版本
   - 在 Vercel/Netlify 设置中指定 Node 版本

2. **检查构建日志**
   - 查看部署平台的构建日志
   - 确认所有依赖都已安装

3. **GLB 文件过大**
   - 如果部署超时，考虑使用 Git LFS
   - 或将 GLB 文件托管到 CDN

### 运行时错误

1. **检查浏览器控制台**
   - 查看是否有 CORS 错误
   - 确认 GLB 文件路径正确

2. **下载调试日志**
   - 使用界面上的"下载日志"按钮
   - 或在控制台运行 `downloadLogs()`

---

## 📊 推荐选择

| 需求 | 推荐方案 | 原因 |
|------|---------|------|
| 快速部署 | Vercel | 一键部署，自动配置 |
| 国内访问 | 自有服务器 + CDN | 速度更快 |
| 团队协作 | Netlify | 预览部署功能强大 |
| 完全控制 | Docker | 可自定义所有配置 |

---

## 🎯 快速开始（推荐）

最简单的方式：

1. 访问 [https://vercel.com](https://vercel.com)
2. 点击 "Import Project"
3. 选择你的 GitHub 仓库
4. 点击 "Deploy"
5. 完成！🎉

部署后会自动获得：
- ✅ HTTPS 域名
- ✅ 全球 CDN
- ✅ 自动部署（每次 git push）
- ✅ 性能监控
- ✅ 免费使用

---

## 📞 需要帮助？

如果部署遇到问题，请：
1. 查看部署平台的构建日志
2. 检查浏览器控制台错误
3. 下载调试日志文件
4. 提交 GitHub Issue
