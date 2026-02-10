# 🚀 Flag Battle Desktop - Windows Build & Installation Guide

## 📋 প্রয়োজনীয় জিনিস

1. **Node.js** installed (ইতিমধ্যে আছে)
2. **npm** installed (ইতিমধ্যে আছে)
3. Dependencies installed (নিচে দেখুন)

---

## 🔧 Step 1: Dependencies Install করুন

প্রথমে `desktop` folder এ যান এবং dependencies install করুন:

```bash
cd "d:\web project\flag battle\desktop"
npm install
```

এটি `electron` এবং `electron-builder` সহ সব dependencies install করবে।

---

## 🏗️ Step 2: Icon File তৈরি করুন (Optional)

আপনার app এর জন্য একটি icon দরকার। যদি না থাকে, তাহলে:

1. `desktop` folder এ `build` নামে একটি folder তৈরি করুন
2. সেখানে `icon.ico` (256x256 বা 512x512) file রাখুন
3. অথবা `icon.png` file রাখুন (electron-builder automatically convert করবে)

**Icon না থাকলে default Electron icon ব্যবহার হবে - কোন সমস্যা নেই!**

---

## 🎯 Step 3: Build করুন

এখন Windows installer তৈরি করুন:

```bash
npm run build
```

এই command টি:
- ✅ আপনার app কে package করবে
- ✅ Windows NSIS installer তৈরি করবে
- ✅ `dist` folder এ output রাখবে

**⏱️ প্রথমবার 5-10 মিনিট সময় লাগতে পারে!**

---

## 📦 Step 4: Installer খুঁজুন

Build complete হলে এখানে installer পাবেন:

```
d:\web project\flag battle\desktop\dist\Flag Battle Setup 1.0.0.exe
```

অথবা:

```
d:\web project\flag battle\desktop\dist\win-unpacked\
```

এই folder এ unpacked version থাকবে (directly run করা যায়)।

---

## 💾 Step 5: Install করুন

### Option A: Installer দিয়ে (Recommended)

1. `Flag Battle Setup 1.0.0.exe` file এ double-click করুন
2. Windows SmartScreen warning আসলে **"More info"** → **"Run anyway"** click করুন
3. Installation wizard follow করুন
4. Install complete হলে Start Menu থেকে **Flag Battle** open করুন

### Option B: Portable Version (No Installation)

1. `win-unpacked` folder খুলুন
2. `Flag Battle.exe` file এ double-click করুন
3. সরাসরি run হবে (installation লাগবে না)

---

## 🎮 Step 6: App ব্যবহার করুন

1. App open হলে Flag Battle game দেখবেন
2. **Settings** ⚙️ button এ click করুন
3. YouTube **Video ID** enter করুন (যেমন: `dQw4w9WgXcQ`)
4. **Connect to Live Chat** button এ click করুন
5. ✅ Live chat থেকে flags spawn হবে!

---

## 🔄 নতুন Version Build করতে

যদি code change করেন এবং নতুন installer তৈরি করতে চান:

```bash
# 1. Code changes করুন
# 2. Version number update করুন (optional)
# 3. আবার build করুন
npm run build
```

---

## 📤 অন্যদের সাথে Share করতে

### Option 1: Direct Share
`Flag Battle Setup 1.0.0.exe` file টি copy করে অন্যদের দিন। তারা simply install করবে।

### Option 2: Portable ZIP
`win-unpacked` folder টি ZIP করে share করুন। Extract করে `Flag Battle.exe` run করবে।

### Option 3: GitHub Release (Professional)
1. GitHub এ repository তে যান
2. **Releases** → **Create a new release**
3. `.exe` file upload করুন
4. Version tag দিন (যেমন: `v1.0.0`)
5. Release publish করুন
6. এখন যে কেউ download করতে পারবে!

---

## 🛠️ Troubleshooting

### Build Error হলে

```bash
# node_modules delete করুন এবং আবার install করুন
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

### Icon দেখাচ্ছে না

`package.json` এ check করুন:
```json
"build": {
  "win": {
    "icon": "build/icon.ico"  // এই path সঠিক আছে কিনা
  }
}
```

### App crash করছে

1. `npm start` দিয়ে development mode এ test করুন
2. Console এ error check করুন
3. DevTools (F12) open করে debug করুন

---

## 📊 Build Output Files

Build complete হলে এই files পাবেন:

```
dist/
├── Flag Battle Setup 1.0.0.exe    ← Installer (এটি share করুন)
├── win-unpacked/                   ← Portable version
│   └── Flag Battle.exe
├── builder-debug.yml
└── builder-effective-config.yaml
```

---

## ✅ সম্পূর্ণ Process এক নজরে

```bash
# 1. Dependencies install
cd "d:\web project\flag battle\desktop"
npm install

# 2. Build করুন
npm run build

# 3. Installer খুঁজুন
# dist\Flag Battle Setup 1.0.0.exe

# 4. Install করুন
# Double-click করুন এবং install wizard follow করুন

# 5. Run করুন
# Start Menu → Flag Battle
```

---

## 🎉 সফল!

এখন আপনার Flag Battle Desktop App Windows এ install করা আছে! 🚀

যেকোনো সমস্যা হলে জানাবেন! 😊
