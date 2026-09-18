const { ipcRenderer } = require('electron');

let tabs = [];
let currentTabId = null;
let tabCounter = 0;
let isIncognito = false;

function $(id) { return document.getElementById(id); }

function newTabUrl() {
    return 'data:text/html,' + encodeURIComponent(`
        <html><body style="margin:0;background:#202124;color:#e8eaed;font-family:sans-serif;
        display:flex;flex-direction:column;align-items:center;padding-top:120px;">
        <h1 style="font-weight:300;">ZenStar</h1>
        <input id="q" autofocus style="padding:12px 18px;width:400px;border-radius:24px;
        border:none;outline:none;font-size:15px;" placeholder="Szukaj w Google lub wpisz adres...">
        <script>
            document.getElementById('q').addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    var q = this.value.trim();
                    if (!q) return;
                    var looksLikeUrl = q.includes('.') && !q.includes(' ');
                    if (q.startsWith('http://') || q.startsWith('https://')) {
                        window.location = q;
                    } else if (looksLikeUrl) {
                        window.location = 'https://' + q;
                    } else {
                        window.location = 'https://www.google.com/search?q=' + encodeURIComponent(q);
                    }
                }
            });
        </script>
        </body></html>
    `);
}

function createTab(url) {
    const id = 'tab-' + (tabCounter++);
    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('partition', isIncognito ? 'incognito-session' : 'persist:main');
    webview.style.display = 'none';
    $('webviewContainer').appendChild(webview);

    const tab = { id, webviewEl: webview, title: 'Nowa karta' };
    tabs.push(tab);

    webview.addEventListener('page-title-updated', (e) => {
        tab.title = e.title;
        renderTabBar();
    });

    webview.addEventListener('did-navigate', (e) => {
        if (currentTabId === id) $('urlInput').value = e.url;
        if (!isIncognito && !e.url.startsWith('data:')) {
            ipcRenderer.invoke('history:add', { url: e.url, title: tab.title, time: Date.now() });
        }
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
        if (currentTabId === id) $('urlInput').value = e.url;
    });

    switchTab(id);
}

function switchTab(id) {
    currentTabId = id;
    tabs.forEach(t => {
        t.webviewEl.style.display = (t.id === id) ? 'flex' : 'none';
    });
    const tab = tabs.find(t => t.id === id);
    if (tab) $('urlInput').value = tab.webviewEl.getAttribute('src') || '';
    renderTabBar();
}

function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    tabs[idx].webviewEl.remove();
    tabs.splice(idx, 1);

    if (tabs.length === 0) {
        createTab(newTabUrl());
        return;
    }
    if (currentTabId === id) {
        switchTab(tabs[Math.max(0, idx - 1)].id);
    } else {
        renderTabBar();
    }
}

function renderTabBar() {
    const bar = $('tabBar');
    bar.innerHTML = '';
    tabs.forEach(tab => {
        const pill = document.createElement('div');
        pill.className = 'tab-pill' + (tab.id === currentTabId ? ' active' : '');
        pill.innerText = (tab.title || 'Nowa karta').slice(0, 18);
        pill.onclick = () => switchTab(tab.id);

        const closeBtn = document.createElement('span');
        closeBtn.innerText = ' ✕';
        closeBtn.className = 'tab-close';
        closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(tab.id); };
        pill.appendChild(closeBtn);

        bar.appendChild(pill);
    });

    const addBtn = document.createElement('div');
    addBtn.className = 'tab-add';
    addBtn.innerText = '+';
    addBtn.onclick = () => createTab(newTabUrl());
    bar.appendChild(addBtn);
}

function currentWebview() {
    const tab = tabs.find(t => t.id === currentTabId);
    return tab ? tab.webviewEl : null;
}

$('btnBack').onclick = () => { const wv = currentWebview(); if (wv && wv.canGoBack()) wv.goBack(); };
$('btnForward').onclick = () => { const wv = currentWebview(); if (wv && wv.canGoForward()) wv.goForward(); };
$('btnReload').onclick = () => { const wv = currentWebview(); if (wv) wv.reload(); };

$('urlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const input = e.target.value.trim();
        if (!input) return;
        const looksLikeUrl = input.includes('.') && !input.includes(' ');
        let finalUrl;
        if (input.startsWith('http://') || input.startsWith('https://')) finalUrl = input;
        else if (looksLikeUrl) finalUrl = 'https://' + input;
        else finalUrl = 'https://www.google.com/search?q=' + encodeURIComponent(input);
        const wv = currentWebview();
        if (wv) wv.loadURL(finalUrl);
    }
});

$('btnMenu').onclick = () => { $('menuDropdown').classList.toggle('show'); };
document.addEventListener('click', (e) => {
    if (!$('menuDropdown').contains(e.target) && e.target !== $('btnMenu')) {
        $('menuDropdown').classList.remove('show');
    }
});

$('btnIncognito').onclick = () => {
    isIncognito = !isIncognito;
    $('incognitoBadge').style.display = isIncognito ? 'block' : 'none';
    $('btnIncognito').innerText = isIncognito ? 'Wyłącz incognito' : 'Włącz incognito';
};

$('btnAdblock').onclick = async () => {
    const enabled = await ipcRenderer.invoke('adblock:toggle');
    $('btnAdblock').innerText = enabled ? 'Wyłącz adblock' : 'Włącz adblock';
    const wv = currentWebview();
    if (wv) wv.reload();
};

$('btnBookmarkAdd').onclick = async () => {
    const wv = currentWebview();
    if (!wv) return;
    await ipcRenderer.invoke('bookmarks:add', {
        url: wv.getAttribute('src'),
        title: tabs.find(t => t.id === currentTabId)?.title || wv.getAttribute('src')
    });
    alert('Dodano do zakładek');
};

