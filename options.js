(() => {
    const boot = () => {
    const i18n = window.AirTabI18n || null;
    const extensionApi = (typeof globalThis !== 'undefined' && globalThis.chrome && globalThis.chrome.runtime?.id)
        ? globalThis.chrome
        : null;
    if (i18n) i18n.init({ observe: false });
    const trText = (text) => (i18n ? i18n.translateText(String(text || '')) : String(text || ''));
    const trKey = (key, fallback, vars = {}) => {
        let text = i18n?.t ? i18n.t(key, vars) : String(fallback || key || '');
        Object.entries(vars || {}).forEach(([name, value]) => {
            text = text.replaceAll(`{${name}}`, String(value));
        });
        return text;
    };

    const STORAGE_KEY = 'airtabData';
    const DATA_VERSION = 2;
    const defaultLinks = [];
    const defaultEngines = [
        { id: 1, name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', icon: 'https://duckduckgo.com/favicon.ico' }
    ];
    const HOST_DISPLAY_NAME_MAP = Object.freeze({
        'duckduckgo.com': 'DuckDuckGo',
        'google.com': 'Google',
        'bing.com': 'Bing',
        'yandex.com': 'Yandex',
        'yandex.ru': 'Yandex',
        'kagi.com': 'Kagi',
        'youtube.com': 'YouTube',
        'wikipedia.org': 'Wikipedia',
        'github.com': 'GitHub',
        'reddit.com': 'Reddit',
        'ecosia.org': 'Ecosia',
        'startpage.com': 'Startpage',
        'brave.com': 'Brave'
    });
    const defaultBgLight = '#f2f2f7';
    const defaultBgDark = '#2c2c2e';
    const DND_DEBUG_STORAGE_KEY = 'airtabDndDebugEnabled';
    const BROWSER_PROFILE_STORAGE_KEY = 'airtabBrowserProfile';
    const LOCAL_BG_DB_NAME = 'airtabLocalBackgrounds';
    const LOCAL_BG_DB_VERSION = 2;
    const LOCAL_BG_HANDLES_STORE = 'themeHandles';
    const LOCAL_BG_FALLBACKS_STORE = 'themeFallbacks';
    const LOCAL_BG_TOKEN_PREFIX = 'local-file://';
    const SYNC_FILE_HANDLE_KEY = 'syncFileHandle';
    const SYNC_LOCAL_META_KEY = 'airtabSyncLocalMeta';
    const SYNC_GOOGLE_META_KEY = 'airtabSyncDropboxMeta';
    const SYNC_GOOGLE_FILE_NAME_KEY = 'airtabDropboxSyncFileName';
    const SYNC_GOOGLE_TOKEN_KEY = 'airtabDropboxSyncToken';
    const SYNC_LAST_LOCAL_UPDATED_AT_KEY = 'airtabSyncLastLocalUpdatedAt';
    const SYNC_UI_MODE_KEY = 'airtabSyncUiMode';
    const DEFAULT_GOOGLE_SYNC_FILE = 'AirTab.sync.json';
    const DROPBOX_SCOPE = 'files.content.read files.content.write';
    const DROPBOX_APP_KEY_DEFAULT = '714cwwsa9yxk7tn';
    const DROPBOX_APP_KEY_STORAGE_KEY = 'airtabDropboxAppKey';
    const DROPBOX_OAUTH_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
    const DROPBOX_OAUTH_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
    const DROPBOX_API_RPC_BASE = 'https://api.dropboxapi.com/2';
    const DROPBOX_API_CONTENT_BASE = 'https://content.dropboxapi.com/2';
    const DROPBOX_WEB_CALLBACK_PATH = 'oauth/dropbox-callback.html';
    const DROPBOX_WEB_OAUTH_MESSAGE_TYPE = 'airtab-dropbox-oauth-callback';

    const statusEl = document.getElementById('status');
    const engineList = document.getElementById('engineList');

    let data = loadData();
    let engines = loadEngines();
    let editingEngineIndex = null;
    const pendingLocalThemeHandles = { light: null, dark: null };
    let themeDraftDirty = false;
    let bookmarkImportPayload = null;
    let googleSyncTokenCacheLoaded = false;
    let googleSyncTokenCache = null;
    const SYSTEM_BOOKMARK_FOLDERS = new Set([
        'bookmarks bar',
        'bookmarks toolbar',
        'other bookmarks',
        'bookmarks menu',
        'mobile bookmarks',
        'bookmarks',
        'панель закладок',
        'другие закладки',
        'меню закладок',
        'мобильные закладки',
        'закладки'
    ]);
    if (!localStorage.getItem(SYNC_LAST_LOCAL_UPDATED_AT_KEY)) {
        localStorage.setItem(SYNC_LAST_LOCAL_UPDATED_AT_KEY, '0');
    }

    function showStatus(text, type = 'success') {
        statusEl.textContent = trText(text);
        statusEl.classList.remove('success', 'error');
        statusEl.classList.add(type === 'error' ? 'error' : 'success');
        window.clearTimeout(showStatus.timer);
        showStatus.timer = window.setTimeout(() => {
            statusEl.textContent = '';
            statusEl.classList.remove('success', 'error');
        }, 2600);
    }

    function createId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
    }

    function normalizeUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) return '';
        if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
        return trimmed;
    }

    function getHostname(url) {
        try { return new URL(url).hostname; } catch (e) { return ''; }
    }

    function getRemoteFaviconUrl(hostname, size = 64) {
        if (!hostname) return '';
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
    }

    function getHostnameDisplayName(hostname, fallback = '') {
        const host = String(hostname || '').trim().toLowerCase()
            .replace(/^www\./, '')
            .replace(/^m\./, '');
        if (!host) return fallback;
        const directPreset = HOST_DISPLAY_NAME_MAP[host];
        if (directPreset) return directPreset;
        const segments = host.split('.').filter(Boolean);
        if (segments.length >= 2) {
            const registrable = segments.slice(-2).join('.');
            const preset = HOST_DISPLAY_NAME_MAP[registrable];
            if (preset) return preset;
        }
        const seed = segments[0] || '';
        const cleaned = seed.replace(/^xn--/, '').replace(/[-_]+/g, ' ').trim();
        if (!cleaned) return fallback;
        return cleaned
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function suggestNameFromUrl(rawUrl, fallback = '') {
        const cleanUrl = normalizeUrl(rawUrl || '');
        if (!cleanUrl) return fallback;
        const hostname = getHostname(cleanUrl);
        return getHostnameDisplayName(hostname, fallback) || fallback;
    }

    function suggestIconFromUrl(rawUrl, size = 64) {
        const cleanUrl = normalizeUrl(rawUrl || '');
        if (!cleanUrl) return '';
        const hostname = getHostname(cleanUrl);
        return getRemoteFaviconUrl(hostname, size);
    }

    function applyAutoFillValue(inputEl, nextValue) {
        if (!inputEl) return;
        const value = String(nextValue || '').trim();
        if (!value) return;
        const current = String(inputEl.value || '').trim();
        const autoValue = String(inputEl.dataset.autoValue || '').trim();
        if (!current || (autoValue && current === autoValue)) {
            inputEl.value = value;
            inputEl.dataset.autoValue = value;
        }
    }

    function markAutoFillValueAsManual(inputEl) {
        if (!inputEl) return;
        const autoValue = String(inputEl.dataset.autoValue || '').trim();
        if (!autoValue) return;
        const current = String(inputEl.value || '').trim();
        if (current !== autoValue) {
            inputEl.dataset.autoValue = '';
        }
    }

    function maybeAutofillEngineFieldsFromUrl() {
        const urlInput = document.getElementById('engineUrl');
        const nameInput = document.getElementById('engineName');
        const iconInput = document.getElementById('engineIcon');
        const url = String(urlInput?.value || '').trim();
        if (!url) return;
        const fallback = trKey('search', 'Поиск');
        applyAutoFillValue(nameInput, suggestNameFromUrl(url, fallback));
        applyAutoFillValue(iconInput, suggestIconFromUrl(url, 64));
    }

    function migrateLegacyLinks(links) {
        return links.map(link => ({
            id: createId('link'),
            type: 'link',
            name: link.name || 'Без названия',
            url: normalizeUrl(link.url || ''),
            customIcon: link.customIcon || '',
            isCompact: !!link.isCompact,
            sidebar: 'left'
        }));
    }

    function buildDefaultData(linksOverride) {
        let legacyFromStorage = null;
        try {
            legacyFromStorage = JSON.parse(localStorage.getItem('myLinks'));
        } catch (e) {
            legacyFromStorage = null;
        }
        const legacyLinks = linksOverride || legacyFromStorage || defaultLinks;
        const spaceId = createId('space');
        return {
            version: DATA_VERSION,
            activeSpaceId: spaceId,
            spaces: [
                {
                    id: spaceId,
                    name: 'Основное',
                    emoji: '🏠',
                    bg: '',
                    showLeftSidebar: true,
                    showRightSidebar: true,
                    items: migrateLegacyLinks(legacyLinks)
                }
            ]
        };
    }

    function normalizeSpace(space) {
        const safe = { ...space };
        safe.id = safe.id || createId('space');
        safe.name = (safe.name || 'Пространство').trim();
        safe.emoji = (typeof safe.emoji === 'string' && safe.emoji.trim()) ? safe.emoji.trim() : '🧭';
        safe.bg = typeof safe.bg === 'string' ? safe.bg.trim() : '';
        safe.showLeftSidebar = safe.showLeftSidebar !== false;
        safe.showRightSidebar = safe.showRightSidebar !== false;
        safe.items = Array.isArray(safe.items) ? safe.items : [];
        return safe;
    }

    function loadData() {
        let parsed = null;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                parsed = null;
            }
        }

        if (parsed && Array.isArray(parsed.links) && !parsed.spaces) {
            parsed = buildDefaultData(parsed.links);
        }

        if (!parsed || !Array.isArray(parsed.spaces)) {
            parsed = buildDefaultData();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            return parsed;
        }

        parsed.version = DATA_VERSION;
        parsed.spaces = parsed.spaces.filter(Boolean).map(normalizeSpace);

        if (!parsed.spaces.length) {
            parsed = buildDefaultData();
        }
        if (!parsed.activeSpaceId || !parsed.spaces.find(s => s.id === parsed.activeSpaceId)) {
            parsed.activeSpaceId = parsed.spaces[0].id;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
    }

    function markLocalDataUpdated(timestamp = Date.now()) {
        const safeTs = Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp) : Date.now();
        localStorage.setItem(SYNC_LAST_LOCAL_UPDATED_AT_KEY, String(safeTs));
        return safeTs;
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        markLocalDataUpdated(Date.now());
    }

    function isLegacyDefaultSingleEngine(engine) {
        const name = String(engine?.name || '').trim().toLowerCase();
        const url = String(engine?.url || '').trim().toLowerCase();
        if (name === 'unduck') {
            return url === 'https://unduck.link?q=' || url === 'https://unduck.link?q=%s';
        }
        if (name !== 'kagi') return false;
        return url === 'https://kagi.com/search?q='
            || url === 'https://kagi.com/search?q=%s'
            || url === 'https://kagi.com/?q='
            || url === 'https://kagi.com/?q=%s'
            || url === 'https://kagi.com/html/search?q='
            || url === 'https://kagi.com/html/search?q=%s';
    }

    function migrateLegacyDefaultEngineList(engineList) {
        if (!Array.isArray(engineList) || engineList.length !== 1) return engineList;
        if (!isLegacyDefaultSingleEngine(engineList[0])) return engineList;
        const migratedId = engineList[0]?.id || defaultEngines[0].id;
        return [
            {
                id: migratedId,
                name: defaultEngines[0].name,
                url: defaultEngines[0].url,
                icon: defaultEngines[0].icon
            }
        ];
    }

    function loadEngines() {
        const raw = localStorage.getItem('myEngines');
        if (!raw) {
            localStorage.setItem('myEngines', JSON.stringify(defaultEngines));
            return defaultEngines.slice();
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) throw new Error('empty');
            const normalized = parsed
                .filter(Boolean)
                .map((engine, i) => ({
                    id: engine.id || Date.now() + i,
                    name: (engine.name || `Engine ${i + 1}`).trim(),
                    url: (engine.url || '').trim(),
                    icon: (engine.icon || '').trim()
                }))
                .filter(engine => engine.name && engine.url && engine.icon);
            if (!normalized.length) throw new Error('empty');
            const migrated = migrateLegacyDefaultEngineList(normalized);
            if (migrated !== normalized) {
                localStorage.setItem('myEngines', JSON.stringify(migrated));
            }
            return migrated;
        } catch (e) {
            localStorage.setItem('myEngines', JSON.stringify(defaultEngines));
            return defaultEngines.slice();
        }
    }

    function saveEngines() {
        if (!engines.length) engines = defaultEngines.slice();
        localStorage.setItem('myEngines', JSON.stringify(engines));
        markLocalDataUpdated(Date.now());
        const activeEngine = localStorage.getItem('myActiveEngine');
        const exists = engines.some(e => String(e.id) === String(activeEngine));
        if (!exists && engines[0]) {
            localStorage.setItem('myActiveEngine', String(engines[0].id));
            markLocalDataUpdated(Date.now());
        }
    }

    function getThemeBackground(theme) {
        if (theme === 'light') {
            const light = localStorage.getItem('myBgLight');
            return light === null ? (localStorage.getItem('myBg') || defaultBgLight) : light;
        }
        return localStorage.getItem('myBgDark') || defaultBgDark;
    }

    function getLocalBgToken(theme) {
        return `${LOCAL_BG_TOKEN_PREFIX}${theme}`;
    }

    function isThemeLocalBgToken(theme, value) {
        return value === getLocalBgToken(theme);
    }

    function setThemeBackground(theme, value) {
        const previous = getThemeBackground(theme);
        if (theme === 'light') {
            localStorage.setItem('myBgLight', value);
            // Legacy compatibility for old reads (pre myBgLight migration).
            localStorage.setItem('myBg', value);
        } else {
            localStorage.setItem('myBgDark', value);
        }
        if (!isThemeLocalBgToken(theme, value)) {
            Promise.all([
                deleteLocalThemeHandle(theme),
                deleteLocalThemeFallbackBlob(theme)
            ]).catch(() => {});
        }
        if (previous !== value) markLocalDataUpdated(Date.now());
    }

    function getPerformanceMode() {
        return localStorage.getItem('airtabPerformanceMode') === 'eco' ? 'eco' : 'balanced';
    }

    function getDndDebugEnabled() {
        const raw = localStorage.getItem(DND_DEBUG_STORAGE_KEY);
        if (raw === null) return false;
        return raw === '1' || raw === 'true';
    }

    function setDndDebugEnabled(enabled) {
        const nextValue = enabled ? '1' : '0';
        if (localStorage.getItem(DND_DEBUG_STORAGE_KEY) === nextValue) return;
        localStorage.setItem(DND_DEBUG_STORAGE_KEY, nextValue);
        markLocalDataUpdated(Date.now());
    }

    function normalizeBrowserProfile(raw) {
        const value = String(raw || '').trim().toLowerCase();
        if (value === 'chrome' || value === 'firefox' || value === 'safari') return value;
        return 'auto';
    }

    function detectBrowserProfile() {
        const ua = String(navigator.userAgent || '').toLowerCase();
        const platform = String(navigator.platform || '').toLowerCase();

        if (ua.includes('firefox') || ua.includes('fxios')) return 'firefox';
        const isSafariLike = (ua.includes('safari') || platform.includes('iphone') || platform.includes('ipad') || platform.includes('mac'))
            && !ua.includes('chrome')
            && !ua.includes('crios')
            && !ua.includes('chromium')
            && !ua.includes('edg')
            && !ua.includes('opr')
            && !ua.includes('opera')
            && !ua.includes('fxios');
        if (isSafariLike) return 'safari';
        return 'chrome';
    }

    function getStoredBrowserProfile() {
        return normalizeBrowserProfile(localStorage.getItem(BROWSER_PROFILE_STORAGE_KEY) || 'auto');
    }

    function setStoredBrowserProfile(profile) {
        const normalized = normalizeBrowserProfile(profile);
        localStorage.setItem(BROWSER_PROFILE_STORAGE_KEY, normalized);
        return normalized;
    }

    function getEffectiveBrowserProfile() {
        const selected = getStoredBrowserProfile();
        return selected === 'auto' ? detectBrowserProfile() : selected;
    }

    function getBrowserProfileLabel(profile) {
        const normalized = normalizeBrowserProfile(profile);
        if (normalized === 'firefox') return trKey('browserProfileFirefox', 'Firefox');
        if (normalized === 'safari') return trKey('browserProfileSafari', 'Safari');
        if (normalized === 'chrome') return trKey('browserProfileChrome', 'Chrome/Chromium');
        return trKey('browserProfileAuto', 'Авто (определять автоматически)');
    }

    function getBrowserProfileOptions() {
        return [
            { value: 'auto', label: trKey('browserProfileAuto', 'Авто (определять автоматически)') },
            { value: 'chrome', label: trKey('browserProfileChrome', 'Chrome/Chromium') },
            { value: 'firefox', label: trKey('browserProfileFirefox', 'Firefox') },
            { value: 'safari', label: trKey('browserProfileSafari', 'Safari') }
        ];
    }

    function updateBrowserProfileHint() {
        const select = document.getElementById('browserProfileSelect');
        const hint = document.getElementById('browserProfileHint');
        if (!select || !hint) return;
        const selected = normalizeBrowserProfile(select.value || 'auto');
        const localOnly = trKey(
            'browserProfileLocalOnly',
            'Профиль хранится только в этом браузере и не синхронизируется.'
        );
        if (selected === 'auto') {
            const detected = getEffectiveBrowserProfile();
            const base = trKey(
                'browserProfileHintAuto',
                'Авто определяет движок браузера: {browser}. Можно выбрать вручную, если нужно.',
                { browser: getBrowserProfileLabel(detected) }
            );
            hint.textContent = `${base} ${localOnly}`;
            return;
        }
        const base = selected === 'firefox'
            ? trKey('browserProfileHintFirefox', 'Firefox: уменьшенные blur/эффекты для более стабильной отрисовки.')
            : selected === 'safari'
                ? trKey('browserProfileHintSafari', 'Safari: облегченные эффекты и специальный режим открытия нескольких вкладок.')
                : trKey('browserProfileHintChrome', 'Chrome/Chromium: максимальная визуальная плавность и полные эффекты.');
        hint.textContent = `${base} ${localOnly}`;
    }

    function initBrowserProfileSelector() {
        const select = document.getElementById('browserProfileSelect');
        const label = document.getElementById('browserProfileLabel');
        if (!select) return;
        if (label) label.textContent = trKey('browserProfile', 'Профиль браузера');
        fillSelectOptions(select, getBrowserProfileOptions());
        select.value = getStoredBrowserProfile();
        updateBrowserProfileHint();
    }

    function openLocalBgDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('indexedDB unavailable'));
                return;
            }
            const request = window.indexedDB.open(LOCAL_BG_DB_NAME, LOCAL_BG_DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(LOCAL_BG_HANDLES_STORE)) db.createObjectStore(LOCAL_BG_HANDLES_STORE);
                if (!db.objectStoreNames.contains(LOCAL_BG_FALLBACKS_STORE)) db.createObjectStore(LOCAL_BG_FALLBACKS_STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Failed to open local background DB'));
        });
    }

    async function getStoredLocalThemeHandle(theme) {
        const db = await openLocalBgDatabase();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_HANDLES_STORE, 'readonly');
                const store = tx.objectStore(LOCAL_BG_HANDLES_STORE);
                const request = store.get(theme);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('Failed to read local background handle'));
                tx.onabort = () => reject(tx.error || new Error('Failed to read local background handle'));
            });
        } finally {
            db.close();
        }
    }

    async function saveLocalThemeHandle(theme, handle) {
        const db = await openLocalBgDatabase();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_HANDLES_STORE, 'readwrite');
                const store = tx.objectStore(LOCAL_BG_HANDLES_STORE);
                store.put(handle, theme);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Failed to store local background handle'));
                tx.onabort = () => reject(tx.error || new Error('Failed to store local background handle'));
            });
        } finally {
            db.close();
        }
    }

    async function deleteLocalThemeHandle(theme) {
        const db = await openLocalBgDatabase();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_HANDLES_STORE, 'readwrite');
                const store = tx.objectStore(LOCAL_BG_HANDLES_STORE);
                store.delete(theme);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Failed to delete local background handle'));
                tx.onabort = () => reject(tx.error || new Error('Failed to delete local background handle'));
            });
        } finally {
            db.close();
        }
    }

    async function getStoredLocalThemeFallbackBlob(theme) {
        const db = await openLocalBgDatabase();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_FALLBACKS_STORE, 'readonly');
                const store = tx.objectStore(LOCAL_BG_FALLBACKS_STORE);
                const request = store.get(theme);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('Failed to read local fallback blob'));
                tx.onabort = () => reject(tx.error || new Error('Failed to read local fallback blob'));
            });
        } finally {
            db.close();
        }
    }

    async function saveLocalThemeFallbackBlob(theme, blob) {
        if (!blob) return;
        const db = await openLocalBgDatabase();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_FALLBACKS_STORE, 'readwrite');
                const store = tx.objectStore(LOCAL_BG_FALLBACKS_STORE);
                store.put(blob, theme);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Failed to store local fallback blob'));
                tx.onabort = () => reject(tx.error || new Error('Failed to store local fallback blob'));
            });
        } finally {
            db.close();
        }
    }

    async function deleteLocalThemeFallbackBlob(theme) {
        const db = await openLocalBgDatabase();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_FALLBACKS_STORE, 'readwrite');
                const store = tx.objectStore(LOCAL_BG_FALLBACKS_STORE);
                store.delete(theme);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Failed to delete local fallback blob'));
                tx.onabort = () => reject(tx.error || new Error('Failed to delete local fallback blob'));
            });
        } finally {
            db.close();
        }
    }

    function readJsonStorage(key, fallback = null) {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function writeJsonStorage(key, value) {
        if (value === null || value === undefined) {
            localStorage.removeItem(key);
            return;
        }
        localStorage.setItem(key, JSON.stringify(value));
    }

    function readSessionJsonStorage(key, fallback = null) {
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeSessionJsonStorage(key, value) {
        try {
            if (value === null || value === undefined) {
                sessionStorage.removeItem(key);
                return;
            }
            sessionStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            // best effort
        }
    }

    function hasExtensionSessionStorageApi() {
        return !!extensionApi?.storage?.session;
    }

    function storageSessionGetValue(key) {
        return new Promise((resolve, reject) => {
            if (!hasExtensionSessionStorageApi()) {
                resolve(undefined);
                return;
            }
            extensionApi.storage.session.get([key], (items) => {
                if (extensionApi.runtime?.lastError) {
                    reject(new Error(extensionApi.runtime.lastError.message || 'Failed to read session storage'));
                    return;
                }
                resolve(items ? items[key] : undefined);
            });
        });
    }

    function storageSessionSetValue(key, value) {
        return new Promise((resolve, reject) => {
            if (!hasExtensionSessionStorageApi()) {
                resolve();
                return;
            }
            extensionApi.storage.session.set({ [key]: value }, () => {
                if (extensionApi.runtime?.lastError) {
                    reject(new Error(extensionApi.runtime.lastError.message || 'Failed to write session storage'));
                    return;
                }
                resolve();
            });
        });
    }

    function storageSessionRemoveKey(key) {
        return new Promise((resolve, reject) => {
            if (!hasExtensionSessionStorageApi()) {
                resolve();
                return;
            }
            extensionApi.storage.session.remove([key], () => {
                if (extensionApi.runtime?.lastError) {
                    reject(new Error(extensionApi.runtime.lastError.message || 'Failed to remove session storage key'));
                    return;
                }
                resolve();
            });
        });
    }

    async function readGoogleTokenStateFromSessionStore() {
        if (hasExtensionSessionStorageApi()) {
            try {
                const value = await storageSessionGetValue(SYNC_GOOGLE_TOKEN_KEY);
                if (value && typeof value === 'object') return value;
            } catch (error) {
                // fallback to tab session storage
            }
        }
        const fromLocal = readJsonStorage(SYNC_GOOGLE_TOKEN_KEY, null);
        if (fromLocal) return fromLocal;
        const legacySession = readSessionJsonStorage(SYNC_GOOGLE_TOKEN_KEY, null);
        if (legacySession) {
            writeJsonStorage(SYNC_GOOGLE_TOKEN_KEY, legacySession);
            writeSessionJsonStorage(SYNC_GOOGLE_TOKEN_KEY, null);
            return legacySession;
        }
        return null;
    }

    async function writeGoogleTokenStateToSessionStore(state) {
        const safeState = state && typeof state === 'object' ? state : null;
        let wroteToExtensionSession = false;
        if (hasExtensionSessionStorageApi()) {
            try {
                if (safeState) await storageSessionSetValue(SYNC_GOOGLE_TOKEN_KEY, safeState);
                else await storageSessionRemoveKey(SYNC_GOOGLE_TOKEN_KEY);
                wroteToExtensionSession = true;
            } catch (error) {
                wroteToExtensionSession = false;
            }
        }
        if (wroteToExtensionSession) {
            writeJsonStorage(SYNC_GOOGLE_TOKEN_KEY, null);
            writeSessionJsonStorage(SYNC_GOOGLE_TOKEN_KEY, null);
            return;
        }
        writeJsonStorage(SYNC_GOOGLE_TOKEN_KEY, safeState);
        writeSessionJsonStorage(SYNC_GOOGLE_TOKEN_KEY, null);
    }

    function getSyncLocalMeta() {
        return readJsonStorage(SYNC_LOCAL_META_KEY, {}) || {};
    }

    function setSyncLocalMeta(patch) {
        const current = getSyncLocalMeta();
        writeJsonStorage(SYNC_LOCAL_META_KEY, { ...current, ...patch });
    }

    function getSyncGoogleMeta() {
        return readJsonStorage(SYNC_GOOGLE_META_KEY, {}) || {};
    }

    function setSyncGoogleMeta(patch) {
        const current = getSyncGoogleMeta();
        writeJsonStorage(SYNC_GOOGLE_META_KEY, { ...current, ...patch });
    }

    function setGoogleSyncError(message) {
        const errorText = String(message || trKey('genericError', 'ошибка'));
        setSyncGoogleMeta({ lastError: errorText, lastErrorAt: Date.now() });
    }

    function clearGoogleSyncError() {
        const current = getSyncGoogleMeta();
        if (!current || (!current.lastError && !current.lastErrorAt)) return;
        const next = { ...current };
        delete next.lastError;
        delete next.lastErrorAt;
        writeJsonStorage(SYNC_GOOGLE_META_KEY, next);
    }

    async function getStoredSyncFileHandle() {
        const db = await openLocalBgDatabase();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_HANDLES_STORE, 'readonly');
                const store = tx.objectStore(LOCAL_BG_HANDLES_STORE);
                const request = store.get(SYNC_FILE_HANDLE_KEY);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('Failed to read sync file handle'));
                tx.onabort = () => reject(tx.error || new Error('Failed to read sync file handle'));
            });
        } finally {
            db.close();
        }
    }

    async function saveStoredSyncFileHandle(handle) {
        const db = await openLocalBgDatabase();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_HANDLES_STORE, 'readwrite');
                const store = tx.objectStore(LOCAL_BG_HANDLES_STORE);
                store.put(handle, SYNC_FILE_HANDLE_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Failed to store sync file handle'));
                tx.onabort = () => reject(tx.error || new Error('Failed to store sync file handle'));
            });
        } finally {
            db.close();
        }
    }

    async function clearStoredSyncFileHandle() {
        const db = await openLocalBgDatabase();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(LOCAL_BG_HANDLES_STORE, 'readwrite');
                const store = tx.objectStore(LOCAL_BG_HANDLES_STORE);
                store.delete(SYNC_FILE_HANDLE_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Failed to delete sync file handle'));
                tx.onabort = () => reject(tx.error || new Error('Failed to delete sync file handle'));
            });
        } finally {
            db.close();
        }
    }

    async function ensureFileHandlePermission(handle, mode = 'read') {
        if (!handle) return false;
        if (typeof handle.queryPermission === 'function') {
            const current = await handle.queryPermission({ mode });
            if (current === 'granted') return true;
        }
        if (typeof handle.requestPermission === 'function') {
            const requested = await handle.requestPermission({ mode });
            return requested === 'granted';
        }
        return true;
    }

    function hasGoogleDriveAuthApi() {
        const hasExtensionOAuth = !!extensionApi?.identity?.launchWebAuthFlow;
        const hasWebPopupOAuth = typeof window.open === 'function' && typeof window.addEventListener === 'function';
        return hasExtensionOAuth || hasWebPopupOAuth;
    }

    function hasGoogleDriveManifestOAuthConfig() {
        try {
            const keyFromStorage = String(localStorage.getItem(DROPBOX_APP_KEY_STORAGE_KEY) || '').trim();
            return !!(DROPBOX_APP_KEY_DEFAULT || keyFromStorage);
        } catch (error) {
            return false;
        }
    }

    function getConfiguredDropboxAppKey() {
        try {
            const keyFromStorage = String(localStorage.getItem(DROPBOX_APP_KEY_STORAGE_KEY) || '').trim();
            return keyFromStorage || DROPBOX_APP_KEY_DEFAULT || '';
        } catch (error) {
            return DROPBOX_APP_KEY_DEFAULT || '';
        }
    }

    function getGoogleSyncFileName() {
        const raw = (localStorage.getItem(SYNC_GOOGLE_FILE_NAME_KEY) || '').trim();
        return raw || DEFAULT_GOOGLE_SYNC_FILE;
    }

    function setGoogleSyncFileName(value) {
        const clean = String(value || '').trim() || DEFAULT_GOOGLE_SYNC_FILE;
        localStorage.setItem(SYNC_GOOGLE_FILE_NAME_KEY, clean);
    }

    async function clearGoogleSyncTokenState() {
        await setGoogleSyncTokenState(null);
    }

    async function getGoogleSyncTokenState() {
        if (googleSyncTokenCacheLoaded) return googleSyncTokenCache;
        let tokenState = await readGoogleTokenStateFromSessionStore();
        const legacyTokenState = readJsonStorage(SYNC_GOOGLE_TOKEN_KEY, null);
        if (!tokenState && legacyTokenState) {
            tokenState = legacyTokenState;
            await writeGoogleTokenStateToSessionStore(tokenState);
        }
        googleSyncTokenCache = tokenState && typeof tokenState === 'object' ? tokenState : null;
        googleSyncTokenCacheLoaded = true;
        return googleSyncTokenCache;
    }

    async function setGoogleSyncTokenState(state) {
        const safeState = state && typeof state === 'object' ? state : null;
        googleSyncTokenCache = safeState;
        googleSyncTokenCacheLoaded = true;
        await writeGoogleTokenStateToSessionStore(safeState);
    }

    function isGoogleSyncConnectedFromMeta(meta = null) {
        const source = meta || getSyncGoogleMeta();
        const connectedAt = Number(source?.connectedAt || 0);
        const disconnectedAt = Number(source?.disconnectedAt || 0);
        return connectedAt > 0 && connectedAt >= disconnectedAt;
    }

    function base64UrlEncode(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function createRandomString(length = 64) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const values = new Uint8Array(length);
        crypto.getRandomValues(values);
        let output = '';
        for (let i = 0; i < values.length; i += 1) output += alphabet[values[i] % alphabet.length];
        return output;
    }

    async function buildCodeChallenge(codeVerifier) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
        return base64UrlEncode(digest);
    }

    function getDropboxRedirectUri() {
        if (extensionApi?.identity?.getRedirectURL) {
            return extensionApi.identity.getRedirectURL('airtab-dropbox-sync');
        }
        const appRootUrl = new URL('../', window.location.href);
        return new URL(DROPBOX_WEB_CALLBACK_PATH, appRootUrl).toString();
    }

    function launchWebAuthFlowPopup(url, interactive) {
        return new Promise((resolve, reject) => {
            if (!interactive) {
                reject(new Error('Popup OAuth requires interactive mode'));
                return;
            }
            const popup = window.open(
                url,
                'airtab-dropbox-oauth',
                'popup=yes,width=520,height=760,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes'
            );
            if (!popup) {
                reject(new Error('OAuth popup blocked'));
                return;
            }
            let settled = false;
            let closedCheckTimer = 0;
            let timeoutTimer = 0;

            const finalize = (fn) => (value) => {
                if (settled) return;
                settled = true;
                window.removeEventListener('message', onMessage);
                if (closedCheckTimer) window.clearInterval(closedCheckTimer);
                if (timeoutTimer) window.clearTimeout(timeoutTimer);
                try { if (!popup.closed) popup.close(); } catch (error) {}
                fn(value);
            };

            const resolveOnce = finalize(resolve);
            const rejectOnce = finalize(reject);

            const onMessage = (event) => {
                if (event.origin !== window.location.origin) return;
                if (!event.data || event.data.type !== DROPBOX_WEB_OAUTH_MESSAGE_TYPE) return;
                const callbackUrl = typeof event.data.url === 'string' ? event.data.url : '';
                if (!callbackUrl) {
                    rejectOnce(new Error('OAuth callback URL missing'));
                    return;
                }
                resolveOnce(callbackUrl);
            };

            window.addEventListener('message', onMessage);
            closedCheckTimer = window.setInterval(() => {
                if (popup.closed) rejectOnce(new Error('OAuth flow canceled'));
            }, 350);
            timeoutTimer = window.setTimeout(() => {
                rejectOnce(new Error('OAuth timeout'));
            }, 3 * 60 * 1000);
        });
    }

    function launchWebAuthFlow(url, interactive) {
        if (extensionApi?.identity?.launchWebAuthFlow) {
            return new Promise((resolve, reject) => {
                extensionApi.identity.launchWebAuthFlow({ url, interactive }, (callbackUrl) => {
                    if (extensionApi.runtime?.lastError) {
                        reject(new Error(extensionApi.runtime.lastError.message || 'OAuth flow failed'));
                        return;
                    }
                    if (!callbackUrl) {
                        reject(new Error('OAuth flow canceled'));
                        return;
                    }
                    resolve(callbackUrl);
                });
            });
        }
        return launchWebAuthFlowPopup(url, interactive);
    }

    async function requestDropboxToken(bodyParams) {
        const response = await fetch(DROPBOX_OAUTH_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(bodyParams).toString()
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = payload?.error_description || payload?.error || `HTTP ${response.status}`;
            throw new Error(`Dropbox token error: ${err}`);
        }
        return payload;
    }

    function buildDropboxTokenState(appKey, tokenResponse, previousState = null) {
        const expiresIn = Number(tokenResponse?.expires_in || 0);
        const expiresAt = Date.now() + Math.max(0, expiresIn - 45) * 1000;
        return {
            appKey: appKey || '',
            accessToken: tokenResponse.access_token || '',
            refreshToken: tokenResponse.refresh_token || previousState?.refreshToken || '',
            tokenType: tokenResponse.token_type || 'Bearer',
            expiresAt
        };
    }

    async function clearGoogleManifestAuthTokens() {
        const tokenState = await getGoogleSyncTokenState();
        const accessToken = tokenState?.accessToken || '';
        if (!accessToken) return;
        try {
            await fetch(`${DROPBOX_API_RPC_BASE}/auth/token/revoke`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` }
            });
        } catch (error) {
            // best effort
        }
    }

    async function authorizeDropboxInteractive(appKey) {
        if (!appKey) throw new Error(trKey('dropboxAppKeyNotSet', 'Dropbox App Key не задан'));
        const redirectUri = getDropboxRedirectUri();
        const state = createRandomString(24);
        const codeVerifier = createRandomString(96);
        const codeChallenge = await buildCodeChallenge(codeVerifier);
        const authUrl = new URL(DROPBOX_OAUTH_AUTHORIZE_URL);
        authUrl.searchParams.set('client_id', appKey);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('token_access_type', 'offline');
        authUrl.searchParams.set('scope', DROPBOX_SCOPE);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        const callbackUrl = await launchWebAuthFlow(authUrl.toString(), true);
        const callback = new URL(callbackUrl);
        const callbackState = callback.searchParams.get('state');
        if (!callbackState || callbackState !== state) throw new Error('Dropbox OAuth state mismatch');
        const oauthError = callback.searchParams.get('error');
        if (oauthError) throw new Error(`Dropbox OAuth error: ${oauthError}`);
        const code = callback.searchParams.get('code');
        if (!code) throw new Error('Dropbox OAuth code missing');

        const tokenResponse = await requestDropboxToken({
            code,
            client_id: appKey,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });
        const previousTokenState = await getGoogleSyncTokenState();
        const statePayload = buildDropboxTokenState(appKey, tokenResponse, previousTokenState);
        await setGoogleSyncTokenState(statePayload);
        return statePayload;
    }

    async function refreshDropboxAccessToken(appKey, refreshToken) {
        if (!appKey || !refreshToken) throw new Error('No refresh token');
        const tokenResponse = await requestDropboxToken({
            client_id: appKey,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });
        const refreshed = buildDropboxTokenState(appKey, tokenResponse, { refreshToken });
        await setGoogleSyncTokenState(refreshed);
        return refreshed;
    }

    function normalizeDropboxPath(fileName) {
        const clean = String(fileName || '').trim() || DEFAULT_GOOGLE_SYNC_FILE;
        return clean.startsWith('/') ? clean : `/${clean}`;
    }

    async function getGoogleDriveAccessToken(options = {}) {
        const interactive = !!options.interactive;
        if (!hasGoogleDriveAuthApi()) {
            throw new Error(trKey('dropboxOauthUnsupported', 'Браузер не поддерживает Dropbox OAuth (ни API расширения, ни popup flow).'));
        }
        const appKey = getConfiguredDropboxAppKey();

        const token = await getGoogleSyncTokenState();
        const tokenAppKey = String(token?.appKey || '').trim();
        const accessToken = String(token?.accessToken || '').trim();
        const refreshToken = String(token?.refreshToken || '').trim();
        const effectiveAppKey = String(appKey || tokenAppKey || '').trim();

        if (accessToken) {
            const expiresAt = Number(token?.expiresAt || 0);
            const looksExpired = Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now() + 10_000;
            if (!looksExpired) return accessToken;
            if (!refreshToken || !effectiveAppKey) return accessToken;
            try {
                const refreshed = await refreshDropboxAccessToken(effectiveAppKey, refreshToken);
                if (refreshed?.accessToken) return refreshed.accessToken;
            } catch (error) {
                return accessToken;
            }
        }

        if (refreshToken && effectiveAppKey) {
            try {
                const refreshed = await refreshDropboxAccessToken(effectiveAppKey, refreshToken);
                if (refreshed?.accessToken) return refreshed.accessToken;
            } catch (error) {
                // fallback to interactive auth if allowed
            }
        }

        if (!interactive) throw new Error(trKey('dropboxNotAuthorized', 'Dropbox не авторизован'));
        if (!effectiveAppKey) {
            throw new Error(trKey('dropboxKeyMissingShort', 'В AirTab не настроен Dropbox App Key'));
        }
        const authorized = await authorizeDropboxInteractive(effectiveAppKey);
        if (!authorized?.accessToken) {
            throw new Error(trKey('dropboxAccessTokenMissing', 'Не удалось получить Dropbox access token'));
        }
        return authorized.accessToken;
    }

    async function requestDropboxJson(path, accessToken, options = {}) {
        const response = await fetch(`${DROPBOX_API_RPC_BASE}${path}`, {
            method: options.method || 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            body: options.body || JSON.stringify(options.payload || {})
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = payload?.error_summary || payload?.error || `HTTP ${response.status}`;
            throw new Error(String(err));
        }
        return payload;
    }

    async function uploadGoogleDriveSyncFile(accessToken, fileName, jsonText) {
        const path = normalizeDropboxPath(fileName);
        const response = await fetch(`${DROPBOX_API_CONTENT_BASE}/files/upload`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({
                    path,
                    mode: 'overwrite',
                    autorename: false,
                    mute: true,
                    strict_conflict: false
                })
            },
            body: jsonText
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = payload?.error_summary || payload?.error || `HTTP ${response.status}`;
            throw new Error(String(err));
        }
        return payload?.id || null;
    }

    async function downloadGoogleDriveSyncFile(accessToken, fileName) {
        const path = normalizeDropboxPath(fileName);
        const response = await fetch(`${DROPBOX_API_CONTENT_BASE}/files/download`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Dropbox-API-Arg': JSON.stringify({ path })
            }
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const err = payload?.error_summary || payload?.error || `HTTP ${response.status}`;
            const message = String(err);
            const missing = response.status === 409 && /not[_/ -]?found/i.test(message);
            const error = new Error(message);
            if (missing) error.code = 'DROPBOX_FILE_NOT_FOUND';
            throw error;
        }
        return await response.text();
    }

    function formatSyncTime(timestamp) {
        const value = Number(timestamp || 0);
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        const activeLang = i18n ? i18n.getActiveLanguage() : 'ru';
        const locale = activeLang === 'pt-BR' ? 'pt-BR'
            : activeLang === 'zh-CN' ? 'zh-CN'
                : activeLang === 'hi' ? 'hi-IN'
                    : activeLang === 'ar' ? 'ar'
                        : activeLang === 'es' ? 'es-ES'
                            : activeLang === 'ru' ? 'ru-RU'
                                : 'en-US';
        return date.toLocaleString(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function getSyncUiMode() {
        const stored = String(localStorage.getItem(SYNC_UI_MODE_KEY) || '').trim().toLowerCase();
        return stored === 'local' ? 'local' : 'dropbox';
    }

    function applySyncModeUi(mode = getSyncUiMode()) {
        const normalized = mode === 'local' ? 'local' : 'dropbox';
        const dropboxCard = document.getElementById('dropboxSyncCard');
        const localCard = document.getElementById('localSyncCard');
        const modeButtons = document.querySelectorAll('#syncModeSwitch .sync-mode-btn');

        modeButtons.forEach((button) => {
            button.classList.toggle('active', button.dataset.syncMode === normalized);
        });
        if (dropboxCard) dropboxCard.classList.toggle('hidden', normalized !== 'dropbox');
        if (localCard) localCard.classList.toggle('hidden', normalized !== 'local');
    }

    function setSyncUiMode(mode) {
        const nextMode = mode === 'local' ? 'local' : 'dropbox';
        localStorage.setItem(SYNC_UI_MODE_KEY, nextMode);
        applySyncModeUi(nextMode);
    }

    async function buildThemeFallbackBlob(file) {
        if (!file || !file.type.startsWith('image/')) return null;
        if (typeof createImageBitmap !== 'function') return file;
        const bitmap = await createImageBitmap(file);
        try {
            const maxWidth = 1920;
            const maxHeight = 1200;
            const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
            const width = Math.max(1, Math.round(bitmap.width * scale));
            const height = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return file;
            ctx.drawImage(bitmap, 0, 0, width, height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
            canvas.width = 1;
            canvas.height = 1;
            if (blob && blob.size > 0) {
                // Keep fallback lightweight and avoid pathological growth.
                if (blob.size <= file.size * 1.25 || file.size > 1024 * 1024) return blob;
            }
            return file;
        } catch (e) {
            return file;
        } finally {
            bitmap.close();
        }
    }

    async function ensureLocalHandleReadable(handle) {
        if (!handle || typeof handle.getFile !== 'function') return false;
        if (typeof handle.queryPermission === 'function' && typeof handle.requestPermission === 'function') {
            const current = await handle.queryPermission({ mode: 'read' });
            if (current === 'granted') return true;
            const requested = await handle.requestPermission({ mode: 'read' });
            return requested === 'granted';
        }
        return true;
    }

    async function pickLocalThemeBackground(theme) {
        if (typeof window.showOpenFilePicker !== 'function') {
            showStatus(
                trKey('localFilePickerUnsupported', 'Браузер не поддерживает выбор локального файла по ссылке.'),
                'error'
            );
            return;
        }
        try {
            const [handle] = await window.showOpenFilePicker({
                multiple: false,
                types: [{
                    description: 'Изображения',
                    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.svg'] }
                }]
            });
            if (!handle) return;
            const canRead = await ensureLocalHandleReadable(handle);
            if (!canRead) {
                showStatus(trKey('localFileAccessDenied', 'Нет доступа к выбранному файлу.'), 'error');
                return;
            }
            const token = getLocalBgToken(theme);
            pendingLocalThemeHandles[theme] = handle;
            const suffix = theme === 'light' ? 'Light' : 'Dark';
            document.getElementById(`bgInput${suffix}`).value = token;
            setThemeBackground(theme, token);
            await saveLocalThemeHandle(theme, handle);
            try {
                const file = await handle.getFile();
                const fallbackBlob = await buildThemeFallbackBlob(file);
                await saveLocalThemeFallbackBlob(theme, fallbackBlob);
            } catch (e) {
                // Fallback cache is best-effort; handle remains the primary source.
            }
            pendingLocalThemeHandles[theme] = null;
            localStorage.setItem('airtabSettingsUpdatedAt', String(Date.now()));
            themeDraftDirty = true;
            showStatus(
                trKey('localFileLinkedSaved', 'Локальный файл привязан и сохранён (файл: {fileName}).', {
                    fileName: handle.name || '-'
                })
            );
        } catch (error) {
            if (error?.name === 'AbortError') return;
            showStatus(trKey('localFileAttachFailed', 'Не удалось привязать локальный файл.'), 'error');
        }
    }

    function saveThemeDraftToStorage() {
        const newBgLight = document.getElementById('bgInputLight').value.trim() || defaultBgLight;
        const newBgDark = document.getElementById('bgInputDark').value.trim() || defaultBgDark;
        if (newBgLight.startsWith('data:image/') || newBgDark.startsWith('data:image/')) return;
        setThemeBackground('light', newBgLight);
        setThemeBackground('dark', newBgDark);
        const prevPerfMode = getPerformanceMode();
        const perfMode = document.getElementById('performanceModeSelect').value === 'eco' ? 'eco' : 'balanced';
        localStorage.setItem('airtabPerformanceMode', perfMode);
        if (prevPerfMode !== perfMode) markLocalDataUpdated(Date.now());
        setStoredBrowserProfile(document.getElementById('browserProfileSelect')?.value || 'auto');
        setDndDebugEnabled(!!document.getElementById('dndDebugEnabled')?.checked);
        localStorage.setItem('airtabSettingsUpdatedAt', String(Date.now()));
    }

    async function persistPendingLocalThemeBackground(theme, value) {
        if (!isThemeLocalBgToken(theme, value)) {
            pendingLocalThemeHandles[theme] = null;
            return;
        }
        const pendingHandle = pendingLocalThemeHandles[theme];
        if (pendingHandle) {
            await saveLocalThemeHandle(theme, pendingHandle);
            pendingLocalThemeHandles[theme] = null;
            return;
        }
        const storedHandle = await getStoredLocalThemeHandle(theme);
        const storedFallback = await getStoredLocalThemeFallbackBlob(theme);
        if (!storedHandle && !storedFallback) {
            showStatus(trKey('localBgFileMissing', 'Файл для локального фона не найден. Выберите его снова.'), 'error');
        }
    }

    function setTab(tab) {
        const safeTab = document.querySelector(`[data-panel="${tab}"]`) ? tab : 'search';
        localStorage.setItem('settingsTab', safeTab);
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === safeTab);
        });
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === safeTab);
        });
    }

    function fillSelectOptions(select, optionItems) {
        if (!select) return;
        select.textContent = '';
        const fragment = document.createDocumentFragment();
        (optionItems || []).forEach((item) => {
            const option = document.createElement('option');
            option.value = String(item?.value ?? '');
            option.textContent = String(item?.label ?? item?.value ?? '');
            fragment.appendChild(option);
        });
        select.appendChild(fragment);
    }

    function initUiLanguageSelector() {
        const select = document.getElementById('uiLanguageSelect');
        const hint = document.getElementById('uiLanguageHint');
        if (!select || !i18n) return;

        const selected = i18n.getStoredLanguage();
        const options = i18n.getLanguageOptions(selected);
        fillSelectOptions(select, options);
        select.value = selected;
        if (hint) hint.textContent = i18n.t('interfaceLanguageHint');

        select.addEventListener('change', () => {
            const nextValue = i18n.setStoredLanguage(select.value || 'auto');
            const refreshed = i18n.getLanguageOptions(nextValue);
            fillSelectOptions(select, refreshed);
            select.value = nextValue;
            if (hint) hint.textContent = i18n.t('interfaceLanguageHint');
            initBrowserProfileSelector();
            i18n.translateDocument(document.body);
            updateSyncUi().catch(() => {});
        });
    }

    function renderEngineList() {
        engineList.textContent = '';
        const fragment = document.createDocumentFragment();
        engines.forEach((engine, index) => {
            const isFirst = index === 0;
            const isLast = index === engines.length - 1;
            const row = document.createElement('div');
            row.className = 'list-item';
            row.dataset.index = String(index);

            const title = document.createElement('div');
            title.className = 'item-title';

            const icon = document.createElement('img');
            icon.src = String(engine.icon || '');
            icon.alt = '';

            const name = document.createElement('span');
            name.className = 'clip';
            name.textContent = String(engine.name || '');

            title.append(icon, name);

            const controls = document.createElement('div');
            controls.className = 'controls';

            const moveUp = document.createElement('button');
            moveUp.type = 'button';
            moveUp.className = 'btn btn-ghost btn-icon move-engine';
            moveUp.dataset.dir = '-1';
            moveUp.disabled = isFirst;
            moveUp.textContent = '↑';

            const moveDown = document.createElement('button');
            moveDown.type = 'button';
            moveDown.className = 'btn btn-ghost btn-icon move-engine';
            moveDown.dataset.dir = '1';
            moveDown.disabled = isLast;
            moveDown.textContent = '↓';

            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'btn btn-tonal btn-icon edit-engine';
            edit.textContent = '✎';

            controls.append(moveUp, moveDown, edit);
            row.append(title, controls);
            fragment.appendChild(row);
        });
        engineList.appendChild(fragment);
    }

    function openEngineEditor(index = null) {
        editingEngineIndex = Number.isInteger(index) ? index : null;
        const editor = document.getElementById('engineEditor');
        const deleteBtn = document.getElementById('btnDeleteEngine');
        const nameInput = document.getElementById('engineName');
        const urlInput = document.getElementById('engineUrl');
        const iconInput = document.getElementById('engineIcon');
        if (editingEngineIndex === null) {
            nameInput.value = '';
            urlInput.value = '';
            iconInput.value = '';
            deleteBtn.style.display = 'none';
        } else {
            const engine = engines[editingEngineIndex];
            if (!engine) return;
            nameInput.value = engine.name;
            urlInput.value = engine.url;
            iconInput.value = engine.icon;
            deleteBtn.style.display = 'inline-block';
        }
        nameInput.dataset.autoValue = '';
        iconInput.dataset.autoValue = '';
        editor.classList.remove('hidden');
    }

    function closeEngineEditor() {
        editingEngineIndex = null;
        document.getElementById('engineEditor').classList.add('hidden');
    }

    function refreshSpaceDependentUi() {
        refreshBookmarkTargetSpaceOptions();
        updateBookmarkImportPreview();
    }

    function initThemeInputs() {
        const light = getThemeBackground('light');
        const dark = getThemeBackground('dark');
        document.getElementById('bgInputLight').value = light;
        document.getElementById('bgInputDark').value = dark;
        if (light.startsWith('#')) document.getElementById('bgColorPickerLight').value = light.slice(0, 7);
        if (dark.startsWith('#')) document.getElementById('bgColorPickerDark').value = dark.slice(0, 7);
        document.getElementById('performanceModeSelect').value = getPerformanceMode();
        const browserProfileSelect = document.getElementById('browserProfileSelect');
        if (browserProfileSelect) browserProfileSelect.value = getStoredBrowserProfile();
        updateBrowserProfileHint();
        document.getElementById('dndDebugEnabled').checked = getDndDebugEnabled();
        themeDraftDirty = false;
    }

    async function blobToDataUrl(blob) {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Failed to encode blob'));
            reader.readAsDataURL(blob);
        });
    }

    async function dataUrlToBlob(dataUrl) {
        const response = await fetch(dataUrl);
        return response.blob();
    }

    async function collectBackupLocalThemeFallbacks() {
        const localThemeFallbacks = {};
        for (const theme of ['light', 'dark']) {
            const currentBackground = getThemeBackground(theme);
            if (!isThemeLocalBgToken(theme, currentBackground)) continue;
            try {
                const fallbackBlob = await getStoredLocalThemeFallbackBlob(theme);
                if (fallbackBlob instanceof Blob && fallbackBlob.size > 0) {
                    localThemeFallbacks[theme] = await blobToDataUrl(fallbackBlob);
                }
            } catch (error) {
                // keep backup lightweight; fallback export is best-effort
            }
        }
        return localThemeFallbacks;
    }

    async function restoreBackupLocalThemeFallbacks(fallbacks, backgroundsByTheme) {
        const fallbackMap = (fallbacks && typeof fallbacks === 'object') ? fallbacks : {};
        for (const theme of ['light', 'dark']) {
            const background = backgroundsByTheme?.[theme] || getThemeBackground(theme);
            const encoded = typeof fallbackMap[theme] === 'string' ? fallbackMap[theme].trim() : '';
            if (encoded.startsWith('data:')) {
                try {
                    const blob = await dataUrlToBlob(encoded);
                    if (blob instanceof Blob && blob.size > 0) {
                        await saveLocalThemeFallbackBlob(theme, blob);
                        continue;
                    }
                } catch (error) {
                    // ignore malformed fallback payload
                }
            }
            if (!isThemeLocalBgToken(theme, background)) {
                await Promise.all([
                    deleteLocalThemeHandle(theme),
                    deleteLocalThemeFallbackBlob(theme)
                ]);
            }
        }
    }

    async function buildBackupPayload() {
        const backup = {
            version: DATA_VERSION,
            data: data,
            engines: engines,
            activeEngine: localStorage.getItem('myActiveEngine') || '',
            bgLight: getThemeBackground('light'),
            bgDark: getThemeBackground('dark'),
            performanceMode: getPerformanceMode(),
            dndDebugEnabled: getDndDebugEnabled(),
            uiLanguage: i18n ? i18n.getStoredLanguage() : 'auto'
        };
        const localThemeFallbacks = await collectBackupLocalThemeFallbacks();
        if (Object.keys(localThemeFallbacks).length) {
            backup.localThemeFallbacks = localThemeFallbacks;
        }
        return backup;
    }

    async function applyImportedBackup(imported) {
        if (imported?.data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(imported.data));
        } else if (imported?.spaces) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: DATA_VERSION,
                spaces: imported.spaces,
                activeSpaceId: imported.activeSpaceId || imported.spaces[0]?.id
            }));
        } else if (imported?.links) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(buildDefaultData(imported.links)));
        } else {
            throw new Error('bad format');
        }

        if (imported.engines) localStorage.setItem('myEngines', JSON.stringify(imported.engines));
        if (imported.activeEngine) localStorage.setItem('myActiveEngine', String(imported.activeEngine));
        if (imported.bgLight) localStorage.setItem('myBgLight', imported.bgLight);
        if (imported.bgDark) localStorage.setItem('myBgDark', imported.bgDark);
        if (imported.performanceMode) localStorage.setItem('airtabPerformanceMode', imported.performanceMode === 'eco' ? 'eco' : 'balanced');
        if (Object.prototype.hasOwnProperty.call(imported, 'dndDebugEnabled')) {
            setDndDebugEnabled(Boolean(imported.dndDebugEnabled));
        }
        if (i18n && Object.prototype.hasOwnProperty.call(imported, 'uiLanguage')) {
            i18n.setStoredLanguage(imported.uiLanguage || 'auto');
        }

        const restoredLight = typeof imported.bgLight === 'string' ? imported.bgLight : getThemeBackground('light');
        const restoredDark = typeof imported.bgDark === 'string' ? imported.bgDark : getThemeBackground('dark');
        await restoreBackupLocalThemeFallbacks(imported.localThemeFallbacks, {
            light: restoredLight,
            dark: restoredDark
        });

        data = loadData();
        engines = loadEngines();
        renderEngineList();
        refreshSpaceDependentUi();
        initThemeInputs();
        initUiLanguageSelector();
        closeEngineEditor();
        markLocalDataUpdated(Date.now());
        localStorage.setItem('airtabSettingsUpdatedAt', String(Date.now()));
        if (i18n) i18n.translateDocument(document.body);
    }

    async function exportBackup() {
        const backup = await buildBackupPayload();
        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = 'AirTab_Backup.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        showStatus(trKey('backupDownloaded', 'Резервная копия скачана.'));
    }

    async function syncDropboxAfterLocalBackupRestore() {
        if (!isGoogleSyncConnectedFromMeta()) return { attempted: false, ok: false, error: '' };
        try {
            await syncPushToGoogleDrive({ interactive: false });
            clearGoogleSyncError();
            return { attempted: true, ok: true, error: '' };
        } catch (error) {
            const message = String(error?.message || trKey('genericError', 'ошибка'));
            setGoogleSyncError(message);
            return { attempted: true, ok: false, error: message };
        }
    }

    function importBackup(file) {
        const reader = new FileReader();
        reader.onload = async function(evt) {
            try {
                const imported = JSON.parse(evt.target?.result || '{}');
                await applyImportedBackup(imported);
                const dropboxSync = await syncDropboxAfterLocalBackupRestore();
                if (dropboxSync.attempted && dropboxSync.ok) {
                    showStatus(trKey('backupRestoredAndDropboxSynced', 'Резерв восстановлен и отправлен в Dropbox.'));
                } else if (dropboxSync.attempted) {
                    showStatus(
                        trKey(
                            'backupRestoredDropboxSyncFailed',
                            'Резерв восстановлен, но отправка в Dropbox не удалась: {error}',
                            { error: dropboxSync.error || trKey('genericError', 'ошибка') }
                        ),
                        'error'
                    );
                } else {
                    showStatus(trKey('backupRestored', 'Резерв восстановлен.'));
                }
                await updateSyncUi().catch(() => {});
            } catch (error) {
                showStatus(trKey('backupImportBadFile', 'Ошибка импорта: неверный файл.'), 'error');
            }
        };
        reader.readAsText(file);
    }

    async function pickSyncFileHandle() {
        if (typeof window.showSaveFilePicker !== 'function') {
            throw new Error(trKey('syncFilePickerUnsupported', 'Браузер не поддерживает выбор sync-файла'));
        }
        const handle = await window.showSaveFilePicker({
            suggestedName: 'AirTab.sync.json',
            types: [{
                description: 'JSON',
                accept: { 'application/json': ['.json'] }
            }]
        });
        await saveStoredSyncFileHandle(handle);
        const readGranted = await ensureFileHandlePermission(handle, 'read');
        const writeGranted = await ensureFileHandlePermission(handle, 'readwrite');
        if (!readGranted || !writeGranted) {
            throw new Error(trKey('syncFileNoAccess', 'Нет доступа к sync-файлу'));
        }
        setSyncLocalMeta({
            fileName: handle.name || 'AirTab.sync.json',
            linkedAt: Date.now()
        });
        return handle;
    }

    async function getOrPickSyncFileHandle() {
        let handle = null;
        try {
            handle = await getStoredSyncFileHandle();
        } catch (error) {
            handle = null;
        }
        if (handle) return handle;
        return await pickSyncFileHandle();
    }

    async function syncPushToLocalFile() {
        const handle = await getOrPickSyncFileHandle();
        const canWrite = await ensureFileHandlePermission(handle, 'readwrite');
        if (!canWrite) throw new Error(trKey('syncFileNoWriteAccess', 'Нет права на запись sync-файла'));
        const payload = await buildBackupPayload();
        const writable = await handle.createWritable();
        try {
            await writable.write(JSON.stringify(payload));
            await writable.close();
        } catch (error) {
            try { await writable.abort(); } catch (e) {}
            throw error;
        }
        setSyncLocalMeta({
            fileName: handle.name || 'AirTab.sync.json',
            lastPushAt: Date.now()
        });
    }

    async function syncPullFromLocalFile() {
        const handle = await getOrPickSyncFileHandle();
        const canRead = await ensureFileHandlePermission(handle, 'read');
        if (!canRead) throw new Error(trKey('syncFileNoReadAccess', 'Нет права на чтение sync-файла'));
        const file = await handle.getFile();
        const text = await file.text();
        const imported = JSON.parse(String(text || '{}'));
        await applyImportedBackup(imported);
        setSyncLocalMeta({
            fileName: handle.name || 'AirTab.sync.json',
            lastPullAt: Date.now()
        });
    }

    async function connectGoogleDriveSync() {
        if (!hasGoogleDriveAuthApi()) {
            throw new Error(trKey('browserNoOAuthApi', 'Этот браузер не поддерживает безопасную OAuth-авторизацию (ни API расширения, ни popup flow).'));
        }
        await getGoogleDriveAccessToken({ interactive: true });
        clearGoogleSyncError();
        setSyncGoogleMeta({ connectedAt: Date.now() });
    }

    async function disconnectGoogleDriveSync() {
        await clearGoogleManifestAuthTokens().catch(() => {});
        clearGoogleSyncError();
        await clearGoogleSyncTokenState();
        setSyncGoogleMeta({ disconnectedAt: Date.now() });
    }

    async function syncPushToGoogleDrive(options = {}) {
        const interactive = options.interactive !== false;
        const accessToken = await getGoogleDriveAccessToken({ interactive });
        const fileName = getGoogleSyncFileName();
        const payload = await buildBackupPayload();
        await uploadGoogleDriveSyncFile(accessToken, fileName, JSON.stringify(payload));
        clearGoogleSyncError();
        setSyncGoogleMeta({
            fileName,
            lastPushAt: Date.now(),
            connectedAt: Date.now()
        });
    }

    async function syncPullFromGoogleDrive(options = {}) {
        const interactive = options.interactive !== false;
        const accessToken = await getGoogleDriveAccessToken({ interactive });
        const fileName = getGoogleSyncFileName();
        const text = await downloadGoogleDriveSyncFile(accessToken, fileName);
        const imported = JSON.parse(String(text || '{}'));
        await applyImportedBackup(imported);
        clearGoogleSyncError();
        setSyncGoogleMeta({
            fileName,
            lastPullAt: Date.now(),
            connectedAt: Date.now()
        });
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(String(evt.target?.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    function getFileBaseName(fileName) {
        const clean = String(fileName || '').replace(/\.[^.]+$/, '').trim();
        return clean || 'Импорт';
    }

    const bookmarkEntityParser = new DOMParser();

    function decodeBookmarkHtmlText(value) {
        const doc = bookmarkEntityParser.parseFromString(String(value || ''), 'text/html');
        return doc.body?.textContent || '';
    }

    function normalizeBookmarkTitle(value, fallback = 'Без названия') {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        return text || fallback;
    }

    function isSystemBookmarkFolderName(value) {
        return SYSTEM_BOOKMARK_FOLDERS.has(String(value || '').trim().toLowerCase());
    }

    function extractBookmarkUrl(entry) {
        const candidate = entry?.url || entry?.href || entry?.link || entry?.uri || '';
        return normalizeUrl(String(candidate || ''));
    }

    function extractBookmarkChildren(entry) {
        const candidate = entry?.children || entry?.items || entry?.bookmarks || entry?.nodes || null;
        return Array.isArray(candidate) ? candidate : null;
    }

    function normalizeBookmarkEntries(entries) {
        if (!Array.isArray(entries)) return [];
        const nodes = [];
        entries.forEach((entry, index) => {
            if (!entry || typeof entry !== 'object') return;
            const url = extractBookmarkUrl(entry);
            const name = normalizeBookmarkTitle(entry.title || entry.name || entry.text || `Ссылка ${index + 1}`);
            if (url) {
                nodes.push({ type: 'link', name, url });
                return;
            }
            const children = extractBookmarkChildren(entry);
            if (children && children.length) {
                nodes.push({
                    type: 'folder',
                    name: normalizeBookmarkTitle(entry.title || entry.name || `Папка ${index + 1}`),
                    children: normalizeBookmarkEntries(children)
                });
            }
        });
        return nodes;
    }

    function parseRaindropJson(raw) {
        const items = Array.isArray(raw?.items) ? raw.items : [];
        if (!items.length) return [];
        const collections = Array.isArray(raw?.collections) ? raw.collections : [];
        if (!collections.length) {
            return normalizeBookmarkEntries(items);
        }

        const collectionMap = new Map();
        collections.forEach((collection, index) => {
            const idRaw = collection?._id ?? collection?.id ?? collection?.uid ?? index;
            const id = String(idRaw);
            collectionMap.set(id, {
                id,
                parentId: collection?.parentId ?? collection?.parent?._id ?? collection?.parent?.id ?? null,
                type: 'folder',
                name: normalizeBookmarkTitle(collection?.title || collection?.name || `Collection ${index + 1}`),
                children: []
            });
        });

        const roots = [];
        collectionMap.forEach((node) => {
            const parentId = node.parentId === null || node.parentId === undefined ? null : String(node.parentId);
            if (parentId && collectionMap.has(parentId)) {
                collectionMap.get(parentId).children.push(node);
            } else {
                roots.push(node);
            }
        });

        items.forEach((item, index) => {
            const url = extractBookmarkUrl(item);
            if (!url) return;
            const linkNode = {
                type: 'link',
                name: normalizeBookmarkTitle(item?.title || item?.name || `Ссылка ${index + 1}`),
                url
            };
            const collectionIdRaw = item?.collectionId ?? item?.collection?._id ?? item?.collection?.id ?? item?.collection?.$id ?? item?.collection ?? null;
            const collectionId = collectionIdRaw === null || collectionIdRaw === undefined ? null : String(collectionIdRaw);
            if (collectionId && collectionMap.has(collectionId)) {
                collectionMap.get(collectionId).children.push(linkNode);
            } else {
                roots.push(linkNode);
            }
        });

        return roots;
    }

    function parseBookmarkJson(text) {
        const raw = JSON.parse(String(text || '').replace(/^\uFEFF/, '').trim());
        if (Array.isArray(raw)) return normalizeBookmarkEntries(raw);
        if (raw && typeof raw === 'object') {
            if (Array.isArray(raw.items) && Array.isArray(raw.collections)) {
                const raindropNodes = parseRaindropJson(raw);
                if (raindropNodes.length) return raindropNodes;
            }
            if (Array.isArray(raw.items)) return normalizeBookmarkEntries(raw.items);
            if (Array.isArray(raw.bookmarks)) return normalizeBookmarkEntries(raw.bookmarks);
            if (Array.isArray(raw.children)) return normalizeBookmarkEntries(raw.children);
            if (raw.root && Array.isArray(raw.root.children)) return normalizeBookmarkEntries(raw.root.children);
        }
        throw new Error('Unsupported JSON format');
    }

    function parseBookmarkTextUrlsFallback(text) {
        const raw = String(text || '');
        if (!raw.trim()) return [];
        const anchorRegex = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
        const anchorFound = [];
        let anchorMatch = anchorRegex.exec(raw);
        while (anchorMatch) {
            const href = anchorMatch[1] || anchorMatch[2] || anchorMatch[3] || '';
            const innerHtml = anchorMatch[4] || '';
            const plainTitle = decodeBookmarkHtmlText(String(innerHtml).replace(/<[^>]*>/g, ' '));
            anchorFound.push({
                url: href,
                name: normalizeBookmarkTitle(plainTitle, '')
            });
            anchorMatch = anchorRegex.exec(raw);
        }

        const hrefRegex = /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
        const hrefFound = [];
        if (!anchorFound.length) {
            let hrefMatch = hrefRegex.exec(raw);
            while (hrefMatch) {
                hrefFound.push({
                    url: hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || '',
                    name: ''
                });
                hrefMatch = hrefRegex.exec(raw);
            }
        }

        const urlRegex = /https?:\/\/[^\s"'<>`]+/gi;
        const genericFound = (!anchorFound.length && !hrefFound.length)
            ? (raw.match(urlRegex) || []).map(url => ({ url, name: '' }))
            : [];
        const found = anchorFound.length ? anchorFound : (hrefFound.length ? hrefFound : genericFound);
        const seen = new Set();
        const links = [];
        found.forEach((candidate, index) => {
            const rawUrl = candidate?.url || '';
            const rawName = candidate?.name || '';
            let url = decodeBookmarkHtmlText(rawUrl)
                .replace(/[)\],.;'"`]+$/g, '')
                .trim();
            if (!url) return;
            try {
                const parsed = new URL(url);
                if (!/^https?:$/.test(parsed.protocol)) return;
                const key = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
                if (seen.has(key)) return;
                seen.add(key);
                const fallbackName = parsed.hostname.replace(/^www\./i, '') || `Ссылка ${index + 1}`;
                links.push({
                    type: 'link',
                    name: normalizeBookmarkTitle(rawName, fallbackName),
                    url: parsed.toString()
                });
            } catch (e) {
                // ignore malformed candidates
            }
        });
        return links;
    }

    function parseBookmarkHtml(text) {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const parseGenericAnchors = () => {
            const links = [];
            const seen = new Set();
            const anchors = Array.from(doc.querySelectorAll('a[href]'));
            anchors.forEach((anchor) => {
                const hrefRaw = String(anchor.getAttribute('href') || '').trim();
                if (!hrefRaw) return;
                if (/^(javascript:|mailto:|tel:|about:|chrome:|edge:|file:|#)/i.test(hrefRaw)) return;
                const url = normalizeUrl(hrefRaw);
                if (!url) return;
                const key = url.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                links.push({
                    type: 'link',
                    name: normalizeBookmarkTitle(anchor.textContent || anchor.getAttribute('title') || 'Без названия'),
                    url
                });
            });
            return links;
        };

        const rootDl = doc.querySelector('dl');
        if (!rootDl) {
            const generic = parseGenericAnchors();
            if (generic.length) return generic;
            throw new Error('Bookmark HTML does not contain <DL> structure');
        }

        const parseDlNode = (dl) => {
            const nodes = [];
            let current = dl.firstElementChild;
            while (current) {
                if (current.tagName === 'DT') {
                    const directChildren = Array.from(current.children || []);
                    const linkEl = directChildren.find(el => el.tagName === 'A' && el.getAttribute('href'));
                    if (linkEl) {
                        const url = normalizeUrl(linkEl.getAttribute('href') || '');
                        if (url) {
                            nodes.push({
                                type: 'link',
                                name: normalizeBookmarkTitle(linkEl.textContent || 'Без названия'),
                                url
                            });
                        }
                    } else {
                        const folderEl = directChildren.find(el => ['H1', 'H2', 'H3'].includes(el.tagName));
                        if (folderEl) {
                            let next = current.nextElementSibling;
                            while (next && next.tagName === 'P') next = next.nextElementSibling;
                            const children = next && next.tagName === 'DL' ? parseDlNode(next) : [];
                            nodes.push({
                                type: 'folder',
                                name: normalizeBookmarkTitle(folderEl.textContent || 'Папка'),
                                children
                            });
                        }
                    }
                } else if (current.tagName === 'A' && current.getAttribute('href')) {
                    const url = normalizeUrl(current.getAttribute('href') || '');
                    if (url) {
                        nodes.push({
                            type: 'link',
                            name: normalizeBookmarkTitle(current.textContent || 'Без названия'),
                            url
                        });
                    }
                }
                current = current.nextElementSibling;
            }
            return nodes;
        };

        const parsed = parseDlNode(rootDl);
        if (parsed.length) return parsed;
        const generic = parseGenericAnchors();
        if (generic.length) return generic;
        throw new Error('No links found in HTML');
    }

    function pruneBookmarkNodes(nodes) {
        return (Array.isArray(nodes) ? nodes : []).map((node) => {
            if (!node || typeof node !== 'object') return null;
            if (node.type === 'link') {
                const url = normalizeUrl(node.url || '');
                if (!url) return null;
                return {
                    type: 'link',
                    name: normalizeBookmarkTitle(node.name || node.title || 'Без названия'),
                    url
                };
            }
            const childrenRaw = node.children || node.items || [];
            const children = pruneBookmarkNodes(childrenRaw);
            if (!children.length) return null;
            return {
                type: 'folder',
                name: normalizeBookmarkTitle(node.name || node.title || 'Папка'),
                children
            };
        }).filter(Boolean);
    }

    function parseBookmarkFileText(text, fileName = '') {
        const lowerName = String(fileName || '').toLowerCase();
        const htmlHint = /<!doctype|<dl|netscape-bookmark-file|<a\s/i.test(String(text).slice(0, 2048));
        let nodes = [];
        if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || htmlHint) {
            try {
                nodes = parseBookmarkHtml(text);
            } catch (error) {
                nodes = parseBookmarkJson(text);
            }
        } else {
            try {
                nodes = parseBookmarkJson(text);
            } catch (error) {
                nodes = parseBookmarkHtml(text);
            }
        }
        nodes = pruneBookmarkNodes(nodes);
        if (!nodes.length) {
            nodes = pruneBookmarkNodes(parseBookmarkTextUrlsFallback(text));
        }
        if (!nodes.length) throw new Error('No links found in file');
        return nodes;
    }

    function collectBookmarkLinks(nodes, path = []) {
        const links = [];
        (Array.isArray(nodes) ? nodes : []).forEach((node) => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'link') {
                links.push({
                    name: normalizeBookmarkTitle(node.name || 'Без названия'),
                    url: normalizeUrl(node.url || ''),
                    path: Array.isArray(path) ? path.slice() : []
                });
                return;
            }
            const folderName = normalizeBookmarkTitle(node.name || 'Папка');
            links.push(...collectBookmarkLinks(node.children || [], [...path, folderName]));
        });
        return links.filter(link => !!link.url);
    }

    function countBookmarkFolders(nodes) {
        let count = 0;
        (Array.isArray(nodes) ? nodes : []).forEach((node) => {
            if (node?.type === 'folder') {
                count += 1;
                count += countBookmarkFolders(node.children || []);
            }
        });
        return count;
    }

    function getTopLevelImportFolders(nodes) {
        const folders = (Array.isArray(nodes) ? nodes : []).filter(node => node?.type === 'folder');
        if (!folders.length) return [];
        const meaningful = folders.filter(folder => !isSystemBookmarkFolderName(folder.name));
        if (meaningful.length) return meaningful;
        const nestedMeaningful = [];
        folders.forEach((folder) => {
            (folder.children || []).forEach((child) => {
                if (child?.type === 'folder' && !isSystemBookmarkFolderName(child.name)) {
                    nestedMeaningful.push(child);
                }
            });
        });
        return nestedMeaningful.length ? nestedMeaningful : folders;
    }

    function dedupeBookmarkLinks(links, enabled) {
        if (!enabled) return links.slice();
        const seen = new Set();
        const unique = [];
        links.forEach((link) => {
            const normalized = normalizeUrl(link.url || '');
            if (!normalized) return;
            let key = normalized.toLowerCase();
            try {
                const parsed = new URL(normalized);
                parsed.hash = '';
                key = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
            } catch (e) {}
            if (seen.has(key)) return;
            seen.add(key);
            unique.push({ ...link, url: normalized });
        });
        return unique;
    }

    function buildBookmarkImportPayload(nodes, fileName) {
        const cleanNodes = pruneBookmarkNodes(nodes);
        const links = collectBookmarkLinks(cleanNodes);
        const folders = countBookmarkFolders(cleanNodes);
        const topLevelFolders = getTopLevelImportFolders(cleanNodes);
        return {
            fileName: fileName || '',
            importName: getFileBaseName(fileName),
            nodes: cleanNodes,
            topLevelFolders,
            stats: {
                totalLinks: links.length,
                totalFolders: folders,
                topLevelFolders: topLevelFolders.length
            }
        };
    }

    function getBookmarkImportAddAs() {
        const value = String(document.getElementById('bookmarkImportAddAs')?.value || '').trim();
        return value === 'links' ? 'links' : 'folder';
    }

    function getBookmarkImportTargetMode() {
        const value = String(document.getElementById('bookmarkImportTargetMode')?.value || '').trim();
        return value === 'new_space' ? 'new_space' : 'selected_space';
    }

    function getSelectedTargetSpace() {
        const selectedId = document.getElementById('bookmarkTargetSpace').value;
        if (!selectedId) return null;
        return data.spaces.find(space => space.id === selectedId) || null;
    }

    function getActiveSpaceEntry() {
        return data.spaces.find(space => space.id === data.activeSpaceId) || data.spaces[0] || null;
    }

    function ensureAtLeastOneSpace() {
        if (Array.isArray(data.spaces) && data.spaces.length > 0) return;
        const newSpaceId = createId('space');
        data.spaces = [{
            id: newSpaceId,
            name: 'Основное',
            emoji: '🏠',
            bg: '',
            items: []
        }];
        data.activeSpaceId = newSpaceId;
    }

    function getUniqueSpaceName(baseName) {
        const safeBase = normalizeBookmarkTitle(baseName || 'Импорт');
        const names = new Set((data.spaces || []).map(space => String(space.name || '').toLowerCase()));
        if (!names.has(safeBase.toLowerCase())) return safeBase;
        let index = 2;
        while (names.has(`${safeBase.toLowerCase()} (${index})`)) index += 1;
        return `${safeBase} (${index})`;
    }

    function getUniqueFolderName(space, baseName) {
        const safeBase = normalizeBookmarkTitle(baseName || 'Импорт');
        const names = new Set((space?.items || [])
            .filter(item => item?.type === 'folder')
            .map(item => String(item.name || '').toLowerCase()));
        if (!names.has(safeBase.toLowerCase())) return safeBase;
        let index = 2;
        while (names.has(`${safeBase.toLowerCase()} (${index})`)) index += 1;
        return `${safeBase} (${index})`;
    }

    function buildImportedLinkItem(link, keepPath) {
        const url = normalizeUrl(link.url || '');
        if (!url) return null;
        const rawPath = Array.isArray(link.path) ? link.path : [];
        const cleanPath = rawPath
            .map(part => normalizeBookmarkTitle(part, '').trim())
            .filter(Boolean)
            .filter(part => !isSystemBookmarkFolderName(part));
        const prefix = keepPath && cleanPath.length ? `${cleanPath.join(' / ')} / ` : '';
        const name = normalizeBookmarkTitle(`${prefix}${link.name || 'Без названия'}`);
        return {
            id: createId('link'),
            type: 'link',
            name,
            url,
            customIcon: '',
            isCompact: false,
            sidebar: 'left'
        };
    }

    function addFolderImportToSpace(space, importName, sourceNodes, dedupe, keepPath) {
        if (!space) return 0;
        const links = dedupeBookmarkLinks(collectBookmarkLinks(sourceNodes), dedupe);
        const folderItems = links
            .map(link => buildImportedLinkItem(link, keepPath))
            .filter(Boolean);
        if (!folderItems.length) return 0;

        const folder = {
            id: createId('folder'),
            type: 'folder',
            name: getUniqueFolderName(space, importName),
            emoji: '',
            items: folderItems,
            isCompact: false,
            folderView: 'list',
            collapsed: true,
            sidebar: 'left'
        };
        space.items = Array.isArray(space.items) ? space.items : [];
        space.items.push(folder);
        return folderItems.length;
    }

    function addLinksImportToSpace(space, sourceNodes, dedupe, keepPath) {
        if (!space) return 0;
        const links = dedupeBookmarkLinks(collectBookmarkLinks(sourceNodes), dedupe);
        const prepared = links
            .map(link => buildImportedLinkItem(link, keepPath))
            .filter(Boolean);
        if (!prepared.length) return 0;
        space.items = Array.isArray(space.items) ? space.items : [];
        prepared.forEach(item => space.items.push(item));
        return prepared.length;
    }

    function normalizeSpaceEmojiInput(value, fallback = '🧭') {
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        const chars = Array.from(raw);
        return chars.slice(0, 2).join('');
    }

    function getBookmarkNewSpaceNameSuggestion(payload = null) {
        const source = payload || bookmarkImportPayload;
        const baseName = source?.importName || 'Импорт закладок';
        return getUniqueSpaceName(baseName);
    }

    function ensureBookmarkNewSpaceDefaults(payload = null) {
        const nameInput = document.getElementById('bookmarkNewSpaceName');
        const emojiInput = document.getElementById('bookmarkNewSpaceEmoji');
        if (!nameInput) return;

        const suggested = getBookmarkNewSpaceNameSuggestion(payload);
        const previousSuggested = String(nameInput.dataset.suggested || '').trim();
        const current = String(nameInput.value || '').trim();
        if (!current || (previousSuggested && current === previousSuggested)) {
            nameInput.value = suggested;
        }
        nameInput.dataset.suggested = suggested;

        if (emojiInput && !String(emojiInput.value || '').trim()) {
            emojiInput.value = '🧭';
        }
    }

    function buildNewSpaceForBookmarkImport(payload) {
        const nameInput = document.getElementById('bookmarkNewSpaceName');
        const emojiInput = document.getElementById('bookmarkNewSpaceEmoji');
        const fallbackName = payload?.importName || 'Импорт закладок';
        const draftName = normalizeBookmarkTitle(nameInput?.value || fallbackName, fallbackName);
        const draftEmoji = normalizeSpaceEmojiInput(emojiInput?.value, '🧭');
        const space = {
            id: createId('space'),
            name: getUniqueSpaceName(draftName),
            emoji: draftEmoji,
            bg: '',
            showLeftSidebar: true,
            showRightSidebar: true,
            items: []
        };
        if (nameInput) {
            nameInput.value = space.name;
            nameInput.dataset.suggested = space.name;
        }
        if (emojiInput) emojiInput.value = space.emoji;
        return space;
    }

    function refreshBookmarkTargetSpaceOptions() {
        const targetSelect = document.getElementById('bookmarkTargetSpace');
        if (!targetSelect) return;
        const currentValue = targetSelect.value;
        fillSelectOptions(targetSelect, (data.spaces || []).map((space) => ({
            value: space.id,
            label: `${space.emoji || '🧭'} ${space.name}`
        })));
        if (currentValue && data.spaces.some(space => space.id === currentValue)) {
            targetSelect.value = currentValue;
        } else if (data.activeSpaceId && data.spaces.some(space => space.id === data.activeSpaceId)) {
            targetSelect.value = data.activeSpaceId;
        }
    }

    function updateBookmarkTargetSpaceVisibility() {
        const targetMode = getBookmarkImportTargetMode();
        const targetWrap = document.getElementById('bookmarkTargetSpaceWrap');
        const newSpaceWrap = document.getElementById('bookmarkNewSpaceWrap');
        if (targetWrap) targetWrap.classList.toggle('hidden', targetMode !== 'selected_space');
        if (newSpaceWrap) newSpaceWrap.classList.toggle('hidden', targetMode !== 'new_space');
        if (targetMode === 'new_space') ensureBookmarkNewSpaceDefaults();
    }

    function updateBookmarkImportPreview() {
        const previewEl = document.getElementById('bookmarkImportPreview');
        if (!previewEl) return;
        if (!bookmarkImportPayload) {
            previewEl.textContent = trKey('importPreviewChooseFile', 'Выберите файл для предпросмотра импорта.');
            return;
        }

        const addAs = getBookmarkImportAddAs();
        const targetMode = getBookmarkImportTargetMode();
        const dedupe = document.getElementById('bookmarkImportDeduplicate').checked;
        const keepPath = document.getElementById('bookmarkImportKeepPath').checked;
        const sampleLinks = dedupeBookmarkLinks(
            collectBookmarkLinks(bookmarkImportPayload.nodes),
            dedupe
        );
        const linksCount = sampleLinks.length;
        const topLevelFolders = bookmarkImportPayload.stats.topLevelFolders;
        const targetSpace = getSelectedTargetSpace() || getActiveSpaceEntry();
        const newSpaceNameInput = document.getElementById('bookmarkNewSpaceName');
        const draftNewSpaceName = normalizeBookmarkTitle(
            (newSpaceNameInput?.value || '').trim() || getBookmarkNewSpaceNameSuggestion(bookmarkImportPayload),
            bookmarkImportPayload.importName || 'Импорт закладок'
        );
        const missingTargetText = trKey('importTargetMissing', 'не выбрано');
        const selectedSpaceLabel = targetSpace ? `${targetSpace.emoji || '🧭'} ${targetSpace.name}` : missingTargetText;
        let actionText = '';
        if (targetMode === 'new_space') {
            actionText = addAs === 'folder'
                ? trKey(
                    'importActionNewSpaceFolder',
                    'Будет создано новое пространство: {spaceName}, и 1 папка внутри.',
                    { spaceName: draftNewSpaceName }
                )
                : trKey(
                    'importActionNewSpaceLinks',
                    'Будет создано новое пространство: {spaceName}, ярлыки добавятся напрямую.',
                    { spaceName: draftNewSpaceName }
                );
        } else if (addAs === 'folder') {
            actionText = trKey(
                'importActionSelectedFolder',
                'Будет создана 1 папка в пространстве: {spaceName}.',
                { spaceName: selectedSpaceLabel }
            );
        } else {
            actionText = trKey(
                'importActionSelectedLinks',
                'Ярлыки будут добавлены напрямую в пространство: {spaceName}.',
                { spaceName: selectedSpaceLabel }
            );
        }
        const pathHint = keepPath ? trKey('importPathHint', 'Путь папок будет добавлен к названиям при необходимости.') : '';
        previewEl.textContent = trKey(
            'importPreviewSummary',
            'Найдено: {totalLinks} ссылок, {totalFolders} папок (верхний уровень: {topLevel}). После фильтра дублей: {deduped}. {action}{pathHint}',
            {
                totalLinks: bookmarkImportPayload.stats.totalLinks,
                totalFolders: bookmarkImportPayload.stats.totalFolders,
                topLevel: topLevelFolders,
                deduped: linksCount,
                action: actionText,
                pathHint: pathHint ? ` ${pathHint}` : ''
            }
        );
    }

    async function handleBookmarkImportFile(file) {
        const fileLabel = document.getElementById('bookmarkImportFileName');
        if (!file) {
            bookmarkImportPayload = null;
            fileLabel.textContent = trKey('noFileSelected', 'Файл не выбран (.html, .htm, .json)');
            updateBookmarkImportPreview();
            return;
        }
        fileLabel.textContent = `${file.name}`;
        try {
            const content = await readFileAsText(file);
            const nodes = parseBookmarkFileText(content, file.name);
            bookmarkImportPayload = buildBookmarkImportPayload(nodes, file.name);
            ensureBookmarkNewSpaceDefaults(bookmarkImportPayload);
            updateBookmarkImportPreview();
            showStatus(
                trKey(
                    'bookmarksFileLoaded',
                    'Файл загружен: {count} ссылок готово к импорту.',
                    { count: bookmarkImportPayload.stats.totalLinks }
                )
            );
        } catch (error) {
            bookmarkImportPayload = null;
            updateBookmarkImportPreview();
            showStatus(trKey('bookmarkParseError', 'Не удалось распознать файл закладок. Поддерживаются HTML/JSON.'), 'error');
        }
    }

    function runBookmarkImport() {
        if (!bookmarkImportPayload) {
            showStatus(trKey('chooseBookmarksFileFirst', 'Сначала выберите файл закладок.'), 'error');
            return;
        }

        ensureAtLeastOneSpace();

        const addAs = getBookmarkImportAddAs();
        const targetMode = getBookmarkImportTargetMode();
        const dedupe = document.getElementById('bookmarkImportDeduplicate').checked;
        const keepPath = document.getElementById('bookmarkImportKeepPath').checked;

        let createdSpaces = 0;
        let createdFolders = 0;
        let createdLinks = 0;
        let targetSpace = getSelectedTargetSpace() || getActiveSpaceEntry();
        if (targetMode === 'new_space') {
            targetSpace = buildNewSpaceForBookmarkImport(bookmarkImportPayload);
            data.spaces.push(targetSpace);
            createdSpaces += 1;
        }
        if (addAs === 'folder') {
            const added = addFolderImportToSpace(targetSpace, bookmarkImportPayload.importName, bookmarkImportPayload.nodes, dedupe, keepPath);
            if (added > 0) {
                createdFolders += 1;
                createdLinks += added;
            }
        } else {
            createdLinks += addLinksImportToSpace(targetSpace, bookmarkImportPayload.nodes, dedupe, keepPath);
        }

        if (!createdSpaces && !createdFolders && !createdLinks) {
            showStatus(trKey('importNothingToDo', 'Нечего импортировать: проверьте файл и параметры.'), 'error');
            return;
        }

        saveData();
        refreshSpaceDependentUi();
        localStorage.setItem('airtabSettingsUpdatedAt', String(Date.now()));
        const summary = trKey(
            'importSummary',
            'Импорт завершён: пространств {spaces}, папок {folders}, ярлыков {links}.',
            { spaces: createdSpaces, folders: createdFolders, links: createdLinks }
        );
        showStatus(summary);
    }

    async function updateSyncUi() {
        const syncFileMetaEl = document.getElementById('syncFileMeta');
        const googleSyncMetaEl = document.getElementById('googleSyncMeta');
        const btnGoogleConnect = document.getElementById('btnGoogleConnect');
        const btnGoogleDisconnect = document.getElementById('btnGoogleDisconnect');
        const googleDriveFileNameInput = document.getElementById('googleDriveFileNameInput');

        let hasSyncFileHandle = false;
        let handleName = '';
        try {
            const handle = await getStoredSyncFileHandle();
            if (handle) {
                hasSyncFileHandle = true;
                handleName = handle.name || '';
            }
        } catch (error) {
            hasSyncFileHandle = false;
        }

        const localMeta = getSyncLocalMeta();
        const localFileName = localMeta.fileName || handleName || 'AirTab.sync.json';
        const localPush = formatSyncTime(localMeta.lastPushAt);
        const localPull = formatSyncTime(localMeta.lastPullAt);
        if (syncFileMetaEl) {
            syncFileMetaEl.textContent = hasSyncFileHandle
                ? trKey(
                    'syncFileMetaSummary',
                    'Файл: {fileName}. Последняя отправка: {lastPush}. Последнее получение: {lastPull}.',
                    { fileName: localFileName, lastPush: localPush, lastPull: localPull }
                )
                : trKey('fileNotLinked', 'Файл не привязан.');
        }

        const hasGoogleAuthApi = hasGoogleDriveAuthApi();
        const fileName = getGoogleSyncFileName();
        const googleMeta = getSyncGoogleMeta();
        const isConnected = hasGoogleAuthApi && isGoogleSyncConnectedFromMeta(googleMeta);
        const googlePush = formatSyncTime(googleMeta.lastPushAt);
        const googlePull = formatSyncTime(googleMeta.lastPullAt);
        const googleError = String(googleMeta.lastError || '').trim();
        const connectedMark = isConnected
            ? trKey('statusConnected', 'подключен')
            : trKey('statusDisconnected', 'не подключен');
        if (googleSyncMetaEl) {
            const baseText = trKey(
                'dropboxMetaSummary',
                'Dropbox {state}. Файл: {fileName}. Последняя отправка: {lastPush}. Последнее получение: {lastPull}.',
                { state: connectedMark, fileName, lastPush: googlePush, lastPull: googlePull }
            );
            googleSyncMetaEl.textContent = googleError
                ? trKey('dropboxMetaSummaryWithError', '{base} Ошибка: {error}.', { base: baseText, error: googleError })
                : baseText;
        }
        if (btnGoogleConnect) btnGoogleConnect.disabled = !hasGoogleAuthApi;
        if (btnGoogleDisconnect) btnGoogleDisconnect.disabled = !hasGoogleAuthApi || !isConnected;
        if (googleDriveFileNameInput && document.activeElement !== googleDriveFileNameInput) {
            googleDriveFileNameInput.value = fileName;
        }
    }

    document.getElementById('optionsTabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        setTab(btn.dataset.tab);
    });

    engineList.addEventListener('click', (e) => {
        const row = e.target.closest('.list-item');
        if (!row) return;
        const index = Number(row.dataset.index);
        if (Number.isNaN(index)) return;

        if (e.target.closest('.move-engine')) {
            const dir = Number(e.target.closest('.move-engine').dataset.dir || 0);
            const newIndex = index + dir;
            if (newIndex < 0 || newIndex >= engines.length) return;
            const [moved] = engines.splice(index, 1);
            engines.splice(newIndex, 0, moved);
            saveEngines();
            renderEngineList();
            showStatus(trKey('searchEngineOrderUpdated', 'Порядок поисковиков обновлён.'));
            return;
        }

        if (e.target.closest('.edit-engine')) {
            openEngineEditor(index);
        }
    });

    document.getElementById('btnAddEngine').addEventListener('click', () => openEngineEditor(null));
    document.getElementById('btnCancelEngine').addEventListener('click', closeEngineEditor);
    const engineNameInput = document.getElementById('engineName');
    const engineUrlInput = document.getElementById('engineUrl');
    const engineIconInput = document.getElementById('engineIcon');
    engineUrlInput.addEventListener('input', maybeAutofillEngineFieldsFromUrl);
    engineNameInput.addEventListener('input', () => markAutoFillValueAsManual(engineNameInput));
    engineIconInput.addEventListener('input', () => markAutoFillValueAsManual(engineIconInput));
    document.getElementById('btnSaveEngine').addEventListener('click', () => {
        let name = document.getElementById('engineName').value.trim();
        const url = normalizeUrl(document.getElementById('engineUrl').value.trim());
        let icon = document.getElementById('engineIcon').value.trim();
        if (!url) {
            showStatus(trKey('fillEngineUrlField', 'Введите URL поисковика.'), 'error');
            return;
        }
        if (!name) name = suggestNameFromUrl(url, trKey('search', 'Поиск'));
        if (!icon) icon = suggestIconFromUrl(url, 64);
        if (!name || !icon) {
            showStatus(trKey('fillEngineUrlField', 'Введите URL поисковика.'), 'error');
            return;
        }
        const existingId = editingEngineIndex === null ? Date.now() : (engines[editingEngineIndex]?.id || Date.now());
        const engine = { id: existingId, name, url, icon };
        if (editingEngineIndex === null) engines.push(engine);
        else engines[editingEngineIndex] = engine;
        saveEngines();
        renderEngineList();
        closeEngineEditor();
        showStatus(trKey('searchEngineSaved', 'Поисковик сохранён.'));
    });
    document.getElementById('btnDeleteEngine').addEventListener('click', () => {
        if (editingEngineIndex === null) return;
        if (engines.length <= 1) {
            showStatus(trKey('atLeastOneEngine', 'Должен остаться хотя бы один поисковик!'), 'error');
            return;
        }
        engines.splice(editingEngineIndex, 1);
        saveEngines();
        renderEngineList();
        closeEngineEditor();
        showStatus(trKey('searchEngineDeleted', 'Поисковик удалён.'));
    });

    ['Light', 'Dark'].forEach(theme => {
        document.getElementById(`bgInput${theme}`).addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value.startsWith('#') && (value.length === 4 || value.length === 7)) {
                document.getElementById(`bgColorPicker${theme}`).value = value;
            }
            themeDraftDirty = true;
        });
        document.getElementById(`bgColorPicker${theme}`).addEventListener('input', (e) => {
            document.getElementById(`bgInput${theme}`).value = e.target.value;
            themeDraftDirty = true;
        });
    });
    document.getElementById('performanceModeSelect').addEventListener('change', () => {
        themeDraftDirty = true;
    });
    document.getElementById('browserProfileSelect')?.addEventListener('change', () => {
        themeDraftDirty = true;
        updateBrowserProfileHint();
    });
    document.getElementById('dndDebugEnabled').addEventListener('change', () => {
        themeDraftDirty = true;
    });

    document.getElementById('bgPickLocalLight').addEventListener('click', () => pickLocalThemeBackground('light'));
    document.getElementById('bgPickLocalDark').addEventListener('click', () => pickLocalThemeBackground('dark'));

    document.getElementById('btnSaveTheme').addEventListener('click', async () => {
        const newBgLight = document.getElementById('bgInputLight').value.trim() || defaultBgLight;
        const newBgDark = document.getElementById('bgInputDark').value.trim() || defaultBgDark;
        if (newBgLight.startsWith('data:image/') || newBgDark.startsWith('data:image/')) {
            showStatus(trKey('dataUrlDisabledShort', 'Data URL для фона отключён. Используйте URL, цвет или локальный файл.'), 'error');
            return;
        }
        try {
            setThemeBackground('light', newBgLight);
            setThemeBackground('dark', newBgDark);
            await persistPendingLocalThemeBackground('light', newBgLight);
            await persistPendingLocalThemeBackground('dark', newBgDark);
            const prevPerfMode = getPerformanceMode();
            const perfMode = document.getElementById('performanceModeSelect').value === 'eco' ? 'eco' : 'balanced';
            localStorage.setItem('airtabPerformanceMode', perfMode);
            if (prevPerfMode !== perfMode) markLocalDataUpdated(Date.now());
            setStoredBrowserProfile(document.getElementById('browserProfileSelect')?.value || 'auto');
            setDndDebugEnabled(!!document.getElementById('dndDebugEnabled')?.checked);
            const verifyLight = getThemeBackground('light');
            const verifyDark = getThemeBackground('dark');
            if (verifyLight !== newBgLight || verifyDark !== newBgDark) {
                throw new Error('Theme value mismatch after save');
            }
            // Forces a cross-tab storage event even if same values were selected repeatedly.
            localStorage.setItem('airtabSettingsUpdatedAt', String(Date.now()));
            const hasSpaceOverrides = Array.isArray(data?.spaces) && data.spaces.some(space => (space?.bg || '').trim());
            if (hasSpaceOverrides) {
                showStatus(trKey('themeSavedWithOverrides', 'Фон сохранён. В пространствах с собственным фоном приоритет остаётся за фоном пространства.'));
            } else {
                showStatus(trKey('themeSaved', 'Фон и режим производительности сохранены.'));
            }
            themeDraftDirty = false;
        } catch (error) {
            showStatus(trKey('themeSaveFailed', 'Не удалось сохранить фон. Проверьте формат URL/цвета и попробуйте снова.'), 'error');
        }
    });

    window.addEventListener('pagehide', () => {
        if (!themeDraftDirty) return;
        try {
            saveThemeDraftToStorage();
            themeDraftDirty = false;
        } catch (e) {
            // ignore close-time persistence issues
        }
    });

    const googleDriveFileNameInput = document.getElementById('googleDriveFileNameInput');
    if (googleDriveFileNameInput) {
        googleDriveFileNameInput.value = getGoogleSyncFileName();
        googleDriveFileNameInput.addEventListener('input', () => {
            setGoogleSyncFileName(googleDriveFileNameInput.value);
            updateSyncUi().catch(() => {});
        });
    }

    const syncModeSwitch = document.getElementById('syncModeSwitch');
    if (syncModeSwitch) {
        syncModeSwitch.addEventListener('click', (e) => {
            const button = e.target.closest('.sync-mode-btn');
            if (!button) return;
            setSyncUiMode(button.dataset.syncMode || 'dropbox');
        });
    }

    const btnSyncFilePick = document.getElementById('btnSyncFilePick');
    if (btnSyncFilePick) {
        btnSyncFilePick.addEventListener('click', async () => {
            try {
                await pickSyncFileHandle();
                await syncPushToLocalFile();
                setSyncUiMode('local');
                showStatus(trKey('syncFileBound', 'Sync-файл привязан.'));
            } catch (error) {
                if (error?.name === 'AbortError') return;
                showStatus(
                    trKey('syncFileBindFailed', 'Не удалось привязать sync-файл: {error}', {
                        error: error?.message || trKey('genericError', 'ошибка')
                    }),
                    'error'
                );
            } finally {
                await updateSyncUi().catch(() => {});
            }
        });
    }

    const btnGoogleConnect = document.getElementById('btnGoogleConnect');
    if (btnGoogleConnect) {
        btnGoogleConnect.addEventListener('click', async () => {
            try {
                await connectGoogleDriveSync();
                setSyncUiMode('dropbox');
                try {
                    await syncPullFromGoogleDrive({ interactive: false });
                    showStatus(trKey('syncFromDropboxDone', 'Синхронизация из Dropbox выполнена.'));
                } catch (pullError) {
                    const pullMessage = String(pullError?.message || '');
                    const cloudFileMissing = pullError?.code === 'DROPBOX_FILE_NOT_FOUND'
                        || /not[_/ -]?found/i.test(pullMessage);
                    if (cloudFileMissing) {
                        await syncPushToGoogleDrive({ interactive: false });
                        showStatus(
                            trKey(
                                'dropboxConnectedSeeded',
                                'Dropbox подключен. Облачный sync-файл не найден, создан новый из текущих данных.'
                            )
                        );
                    } else {
                        throw pullError;
                    }
                }
            } catch (error) {
                const message = error?.message || trKey('genericError', 'ошибка');
                setGoogleSyncError(message);
                showStatus(
                    trKey('dropboxConnectFailed', 'Dropbox не подключен: {error}', { error: message }),
                    'error'
                );
            } finally {
                await updateSyncUi().catch(() => {});
            }
        });
    }

    const btnGoogleDisconnect = document.getElementById('btnGoogleDisconnect');
    if (btnGoogleDisconnect) {
        btnGoogleDisconnect.addEventListener('click', async () => {
            await disconnectGoogleDriveSync();
            showStatus(trKey('dropboxDisconnected', 'Dropbox отключен.'));
            await updateSyncUi().catch(() => {});
        });
    }

    document.getElementById('btnExport').addEventListener('click', exportBackup);
    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importBackup(file);
        e.target.value = '';
    });
    document.getElementById('bookmarkImportFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleBookmarkImportFile(file);
        e.target.value = '';
    });
    document.getElementById('bookmarkImportAddAs').addEventListener('change', () => {
        updateBookmarkImportPreview();
    });
    document.getElementById('bookmarkImportTargetMode').addEventListener('change', () => {
        updateBookmarkTargetSpaceVisibility();
        updateBookmarkImportPreview();
    });
    document.getElementById('bookmarkTargetSpace').addEventListener('change', updateBookmarkImportPreview);
    document.getElementById('bookmarkNewSpaceName').addEventListener('input', updateBookmarkImportPreview);
    document.getElementById('bookmarkNewSpaceEmoji').addEventListener('input', updateBookmarkImportPreview);
    document.getElementById('bookmarkImportDeduplicate').addEventListener('change', updateBookmarkImportPreview);
    document.getElementById('bookmarkImportKeepPath').addEventListener('change', updateBookmarkImportPreview);
    document.getElementById('btnImportBookmarks').addEventListener('click', runBookmarkImport);

    document.getElementById('btnOpenNewTab').addEventListener('click', () => {
        if (extensionApi?.tabs?.create && extensionApi.runtime?.getURL) {
            extensionApi.tabs.create({ url: extensionApi.runtime.getURL('') });
        } else {
            const appRootUrl = new URL('../', window.location.href).toString();
            window.open(appRootUrl, '_blank', 'noopener,noreferrer');
        }
    });

    const syncMetaKeys = new Set([
        SYNC_LOCAL_META_KEY,
        SYNC_GOOGLE_META_KEY,
        SYNC_GOOGLE_FILE_NAME_KEY,
        SYNC_GOOGLE_TOKEN_KEY,
        SYNC_UI_MODE_KEY
    ]);

    window.addEventListener('storage', (e) => {
        if (!e?.key || syncMetaKeys.has(e.key)) {
            updateSyncUi().catch(() => {});
        }
    });
    window.addEventListener('focus', () => {
        updateSyncUi().catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateSyncUi().catch(() => {});
    });
    const syncUiPollTimer = window.setInterval(() => {
        if (document.hidden) return;
        updateSyncUi().catch(() => {});
    }, 5000);
    window.addEventListener('beforeunload', () => {
        window.clearInterval(syncUiPollTimer);
    });

    initUiLanguageSelector();
    initBrowserProfileSelector();
    setTab(localStorage.getItem('settingsTab') || 'search');
    initThemeInputs();
    renderEngineList();
    refreshSpaceDependentUi();
    ensureBookmarkNewSpaceDefaults();
    updateBookmarkTargetSpaceVisibility();
    applySyncModeUi();
    updateSyncUi().catch(() => {});
    if (i18n) i18n.translateDocument(document.body);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
