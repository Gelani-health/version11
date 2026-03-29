# 🚀 Server Deployment Guide

**Complete guide to install Gelani AI Healthcare Assistant on a server**

---

## 📋 Table of Contents

1. [What You Need](#-what-you-need)
2. [Step 1: Get a Server](#-step-1-get-a-server)
3. [Step 2: Connect to Your Server](#-step-2-connect-to-your-server)
4. [Step 3: Install Required Software](#-step-3-install-required-software)
5. [Step 4: Download and Setup the Application](#-step-4-download-and-setup-the-application)
6. [Step 5: Configure the Application](#-step-5-configure-the-application)
7. [Step 6: Run the Application](#-step-6-run-the-application)
8. [Step 7: Set Up Domain Name (Optional)](#-step-7-set-up-domain-name-optional)
9. [Step 8: Enable HTTPS (Optional)](#-step-8-enable-https-optional)

---

## 🖥️ What You Need

Before starting, make sure you have:

| Item | Description |
|------|-------------|
| **Server** | A VPS or cloud server (see Step 1) |
| **Domain** | Optional but recommended (e.g., `gelani.yourdomain.com`) |
| **SSH Client** | To connect to your server |

---

## Step 1: Get a Server

### Option A: Cloud Providers (Recommended for beginners)

| Provider | Starting Price | Difficulty |
|----------|---------------|------------|
| [DigitalOcean](https://www.digitalocean.com/) | $4/month | Easy ⭐ |
| [Linode/Akamai](https://www.linode.com/) | $5/month | Easy ⭐ |
| [Vultr](https://www.vultr.com/) | $2.50/month | Easy ⭐ |
| [AWS EC2](https://aws.amazon.com/ec2/) | Free tier available | Medium ⭐⭐ |
| [Google Cloud](https://cloud.google.com/) | Free tier available | Medium ⭐⭐ |

### Recommended Server Specifications

| Spec | Minimum | Recommended |
|------|---------|-------------|
| **RAM** | 2 GB | 4 GB |
| **Storage** | 20 GB | 50 GB |
| **CPU** | 1 core | 2 cores |
| **OS** | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |

### When creating your server, note down:

1. **Server IP Address** (looks like: `123.45.67.89`)
2. **Root Password** (you set this during creation)
3. **SSH Key** (if you uploaded one)

---

## Step 2: Connect to Your Server

### On Windows:

1. **Download PuTTY**: https://www.putty.org/
2. **Open PuTTY**
3. **Enter your server IP** in "Host Name"
4. **Click "Open"**
5. **Login as**: `root`
6. **Enter your password**

### On Mac/Linux:

1. **Open Terminal**
2. **Run this command**:
   ```bash
   ssh root@YOUR_SERVER_IP
   ```
   (Replace `YOUR_SERVER_IP` with your actual IP)

3. **Enter your password** (you won't see it while typing - that's normal)

---

## Step 3: Install Required Software

Once connected to your server, run these commands one by one.

### 3.1 Update Your Server

```bash
apt update && apt upgrade -y
```

Wait for it to finish (1-2 minutes).

### 3.2 Install Node.js

```bash
# Install Node.js 20 (the latest stable version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
```

**Verify installation**:
```bash
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

### 3.3 Install Git

```bash
apt install -y git
```

**Verify installation**:
```bash
git --version    # Should show git version 2.x.x
```

### 3.4 Install PM2 (Process Manager)

This keeps your application running 24/7:

```bash
npm install -g pm2
```

### 3.5 Install Nginx (Web Server)

This serves your application to the internet:

```bash
apt install -y nginx
```

---

## Step 4: Download and Setup the Application

### 4.1 Create Application Directory

```bash
# Create a folder for your apps
mkdir -p /var/www
cd /var/www
```

### 4.2 Download the Code

```bash
# Clone the repository
git clone https://github.com/MK428NP/gelani-healthcare-assistant.git

# Enter the project folder
cd gelani-healthcare-assistant
```

### 4.3 Install Dependencies

```bash
npm install
```

This takes 2-5 minutes. Wait for it to complete.

### 4.4 Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma db push
```

### 4.5 Build the Application

```bash
npm run build
```

This takes 1-3 minutes.

---

## Step 5: Configure the Application

### 5.1 Create Environment File

```bash
nano .env
```

This opens a text editor. Copy and paste this:

```env
# Database
DATABASE_URL="file:./dev.db"

# Server
PORT=3000
NODE_ENV="production"

# AI API Key (REQUIRED for AI features)
Z_AI_API_KEY="your-api-key-here"

# Bahmni HIS (Optional)
BAHMNI_URL=""
BAHMNI_USERNAME=""
BAHMNI_PASSWORD=""

# Odoo ERP (Optional)
ODOO_URL=""
ODOO_DATABASE=""
ODOO_API_KEY=""
```

### 5.2 Save and Exit

1. Press `Ctrl + O` then `Enter` (to save)
2. Press `Ctrl + X` (to exit)

---

## Step 6: Run the Application

### 6.1 Start with PM2

```bash
pm2 start npm --name "gelani" -- start
```

### 6.2 Save PM2 Configuration

```bash
pm2 save
pm2 startup
```

Copy the command it shows you and run it. This makes the app start automatically when the server restarts.

### 6.3 Check if Running

```bash
pm2 status
```

You should see something like:
```
┌─────┬──────────┬─────────┬─────────┐
│ id  │ name     │ status  │ port    │
├─────┼──────────┼─────────┼─────────┤
│ 0   │ gelani   │ online  │ 3000    │
└─────┴──────────┴─────────┴─────────┘
```

### 6.4 Test the Application

On your local computer, open a browser and go to:
```
http://YOUR_SERVER_IP:3000
```

You should see the Gelani AI Healthcare Assistant!

---

## Step 7: Set Up Domain Name (Optional)

If you have a domain name (e.g., `gelani.yourdomain.com`):

### 7.1 Configure DNS

Go to your domain registrar (where you bought the domain) and add an **A Record**:

| Type | Name | Value |
|------|------|-------|
| A | gelani | YOUR_SERVER_IP |

Wait 5-30 minutes for DNS to update.

### 7.2 Configure Nginx

```bash
nano /etc/nginx/sites-available/gelani
```

Paste this (replace `gelani.yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name gelani.yourdomain.com;

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

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

### 7.3 Enable the Site

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/gelani /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

Now you can access: `http://gelani.yourdomain.com`

---

## Step 8: Enable HTTPS (Optional)

HTTPS makes your site secure (shows 🔒 in browser).

### 8.1 Install Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 8.2 Get SSL Certificate

```bash
certbot --nginx -d gelani.yourdomain.com
```

Follow the prompts:
1. Enter your email
2. Agree to terms
3. Choose to redirect HTTP to HTTPS (recommended)

### 8.3 Auto-Renewal

Certbot sets up auto-renewal. Test it:

```bash
certbot renew --dry-run
```

Your site is now available at: `https://gelani.yourdomain.com` 🔒

---

## 📋 Quick Reference Commands

| Task | Command |
|------|---------|
| **Check app status** | `pm2 status` |
| **View logs** | `pm2 logs gelani` |
| **Restart app** | `pm2 restart gelani` |
| **Stop app** | `pm2 stop gelani` |
| **Update code** | `cd /var/www/gelani-healthcare-assistant && git pull && npm install && npm run build && pm2 restart gelani` |

---

## 🔥 Firewall Setup (Important for Security)

```bash
# Allow SSH
ufw allow ssh

# Allow HTTP
ufw allow 80

# Allow HTTPS
ufw allow 443

# Enable firewall
ufw enable
```

Type `y` to confirm.

---

## 🔄 How to Update the Application

When there are new updates:

```bash
# Go to app folder
cd /var/www/gelani-healthcare-assistant

# Download updates
git pull

# Install any new dependencies
npm install

# Rebuild
npm run build

# Restart the app
pm2 restart gelani
```

---

## 🆘 Troubleshooting

### App won't start

```bash
# Check logs for errors
pm2 logs gelani

# Try starting manually to see errors
npm start
```

### Can't connect from browser

1. Check if app is running: `pm2 status`
2. Check firewall: `ufw status`
3. Check if port is open: `netstat -tulpn | grep 3000`

### "Permission denied" errors

```bash
# Fix ownership
chown -R www-data:www-data /var/www/gelani-healthcare-assistant
```

### Memory issues

```bash
# Increase swap memory (creates 2GB virtual memory)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

---

## 📞 Getting Help

1. Check the logs: `pm2 logs gelani`
2. Check Nginx logs: `tail -f /var/log/nginx/error.log`
3. Create an issue: https://github.com/MK428NP/gelani-healthcare-assistant/issues

---

**Congratulations! 🎉 You've successfully deployed Gelani AI Healthcare Assistant!**
