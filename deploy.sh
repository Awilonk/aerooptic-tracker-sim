#!/bin/bash

# 自动化部署脚本
# 用于将项目部署到远程服务器

set -e

echo "=========================================="
echo "  Aerooptic Tracker Sim 部署脚本"
echo "=========================================="
echo ""

# 服务器配置
SERVER_IP="125.208.17.98"
SERVER_USER="root"
DEPLOY_PATH="/var/www/aerooptic-tracker-sim"
NGINX_CONF="/etc/nginx/conf.d/aerooptic.conf"

echo "📦 步骤 1/5: 构建项目..."
npm run build

echo ""
echo "📤 步骤 2/5: 压缩构建文件..."
cd dist
tar -czf ../dist.tar.gz .
cd ..

echo ""
echo "🚀 步骤 3/5: 上传到服务器..."
scp dist.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/

echo ""
echo "⚙️  步骤 4/5: 在服务器上解压和配置..."
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
# 创建部署目录
mkdir -p /var/www/aerooptic-tracker-sim

# 解压文件
cd /var/www/aerooptic-tracker-sim
tar -xzf /tmp/dist.tar.gz

# 清理临时文件
rm /tmp/dist.tar.gz

# 设置权限
chown -R nginx:nginx /var/www/aerooptic-tracker-sim
chmod -R 755 /var/www/aerooptic-tracker-sim

echo "✅ 文件部署完成"
ENDSSH

echo ""
echo "🌐 步骤 5/5: 配置 Nginx..."
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
# 检查 Nginx 是否安装
if ! command -v nginx &> /dev/null; then
    echo "安装 Nginx..."
    yum install -y nginx
fi

# 创建 Nginx 配置
cat > /etc/nginx/conf.d/aerooptic.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/aerooptic-tracker-sim;
    index index.html;

    # 日志
    access_log /var/log/nginx/aerooptic-access.log;
    error_log /var/log/nginx/aerooptic-error.log;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # GLB 文件特殊处理
    location ~* \.glb$ {
        add_header Content-Type "model/gltf-binary";
        expires 1y;
        add_header Cache-Control "public";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
EOF

# 测试 Nginx 配置
nginx -t

# 启动或重启 Nginx
systemctl enable nginx
systemctl restart nginx

# 配置防火墙
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload
fi

echo "✅ Nginx 配置完成"
ENDSSH

echo ""
echo "🎉 部署完成！"
echo ""
echo "访问地址: http://${SERVER_IP}"
echo ""
echo "=========================================="

# 清理本地临时文件
rm -f dist.tar.gz

echo ""
echo "提示: 如果需要配置域名，请修改 Nginx 配置中的 server_name"
