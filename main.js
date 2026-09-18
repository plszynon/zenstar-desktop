const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = app.getPath('userData');
const bookmarksFile = path.join(dataDir, 'bookmarks.json');
const historyFile = path.join(dataDir, 'history.json');
const settingsFile = path.join(dataDir, 'settings.json');
const passwordsFile = path.join(dataDir, 'passwords.json');
const keyFile = path.join(dataDir, 'passwords.key');

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
        return fallback;
    }
}

function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        icon: path.join(__dirname, 'build', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
    setupAdblock();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ---------- ADBLOCK ----------

let adblockHosts = [];
let adblockEnabled = true;

function loadAdblockList() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, 'adblock_hosts.txt'), 'utf-8');
        adblockHosts = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    } catch (e) {
        adblockHosts = [];
    }
}

function setupAdblock() {
    loadAdblockList();
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        if (!adblockEnabled) return callback({ cancel: false });
        try {
            const host = new URL(details.url).hostname;
            const blocked = adblockHosts.some(h => host === h || host.endsWith('.' + h));
            callback({ cancel: blocked });
        } catch (e) {
            callback({ cancel: false });
        }
    });
}

ipcMain.handle('adblock:toggle', () => {
    adblockEnabled = !adblockEnabled;
    return adblockEnabled;
});
ipcMain.handle('adblock:get', () => adblockEnabled);

// ---------- SZYFROWANIE (AES-256-GCM, klucz lokalny) ----------

function getOrCreateKey() {
    if (fs.existsSync(keyFile)) {
        return fs.readFileSync(keyFile);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyFile, key);
    return key;
}

function encrypt(text) {
    const key = getOrCreateKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(data) {
    const key = getOrCreateKey();
    const buf = Buffer.from(data, 'base64');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
}

// ---------- HASŁA ----------

function loadPasswords() {
    const raw = readJson(passwordsFile, []);
    return raw.map(p => {
        try {
            return { ...p, password: decrypt(p.password) };
        } catch (e) {
            return { ...p, password: '' };
        }
    });
}

ipcMain.handle('passwords:get', () => loadPasswords());

ipcMain.handle('passwords:add', (e, entry) => {
    const raw = readJson(passwordsFile, []);
    raw.push({
        id: Date.now().toString(),
        title: entry.title || entry.url,
        url: entry.url,
        username: entry.username,
        password: encrypt(entry.password)
    });
    writeJson(passwordsFile, raw);
    return loadPasswords();
});

ipcMain.handle('passwords:delete', (e, id) => {
    const raw = readJson(passwordsFile, []);
    const filtered = raw.filter(p => p.id !== id);
    writeJson(passwordsFile, filtered);
    return loadPasswords();
});

// Import z pliku CSV wyeksportowanego z Chrome/Edge (kolumny: name,url,username,password)
ipcMain.handle('passwords:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Wybierz plik CSV z hasłami (eksport z Chrome/Edge)',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return { count: 0 };

    function parseCsvLine(line) {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        result.push(cur);
        return result;
    }

    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const urlIdx = header.indexOf('url');
    const userIdx = header.indexOf('username');
    const passIdx = header.indexOf('password');

    const raw = readJson(passwordsFile, []);
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const url = cols[urlIdx] || '';
        const username = cols[userIdx] || '';
        const password = cols[passIdx] || '';
        if (!url || !password) continue;

        raw.push({
            id: Date.now().toString() + '-' + i,
            title: (nameIdx >= 0 ? cols[nameIdx] : url) || url,
            url,
            username,
            password: encrypt(password)
        });
        count++;
    }

    writeJson(passwordsFile, raw);
    return { count, all: loadPasswords() };
});

// ---------- ZAKŁADKI ----------

ipcMain.handle('bookmarks:get', () => readJson(bookmarksFile, []));

ipcMain.handle('bookmarks:add', (e, bm) => {
    const list = readJson(bookmarksFile, []);
    list.push(bm);
    writeJson(bookmarksFile, list);
    return list;
});

ipcMain.handle('bookmarks:clear', () => {
    writeJson(bookmarksFile, []);
    return [];
});

// Import zakładek z pliku HTML wyeksportowanego z innej przeglądarki
// (Chrome, Firefox, Edge - wszystkie eksportują w tym samym, uniwersalnym formacie)
ipcMain.handle('bookmarks:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Wybierz plik z wyeksportowanymi zakładkami (HTML)',
        filters: [{ name: 'Zakładki HTML', extensions: ['html', 'htm'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const html = fs.readFileSync(result.filePaths[0], 'utf-8');
    const regex = /<A[^>]*HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
    const imported = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        imported.push({ url: match[1], title: match[2] || match[1] });
    }

    const existing = readJson(bookmarksFile, []);
    const merged = existing.concat(imported);
    writeJson(bookmarksFile, merged);

    return { count: imported.length, all: merged };
});

// ---------- HISTORIA ----------

ipcMain.handle('history:get', () => readJson(historyFile, []));

ipcMain.handle('history:add', (e, entry) => {
    const list = readJson(historyFile, []);
    list.push(entry);
    const trimmed = list.slice(-1000);
    writeJson(historyFile, trimmed);
    return trimmed;
});

ipcMain.handle('history:clear', () => {
    writeJson(historyFile, []);
    return [];
});

// ---------- USTAWIENIA (kolor motywu itp.) ----------

ipcMain.handle('settings:get', () => readJson(settingsFile, { themeColor: '#8E24AA' }));

ipcMain.handle('settings:set', (e, settings) => {
    writeJson(settingsFile, settings);
    return settings;
});
