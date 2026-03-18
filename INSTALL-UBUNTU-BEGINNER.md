# 📖 Complete Installation Guide for Beginners
## Gelani AI Healthcare Assistant on Ubuntu

This guide will walk you through every step to install and run the Gelani AI Healthcare Assistant on an Ubuntu laptop or server. No prior technical knowledge required!

---

## 📋 What You'll Need

| Item | Minimum | Recommended |
|------|---------|-------------|
| Ubuntu Version | 20.04 LTS | 22.04 LTS or newer |
| RAM | 2 GB | 4 GB or more |
| Storage | 10 GB free | 20 GB or more |
| Internet | Required | Stable connection |

---

## 🚀 Step 1: Open Your Terminal

**How to open Terminal in Ubuntu:**

1. Press `Ctrl + Alt + T` on your keyboard
2. OR: Click the **Activities** button (top left), type "terminal", click the Terminal icon

You should see a window with a prompt that looks like:
```
username@computername:~$
```

> **💡 Tip:** The `$` symbol means you're ready to type commands. Don't type the `$` - just type the commands after it.

---

## 🔄 Step 2: Update Your System

First, let's make sure your Ubuntu is up to date. Type these commands one at a time:

```bash
sudo apt update
```

> **What this does:** Downloads the latest list of available software packages.

