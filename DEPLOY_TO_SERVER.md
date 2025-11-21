# 部署到您的服务器指南

## 服务器信息
- **IP地址**: 125.208.17.98
- **用户名**: root
- **密码**: IC7taOMkKBQc

---

## 🚀 方法1：自动化部署（推荐）

### 使用 PowerShell 脚本一键部署

1. **打开 PowerShell**（以管理员身份）

2. **运行部署脚本**
   ```powershell
   cd "c:\Users\86132\Downloads\aerooptic-tracker-sim (2)"
   .\deploy-windows.ps1
   ```

3. **输入密码**
   - 脚本会提示输入服务器密码
   - 密码: `IC7taOMkKBQc`
   - 可能需要输入2-3次（SCP上传和SSH连接）

4. **等待完成**
   - 脚本会自动完成所有步骤
   - 完成后访问: http://125.208.17.98

### 如果遇到问题

如果 PowerShell 脚本执行被阻止：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📝 方法2：手动部署

### 步骤 1: 构建项目

在本地 PowerShell 中运行：
```powershell
cd "c:\Users\86132\Downloads\aerooptic-tracker-sim (2)"
npm run build
```

### 步骤 2: 压缩构建文件

```powershell
Compress-Archive -Path "dist\*" -DestinationPath "dist.zip" -Force
```

### 步骤 3: 上传到服务器

使用 SCP 上传（需要先安装 OpenSSH 客户端）：
```powershell
scp dist.zip root@125.208.17.98:/tmp/
# 输入密码: IC7taOMkKBQc
```

**或者使用 WinSCP 图形界面：**
1. 下载 WinSCP: https://winscp.net/
2. 连接信息：
   - 主机: 125.208.17.98
   - 用户名: root
   - 密码: IC7taOMkKBQc
3. 上传 `dist.zip` 到 `/tmp/` 目录

### 步骤 4: 连接到服务器

使用 SSH 连接：
```powershell
ssh root@125.208.17.98
# 输入密码: IC7taOMkKBQc
```

**或者使用 PuTTY：**
1. 下载 PuTTY: https://www.putty.org/
2. 主机: 125.208.17.98
3. 端口: 22
4. 用户名: root
5. 密码: IC7taOMkKBQc

### 步骤 5: 在服务器上执行部署

连接到服务器后，执行以下命令：

```bash
# 1. 安装必要软件
yum install -y nginx unzip

# 2. 创建部署目录
mkdir -p /var/www/aerooptic-tracker-sim

# 3. 清空旧文件（如果有）
rm -rf /var/www/aerooptic-tracker-sim/*

# 4. 解压文件
cd /var/www/aerooptic-tracker-sim
unzip /tmp/dist.zip

# 5. 设置权限
chown -R nginx:nginx /var/www/aerooptic-tracker-sim
chmod -R 755 /var/www/aerooptic-tracker-sim

# 6. 配置 Nginx
cat > /etc/nginx/conf.d/aerooptic.conf << 'EOF'
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
EOF

# 7. 测试 Nginx 配置
nginx -t

# 8. 启动 Nginx
systemctl enable nginx
systemctl restart nginx

# 9. 配置防火墙
firewall-cmd --permanent --add-service=http
firewall-cmd --reload

# 10. 清理临时文件
rm /tmp/dist.zip

echo "✅ 部署完成！"
echo "访问地址: http://125.208.17.98"
```

---

## 🌐 访问网站

部署完成后，在浏览器中访问：

**http://125.208.17.98**

---

## 🔧 故障排查

### 1. 无法访问网站

检查 Nginx 状态：
```bash
systemctl status nginx
```

查看错误日志：
```bash
tail -f /var/log/nginx/aerooptic-error.log
```

### 2. 防火墙问题

检查防火墙状态：
```bash
firewall-cmd --list-all
```

确保 HTTP 服务已开放：
```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
```

### 3. 文件权限问题

重新设置权限：
```bash
chown -R nginx:nginx /var/www/aerooptic-tracker-sim
chmod -R 755 /var/www/aerooptic-tracker-sim
```

### 4. Nginx 配置错误

测试配置：
```bash
nginx -t
```

重新加载配置：
```bash
systemctl reload nginx
```

---

## 🔄 更新部署

当代码更新后，重新部署：

### 快速更新
```powershell
# 在本地运行
cd "c:\Users\86132\Downloads\aerooptic-tracker-sim (2)"
.\deploy-windows.ps1
```

### 手动更新
1. 本地构建: `npm run build`
2. 压缩: `Compress-Archive -Path "dist\*" -DestinationPath "dist.zip" -Force`
3. 上传: `scp dist.zip root@125.208.17.98:/tmp/`
4. 在服务器上解压并替换文件

---

## 📊 监控和维护

### 查看访问日志
```bash
tail -f /var/log/nginx/aerooptic-access.log
```

### 查看错误日志
```bash
tail -f /var/log/nginx/aerooptic-error.log
```

### 重启 Nginx
```bash
systemctl restart nginx
```

### 查看磁盘使用
```bash
df -h
```

---

## 🎯 下一步

### 配置域名（可选）

如果您有域名，可以配置：

1. 将域名 A 记录指向: 125.208.17.98
2. 修改 Nginx 配置中的 `server_name`:
   ```bash
   nano /etc/nginx/conf.d/aerooptic.conf
   # 将 server_name _; 改为 server_name yourdomain.com;
   ```
3. 重启 Nginx: `systemctl reload nginx`

### 配置 HTTPS（推荐）

使用 Let's Encrypt 免费证书：
```bash
yum install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

## 📞 需要帮助？

如果遇到问题：
1. 检查上面的故障排查部分
2. 查看 Nginx 日志
3. 确认防火墙设置
4. 联系技术支持

---

## ⚠️ 重要提示

- 服务器到期时间: 2025-11-28
- 请及时续费以避免服务中断
- 建议定期备份网站文件
- 定期更新系统安全补丁: `yum update`
