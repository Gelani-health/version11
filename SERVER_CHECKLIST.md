# 📋 Server Setup Checklist

Complete guide to match the system on your new server.

---

## ✅ Pre-Installation Checklist

Before starting, make sure you have:

| Item | Status | Notes |
|------|--------|-------|
| Server access | ⬜ | SSH credentials or console access |
| Server IP | ⬜ | e.g., `123.45.67.89` |
| Domain (optional) | ⬜ | e.g., `gelani.yourdomain.com` |
| AI API Key | ⬜ | OpenAI, Anthropic, or z-ai key |

---

## 🖥️ Step 1: Server Requirements

### Minimum Hardware

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 2 GB | 4 GB |
| Storage | 20 GB | 50 GB |
| CPU | 1 core | 2 cores |
| OS | Ubuntu 20.04 | Ubuntu 22.04 LTS |

### Software to Install

```bash
# Update server
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install Git
apt install -y git

# Install PM2 (keeps app running)
npm install -g pm2

# Verify installations
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
git --version    # Should show 2.x.x
```

---

## 📥 Step 2: Download Code

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone repository
git clone https://github.com/MK428NP/gelani-healthcare-assistant.git

# Enter directory
cd gelani-healthcare-assistant
```

---

## 📦 Step 3: Install Dependencies

```bash
# Install all packages
npm install

# This will install:
# - Next.js (web framework)
# - Prisma (database)
# - Radix UI components
# - All other dependencies
```

**Wait 2-5 minutes** for installation to complete.

---

## 🗄️ Step 4: Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma db push
```

This creates a SQLite database file at `prisma/dev.db`.

---

## ⚙️ Step 5: Create Environment File

Create `.env` file:

```bash
nano .env
```

**Copy and paste this:**

```env
# ===========================================
# DATABASE CONFIGURATION
# ===========================================
# SQLite database (file-based, no setup needed)
DATABASE_URL="file:./dev.db"

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3000
NODE_ENV="production"

# ===========================================
# AI API CONFIGURATION (Required for AI features)
# ===========================================
# Option A: z-ai-web-dev-sdk (if you have access)
# Z_AI_API_KEY="your-z-ai-api-key"

# Option B: OpenAI (recommended)
# OPENAI_API_KEY="sk-your-openai-api-key"

# Option C: Anthropic Claude
# ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"

# ===========================================
# BAHMNI INTEGRATION (Optional)
# ===========================================
# BAHMNI_URL="https://your-bahmni-server.com"
# BAHMNI_USERNAME="your-username"
# BAHMNI_PASSWORD="your-password"

# ===========================================
# ODOO INTEGRATION (Optional)
# ===========================================
# ODOO_URL="https://your-company.odoo.com"
# ODOO_DATABASE="your-database"
# ODOO_API_KEY="your-api-key"
```

**Save:** Press `Ctrl + O`, then `Enter`
**Exit:** Press `Ctrl + X`

---

## 🔨 Step 6: Build Application

```bash
# Build for production
npm run build
```

**Wait 1-3 minutes** for build to complete.

---

## 🚀 Step 7: Start Application

### Start with PM2 (Recommended)

```bash
# Start application
pm2 start npm --name "gelani" -- start

# Save PM2 configuration
pm2 save

# Enable auto-start on server reboot
pm2 startup
# (Copy and run the command it shows you)
```

### Check Status

```bash
pm2 status
```

Should show:
```
┌─────┬──────────┬─────────┬─────────┐
│ id  │ name     │ status  │ port    │
├─────┼──────────┼─────────┼─────────┤
│ 0   │ gelani   │ online  │ 3000    │
└─────┴──────────┴─────────┴─────────┘
```

---

## 🌐 Step 8: Access Application

### From Browser

Open: `http://YOUR_SERVER_IP:3000`

### If Not Accessible

Check firewall:
```bash
# Allow port 3000
ufw allow 3000

# Or use Nginx reverse proxy (recommended)
```

---

## 🔒 Step 9: Setup Nginx (Recommended)

### Install Nginx

```bash
apt install -y nginx
```

### Create Configuration

```bash
nano /etc/nginx/sites-available/gelani
```

**Paste this:**

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or use server IP

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

### Enable Site

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/gelani /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

Now access at: `http://your-domain.com` (without port)

---

## 🔐 Step 10: Enable HTTPS (Optional)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

Follow prompts, then access at: `https://your-domain.com` 🔒

---

## 📊 Verification Checklist

After setup, verify each feature:

| Feature | Test | Expected Result |
|---------|------|-----------------|
| Dashboard | Open home page | Shows statistics |
| Patients | Add new patient | Patient saved successfully |
| Consultations | Create consultation | Consultation appears in list |
| Lab Results | Add lab result | Result saved with interpretation |
| AI Support | Ask clinical question | AI responds (needs API key) |
| Drug Safety | Check interactions | Shows interaction alerts |

---

## 🔧 Common Issues & Fixes

### Issue: "Cannot find module"

```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Issue: "Port 3000 in use"

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Issue: Database errors

```bash
# Reset database
npx prisma db push --force-reset
```

### Issue: App crashes

```bash
# Check logs
pm2 logs gelani

# Restart
pm2 restart gelani
```

---

## 🔄 How to Update

When new code is pushed to GitHub:

```bash
cd /var/www/gelani-healthcare-assistant

# Download updates
git pull

# Install new dependencies (if any)
npm install

# Rebuild
npm run build

# Restart
pm2 restart gelani
```

---

## 📱 Quick Reference Commands

| Task | Command |
|------|---------|
| Check status | `pm2 status` |
| View logs | `pm2 logs gelani` |
| Restart | `pm2 restart gelani` |
| Stop | `pm2 stop gelani` |
| Start | `pm2 start gelani` |
| Rebuild | `npm run build` |
| Update | `git pull && npm install && npm run build && pm2 restart gelani` |

---

## 🆘 Need Help?

1. Check logs: `pm2 logs gelani`
2. Check Nginx logs: `tail -f /var/log/nginx/error.log`
3. GitHub Issues: https://github.com/MK428NP/gelani-healthcare-assistant/issues