$('btnImportBookmarks').onclick = async () => {
    const result = await ipcRenderer.invoke('bookmarks:import');
    if (result) {
        alert('Zaimportowano ' + result.count + ' zakładek z innej przeglądarki!');
    }
};

// ---------- HASŁA ----------

$('btnPasswordsList').onclick = async () => {
    const passwords = await ipcRenderer.invoke('passwords:get');
    showPasswordsModal(passwords);
};

$('btnPasswordAdd').onclick = () => {
    const wv = currentWebview();
    $('pfUrl').value = wv ? (wv.getAttribute('src') || '') : '';
    $('pfUsername').value = '';
    $('pfPassword').value = '';
    $('passwordFormModal').style.display = 'flex';
};

$('pfCancel').onclick = () => { $('passwordFormModal').style.display = 'none'; };

$('pfSave').onclick = async () => {
    const url = $('pfUrl').value.trim();
    const username = $('pfUsername').value.trim();
    const password = $('pfPassword').value;
    if (!url || !password) { alert('Podaj przynajmniej adres i hasło'); return; }

    let title = url;
    try { title = new URL(url).hostname; } catch (e) {}

    await ipcRenderer.invoke('passwords:add', { url, username, password, title });
    $('passwordFormModal').style.display = 'none';
    alert('Zapisano hasło');
};

$('btnImportPasswords').onclick = async () => {
    const result = await ipcRenderer.invoke('passwords:import');
    if (result) {
        alert('Zaimportowano ' + result.count + ' haseł z pliku CSV!');
    }
};

function showPasswordsModal(items) {
    $('listModalTitle').innerText = 'Hasła (lokalnie zaszyfrowane)';
    const container = $('listModalItems');
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<div class="empty">Brak zapisanych haseł.</div>';
    }

    items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        const info = document.createElement('div');
        info.innerText = (it.title || it.url) + '\n' + (it.username || '(brak loginu)');
        info.style.cursor = 'default';

        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.gap = '6px';

        const fillBtn = document.createElement('button');
        fillBtn.innerText = 'Wypełnij';
        fillBtn.style.cssText = 'padding:6px 10px;border:none;border-radius:6px;background:var(--theme-color);color:white;cursor:pointer;font-size:12px;';
        fillBtn.onclick = () => {
            fillCredentials(it.username, it.password);
            $('listModal').classList.remove('show');
        };

        const delBtn = document.createElement('button');
        delBtn.innerText = '✕';
        delBtn.style.cssText = 'padding:6px 10px;border:none;border-radius:6px;background:#555;color:white;cursor:pointer;';
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            const updated = await ipcRenderer.invoke('passwords:delete', it.id);
            showPasswordsModal(updated);
        };

        btns.appendChild(fillBtn);
        btns.appendChild(delBtn);
        row.appendChild(info);
        row.appendChild(btns);
        container.appendChild(row);
    });

    $('listModal').classList.add('show');
}

function fillCredentials(username, password) {
    const wv = currentWebview();
    if (!wv) return;
    const script = `
        (function() {
            var userSelectors = ['input[autocomplete="username"]','input[type="email"]',
                'input[name*="user" i]','input[id*="user" i]','input[name*="login" i]'];
            var passSelectors = ['input[type="password"]'];
            function findFirst(selectors) {
                for (var i = 0; i < selectors.length; i++) {
                    var el = document.querySelector(selectors[i]);
                    if (el) return el;
                }
                return null;
            }
            var uEl = findFirst(userSelectors);
            var pEl = findFirst(passSelectors);
            if (uEl) {
                uEl.value = ${JSON.stringify(username || '')};
                uEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (pEl) {
                pEl.value = ${JSON.stringify(password || '')};
                pEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (!uEl && !pEl) {
                alert('Nie znaleziono pól logowania na tej stronie');
            }
        })();
    `;
    wv.executeJavaScript(script);
}

$('btnHistory').onclick = async () => {
    const history = await ipcRenderer.invoke('history:get');
    showListModal('Historia', history.slice().reverse());
};

$('btnBookmarksList').onclick = async () => {
    const bookmarks = await ipcRenderer.invoke('bookmarks:get');
    showListModal('Zakładki', bookmarks.slice().reverse());
};

function showListModal(title, items) {
    $('listModalTitle').innerText = title;
    const container = $('listModalItems');
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = '<div class="empty">Brak wpisów.</div>';
    }
    items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerText = (it.title || it.url) + '\n' + it.url;
        row.onclick = () => {
            createTab(it.url);
            $('listModal').classList.remove('show');
        };
        container.appendChild(row);
    });
    $('listModal').classList.add('show');
}
$('closeModal').onclick = () => $('listModal').classList.remove('show');

// Kolor motywu
const colorSwatches = ['#8E24AA', '#2196F3', '#F44336', '#4CAF50', '#FF9800', '#009688', '#E91E63', '#607D8B'];
function buildColorPicker() {
    const wrap = $('colorPicker');
    colorSwatches.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'swatch';
        sw.style.background = c;
        sw.onclick = async () => {
            await ipcRenderer.invoke('settings:set', { themeColor: c });
            document.documentElement.style.setProperty('--theme-color', c);
        };
        wrap.appendChild(sw);
    });
}

async function applyTheme() {
    const settings = await ipcRenderer.invoke('settings:get');
    document.documentElement.style.setProperty('--theme-color', settings.themeColor || '#8E24AA');
}

applyTheme();
buildColorPicker();
createTab(newTabUrl());
