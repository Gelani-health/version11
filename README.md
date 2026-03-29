# 🏥 Gelani AI Healthcare Assistant

An AI-powered healthcare assistant that works **standalone** or integrated with Bahmni HIS and Odoo ERP.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Standalone](https://img.shields.io/badge/Mode-Standalone%20%7C%20Integrated-blue)

> **💡 Works Standalone!** This system does NOT require Bahmni HIS to function. It has its own database and all features work independently. Bahmni/Odoo integrations are optional for connecting to existing hospital systems.

---

## 📋 Table of Contents

1. [What is this system?](#-what-is-this-system)
2. [Features](#-features)
3. [What you need before installing](#-what-you-need-before-installing)
4. [Installation Guide](#-installation-guide)
5. [Running the Application](#-running-the-application)
6. [Configuration](#-configuration)
7. [Troubleshooting](#-troubleshooting)

---

## 🤔 What is this system?

Gelani AI Healthcare Assistant is a web-based medical application that helps doctors and nurses with:

- **Patient Management**: Store and manage patient records
- **AI Consultations**: Get AI-assisted clinical decision support
- **Drug Safety**: Check for dangerous drug interactions
- **Documentation**: Auto-generate medical notes with AI
- **Lab Results**: Record and interpret laboratory test results
- **Integrations**: Connect to Bahmni HIS and Odoo ERP

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🩺 **Patient Management** | Register, search, and manage patient records |
| 🤖 **AI Clinical Support** | Get diagnosis suggestions and treatment recommendations |
| 💊 **Drug Interaction Checker** | Check medications for dangerous interactions |
| 📝 **Smart Documentation** | AI-powered SOAP notes with medical autocomplete |
| 🧪 **Lab Results** | Record lab tests with automatic interpretation |
| 🎤 **Voice Transcription** | Convert speech to medical notes |
| 📊 **Analytics Dashboard** | View statistics and reports |
| 🔗 **Bahmni Integration** | Connect to Bahmni HIS via FHIR R4 API |
| 📦 **Odoo Integration** | Connect to Odoo for billing and CRM |

---

## 🔀 Two Modes of Operation

### Mode 1: Standalone (Default) ✅

**Works out of the box!** No external systems needed.

```
┌──────────────────────────────────────┐
│         STANDALONE MODE              │
├──────────────────────────────────────┤
│  Your Server                         │
│  ┌────────────────────────────────┐  │
│  │  Gelani Healthcare Assistant   │  │
│  │  + SQLite Database             │  │
│  │  + AI Features                 │  │
│  └────────────────────────────────┘  │
│                                      │
│  ✓ All features work                 │
│  ✓ Data stored locally               │
│  ✓ No external dependencies          │
└──────────────────────────────────────┘
```

**Use this when:**
- Small clinic or individual practice
- Testing or development
- No existing hospital system

---

### Mode 2: Integrated (Optional)

Connect to existing hospital systems for data sync.

```
┌─────────────────────────────────────────────────────┐
│              INTEGRATED MODE                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────┐ │
│  │   Bahmni    │    │   Gelani    │    │  Odoo   │ │
│  │     HIS     │◄──►│  Healthcare │◄──►│   ERP   │ │
│  │             │    │  Assistant  │    │         │ │
│  └─────────────┘    └─────────────┘    └─────────┘ │
│        │                  │                  │      │
│   Patient Data      AI Support          Billing     │
│   Encounters        Drug Safety         CRM         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Use this when:**
- Hospital already uses Bahmni HIS
- Need billing/CRM integration with Odoo
- Want to sync patient data across systems

---

### Feature Comparison

| Feature | Standalone | With Bahmni | With Odoo |
|---------|:----------:|:-----------:|:---------:|
| Patient Management | ✅ | ✅ + Sync | ✅ |
| Consultations | ✅ | ✅ + Sync | ✅ |
| AI Clinical Support | ✅ | ✅ | ✅ |
| Drug Interaction | ✅ | ✅ | ✅ |
| Lab Results | ✅ | ✅ | ✅ |
| Documentation | ✅ | ✅ | ✅ |
| Voice Transcription | ✅ | ✅ | ✅ |
| Patient Sync from HIS | ❌ | ✅ | ❌ |
| Billing Integration | ❌ | ❌ | ✅ |
| CRM Integration | ❌ | ❌ | ✅ |

---

## 💻 What you need before installing

### Option A: For Local Development (Your Computer)

You need to install these **3 things**:

| Software | What it does | Download Link |
|----------|--------------|---------------|
| **Node.js** | Runs JavaScript code | [Download Node.js LTS](https://nodejs.org/) |
| **Git** | Downloads code from GitHub | [Download Git](https://git-scm.com/downloads) |
| **A code editor** | To view/edit code (optional) | [Download VS Code](https://code.visualstudio.com/) |

### Option B: For Server Deployment

You need:
- A server (VPS, cloud instance, or dedicated server)
- Ubuntu 20.04 or 22.04 LTS (recommended)
- At least 2GB RAM, 20GB storage
- Domain name (optional but recommended)

---

## 📥 Installation Guide

### Step 1: Download the Code from GitHub

#### On Windows:

1. **Open Command Prompt** (Press `Win + R`, type `cmd`, press Enter)

2. **Go to the folder where you want to install**:
   ```bash
   cd C:\
   mkdir projects
   cd projects
   ```

3. **Download the code**:
   ```bash
   git clone https://github.com/MK428NP/gelani-healthcare-assistant.git
   ```

4. **Enter the project folder**:
   ```bash
   cd gelani-healthcare-assistant
   ```

#### On Mac/Linux:

1. **Open Terminal** (Press `Cmd + Space`, type `Terminal`, press Enter)

2. **Go to your projects folder**:
   ```bash
   cd ~/Documents
   mkdir projects
   cd projects
   ```

3. **Download the code**:
   ```bash
   git clone https://github.com/MK428NP/gelani-healthcare-assistant.git
   ```

4. **Enter the project folder**:
   ```bash
   cd gelani-healthcare-assistant
   ```

---

### Step 2: Install Required Packages

**This step downloads all the necessary libraries.**

```bash
npm install
```

Wait a few minutes while it downloads everything.

> **What if npm install fails?**
> - Make sure you installed Node.js correctly
> - Try running: `npm install --legacy-peer-deps`

---

### Step 3: Set Up the Database

The system uses SQLite (a simple database file). Initialize it with:

```bash
npx prisma generate
npx prisma db push
```

> **What does this do?**
> - Creates a file called `dev.db` in the `prisma/` folder
> - Sets up all the tables needed for the application

---

### Step 4: Create Environment File

Create a file called `.env` in the main project folder:

```bash
# Copy this content into a file named .env
DATABASE_URL="file:./dev.db"
```

For Windows (Command Prompt):
```cmd
echo DATABASE_URL="file:./dev.db" > .env
```

For Mac/Linux:
```bash
echo 'DATABASE_URL="file:./dev.db"' > .env
```

---

## 🚀 Running the Application

### Start the Development Server

```bash
npm run dev
```

You should see something like:
```
▲ Next.js 16.0.0
- Local:        http://localhost:3000
```

### Open in Browser

Open your web browser and go to:
**http://localhost:3000**

You should see the Gelani AI Healthcare Assistant dashboard!

---

## ⚙️ Configuration

### AI Features (Required for AI to work)

The AI features need an API key. Add this to your `.env` file:

```env
# AI API Configuration
# Replace with your actual API key
Z_AI_API_KEY="your-api-key-here"
```

> **How to get an API key**: Contact your system administrator or AI provider

### Bahmni HIS Integration

To connect to Bahmni, add these settings to your `.env`:

```env
# Bahmni HIS Configuration
BAHMNI_URL="https://your-bahmni-server.com"
BAHMNI_USERNAME="your-username"
BAHMNI_PASSWORD="your-password"
```

### Odoo ERP Integration

To connect to Odoo:

```env
# Odoo ERP Configuration
ODOO_URL="https://your-company.odoo.com"
ODOO_DATABASE="your-database"
ODOO_API_KEY="your-api-key"
```

---

## 🔧 Troubleshooting

### Problem: "npm is not recognized"

**Solution**: You need to install Node.js first.
1. Go to https://nodejs.org/
2. Download the LTS version
3. Install it (just click Next, Next, Next)
4. Close and reopen your terminal
5. Try again

---

### Problem: "git is not recognized"

**Solution**: You need to install Git.
1. Go to https://git-scm.com/downloads
2. Download for your operating system
3. Install it
4. Close and reopen your terminal
5. Try again

---

### Problem: "Port 3000 is already in use"

**Solution**: Another program is using port 3000. Use a different port:

```bash
PORT=3001 npm run dev
```

Then open http://localhost:3001

---

### Problem: "Cannot find module..."

**Solution**: The packages weren't installed correctly. Try:

```bash
# Delete the node_modules folder
rm -rf node_modules    # Mac/Linux
rmdir /s node_modules  # Windows

# Reinstall
npm install
```

---

### Problem: Database errors

**Solution**: Reset the database:

```bash
npx prisma db push --force-reset
```

---

## 📁 Project Structure

```
gelani-healthcare-assistant/
├── prisma/              # Database configuration
│   ├── schema.prisma    # Database structure
│   └── dev.db           # SQLite database file
├── src/
│   ├── app/             # Web pages (Next.js)
│   │   ├── api/         # Backend API routes
│   │   └── page.tsx     # Main page
│   ├── components/      # UI components
│   │   └── ui/          # Base UI components
│   └── lib/             # Utilities and helpers
├── public/              # Images and static files
├── package.json         # Project dependencies
└── README.md            # This file
```

---

## 🆘 Getting Help

If you encounter problems:

1. **Check the Troubleshooting section above**
2. **Check the error message** - it usually tells you what's wrong
3. **Ask your system administrator**
4. **Create an issue on GitHub**: https://github.com/MK428NP/gelani-healthcare-assistant/issues

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Credits

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database by [Prisma](https://www.prisma.io/)
- Integrated with [Bahmni HIS](https://bahmni.org/)
