# How to start the Motion Hub

Run these commands in **Command Prompt** or **PowerShell**.

## 1. Go to the hub folder

First change into the folder that contains `package.json`:

```cmd
cd C:\Users\Halep\MotionHub\hub-app
```

(If MotionHub is somewhere else on your PC, use that path instead.)

## 2. Start the Hub

**Staff mode (default):**
```cmd
npm start
```

**Master mode:**
```cmd
npm run start:master
```

---

**If you see "npm is not recognized":** Install Node.js from https://nodejs.org, then close and reopen Command Prompt and try again.

**If you see "Could not read package.json":** You're not in the right folder. Use `cd` to go to the folder that contains `hub-app` (e.g. your MotionHub folder), then `cd hub-app`, then run `npm start` again.
