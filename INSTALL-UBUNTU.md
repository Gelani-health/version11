# Gelani AI Healthcare Assistant - Ubuntu Server Installation Guide

## 📦 Package Contents

- `ai-healthcare-bahmni.tar.gz` - Complete application (613KB)
- This installation guide

---

## 📋 Step 1: Copy to USB

### On This Machine:

```bash
# The archive is ready at:
/home/z/ai-healthcare-bahmni.tar.gz

# Copy it to your USB drive:
# 1. Insert USB drive
# 2. Copy the file: ai-healthcare-bahmni.tar.gz
# 3. Eject USB safely
```

---

## 🖥️ Step 2: On Ubuntu Server

### 2.1 Login to your Ubuntu Server

```bash
ssh your-user@your-server-ip
```

### 2.2 Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Bun (faster alternative to npm)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install build tools
sudo apt install -y build-essential python3

# Verify installations
node --version   # Should show v20.x.x
bun --version    # Should show 1.x.x
```

### 2.3 Create Project Directory

```bash
# Create directory for the app
sudo mkdir -p /opt/ai-healthcare
sudo chown $USER:$USER /opt/ai-healthcare
cd /opt/ai-healthcare
```

### 2.4 Copy from USB

```bash
# Mount USB (usually /media/username/USBNAME or /mnt/usb)
# Example:
cp /media/$USER/YOUR_USB/ai-healthcare-bahmni.tar.gz .

# Or if using scp from another machine:
# scp user@source-machine:/home/z/ai-healthcare-bahmni.tar.gz .
```

### 2.5 Extract and Install

```bash
# Extract the archive
tar -xzvf ai-healthcare-bahmni.tar.gz

# Move contents to current directory
mv my-project/* .
mv my-project/.* . 2>/dev/null || true
rm -rf my-project

# Install dependencies
bun install
# OR if using npm:
# npm install

# Initialize database
bun run db:push
# OR: npm run db:push
```

---

## 🚀 Step 3: Configure and Run

### 3.1 Create Environment File

```bash
# Create .env.local file
cat > .env.local << 'EOF'
# Database
DATABASE_URL="file:./db/healthcare.db"

# Bahmni Configuration
BAHMNI_URL="https://your-bahmni-server.org"
BAHMNI_FHIR_ENDPOINT="/openmrs/ws/fhir2/R4"

# AI Configuration
AI_MODEL="medgemma"
AI_TEMPERATURE="0.7"

# Feature Flags
ENABLE_CLINICAL_DECISION_SUPPORT="true"
ENABLE_DRUG_INTERACTION_CHECK="true"
ENABLE_IMAGE_ANALYSIS="true"
ENABLE_VOICE_TRANSCRIPTION="true"

# Safety Settings
REQUIRE_HUMAN_REVIEW="true"
SAFETY_ALERT_THRESHOLD="0.8"
EOF
```

### 3.2 Run the Application

```bash
# Development mode
bun run dev

# OR production build
bun run build
bun run start
```

### 3.3 Access the Application

Open in browser: `http://YOUR_SERVER_IP:3000`

---

## 🔧 Step 4: Run as System Service (Production)

### Create systemd service:

```bash
sudo nano /etc/systemd/system/ai-healthcare.service
```

### Paste this content:

```ini
[Unit]
Description=AI Healthcare Assistant
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/ai-healthcare
ExecStart=/home/YOUR_USERNAME/.bun/bin/bun run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Enable and start:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable ai-healthcare

# Start service
sudo systemctl start ai-healthcare

# Check status
sudo systemctl status ai-healthcare

# View logs
journalctl -u ai-healthcare -f
```

---

## 🌐 Step 5: Configure Firewall

```bash
# Allow port 3000
sudo ufw allow 3000/tcp

# Or if using nginx proxy:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

---

## 🔒 Step 6: Optional - Nginx Reverse Proxy with SSL

### Install Nginx:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/ai-healthcare
```

### Paste:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable and get SSL:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ai-healthcare /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

---

## 📊 Quick Reference Commands

| Task | Command |
|------|---------|
| Start app | `bun run dev` or `bun run start` |
| Stop service | `sudo systemctl stop ai-healthcare` |
| Restart service | `sudo systemctl restart ai-healthcare` |
| View logs | `journalctl -u ai-healthcare -f` |
| Update code | Copy new tar.gz, extract, `bun install`, restart |
| Check port | `netstat -tlnp | grep 3000` |

---

## 🐛 Troubleshooting

### Port 3000 already in use:
```bash
# Find process using port
sudo lsof -i :3000
# Kill it
sudo kill -9 <PID>
```

### Permission denied:
```bash
# Fix permissions
sudo chown -R $USER:$USER /opt/ai-healthcare
chmod -R 755 /opt/ai-healthcare
```

### Database issues:
```bash
# Reset database
rm -f db/healthcare.db
bun run db:push
```

---

## ✅ Verification Checklist

- [ ] Node.js 20+ installed
- [ ] Bun installed
- [ ] Dependencies installed (`bun install`)
- [ ] Database initialized (`bun run db:push`)
- [ ] Environment file created (`.env.local`)
- [ ] Application running on port 3000
- [ ] Firewall configured
- [ ] Systemd service enabled (optional)
- [ ] Nginx proxy configured (optional)

---

## 📞 Support

If you encounter issues:
1. Check logs: `journalctl -u ai-healthcare -f`
2. Check if port is in use: `netstat -tlnp | grep 3000`
3. Verify environment: `node --version && bun --version`

---

**Your application will be available at:** `http://YOUR_SERVER_IP:3000`