Type your password when asked (you won't see it as you type - this is normal for security). Press Enter.

```bash
sudo apt upgrade -y
```

> **What this does:** Installs all available updates. The `-y` means "yes, go ahead without asking me to confirm each one."

Wait for this to complete (may take 5-15 minutes depending on how old your system is).

---

## 📦 Step 3: Install Essential Tools

### Install Curl (for downloading files)

```bash
sudo apt install curl -y
```

### Install Git (for downloading code from GitHub)

```bash
sudo apt install git -y
```

> **What is Git?** Git is a tool that downloads code from GitHub (a website where developers share their code).

### Verify installations:

```bash
git --version
curl --version
```

You should see version numbers appear (like `git version 2.34.1`).

---

## 🟢 Step 4: Install Node.js (JavaScript Runtime)

Node.js runs JavaScript code outside of a web browser. We'll install version 20 LTS (Long Term Support - the most stable version).

### Method 1: Using NodeSource (Recommended)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

> **What this does:** Adds the official Node.js repository to your system.

```bash
sudo apt install nodejs -y
```

### Verify installation:

```bash
node --version
npm --version
```

You should see:
- Node.js version (like `v20.11.0`)
- npm version (like `10.2.4`)

> **What is npm?** npm (Node Package Manager) downloads and manages JavaScript libraries that your application needs.

---

## 🥟 Step 5: Install Bun (Fast Package Manager)

Bun is a modern, fast alternative to npm. This project uses Bun.

```bash
curl -fsSL https://bun.sh/install | bash
```

Wait for it to finish. You'll see a message about adding Bun to your path.

### Make Bun available in your terminal:

```bash
source ~/.bashrc
```

If that doesn't work, try:

```bash
source ~/.bash_profile
```

Or simply close and reopen your terminal.

### Verify Bun installation:

```bash
bun --version
```

You should see a version number (like `1.0.30`).

---

## 📥 Step 6: Download the Gelani Healthcare Assistant

### Navigate to your preferred folder:

```bash
cd ~
```

> **What this does:** Goes to your home folder (`/home/your-username/`)

### Create a projects folder:

```bash
mkdir -p projects
cd projects
```

### Download the code from GitHub:

```bash
git clone https://github.com/MK428NP/gelani-healthcare-assistant.git
```

You'll see progress as it downloads. Wait for it to complete.

### Enter the project folder:

```bash
cd gelani-healthcare-assistant
```

### Check you're in the right place:

```bash
ls
```

You should see files like `package.json`, `src`, `prisma`, etc.

---

## 📚 Step 7: Install Project Dependencies

This step downloads all the libraries and packages the application needs.

```bash
bun install
```

> **What this does:** Reads the `package.json` file and downloads all required packages into a `node_modules` folder.

This may take 2-5 minutes depending on your internet speed. You'll see a lot of text scrolling by - this is normal.

---

## 🗄️ Step 8: Set Up the Database

The application uses SQLite, a simple file-based database. No separate database server needed!

### Generate database schema:

```bash
npx prisma generate
```

> **What this does:** Creates the database client code that lets the application talk to the database.

### Create the database:

```bash
npx prisma db push
```

> **What this does:** Creates the actual database file (`custom.db`) with all the necessary tables.

You should see something like:
```
Your database is now in sync with your Prisma schema.
```

---

## ⚙️ Step 9: Create Environment Configuration

Create a file called `.env` that stores configuration settings.

### Create the file:

```bash
nano .env
```

> **What this does:** Opens a simple text editor called Nano.

### Type this content into the file:

```env
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

> **💡 Tip:** If your username is different, replace `/home/z/` with your actual home folder path. For example: `/home/john/projects/gelani-healthcare-assistant/db/custom.db`

### Save and exit:

1. Press `Ctrl + O` (to save)
2. Press `Enter` (to confirm the filename)
3. Press `Ctrl + X` (to exit)

### Verify the file was created:

```bash
cat .env
```

You should see the content you typed.

---

## 🌱 Step 10: Seed the Database (Optional but Recommended)

This adds sample data and medical knowledge to your database.

```bash
bun run db:push
```

Then seed with initial data:

```bash
npx prisma db seed
```

If that doesn't work, you can manually seed:

```bash
bun run prisma/seed.ts
```

---

## 🚀 Step 11: Start the Application!

Now for the exciting part - running your healthcare assistant!

```bash
bun run dev
```

You should see:

```
▲ Next.js 16.x.x
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in XXXXms
```

### Open in your web browser:

1. Open Firefox or Chrome
2. Go to: **http://localhost:3000**

You should see the **Gelani AI Healthcare Assistant** dashboard!

---

## 🎉 Congratulations!

Your Gelani AI Healthcare Assistant is now running! Here's what you can do:

### Main Features:
- **Dashboard** - Overview of your healthcare activities
- **Patients** - Register and manage patient records
- **Consultations** - Create and manage patient visits
- **RAG Healthcare** - AI-powered clinical decision support
- **Healthcare AI** - Symptom analysis, risk calculators, lab interpretation
- **Documentation** - AI-assisted SOAP notes
- **Drug Safety** - Check for drug interactions
- **Medical Imaging** - AI-assisted image analysis

### To Stop the Server:
Press `Ctrl + C` in the terminal where the server is running.

---

## 🔧 Common Problems and Solutions

### Problem: "bun: command not found"

**Solution:** Bun wasn't added to your path. Try:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Then add this line to your `.bashrc` file:
```bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

### Problem: "EACCES: permission denied"

**Solution:** You don't have permission for a folder. Try:
```bash
sudo chown -R $USER:$USER ~/projects/gelani-healthcare-assistant
```

---

### Problem: "Port 3000 is already in use"

**Solution:** Something else is using port 3000. Either:
1. Find and stop it:
```bash
lsof -i :3000
kill -9 <PID>
```

2. Or use a different port:
```bash
PORT=3001 bun run dev
```
Then go to http://localhost:3001

---

### Problem: Database errors

**Solution:** Reset the database:
```bash
npx prisma db push --force-reset
```

---

### Problem: "Cannot find module"

**Solution:** Reinstall dependencies:
```bash
rm -rf node_modules
rm bun.lock
bun install
```

---

## 🔄 Daily Usage

### To start the application every day:

1. Open Terminal (`Ctrl + Alt + T`)
2. Navigate to the project:
```bash
cd ~/projects/gelani-healthcare-assistant
```
3. Start the server:
```bash
bun run dev
```
4. Open browser to: http://localhost:3000

---

## 🌐 Access from Other Computers (Optional)

If you want to access the application from other computers on your network:

### Find your IP address:
```bash
ip addr show | grep inet
```

Look for something like `192.168.1.xxx` (not `127.0.0.1`).

### Start the server:
```bash
bun run dev
```

### Access from another computer:
Open a browser on another computer and go to:
```
http://YOUR-IP-ADDRESS:3000
```
For example: `http://192.168.1.100:3000`

---

## 🛡️ Security Notes

1. **Database Location:** The SQLite database file is stored locally. Make regular backups.

2. **Backups:** Create a backup script:
```bash
# Create a backup
cp ~/projects/gelani-healthcare-assistant/db/custom.db ~/backups/healthcare-$(date +%Y%m%d).db
```

3. **Don't expose to the internet directly:** This application is designed for local network use. For internet access, use a reverse proxy with authentication.

---

## 📞 Getting Help

If you encounter problems:

1. **Check the Troubleshooting section above**
2. **Check the error message** - it usually tells you what's wrong
3. **Create an issue on GitHub:** https://github.com/MK428NP/gelani-healthcare-assistant/issues

---

## 📋 Quick Reference Commands

| What you want to do | Command |
|---------------------|---------|
| Go to project folder | `cd ~/projects/gelani-healthcare-assistant` |
| Start the application | `bun run dev` |
| Stop the application | Press `Ctrl + C` |
| Update the code | `git pull origin main` |
| Reinstall dependencies | `bun install` |
| Reset database | `npx prisma db push --force-reset` |
| Check for errors | `bun run lint` |

---

## 🎓 What's Next?

Once you're comfortable with the basics:

1. **Add your own patients** - Use the Patients module
2. **Try AI features** - Test the RAG Healthcare assistant
3. **Customize settings** - Check the Settings page
4. **Learn keyboard shortcuts** - Speed up your workflow

---

**Happy Healthcare Management! 🏥**

*Last updated: March 2026*
