const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = app.getPath('userData');
const bookmarksFile = path.join(dataDir, 'bookmarks.json');
const historyFile = path.join(dataDir, 'history.json');
const settingsFile = path.join(dataDir, 'settings.json');

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
