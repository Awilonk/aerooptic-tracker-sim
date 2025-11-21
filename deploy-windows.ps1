# Windows PowerShell 部署脚本
# 用于从 Windows 部署到 Linux 服务器

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Aerooptic Tracker Sim 部署脚本" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 服务器配置
$SERVER_IP = "125.208.17.98"
$SERVER_USER = "root"
$SERVER_PASSWORD = "IC7taOMkKBQc"

Write-Host "📦 步骤 1/6: 构建项目..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败！" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📤 步骤 2/6: 压缩构建文件..." -ForegroundColor Yellow
Compress-Archive -Path "dist\*" -DestinationPath "dist.zip" -Force

Write-Host ""
Write-Host "🔐 步骤 3/6: 配置 SSH 连接..." -ForegroundColor Yellow
Write-Host "提示: 首次连接需要输入密码: $SERVER_PASSWORD" -ForegroundColor Gray

# 检查是否安装了 SSH 客户端
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 SSH 客户端。请安装 OpenSSH 客户端。" -ForegroundColor Red
    Write-Host "可以通过以下方式安装:" -ForegroundColor Yellow
    Write-Host "  设置 -> 应用 -> 可选功能 -> 添加功能 -> OpenSSH 客户端" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "🚀 步骤 4/6: 上传文件到服务器..." -ForegroundColor Yellow
Write-Host "使用 SCP 上传文件 (需要输入密码: $SERVER_PASSWORD)" -ForegroundColor Gray

# 使用 SCP 上传 (需要手动输入密码)
scp dist.zip "${SERVER_USER}@${SERVER_IP}:/tmp/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 上传失败！请检查网络连接和服务器信息。" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⚙️  步骤 5/6: 在服务器上部署..." -ForegroundColor Yellow

# 创建部署脚本
$deployScript = @'
#!/bin/bash
set -e

echo "开始部署..."

# 安装必要的软件
if ! command -v nginx &> /dev/null; then
    echo "安装 Nginx..."
    yum install -y nginx unzip
fi

if ! command -v unzip &> /dev/null; then
    yum install -y unzip
fi

# 创建部署目录
mkdir -p /var/www/aerooptic-tracker-sim

# 清空旧文件
rm -rf /var/www/aerooptic-tracker-sim/*

# 解压文件
cd /var/www/aerooptic-tracker-sim
unzip -q /tmp/dist.zip

# 清理临时文件
rm /tmp/dist.zip

# 设置权限
chown -R nginx:nginx /var/www/aerooptic-tracker-sim
chmod -R 755 /var/www/aerooptic-tracker-sim

# 配置 Nginx
cat > /etc/nginx/conf.d/aerooptic.conf << 'NGINXCONF'
server {
    listen 80;
    server_name _;
    root /var/www/aerooptic-tracker-sim;
    index index.html;

    access_log /var/log/nginx/aerooptic-access.log;
    error_log /var/log/nginx/aerooptic-error.log;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.glb$ {
        add_header Content-Type "model/gltf-binary";
        expires 1y;
        add_header Cache-Control "public";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
NGINXCONF

# 测试 Nginx 配置
nginx -t

# 启动 Nginx
systemctl enable nginx
systemctl restart nginx

# 配置防火墙
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload
fi

echo "✅ 部署完成！"
echo "访问地址: http://$(hostname -I | awk '{print $1}')"
'@

# 将脚本保存到临时文件
$deployScript | Out-File -FilePath "deploy-remote.sh" -Encoding UTF8

# 上传部署脚本
Write-Host "上传部署脚本..." -ForegroundColor Gray
scp deploy-remote.sh "${SERVER_USER}@${SERVER_IP}:/tmp/"

# 执行部署脚本
Write-Host "执行远程部署..." -ForegroundColor Gray
ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x /tmp/deploy-remote.sh && /tmp/deploy-remote.sh && rm /tmp/deploy-remote.sh"

Write-Host ""
Write-Host "🧹 步骤 6/6: 清理临时文件..." -ForegroundColor Yellow
Remove-Item -Path "dist.zip" -Force
Remove-Item -Path "deploy-remote.sh" -Force

Write-Host ""
Write-Host "🎉 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "访问地址: http://$SERVER_IP" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示:" -ForegroundColor Yellow
Write-Host "  - 如果无法访问，请检查服务器防火墙设置" -ForegroundColor Gray
Write-Host "  - 查看日志: ssh root@$SERVER_IP 'tail -f /var/log/nginx/aerooptic-error.log'" -ForegroundColor Gray
Write-Host ""
