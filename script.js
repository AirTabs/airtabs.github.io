document.addEventListener('DOMContentLoaded', () => {
    const i18n = window.AirTabI18n || null;
    const extensionApi = (typeof globalThis !== 'undefined' && globalThis.chrome && globalThis.chrome.runtime?.id)
        ? globalThis.chrome
        : null;
    if (i18n) i18n.init({ observe: true });
    const trText = (text) => (i18n ? i18n.translateText(String(text || '')) : String(text || ''));
    const trKey = (key, fallback, vars = {}) => {
        let text = i18n?.t ? i18n.t(key, vars) : String(fallback || key || '');
        Object.entries(vars || {}).forEach(([name, value]) => {
            text = text.replaceAll(`{${name}}`, String(value));
        });
        return text;
    };

    if (window.location.pathname.endsWith('/index.html')) {
        const canonicalPath = window.location.pathname.slice(0, -'index.html'.length);
        const canonicalUrl = `${canonicalPath}${window.location.search}${window.location.hash}`;
        window.history.replaceState(null, '', canonicalUrl);
    }

    const STORAGE_KEY = 'airtabData';
    const DATA_VERSION = 2;

    const defaultLinks = [];

    const defaultEngines = [
        { id: 1, name: "Kagi", url: "https://kagi.com/search?q=", icon: "https://kagi.com/favicon.ico" }
    ];

    let engines = JSON.parse(localStorage.getItem('myEngines')) || defaultEngines;
    let activeEngineId = localStorage.getItem('myActiveEngine') || engines[0]?.id;

    const defaultBgLight = "#f2f2f7";
    const defaultBgDark = "#2c2c2e";
    const defaultFolderGradient = { from: '#2b59ff', to: '#00b3b0', angle: 140 };
    const DND_DEBUG_STORAGE_KEY = 'airtabDndDebugEnabled';
    const LOCAL_BG_DB_NAME = 'airtabLocalBackgrounds';
    const LOCAL_BG_DB_VERSION = 2;
    const LOCAL_BG_HANDLES_STORE = 'themeHandles';
    const LOCAL_BG_FALLBACKS_STORE = 'themeFallbacks';
    const LOCAL_BG_TOKEN_PREFIX = 'local-file://';
    const SYNC_FILE_HANDLE_KEY = 'syncFileHandle';
    const SYNC_LOCAL_META_KEY = 'airtabSyncLocalMeta';
    const SYNC_DROPBOX_META_KEY = 'airtabSyncDropboxMeta';
    const SYNC_DROPBOX_FILE_NAME_KEY = 'airtabDropboxSyncFileName';
    const SYNC_DROPBOX_TOKEN_KEY = 'airtabDropboxSyncToken';
    const SYNC_LAST_LOCAL_UPDATED_AT_KEY = 'airtabSyncLastLocalUpdatedAt';
    const DEFAULT_SYNC_FILE_NAME = 'AirTab.sync.json';
    const DROPBOX_SCOPE = 'files.content.read files.content.write';
    const DROPBOX_APP_KEY_DEFAULT = '714cwwsa9yxk7tn';
    const DROPBOX_APP_KEY_STORAGE_KEY = 'airtabDropboxAppKey';
    const DROPBOX_OAUTH_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
    const DROPBOX_API_RPC_BASE = 'https://api.dropboxapi.com/2';
    const DROPBOX_API_CONTENT_BASE = 'https://content.dropboxapi.com/2';
    const AUTO_SYNC_PUSH_DEBOUNCE_MS = 1400;
    const AUTO_SYNC_PULL_DEBOUNCE_MS = 700;
    const AUTO_SYNC_PULL_MIN_INTERVAL_MS = 4500;
    const FAVICON_SIZE_GRID = 64;
    const FAVICON_SIZE_COMPACT = 32;
    const FAVICON_FALLBACK_ICON = 'icons/icon-32.png';
    const HIDE_RIGHT_SIDEBAR_QUERY = '(max-width: 1100px)';

    let performanceMode = localStorage.getItem('airtabPerformanceMode') || 'balanced';
    if (performanceMode !== 'eco') performanceMode = 'balanced';
    function readDndDebugEnabled() {
        const raw = localStorage.getItem(DND_DEBUG_STORAGE_KEY);
        if (raw === null) return false;
        return raw === '1' || raw === 'true';
    }
    let dndDebugEnabled = readDndDebugEnabled();
    const defaultFolderView = 'list';
    if (localStorage.getItem('folderDefaultView') !== null) {
        localStorage.removeItem('folderDefaultView');
    }
    let settingsTab = localStorage.getItem('settingsTab') || 'search';

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rightSidebarQuery = window.matchMedia(HIDE_RIGHT_SIDEBAR_QUERY);
    const mobileCommandModeQuery = window.matchMedia('(max-width: 900px)');
    let rightSidebarHidden = rightSidebarQuery.matches;

    let data = loadData();
    if (!localStorage.getItem(SYNC_LAST_LOCAL_UPDATED_AT_KEY)) {
        localStorage.setItem(SYNC_LAST_LOCAL_UPDATED_AT_KEY, String(Date.now()));
    }
    let selectedIds = new Set();
    let selectionContext = { scope: 'space', folderId: null };
    let modifierPressed = false;
    let mobileCommandMode = false;
    let currentFolderContext = null;
    let pendingFolderReturn = null;
    let currentItemType = 'link';
    let editContext = { scope: 'space', folderId: null, defaultStyle: 'square', targetSidebar: 'left' };
    let activeFolderMenuId = null;
    const localThemeBackgroundUrls = { light: '', dark: '' };
    const pendingLocalThemeHandles = { light: null, dark: null };
    let pendingSpaceFromFolderContext = null;
    let autoSyncPushTimer = 0;
    let autoSyncPushRunning = false;
    let autoSyncPushQueued = false;
    let autoSyncSuppressPush = false;
    let autoSyncPullTimer = 0;
    let autoSyncPullRunning = false;
    let autoSyncPullQueued = false;
    let autoSyncLastPullAt = 0;
    let dropboxTokenStateCacheLoaded = false;
    let dropboxTokenStateCache = null;

    document.addEventListener('error', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return;
        const fallbackSrc = String(target.dataset.fallbackSrc || '').trim();
        if (!fallbackSrc) return;
        if (target.dataset.fallbackApplied === '1') {
            target.removeAttribute('data-fallback-src');
            target.src = FAVICON_FALLBACK_ICON;
            return;
        }
        target.dataset.fallbackApplied = '1';
        target.src = fallbackSrc;
    }, true);

    function createId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
    }

    function normalizeUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) return '';
        if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
        return trimmed;
    }

    function normalizeFolderView(value) {
        return value === 'grid' ? 'grid' : 'list';
    }

    function isSelectionModifierActive(event = null) {
        const keyboardModifier = !!(event && (event.metaKey || event.ctrlKey));
        return keyboardModifier || modifierPressed || mobileCommandMode;
    }

    function replaceWithFragment(container, html) {
        if (!container) return;
        container.replaceChildren();
        if (!html) return;
        const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
        const nodes = Array.from(doc.body.childNodes).map(node => document.importNode(node, true));
        container.replaceChildren(...nodes);
    }

    function normalizeGradientAngle(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return defaultFolderGradient.angle;
        return Math.max(0, Math.min(360, Math.round(parsed)));
    }

    function hexToRgba(hex, alpha) {
        const cleaned = (hex || '').replace('#', '').trim();
        if (!cleaned) return '';
        const value = cleaned.length === 3
            ? cleaned.split('').map(ch => ch + ch).join('')
            : cleaned;
        if (value.length !== 6) return '';
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '';
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function getFolderGradientStyle(folder) {
        const gradient = folder?.gradient;
        if (!gradient || !gradient.from || !gradient.to) return '';
        const from = hexToRgba(gradient.from, 0.2);
        const to = hexToRgba(gradient.to, 0.16);
        if (!from || !to) return '';
        const angle = normalizeGradientAngle(gradient.angle);
        return `linear-gradient(${angle}deg, ${from}, ${to})`;
    }

    function getHostname(url) {
        try { return new URL(url).hostname; } catch (e) { return ''; }
    }

    function getLocalBgToken(theme) {
        return `${LOCAL_BG_TOKEN_PREFIX}${theme}`;
    }

    function isThemeLocalBgToken(theme, value) {
        return value === getLocalBgToken(theme);
    }

    function revokeLocalThemeBackgroundUrl(theme) {
        const currentUrl = localThemeBackgroundUrls[theme];
        if (currentUrl) {
            try { URL.revokeObjectURL(currentUrl); } catch (e) { /* ignore */ }
            localThemeBackgroundUrls[theme] = '';
        }
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
        if (!(blob instanceof Blob) || blob.size <= 0) return;
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

    async function buildThemeFallbackBlob(file) {
        if (!file || !String(file.type || '').startsWith('image/')) return null;
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
                if (blob.size <= file.size * 1.25 || file.size > 1024 * 1024) return blob;
            }
            return file;
        } catch (e) {
            return file;
        } finally {
            bitmap.close();
        }
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
            const background = getThemeBackground(theme);
            if (!isThemeLocalBgToken(theme, background)) continue;
            try {
                const fallbackBlob = await getStoredLocalThemeFallbackBlob(theme);
                if (fallbackBlob instanceof Blob && fallbackBlob.size > 0) {
                    localThemeFallbacks[theme] = await blobToDataUrl(fallbackBlob);
                }
            } catch (error) {
                // fallback export is best-effort
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

    async function setLocalThemeBackgroundFromHandle(theme, handle) {
        const readable = await ensureLocalHandleReadable(handle);
        if (!readable) return false;
        const file = await handle.getFile();
        if (!file || !file.type.startsWith('image/')) return false;
        try {
            const fallbackBlob = await buildThemeFallbackBlob(file);
            await saveLocalThemeFallbackBlob(theme, fallbackBlob || file);
        } catch (e) {
            // best-effort fallback cache
        }
        revokeLocalThemeBackgroundUrl(theme);
        localThemeBackgroundUrls[theme] = URL.createObjectURL(file);
        return true;
    }

    function setLocalThemeBackgroundFromBlob(theme, blob) {
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) return false;
        revokeLocalThemeBackgroundUrl(theme);
        localThemeBackgroundUrls[theme] = URL.createObjectURL(blob);
        return true;
    }

    async function hydrateLocalThemeBackgrounds() {
        for (const theme of ['light', 'dark']) {
            const storedValue = getThemeBackground(theme);
            if (!isThemeLocalBgToken(theme, storedValue)) {
                revokeLocalThemeBackgroundUrl(theme);
                continue;
            }
            let applied = false;
            try {
                const handle = await getStoredLocalThemeHandle(theme);
                if (handle) applied = await setLocalThemeBackgroundFromHandle(theme, handle);
            } catch (e) {
                applied = false;
            }
            if (applied) continue;
            try {
                const fallbackBlob = await getStoredLocalThemeFallbackBlob(theme);
                if (fallbackBlob) applied = setLocalThemeBackgroundFromBlob(theme, fallbackBlob);
            } catch (e) {
                applied = false;
            }
            if (!applied) {
                revokeLocalThemeBackgroundUrl(theme);
            }
        }
        const activeSpace = getActiveSpace();
        if (!activeSpace?.bg) applyCurrentTheme();
    }

    function resolveThemeBackgroundForApply(theme) {
        const stored = getThemeBackground(theme);
        if (isThemeLocalBgToken(theme, stored)) {
            return localThemeBackgroundUrls[theme] || (theme === 'light' ? defaultBgLight : defaultBgDark);
        }
        return stored;
    }

    function getThemeBackground(theme) {
        if (theme === 'light') {
            const light = localStorage.getItem('myBgLight');
            return light === null ? (localStorage.getItem('myBg') || defaultBgLight) : light;
        }
        return localStorage.getItem('myBgDark') || defaultBgDark;
    }

    function setThemeBackground(theme, value) {
        if (theme === 'light') {
            localStorage.setItem('myBgLight', value);
            localStorage.setItem('myBg', value);
        } else {
            localStorage.setItem('myBgDark', value);
        }
        if (!isThemeLocalBgToken(theme, value)) {
            revokeLocalThemeBackgroundUrl(theme);
            Promise.all([
                deleteLocalThemeHandle(theme),
                deleteLocalThemeFallbackBlob(theme)
            ]).catch(() => {});
        }
    }

    function escapeHtmlAttr(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function getChromiumFaviconUrl(pageUrl, size = FAVICON_SIZE_GRID) {
        const cleanUrl = String(pageUrl || '').trim();
        if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) return '';
        try {
            if (!extensionApi?.runtime?.getURL) return '';
            const params = new URLSearchParams({
                pageUrl: cleanUrl,
                size: String(size)
            });
            return extensionApi.runtime.getURL(`/_favicon/?${params.toString()}`);
        } catch (error) {
            return '';
        }
    }

    function getRemoteFaviconUrl(hostname, size = FAVICON_SIZE_GRID) {
        if (!hostname) return '';
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
    }

    function getLinkIconSources(url, customIcon = '', size = FAVICON_SIZE_GRID) {
        const custom = String(customIcon || '').trim();
        const cleanUrl = normalizeUrl(url || '');
        const hostname = getHostname(cleanUrl);
        const chromiumFavicon = getChromiumFaviconUrl(cleanUrl, size);
        const remoteFavicon = getRemoteFaviconUrl(hostname, size);

        if (custom) {
            return {
                src: custom,
                fallback: chromiumFavicon || remoteFavicon || FAVICON_FALLBACK_ICON
            };
        }
        if (chromiumFavicon) {
            return {
                src: chromiumFavicon,
                fallback: remoteFavicon || FAVICON_FALLBACK_ICON
            };
        }
        if (remoteFavicon) {
            return {
                src: remoteFavicon,
                fallback: FAVICON_FALLBACK_ICON
            };
        }
        return { src: FAVICON_FALLBACK_ICON, fallback: '' };
    }

    function buildFaviconImgAttrs(url, customIcon = '', size = FAVICON_SIZE_GRID) {
        const icon = getLinkIconSources(url, customIcon, size);
        const srcAttr = `src="${escapeHtmlAttr(icon.src || FAVICON_FALLBACK_ICON)}"`;
        const fallbackAttr = icon.fallback
            ? ` data-fallback-src="${escapeHtmlAttr(icon.fallback)}"`
            : '';
        return `${srcAttr}${fallbackAttr}`;
    }

    function shouldRenderLeftSidebar(space = null) {
        const targetSpace = space || getActiveSpace();
        return targetSpace?.showLeftSidebar !== false;
    }

    function shouldRenderRightSidebar(space = null) {
        const targetSpace = space || getActiveSpace();
        return !rightSidebarHidden && targetSpace?.showRightSidebar !== false;
    }

    function applySpaceSidebarVisibility(space = null) {
        const targetSpace = space || getActiveSpace();
        const leftVisible = shouldRenderLeftSidebar(targetSpace);
        const rightVisible = shouldRenderRightSidebar(targetSpace);
        document.body.classList.toggle('space-hide-left', !leftVisible);
        document.body.classList.toggle('space-hide-right', !rightVisible);
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

    function normalizeItem(item) {
        const type = item.type === 'folder' ? 'folder' : 'link';
        const normalized = { ...item, type };
        normalized.id = normalized.id || createId(type === 'folder' ? 'folder' : 'link');
        if (type === 'folder') {
            normalized.name = normalized.name || 'Папка';
            normalized.emoji = typeof normalized.emoji === 'string' ? normalized.emoji : '';
            if (normalized.gradient && typeof normalized.gradient === 'object') {
                normalized.gradient = {
                    from: normalized.gradient.from || defaultFolderGradient.from,
                    to: normalized.gradient.to || defaultFolderGradient.to,
                    angle: normalizeGradientAngle(
                        normalized.gradient.angle === undefined
                            ? defaultFolderGradient.angle
                            : normalized.gradient.angle
                    )
                };
            } else {
                delete normalized.gradient;
            }
            normalized.items = Array.isArray(normalized.items)
                ? normalized.items.map(normalizeItem).filter(child => child.type === 'link' || child.type === 'folder')
                : [];
            normalized.isCompact = false;
            normalized.folderView = normalizeFolderView(normalized.folderView || defaultFolderView);
            normalized.collapsed = !!normalized.collapsed;
            normalized.sidebar = normalized.sidebar === 'right' ? 'right' : 'left';
        } else {
            normalized.name = normalized.name || 'Без названия';
            normalized.url = normalizeUrl(normalized.url || '');
            normalized.customIcon = normalized.customIcon || '';
            normalized.isCompact = !!normalized.isCompact;
            normalized.sidebar = normalized.sidebar === 'right' ? 'right' : 'left';
        }
        return normalized;
    }

    function getUniqueFolderName(space, baseName = '') {
        const safeBaseName = String(baseName || '').trim() || trKey('newFolder', 'Новая папка');
        const names = (space.items || [])
            .filter(item => item.type === 'folder')
            .map(item => (item.name || '').toLowerCase());
        const baseLower = safeBaseName.toLowerCase();
        if (!names.includes(baseLower)) return safeBaseName;
        let i = 2;
        while (names.includes(`${baseLower} (${i})`)) i += 1;
        return `${safeBaseName} (${i})`;
    }

    function createQuickFolder(targetSidebar = 'left') {
        const space = getActiveSpace();
        const name = getUniqueFolderName(space, trKey('newFolder', 'Новая папка'));
        const newFolder = {
            id: createId('folder'),
            type: 'folder',
            name,
            emoji: '',
            items: [],
            isCompact: false,
            folderView: defaultFolderView,
            collapsed: true,
            sidebar: targetSidebar || 'left'
        };
        space.items.push(newFolder);
        saveData();
        renderItems();
    }

    function setEmoji(button, emoji) {
        if (!button) return;
        button.dataset.emoji = emoji;
        button.textContent = emoji;
    }

    const emojiLibrary = [
        { emoji: '🏠', keywords: ['дом', 'home', 'house'], category: 'home' },
        { emoji: '🏡', keywords: ['дом', 'коттедж', 'house'], category: 'home' },
        { emoji: '🛋️', keywords: ['диван', 'уют', 'sofa'], category: 'home' },
        { emoji: '🛏️', keywords: ['кровать', 'сон', 'bed'], category: 'home' },
        { emoji: '🍽️', keywords: ['кухня', 'еда', 'plate'], category: 'home' },
        { emoji: '🧹', keywords: ['уборка', 'clean'], category: 'home' },
        { emoji: '🧺', keywords: ['стирка', 'laundry'], category: 'home' },
        { emoji: '🚪', keywords: ['дверь', 'door'], category: 'home' },
        { emoji: '🔑', keywords: ['ключ', 'key'], category: 'home' },
        { emoji: '🧼', keywords: ['мыло', 'clean'], category: 'home' },
        { emoji: '💼', keywords: ['работа', 'портфель', 'work'], category: 'work' },
        { emoji: '🗂️', keywords: ['файлы', 'folder', 'work'], category: 'work' },
        { emoji: '📁', keywords: ['папка', 'folder'], category: 'work' },
        { emoji: '📌', keywords: ['пин', 'pin'], category: 'work' },
        { emoji: '📍', keywords: ['метка', 'pin'], category: 'work' },
        { emoji: '🗓️', keywords: ['календарь', 'calendar'], category: 'work' },
        { emoji: '📅', keywords: ['календарь', 'calendar'], category: 'work' },
        { emoji: '🧾', keywords: ['счет', 'invoice'], category: 'work' },
        { emoji: '📈', keywords: ['рост', 'chart'], category: 'work' },
        { emoji: '📊', keywords: ['аналитика', 'chart'], category: 'work' },
        { emoji: '📚', keywords: ['книги', 'books', 'учеба'], category: 'work' },
        { emoji: '🛠', keywords: ['инструменты', 'tools'], category: 'work' },
        { emoji: '🧩', keywords: ['пазл', 'project'], category: 'work' },
        { emoji: '🧪', keywords: ['лаборатория', 'experiment'], category: 'work' },
        { emoji: '🧰', keywords: ['набор', 'toolbox'], category: 'work' },
        { emoji: '🎧', keywords: ['музыка', 'audio'], category: 'media' },
        { emoji: '🎮', keywords: ['игры', 'game'], category: 'media' },
        { emoji: '🎨', keywords: ['дизайн', 'art'], category: 'media' },
        { emoji: '🎬', keywords: ['кино', 'film'], category: 'media' },
        { emoji: '🎥', keywords: ['видео', 'video'], category: 'media' },
        { emoji: '🎵', keywords: ['музыка', 'music'], category: 'media' },
        { emoji: '🎤', keywords: ['микрофон', 'podcast'], category: 'media' },
        { emoji: '📷', keywords: ['фото', 'camera'], category: 'media' },
        { emoji: '🎲', keywords: ['игры', 'dice'], category: 'media' },
        { emoji: '🎹', keywords: ['пианино', 'music'], category: 'media' },
        { emoji: '💻', keywords: ['ноутбук', 'laptop'], category: 'tech' },
        { emoji: '🖥️', keywords: ['монитор', 'desktop'], category: 'tech' },
        { emoji: '🖱️', keywords: ['мышь', 'mouse'], category: 'tech' },
        { emoji: '⌨️', keywords: ['клавиатура', 'keyboard'], category: 'tech' },
        { emoji: '📱', keywords: ['телефон', 'mobile'], category: 'tech' },
        { emoji: '🛰️', keywords: ['спутник', 'satellite'], category: 'tech' },
        { emoji: '📡', keywords: ['сигнал', 'signal'], category: 'tech' },
        { emoji: '🤖', keywords: ['робот', 'ai'], category: 'tech' },
        { emoji: '🧠', keywords: ['мысль', 'brain'], category: 'tech' },
        { emoji: '⚙️', keywords: ['настройки', 'gear'], category: 'tech' },
        { emoji: '🧭', keywords: ['навигация', 'compass'], category: 'tech' },
        { emoji: '✈️', keywords: ['полет', 'flight'], category: 'travel' },
        { emoji: '🚗', keywords: ['машина', 'car'], category: 'travel' },
        { emoji: '🚆', keywords: ['поезд', 'train'], category: 'travel' },
        { emoji: '🚀', keywords: ['ракета', 'rocket'], category: 'travel' },
        { emoji: '🧳', keywords: ['багаж', 'luggage'], category: 'travel' },
        { emoji: '🗺️', keywords: ['карта', 'map'], category: 'travel' },
        { emoji: '🏖️', keywords: ['пляж', 'beach'], category: 'travel' },
        { emoji: '🏕️', keywords: ['кемпинг', 'camp'], category: 'travel' },
        { emoji: '🗼', keywords: ['город', 'city'], category: 'travel' },
        { emoji: '🛫', keywords: ['вылет', 'departure'], category: 'travel' },
        { emoji: '🌿', keywords: ['природа', 'leaf'], category: 'nature' },
        { emoji: '🌊', keywords: ['вода', 'ocean'], category: 'nature' },
        { emoji: '🌙', keywords: ['ночь', 'moon'], category: 'nature' },
        { emoji: '☀️', keywords: ['солнце', 'sun'], category: 'nature' },
        { emoji: '🌈', keywords: ['радуга', 'rainbow'], category: 'nature' },
        { emoji: '❄️', keywords: ['снег', 'snow'], category: 'nature' },
        { emoji: '🌵', keywords: ['кактус', 'cactus'], category: 'nature' },
        { emoji: '🌸', keywords: ['цветы', 'sakura'], category: 'nature' },
        { emoji: '🍃', keywords: ['лист', 'wind'], category: 'nature' },
        { emoji: '🪐', keywords: ['космос', 'space'], category: 'nature' },
        { emoji: '✅', keywords: ['готово', 'ok'], category: 'symbols' },
        { emoji: '❌', keywords: ['нет', 'no'], category: 'symbols' },
        { emoji: '⚡️', keywords: ['энергия', 'bolt'], category: 'symbols' },
        { emoji: '🔒', keywords: ['замок', 'lock'], category: 'symbols' },
        { emoji: '🔓', keywords: ['открыто', 'unlock'], category: 'symbols' },
        { emoji: '🔥', keywords: ['огонь', 'fire'], category: 'symbols' },
        { emoji: '⭐️', keywords: ['звезда', 'star'], category: 'symbols' },
        { emoji: '✨', keywords: ['сияние', 'sparkles'], category: 'symbols' },
        { emoji: '💡', keywords: ['идея', 'idea'], category: 'symbols' },
        { emoji: '🎯', keywords: ['цель', 'target'], category: 'symbols' },
        { emoji: '🔮', keywords: ['магия', 'crystal'], category: 'symbols' },
        { emoji: '❤️', keywords: ['любовь', 'heart'], category: 'mood' },
        { emoji: '🧡', keywords: ['love', 'heart'], category: 'mood' },
        { emoji: '💛', keywords: ['love', 'heart'], category: 'mood' },
        { emoji: '💚', keywords: ['love', 'heart'], category: 'mood' },
        { emoji: '💙', keywords: ['love', 'heart'], category: 'mood' },
        { emoji: '💜', keywords: ['love', 'heart'], category: 'mood' },
        { emoji: '🤍', keywords: ['love', 'heart'], category: 'mood' },
        { emoji: '🤝', keywords: ['команда', 'team'], category: 'mood' },
        { emoji: '🙌', keywords: ['ура', 'yay'], category: 'mood' },
        { emoji: '🎉', keywords: ['праздник', 'party'], category: 'mood' }
    ];

    const emojiCategories = [
        { id: 'all', label: 'Все' },
        { id: 'home', label: 'Дом' },
        { id: 'work', label: 'Работа' },
        { id: 'media', label: 'Медиа' },
        { id: 'tech', label: 'Тех' },
        { id: 'travel', label: 'Путешествия' },
        { id: 'nature', label: 'Природа' },
        { id: 'symbols', label: 'Символы' },
        { id: 'mood', label: 'Настроение' }
    ];

    const folderGradientPresets = [
        { name: 'Ocean', from: '#2b59ff', to: '#00b3b0', angle: 140 },
        { name: 'Sunset', from: '#ff7a59', to: '#ffcc70', angle: 130 },
        { name: 'Neon', from: '#6f3dff', to: '#00d1ff', angle: 150 },
        { name: 'Lime', from: '#00a96e', to: '#b8e62e', angle: 128 },
        { name: 'Rose', from: '#ff4fa0', to: '#ff7b7b', angle: 145 },
        { name: 'Aurora', from: '#08b6d8', to: '#7d5fff', angle: 120 },
        { name: 'Forest', from: '#0f9960', to: '#42c883', angle: 160 },
        { name: 'Citrus', from: '#ff9f1c', to: '#ff5a5f', angle: 115 }
    ];

    let emojiTarget = null;
    const emojiPopover = document.getElementById('emojiPopover');
    const emojiGrid = document.getElementById('emojiGrid');
    const emojiSearch = document.getElementById('emojiSearch');
    const emojiCategoriesEl = document.getElementById('emojiCategories');
    const emojiEmpty = document.getElementById('emojiEmpty');
    const emojiClearBtn = document.getElementById('emojiClearBtn');
    const emojiFilter = { category: 'all', query: '' };

    function renderEmojiCategories() {
        emojiCategoriesEl.replaceChildren();
        emojiCategories.forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `emoji-cat-btn ${emojiFilter.category === cat.id ? 'active' : ''}`.trim();
            btn.dataset.category = cat.id;
            btn.textContent = cat.label;
            emojiCategoriesEl.appendChild(btn);
        });
    }

    function renderEmojiGrid() {
        const query = emojiFilter.query.trim().toLowerCase();
        let items = emojiLibrary;
        if (!query && emojiFilter.category !== 'all') {
            items = items.filter(item => item.category === emojiFilter.category);
        }
        if (query) {
            items = items.filter(item => {
                const hay = `${item.emoji} ${item.keywords.join(' ')}`.toLowerCase();
                return hay.includes(query);
            });
        }
        emojiGrid.replaceChildren();
        items.forEach((item) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'emoji-option';
            btn.dataset.emoji = item.emoji;
            btn.textContent = item.emoji;
            emojiGrid.appendChild(btn);
        });
        emojiEmpty.style.display = items.length ? 'none' : 'block';
    }

    function openEmojiPopover(button) {
        if (!button) return;
        emojiTarget = button;
        emojiFilter.query = '';
        emojiSearch.value = '';
        renderEmojiCategories();
        renderEmojiGrid();
        const rect = button.getBoundingClientRect();
        emojiPopover.style.display = 'block';
        const popoverRect = emojiPopover.getBoundingClientRect();
        const left = Math.min(window.innerWidth - popoverRect.width - 12, Math.max(12, rect.left));
        const top = Math.min(window.innerHeight - popoverRect.height - 12, rect.bottom + 8);
        emojiPopover.style.left = `${left}px`;
        emojiPopover.style.top = `${top}px`;
    }

    function closeEmojiPopover() {
        emojiPopover.style.display = 'none';
        emojiTarget = null;
    }

    function buildDefaultData(linksOverride) {
        const legacyLinks = linksOverride || JSON.parse(localStorage.getItem('myLinks')) || defaultLinks;
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

    function loadData() {
        let parsed = null;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
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
        parsed.spaces = parsed.spaces.filter(Boolean).map(space => {
            const safeSpace = { ...space };
            safeSpace.id = safeSpace.id || createId('space');
            safeSpace.name = safeSpace.name || 'Пространство';
            safeSpace.emoji = safeSpace.emoji || '🧭';
            safeSpace.bg = safeSpace.bg || '';
            safeSpace.showLeftSidebar = safeSpace.showLeftSidebar !== false;
            safeSpace.showRightSidebar = safeSpace.showRightSidebar !== false;
            safeSpace.items = Array.isArray(safeSpace.items) ? safeSpace.items.map(normalizeItem) : [];
            return safeSpace;
        });

        if (!parsed.spaces.length) parsed = buildDefaultData();
        if (!parsed.activeSpaceId || !parsed.spaces.find(s => s.id === parsed.activeSpaceId)) {
            parsed.activeSpaceId = parsed.spaces[0].id;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
    }

    const SAVE_DATA_DEBOUNCE_MS = 64;
    let saveDataTimer = 0;
    let saveDataPending = false;

    function flushDataSave() {
        saveDataPending = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        markLocalDataUpdated(Date.now());
        scheduleAutoSyncPush(false);
    }

    function saveData(options = {}) {
        const immediate = options?.immediate === true;
        if (immediate) {
            if (saveDataTimer) {
                window.clearTimeout(saveDataTimer);
                saveDataTimer = 0;
            }
            flushDataSave();
            return;
        }
        saveDataPending = true;
        if (saveDataTimer) return;
        saveDataTimer = window.setTimeout(() => {
            saveDataTimer = 0;
            if (saveDataPending) flushDataSave();
        }, SAVE_DATA_DEBOUNCE_MS);
    }

    function readJsonStorage(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJsonStorage(key, value) {
        if (value === undefined) return;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            // ignore quota/serialization issues in auto-sync metadata
        }
    }

    function getSyncLocalMeta() {
        return readJsonStorage(SYNC_LOCAL_META_KEY, {}) || {};
    }

    function setSyncLocalMeta(patch) {
        const current = getSyncLocalMeta();
        writeJsonStorage(SYNC_LOCAL_META_KEY, { ...current, ...patch });
    }

    function getSyncDropboxMeta() {
        return readJsonStorage(SYNC_DROPBOX_META_KEY, {}) || {};
    }

    function setSyncDropboxMeta(patch) {
        const current = getSyncDropboxMeta();
        writeJsonStorage(SYNC_DROPBOX_META_KEY, { ...current, ...patch });
    }

    function isDropboxSyncConnected(meta = null) {
        const source = meta || getSyncDropboxMeta();
        const connectedAt = Number(source?.connectedAt || 0);
        const disconnectedAt = Number(source?.disconnectedAt || 0);
        return connectedAt > 0 && connectedAt >= disconnectedAt;
    }

    function getConfiguredDropboxAppKey() {
        try {
            const fromStorage = String(localStorage.getItem(DROPBOX_APP_KEY_STORAGE_KEY) || '').trim();
            return fromStorage || DROPBOX_APP_KEY_DEFAULT || '';
        } catch (error) {
            return DROPBOX_APP_KEY_DEFAULT || '';
        }
    }

    function getDropboxSyncFileName() {
        const raw = String(localStorage.getItem(SYNC_DROPBOX_FILE_NAME_KEY) || '').trim();
        return raw || DEFAULT_SYNC_FILE_NAME;
    }

    function getLocalDataUpdatedAt() {
        const raw = Number(localStorage.getItem(SYNC_LAST_LOCAL_UPDATED_AT_KEY) || 0);
        return Number.isFinite(raw) && raw > 0 ? raw : 0;
    }

    function markLocalDataUpdated(timestamp = Date.now()) {
        const safeTs = Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp) : Date.now();
        localStorage.setItem(SYNC_LAST_LOCAL_UPDATED_AT_KEY, String(safeTs));
        return safeTs;
    }

    async function readDropboxTokenStateFromSessionStore() {
        if (!extensionApi?.storage?.session?.get) {
            return readJsonStorage(SYNC_DROPBOX_TOKEN_KEY, null);
        }
        try {
            const result = await extensionApi.storage.session.get([SYNC_DROPBOX_TOKEN_KEY]);
            const state = result?.[SYNC_DROPBOX_TOKEN_KEY];
            return state && typeof state === 'object' ? state : null;
        } catch (error) {
            return readJsonStorage(SYNC_DROPBOX_TOKEN_KEY, null);
        }
    }

    async function writeDropboxTokenStateToSessionStore(state) {
        const safeState = state && typeof state === 'object' ? state : null;
        if (!extensionApi?.storage?.session?.set) {
            writeJsonStorage(SYNC_DROPBOX_TOKEN_KEY, safeState);
            return;
        }
        try {
            if (safeState) {
                await extensionApi.storage.session.set({ [SYNC_DROPBOX_TOKEN_KEY]: safeState });
            } else if (extensionApi.storage.session.remove) {
                await extensionApi.storage.session.remove([SYNC_DROPBOX_TOKEN_KEY]);
            }
            localStorage.removeItem(SYNC_DROPBOX_TOKEN_KEY);
        } catch (error) {
            writeJsonStorage(SYNC_DROPBOX_TOKEN_KEY, safeState);
        }
    }

    async function getDropboxTokenState() {
        if (dropboxTokenStateCacheLoaded) return dropboxTokenStateCache;
        let tokenState = await readDropboxTokenStateFromSessionStore();
        const legacy = readJsonStorage(SYNC_DROPBOX_TOKEN_KEY, null);
        if (!tokenState && legacy) {
            tokenState = legacy;
            await writeDropboxTokenStateToSessionStore(tokenState);
        }
        if (legacy) localStorage.removeItem(SYNC_DROPBOX_TOKEN_KEY);
        dropboxTokenStateCache = tokenState && typeof tokenState === 'object' ? tokenState : null;
        dropboxTokenStateCacheLoaded = true;
        return dropboxTokenStateCache;
    }

    async function setDropboxTokenState(state) {
        const safeState = state && typeof state === 'object' ? state : null;
        dropboxTokenStateCacheLoaded = true;
        dropboxTokenStateCache = safeState;
        await writeDropboxTokenStateToSessionStore(safeState);
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

    async function refreshDropboxAccessToken(appKey, refreshToken) {
        if (!appKey || !refreshToken) throw new Error('No refresh token');
        const tokenResponse = await requestDropboxToken({
            client_id: appKey,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });
        const refreshed = buildDropboxTokenState(appKey, tokenResponse, { refreshToken });
        await setDropboxTokenState(refreshed);
        return refreshed;
    }

    async function getDropboxAccessTokenNonInteractive() {
        const appKey = getConfiguredDropboxAppKey();
        if (!appKey) return '';
        const token = await getDropboxTokenState();
        const tokenMatchesApp = token?.appKey === appKey;
        if (token && !tokenMatchesApp) {
            await setDropboxTokenState(null);
            return '';
        }
        const validToken = tokenMatchesApp && token?.accessToken && Number(token?.expiresAt || 0) > Date.now() + 10_000;
        if (validToken) return token.accessToken;
        if (tokenMatchesApp && token?.refreshToken) {
            try {
                const refreshed = await refreshDropboxAccessToken(appKey, token.refreshToken);
                return refreshed?.accessToken || '';
            } catch (error) {
                return '';
            }
        }
        return '';
    }

    function normalizeDropboxPath(fileName) {
        const clean = String(fileName || '').trim() || DEFAULT_SYNC_FILE_NAME;
        return clean.startsWith('/') ? clean : `/${clean}`;
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
            const message = payload?.error_summary || payload?.error || `HTTP ${response.status}`;
            throw new Error(`Dropbox API error: ${message}`);
        }
        return payload;
    }

    async function uploadDropboxSyncFile(accessToken, fileName, jsonText) {
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
            const message = payload?.error_summary || payload?.error || `HTTP ${response.status}`;
            throw new Error(`Dropbox upload failed: ${message}`);
        }
        return payload;
    }

    async function downloadDropboxSyncFile(accessToken, fileName) {
        const path = normalizeDropboxPath(fileName);
        const response = await fetch(`${DROPBOX_API_CONTENT_BASE}/files/download`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Dropbox-API-Arg': JSON.stringify({ path })
            }
        });
        if (response.status === 409) {
            throw new Error('Dropbox file not found');
        }
        if (!response.ok) {
            const message = await response.text().catch(() => `HTTP ${response.status}`);
            throw new Error(`Dropbox download failed: ${message}`);
        }
        return response.text();
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

    async function ensureSyncFilePermission(handle, mode = 'readwrite', request = false) {
        if (!handle) return false;
        if (typeof handle.queryPermission === 'function') {
            const current = await handle.queryPermission({ mode });
            if (current === 'granted') return true;
            if (!request) return false;
        }
        if (request && typeof handle.requestPermission === 'function') {
            const requested = await handle.requestPermission({ mode });
            return requested === 'granted';
        }
        return true;
    }

    async function buildBackupPayloadForSync() {
        const payload = {
            version: DATA_VERSION,
            data: data,
            engines: engines,
            activeEngine: activeEngineId,
            bgLight: getThemeBackground('light'),
            bgDark: getThemeBackground('dark'),
            performanceMode: performanceMode,
            dndDebugEnabled: dndDebugEnabled,
            syncMeta: {
                updatedAt: getLocalDataUpdatedAt() || Date.now(),
                source: 'airtab-auto'
            }
        };
        const localThemeFallbacks = await collectBackupLocalThemeFallbacks();
        if (Object.keys(localThemeFallbacks).length) payload.localThemeFallbacks = localThemeFallbacks;
        return payload;
    }

    function getPayloadUpdatedAt(payload) {
        const ts = Number(payload?.syncMeta?.updatedAt || payload?.updatedAt || 0);
        return Number.isFinite(ts) && ts > 0 ? ts : 0;
    }

    async function applySyncedPayload(payload) {
        if (!payload || typeof payload !== 'object') return false;
        if (!payload.data && !payload.spaces && !payload.links) return false;
        autoSyncSuppressPush = true;
        try {
            if (payload.data) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.data));
            } else if (payload.spaces) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    version: DATA_VERSION,
                    spaces: payload.spaces,
                    activeSpaceId: payload.activeSpaceId || payload.spaces[0]?.id
                }));
            } else if (payload.links) {
                const migrated = buildDefaultData(payload.links);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            }

            if (payload.engines) localStorage.setItem('myEngines', JSON.stringify(payload.engines));
            if (payload.activeEngine) localStorage.setItem('myActiveEngine', String(payload.activeEngine));
            if (payload.bgLight) localStorage.setItem('myBgLight', payload.bgLight);
            if (payload.bgDark) localStorage.setItem('myBgDark', payload.bgDark);
            if (payload.performanceMode) {
                localStorage.setItem('airtabPerformanceMode', payload.performanceMode === 'eco' ? 'eco' : 'balanced');
            }
            if (Object.prototype.hasOwnProperty.call(payload, 'dndDebugEnabled')) {
                localStorage.setItem(DND_DEBUG_STORAGE_KEY, payload.dndDebugEnabled ? '1' : '0');
            }

            const restoredLight = typeof payload.bgLight === 'string' ? payload.bgLight : getThemeBackground('light');
            const restoredDark = typeof payload.bgDark === 'string' ? payload.bgDark : getThemeBackground('dark');
            await restoreBackupLocalThemeFallbacks(payload.localThemeFallbacks, {
                light: restoredLight,
                dark: restoredDark
            });

            const remoteUpdatedAt = getPayloadUpdatedAt(payload);
            markLocalDataUpdated(remoteUpdatedAt || Date.now());
            localStorage.setItem('airtabSettingsUpdatedAt', String(Date.now()));

            data = loadData();
            try {
                engines = JSON.parse(localStorage.getItem('myEngines')) || defaultEngines;
            } catch (error) {
                engines = defaultEngines;
            }
            activeEngineId = localStorage.getItem('myActiveEngine') || engines[0]?.id;
            performanceMode = localStorage.getItem('airtabPerformanceMode') === 'eco' ? 'eco' : 'balanced';
            dndDebugEnabled = readDndDebugEnabled();
            applyDndDebugVisibility();

            selectedIds.clear();
            selectionContext = { scope: 'space', folderId: null };
            updateSelectionUI();
            applyPerformanceMode();
            renderItems();
            renderSpaces();
            renderSearchDropdown();
            applySpaceTheme();
            return true;
        } finally {
            autoSyncSuppressPush = false;
        }
    }

    async function pullPayloadFromLocalFileAuto() {
        const handle = await getStoredSyncFileHandle().catch(() => null);
        if (!handle) return null;
        const canRead = await ensureSyncFilePermission(handle, 'read', false);
        if (!canRead) return null;
        const file = await handle.getFile();
        const text = await file.text();
        const payload = JSON.parse(String(text || '{}'));
        setSyncLocalMeta({
            fileName: handle.name || DEFAULT_SYNC_FILE_NAME,
            lastPullAt: Date.now()
        });
        return payload;
    }

    async function pullPayloadFromDropboxAuto() {
        if (!isDropboxSyncConnected()) return null;
        const accessToken = await getDropboxAccessTokenNonInteractive();
        if (!accessToken) return null;
        const fileName = getDropboxSyncFileName();
        const text = await downloadDropboxSyncFile(accessToken, fileName);
        const payload = JSON.parse(String(text || '{}'));
        setSyncDropboxMeta({
            fileName,
            lastPullAt: Date.now(),
            lastError: '',
            lastErrorAt: 0
        });
        return payload;
    }

    async function autoSyncPullOnStartup() {
        const candidates = [];
        try {
            const fromFile = await pullPayloadFromLocalFileAuto();
            if (fromFile) candidates.push({ source: 'file', payload: fromFile });
        } catch (error) {
            setSyncLocalMeta({ lastError: String(error?.message || 'pull error'), lastErrorAt: Date.now() });
        }
        try {
            const fromDropbox = await pullPayloadFromDropboxAuto();
            if (fromDropbox) candidates.push({ source: 'dropbox', payload: fromDropbox });
        } catch (error) {
            setSyncDropboxMeta({ lastError: String(error?.message || 'pull error'), lastErrorAt: Date.now() });
        }
        if (!candidates.length) return;

        candidates.sort((a, b) => getPayloadUpdatedAt(b.payload) - getPayloadUpdatedAt(a.payload));
        const newest = candidates[0].payload;
        const remoteUpdatedAt = getPayloadUpdatedAt(newest);
        const localUpdatedAt = getLocalDataUpdatedAt();
        if (remoteUpdatedAt && localUpdatedAt && remoteUpdatedAt <= localUpdatedAt) return;
        await applySyncedPayload(newest);
    }

    function shouldPushAfterStartup() {
        const localUpdatedAt = getLocalDataUpdatedAt();
        if (!localUpdatedAt) return false;
        const localMeta = getSyncLocalMeta();
        const localLinked = Number(localMeta?.linkedAt || 0) > 0 || !!String(localMeta?.fileName || '').trim();
        const localLastPushAt = Number(localMeta?.lastPushAt || 0);
        const localNeedsPush = localLinked && localUpdatedAt > localLastPushAt;
        const dropboxMeta = getSyncDropboxMeta();
        const dropboxLastPushAt = Number(dropboxMeta?.lastPushAt || 0);
        const dropboxNeedsPush = isDropboxSyncConnected(dropboxMeta) && localUpdatedAt > dropboxLastPushAt;
        return localNeedsPush || dropboxNeedsPush;
    }

    function scheduleAutoSyncPull(options = {}) {
        const immediate = options?.immediate === true;
        const force = options?.force === true;
        if (document.hidden) return;
        if (!force && autoSyncLastPullAt && (Date.now() - autoSyncLastPullAt) < AUTO_SYNC_PULL_MIN_INTERVAL_MS) return;
        if (immediate) {
            if (autoSyncPullTimer) {
                clearTimeout(autoSyncPullTimer);
                autoSyncPullTimer = 0;
            }
            runAutoSyncPull(force).catch(() => {});
            return;
        }
        if (autoSyncPullTimer) return;
        autoSyncPullTimer = window.setTimeout(() => {
            autoSyncPullTimer = 0;
            runAutoSyncPull(force).catch(() => {});
        }, AUTO_SYNC_PULL_DEBOUNCE_MS);
    }

    async function runAutoSyncPull(force = false) {
        if (document.hidden) return;
        if (!force && autoSyncLastPullAt && (Date.now() - autoSyncLastPullAt) < AUTO_SYNC_PULL_MIN_INTERVAL_MS) return;
        if (autoSyncPullRunning) {
            autoSyncPullQueued = true;
            return;
        }
        autoSyncPullRunning = true;
        try {
            await autoSyncPullOnStartup();
            autoSyncLastPullAt = Date.now();
            if (shouldPushAfterStartup()) scheduleAutoSyncPush(false);
        } finally {
            autoSyncPullRunning = false;
            if (autoSyncPullQueued) {
                autoSyncPullQueued = false;
                scheduleAutoSyncPull({ immediate: true, force: true });
            }
        }
    }

    async function pushPayloadToLocalFileAuto(payloadJson) {
        const handle = await getStoredSyncFileHandle().catch(() => null);
        if (!handle) return;
        const canWrite = await ensureSyncFilePermission(handle, 'readwrite', false);
        if (!canWrite) return;
        const writable = await handle.createWritable();
        try {
            await writable.write(payloadJson);
            await writable.close();
        } catch (error) {
            try { await writable.abort(); } catch (abortError) {}
            throw error;
        }
        setSyncLocalMeta({
            fileName: handle.name || DEFAULT_SYNC_FILE_NAME,
            lastPushAt: Date.now(),
            lastError: '',
            lastErrorAt: 0
        });
    }

    async function pushPayloadToDropboxAuto(payloadJson) {
        if (!isDropboxSyncConnected()) return;
        const accessToken = await getDropboxAccessTokenNonInteractive();
        if (!accessToken) return;
        const fileName = getDropboxSyncFileName();
        await uploadDropboxSyncFile(accessToken, fileName, payloadJson);
        setSyncDropboxMeta({
            fileName,
            lastPushAt: Date.now(),
            lastError: '',
            lastErrorAt: 0
        });
    }

    function scheduleAutoSyncPush(immediate = false) {
        if (autoSyncSuppressPush) return;
        if (immediate) {
            if (autoSyncPushTimer) {
                clearTimeout(autoSyncPushTimer);
                autoSyncPushTimer = 0;
            }
            runAutoSyncPush().catch(() => {});
            return;
        }
        if (autoSyncPushTimer) return;
        autoSyncPushTimer = window.setTimeout(() => {
            autoSyncPushTimer = 0;
            runAutoSyncPush().catch(() => {});
        }, AUTO_SYNC_PUSH_DEBOUNCE_MS);
    }

    async function runAutoSyncPush() {
        if (autoSyncSuppressPush) return;
        if (autoSyncPushRunning) {
            autoSyncPushQueued = true;
            return;
        }
        autoSyncPushRunning = true;
        try {
            const payload = await buildBackupPayloadForSync();
            const payloadJson = JSON.stringify(payload);

            try {
                await pushPayloadToLocalFileAuto(payloadJson);
            } catch (error) {
                setSyncLocalMeta({
                    lastError: String(error?.message || 'push error'),
                    lastErrorAt: Date.now()
                });
            }

            try {
                await pushPayloadToDropboxAuto(payloadJson);
            } catch (error) {
                setSyncDropboxMeta({
                    lastError: String(error?.message || 'push error'),
                    lastErrorAt: Date.now()
                });
            }
        } finally {
            autoSyncPushRunning = false;
            if (autoSyncPushQueued) {
                autoSyncPushQueued = false;
                scheduleAutoSyncPush(true);
            }
        }
    }

    function getActiveSpace() {
        return data.spaces.find(s => s.id === data.activeSpaceId) || data.spaces[0];
    }

    function applyCurrentTheme() {
        const isDark = darkModeQuery.matches;
        applyBg(resolveThemeBackgroundForApply(isDark ? 'dark' : 'light'));
    }

    function applyPerformanceMode() {
        document.body.classList.toggle('perf-eco', performanceMode === 'eco');
    }

    function applySpaceTheme() {
        const space = getActiveSpace();
        if (space?.bg) applyBg(space.bg);
        else applyCurrentTheme();
    }

    let externalThemeSyncRaf = 0;
    function syncThemeFromStorage() {
        if (externalThemeSyncRaf) cancelAnimationFrame(externalThemeSyncRaf);
        externalThemeSyncRaf = requestAnimationFrame(() => {
            externalThemeSyncRaf = 0;
            hydrateLocalThemeBackgrounds()
                .catch(() => {})
                .finally(() => {
                    const space = getActiveSpace();
                    if (!space?.bg) applyCurrentTheme();
                });
        });
    }

    darkModeQuery.addEventListener('change', () => {
        const space = getActiveSpace();
        if (!space?.bg) applyCurrentTheme();
    });

    window.addEventListener('storage', (e) => {
        const key = e?.key || '';
        if (!key) return;
        if (key === DND_DEBUG_STORAGE_KEY || key === 'airtabSettingsUpdatedAt') {
            dndDebugEnabled = readDndDebugEnabled();
            applyDndDebugVisibility();
        }
        if (key === STORAGE_KEY) {
            data = loadData();
            selectedIds.clear();
            selectionContext = { scope: 'space', folderId: null };
            updateSelectionUI();
            renderItems();
            renderSpaces();
            applySpaceTheme();
            return;
        }
        if (key === 'myEngines' || key === 'myActiveEngine') {
            try {
                engines = JSON.parse(localStorage.getItem('myEngines')) || defaultEngines;
            } catch (err) {
                engines = defaultEngines;
            }
            activeEngineId = localStorage.getItem('myActiveEngine') || engines[0]?.id;
            renderSearchDropdown();
            return;
        }
        if (key === 'airtabPerformanceMode') {
            performanceMode = localStorage.getItem('airtabPerformanceMode') === 'eco' ? 'eco' : 'balanced';
            applyPerformanceMode();
            return;
        }
        if (key === 'myBg' || key === 'myBgLight' || key === 'myBgDark' || key === 'airtabSettingsUpdatedAt') {
            syncThemeFromStorage();
        }
    });

    window.addEventListener('pagehide', () => {
        if (saveDataPending) saveData({ immediate: true });
        scheduleAutoSyncPush(true);
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        scheduleAutoSyncPull({ immediate: false });
    });

    window.addEventListener('focus', () => {
        scheduleAutoSyncPull({ immediate: false });
    });

    window.addEventListener('online', () => {
        scheduleAutoSyncPull({ immediate: true, force: true });
        if (shouldPushAfterStartup()) scheduleAutoSyncPush(false);
    });

    rightSidebarQuery.addEventListener('change', (e) => {
        if (rightSidebarHidden === e.matches) return;
        rightSidebarHidden = e.matches;
        renderSidebars();
    });

    mobileCommandModeQuery.addEventListener('change', (e) => {
        if (!e.matches && mobileCommandMode) {
            setMobileCommandMode(false, { clearSelection: true });
        }
        resetMobileBottomVisibilityOnViewportChange();
    });

    function getBrightness(color) {
        let r, g, b;
        if (color.startsWith('#')) {
            let hex = color.slice(1);
            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
            r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
        } else if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (!match) return 0;
            [r, g, b] = match.map(Number);
        } else return 0;
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    function applyBg(bgValue) {
        if (!bgValue) return;
        const root = document.documentElement;
        root.style.setProperty('--initial-bg', bgValue);
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta && (bgValue.startsWith('#') || bgValue.startsWith('rgb'))) {
            themeMeta.setAttribute('content', bgValue);
        }

        const setLightTokens = () => {
            root.style.setProperty('--text-color', '#1b1b1f');
            root.style.setProperty('--on-surface', '#1b1b1f');
            root.style.setProperty('--surface-0', '#f6f1f9');
            root.style.setProperty('--surface-1', 'rgba(255,255,255,0.86)');
            root.style.setProperty('--surface-2', 'rgba(255,255,255,0.74)');
            root.style.setProperty('--surface-3', 'rgba(255,255,255,0.62)');
            root.style.setProperty('--outline', 'rgba(28,27,31,0.18)');
            root.style.setProperty('--text-shadow', 'none');
            root.style.setProperty('--shadow-1', '0 10px 24px rgba(0,0,0,0.12)');
            root.style.setProperty('--shadow-2', '0 18px 38px rgba(0,0,0,0.18)');
            document.body.classList.remove('theme-dark');
        };

        const setDarkTokens = () => {
            root.style.setProperty('--text-color', '#f4eff4');
            root.style.setProperty('--on-surface', '#f4eff4');
            root.style.setProperty('--surface-0', '#101014');
            root.style.setProperty('--surface-1', 'rgba(28,27,31,0.82)');
            root.style.setProperty('--surface-2', 'rgba(40,39,43,0.78)');
            root.style.setProperty('--surface-3', 'rgba(54,52,60,0.72)');
            root.style.setProperty('--outline', 'rgba(255,255,255,0.16)');
            root.style.setProperty('--text-shadow', '0 1px 6px rgba(0,0,0,0.5)');
            root.style.setProperty('--shadow-1', '0 12px 28px rgba(0,0,0,0.32)');
            root.style.setProperty('--shadow-2', '0 20px 46px rgba(0,0,0,0.42)');
            document.body.classList.add('theme-dark');
        };

        if (bgValue.startsWith('#') || bgValue.startsWith('rgb')) {
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundColor = bgValue;
            if (getBrightness(bgValue) > 130) {
                setLightTokens();
                root.style.setProperty('--overlay-opacity', '0');
            } else {
                setDarkTokens();
                root.style.setProperty('--overlay-opacity', '0');
            }
        } else {
            document.body.style.backgroundImage = `url('${bgValue}')`;
            setDarkTokens();
            root.style.setProperty('--overlay-opacity', '0.32');
        }
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(evt.target?.result || '');
            reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
            reader.readAsDataURL(file);
        });
    }

    async function tryOptimizeBackgroundImage(file) {
        if (!file || !file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return null;
        const bitmap = await createImageBitmap(file);
        try {
            const maxWidth = 2048;
            const maxHeight = 1280;
            const needsResize = bitmap.width > maxWidth || bitmap.height > maxHeight;
            const needsCompression = file.size > 2.5 * 1024 * 1024;
            if (!needsResize && !needsCompression) return null;

            const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
            const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
            const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

            let optimized = canvas.toDataURL('image/webp', 0.84);
            if (!optimized || optimized === 'data:,') {
                optimized = canvas.toDataURL('image/jpeg', 0.86);
            }
            const approxOriginalDataUrlLength = Math.ceil(file.size / 3) * 4 + 64;
            if (!needsResize && optimized && optimized.length >= approxOriginalDataUrlLength) {
                return null;
            }
            canvas.width = 1;
            canvas.height = 1;
            return optimized && optimized.startsWith('data:image/') ? optimized : null;
        } finally {
            bitmap.close();
        }
    }

    async function readBackgroundDataUrl(file) {
        try {
            const optimized = await tryOptimizeBackgroundImage(file);
            if (optimized) return { dataUrl: optimized, optimized: true };
        } catch (e) {
            // fallback to plain read below
        }
        return { dataUrl: await readFileAsDataUrl(file), optimized: false };
    }

    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('clock').innerText = `${hours}:${minutes}`;
    }

    let clockAlignTimer = null;
    let clockInterval = null;

    function stopClockUpdates() {
        if (clockAlignTimer) {
            clearTimeout(clockAlignTimer);
            clockAlignTimer = null;
        }
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
    }

    function scheduleClock() {
        stopClockUpdates();
        updateClock();
        if (document.visibilityState !== 'visible') return;
        const now = new Date();
        const delay = (60 - now.getSeconds()) * 1000 + 50;
        clockAlignTimer = setTimeout(() => {
            updateClock();
            clockInterval = setInterval(updateClock, 60000);
        }, delay);
    }

    document.addEventListener('visibilitychange', scheduleClock, { passive: true });
    window.addEventListener('beforeunload', stopClockUpdates);
    window.addEventListener('beforeunload', () => {
        revokeLocalThemeBackgroundUrl('light');
        revokeLocalThemeBackgroundUrl('dark');
    });

    function resetInteractionState() {
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        modifierPressed = false;
        activeFolderMenuId = null;
        closeEmojiPopover();
        const engineMenu = document.getElementById('engineListMenu');
        if (engineMenu) engineMenu.classList.remove('active');
        releaseDragState();
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.classList.contains('active')) {
                modal.style.pointerEvents = 'auto';
                modal.style.visibility = 'visible';
            } else {
                modal.style.pointerEvents = 'none';
                modal.style.visibility = 'hidden';
            }
        });
        updateSelectionUI();
        renderSidebars();
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
        if (document.activeElement && modal && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        if (id === 'settingsModal') {
            const bgInputLight = document.getElementById('bgInputLight');
            const bgInputDark = document.getElementById('bgInputDark');
            if (bgInputLight?.value?.startsWith('data:image/')) bgInputLight.value = '';
            if (bgInputDark?.value?.startsWith('data:image/')) bgInputDark.value = '';
            pendingLocalThemeHandles.light = null;
            pendingLocalThemeHandles.dark = null;
        }
        if (id === 'spaceModal') {
            const spaceBgInput = document.getElementById('spaceBgInput');
            const spaceBgFile = document.getElementById('spaceBgFile');
            const spaceBgStatus = document.getElementById('spaceBgStatus');
            const folderSourceWrap = document.getElementById('spaceFolderSource');
            const folderSourceMode = document.getElementById('spaceFolderSourceMode');
            if (spaceBgInput?.value?.startsWith('data:image/')) spaceBgInput.value = '';
            if (spaceBgFile) spaceBgFile.value = '';
            if (spaceBgStatus) spaceBgStatus.innerText = '';
            if (folderSourceWrap) folderSourceWrap.classList.remove('active');
            if (folderSourceMode) folderSourceMode.value = 'add_folder';
            pendingSpaceFromFolderContext = null;
        }
        resetInteractionState();
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.style.pointerEvents = 'auto';
        modal.style.visibility = 'visible';
        modal.classList.add('active');
    }

    function closeItemModal() {
        closeModal('itemModal');
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
        if (pendingFolderReturn) {
            const folderId = pendingFolderReturn;
            pendingFolderReturn = null;
            const space = getActiveSpace();
            const folderExists = space.items.find(item => item.id === folderId && item.type === 'folder');
            if (folderExists) openFolder(folderId);
        }
    }

    function closeFolderModal() {
        closeModal('folderModal');
        currentFolderContext = null;
        pendingFolderReturn = null;
        setFolderEditMode(false);
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
    }

    function renderItems() {
        const grid = document.getElementById('grid');
        const cards = [];
        const space = getActiveSpace();
        const items = space.items || [];
        const itemActionsLabel = trKey('itemActions', 'Действия элемента');
        const addLabel = trKey('add', 'Добавить');

        items.forEach((item) => {
            const isSelected = selectedIds.has(item.id);
            const selectedClass = isSelected ? 'selected' : '';
            if (item.type !== 'link') return;
            if (item.isCompact) return;

            const iconAttrs = buildFaviconImgAttrs(item.url, item.customIcon, FAVICON_SIZE_GRID);
            cards.push(`
                <div class="card-container drag-item ${selectedClass}" draggable="true" data-id="${item.id}" data-type="link">
                    <div class="select-indicator"></div>
                    <div class="card-box-wrap">
                        <button type="button" class="edit-btn" data-id="${item.id}" aria-label="${itemActionsLabel}">⋮</button>
                        <a href="${item.url}" class="card-box" draggable="false">
                            <img ${iconAttrs} alt="" loading="lazy" decoding="async">
                        </a>
                    </div>
                    <div class="card-text">${item.name}</div>
                </div>
            `);
        });

        cards.push(`
            <div class="card-container">
                <div class="card-box-wrap">
                    <div class="card-box add-btn-box" data-add="square" data-force-type="link">+</div>
                </div>
                <div class="card-text">${addLabel}</div>
            </div>
        `);
        replaceWithFragment(grid, cards.join(''));
        renderSidebars();
    }

    function getSidebarSide(listEl) {
        return listEl?.dataset.side === 'right' ? 'right' : 'left';
    }

    function applySidebarPlacement(item, dropSidebarList, dropTarget) {
        const list = dropSidebarList || dropTarget?.closest('.sidebar-list');
        if (!list) return;
        item.sidebar = getSidebarSide(list);
    }

    function renderSidebarList(container, items) {
        const folderClosedSvg = `<img src="folder-closed.svg" alt="" loading="lazy" decoding="async">`;
        const folderOpenSvg = `<img src="folder-opened.svg" alt="" loading="lazy" decoding="async">`;
        const itemActionsLabel = trKey('itemActions', 'Действия элемента');
        const expandFolderLabel = trKey('expandFolder', 'Развернуть папку');
        const collapseFolderLabel = trKey('collapseFolder', 'Свернуть папку');
        const folderLabel = trKey('folder', 'Папка');
        const folderActionsLabel = trKey('folderActions', 'Действия папки');
        const editLabel = trKey('edit', 'Редактировать');
        const openTabsLabel = trKey('openTabs', 'Открыть вкладки');
        const deleteLabel = trKey('delete', 'Удалить');
        const renderTreeItems = (entries, parentId = null) => {
            return entries.map(entry => {
                if (entry.type === 'link') {
                    const isSelected = selectedIds.has(entry.id);
                    const selectedClass = isSelected ? 'selected' : '';
                    const childClass = parentId ? 'tree-child' : '';
                    const iconAttrs = buildFaviconImgAttrs(entry.url, entry.customIcon, FAVICON_SIZE_COMPACT);
                    return `
                        <div class="compact-wrapper drag-item ${childClass} ${selectedClass}" draggable="true" data-id="${entry.id}" data-type="link" ${parentId ? `data-parent="${parentId}"` : ''}>
                            <div class="select-indicator"></div>
                            <button type="button" class="edit-btn" data-id="${entry.id}" ${parentId ? 'data-scope="folder"' : ''} aria-label="${itemActionsLabel}">⋮</button>
                            <a href="${entry.url}" class="compact-card" draggable="false">
                                <img ${iconAttrs} alt="" loading="lazy" decoding="async">
                                <span>${entry.name}</span>
                            </a>
                        </div>
                    `;
                }

                if (entry.type === 'folder') {
                    const folder = entry;
                    const isCollapsed = !!folder.collapsed;
                    const isSelected = selectedIds.has(folder.id);
                    const selectedClass = isSelected ? 'selected' : '';
                    const isMenuOpen = folder.id === activeFolderMenuId;
                    const hasEmoji = !!folder.emoji;
                    const hasChildren = (folder.items || []).length > 0;
                    const gradientStyle = getFolderGradientStyle(folder);
                    const styleAttr = gradientStyle ? `style="--folder-bg: ${gradientStyle};"` : '';
                    return `
                        <div class="tree-folder ${isCollapsed ? '' : 'expanded'} ${isMenuOpen ? 'menu-open' : ''} drag-item ${selectedClass}" draggable="true" data-id="${folder.id}" data-type="folder" ${parentId ? `data-parent="${parentId}"` : ''} ${styleAttr}>
                            <div class="select-indicator"></div>
                            <button type="button" class="folder-toggle ${hasEmoji ? 'is-emoji' : ''}" data-action="toggle" aria-label="${isCollapsed ? expandFolderLabel : collapseFolderLabel}">
                                ${hasEmoji
                                    ? `${folder.emoji}`
                                    : `<span class="folder-svg icon-closed">${folderClosedSvg}</span>
                                       <span class="folder-svg icon-open">${folderOpenSvg}</span>`
                                }
                            </button>
                            <span class="tree-name">${folder.name || folderLabel}</span>
                            <div class="tree-actions">
                                <button type="button" class="tree-btn" data-action="menu" title="${folderActionsLabel}" aria-label="${folderActionsLabel}">⋮</button>
                            </div>
                            ${isMenuOpen ? `
                                <div class="tree-menu" data-menu="${folder.id}">
                                    <button type="button" class="tree-menu-btn" data-action="edit">${editLabel}</button>
                                    <button type="button" class="tree-menu-btn" data-action="open-tabs">${openTabsLabel}</button>
                                    <button type="button" class="tree-menu-btn danger" data-action="delete">${deleteLabel}</button>
                                </div>
                            ` : ''}
                        </div>
                        ${hasChildren ? `
                            <div class="tree-children ${isCollapsed ? '' : 'expanded'}" data-parent="${folder.id}">
                                ${renderTreeItems(folder.items || [], folder.id)}
                            </div>
                        ` : ''}
                    `;
                }
                return '';
            }).join('');
        };

        replaceWithFragment(container, renderTreeItems(items));
    }

    function renderSidebars() {
        const leftList = document.getElementById('sidebarListLeft');
        const rightList = document.getElementById('sidebarListRight');
        if (!leftList || !rightList) return;
        const space = getActiveSpace();
        applySpaceSidebarVisibility(space);
        const topItems = (space.items || []).filter(item => item.type === 'folder' || (item.type === 'link' && item.isCompact));
        const leftItems = topItems.filter(item => item.sidebar !== 'right');
        const rightItems = topItems.filter(item => item.sidebar === 'right');
        if (shouldRenderLeftSidebar(space)) {
            renderSidebarList(leftList, leftItems);
        } else if (leftList.childNodes.length > 0) {
            leftList.textContent = '';
        }
        if (shouldRenderRightSidebar(space)) {
            renderSidebarList(rightList, rightItems);
        } else if (rightList.childNodes.length > 0) {
            rightList.textContent = '';
        }
    }

    function renderFolderItems() {
        const folderGrid = document.getElementById('folderGrid');
        folderGrid.textContent = '';
        const folderCards = [];
        const itemActionsLabel = trKey('itemActions', 'Действия элемента');

        if (!currentFolderContext) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, currentFolderContext.folderId);
        if (!folder) return;

        const folderView = normalizeFolderView(folder.folderView || defaultFolderView);
        folder.folderView = folderView;
        updateFolderViewUI(folderView);

        folder.items.forEach((item) => {
            const iconAttrs = buildFaviconImgAttrs(
                item.url,
                item.customIcon,
                folderView === 'grid' ? FAVICON_SIZE_GRID : FAVICON_SIZE_COMPACT
            );
            const selectedClass = selectedIds.has(item.id) ? 'selected' : '';
            if (folderView === 'grid') {
                folderCards.push(`
                    <div class="card-container drag-item ${selectedClass}" draggable="true" data-id="${item.id}" data-type="link" data-scope="folder">
                        <div class="select-indicator"></div>
                        <div class="card-box-wrap">
                            <button type="button" class="move-out-btn" data-id="${item.id}" title="Вынести" aria-label="Вынести из папки">↗</button>
                            <button type="button" class="edit-btn" data-id="${item.id}" data-scope="folder" aria-label="${itemActionsLabel}">⋮</button>
                            <a href="${item.url}" class="card-box" draggable="false">
                                <img ${iconAttrs} alt="" loading="lazy" decoding="async">
                            </a>
                        </div>
                        <div class="card-text">${item.name}</div>
                    </div>
                `);
            } else {
                folderCards.push(`
                    <div class="compact-wrapper drag-item ${selectedClass}" draggable="true" data-id="${item.id}" data-type="link" data-scope="folder">
                        <div class="select-indicator"></div>
                        <button type="button" class="move-out-btn" data-id="${item.id}" title="Вынести" aria-label="Вынести из папки">↗</button>
                        <button type="button" class="edit-btn" data-id="${item.id}" data-scope="folder" aria-label="${itemActionsLabel}">⋮</button>
                        <a href="${item.url}" class="compact-card" draggable="false">
                            <img ${iconAttrs} alt="" loading="lazy" decoding="async">
                            <span>${item.name}</span>
                        </a>
                    </div>
                `);
            }
        });
        replaceWithFragment(folderGrid, folderCards.join(''));
    }

    function renderSearchDropdown() {
        const menu = document.getElementById('engineListMenu');
        const menuItems = [];
        const chooseEngineLabel = trKey('chooseSearchEngine', 'Выбрать поисковую систему');
        const activeEngine = engines.find(e => e.id == activeEngineId) || engines[0];
        if (activeEngine) document.getElementById('currentEngineIcon').src = activeEngine.icon;
        engines.forEach(eng => {
            menuItems.push(`
                <button type="button" class="engine-list-item" data-id="${eng.id}" title="${eng.name}" aria-label="${chooseEngineLabel}">
                    <img src="${eng.icon}" alt="${eng.name}">
                </button>
            `);
        });
        replaceWithFragment(menu, menuItems.join(''));
    }

    function renderEngineSettingsList() {
        const list = document.getElementById('engineSettingsList');
        const rows = [];
        engines.forEach((eng, i) => {
            const isFirst = i === 0;
            const isLast = i === engines.length - 1;
            rows.push(`
                <div class="engine-settings-item settings-item" data-index="${i}">
                    <span><img src="${eng.icon}"> ${eng.name}</span>
                    <div class="engine-controls">
                        <button type="button" class="move-btn" data-action="up" data-index="${i}" ${isFirst ? 'disabled' : ''} aria-label="Сдвинуть вверх">↑</button>
                        <button type="button" class="move-btn" data-action="down" data-index="${i}" ${isLast ? 'disabled' : ''} aria-label="Сдвинуть вниз">↓</button>
                        <button type="button" class="edit-engine-btn" data-index="${i}" aria-label="Редактировать поисковик">✎</button>
                    </div>
                </div>
            `);
        });
        replaceWithFragment(list, rows.join(''));
    }

    function renderSpaceSettingsList() {
        const list = document.getElementById('spaceSettingsList');
        const rows = [];
        data.spaces.forEach((space, i) => {
            const activeMark = space.id === data.activeSpaceId ? '• ' : '';
            rows.push(`
                <div class="space-settings-item settings-item" data-index="${i}" data-id="${space.id}">
                    <span>${activeMark}${space.emoji || '🧭'} ${space.name}</span>
                </div>
            `);
        });
        replaceWithFragment(list, rows.join(''));
    }

    function renderSpaces() {
        const strip = document.getElementById('spacesStrip');
        const pills = [];
        data.spaces.forEach(space => {
            const isActive = space.id === data.activeSpaceId;
            pills.push(`
                <button type="button" class="space-pill ${isActive ? 'active' : ''}" data-id="${space.id}" title="${space.name}" draggable="true" aria-label="Переключить пространство">
                    <span class="space-emoji">${space.emoji || '🧭'}</span>
                    <span class="space-name">${space.name}</span>
                </button>
            `);
        });
        replaceWithFragment(strip, pills.join(''));
        if (spaceDropTargetId) {
            const targetPill = strip.querySelector(`.space-pill[data-id="${spaceDropTargetId}"]`);
            if (targetPill) targetPill.classList.add('drop-target');
            else spaceDropTargetId = null;
        }
        updateSpaceNavButtons();
    }

    function updateSpaceNavButtons() {
        const prevBtn = document.getElementById('spacePrevBtn');
        const nextBtn = document.getElementById('spaceNextBtn');
        const disabled = data.spaces.length <= 1;
        prevBtn.disabled = disabled;
        nextBtn.disabled = disabled;
    }

    let spaceSwitchTimer = 0;
    let spaceItemsEnterTimer = 0;

    function playSpaceSwitchAnimation(direction = 0) {
        const container = document.querySelector('.container');
        if (!container) return;
        container.classList.remove('space-switch', 'space-switch-left', 'space-switch-right', 'space-switch-eco');
        // Force restart when switching quickly between spaces.
        void container.offsetWidth;
        if (performanceMode === 'eco') {
            container.classList.add('space-switch-eco');
        } else if (direction > 0) {
            container.classList.add('space-switch-right');
        } else if (direction < 0) {
            container.classList.add('space-switch-left');
        } else {
            container.classList.add('space-switch');
        }
        clearTimeout(spaceSwitchTimer);
        spaceSwitchTimer = window.setTimeout(() => {
            container.classList.remove('space-switch', 'space-switch-left', 'space-switch-right', 'space-switch-eco');
        }, performanceMode === 'eco' ? 120 : 230);
    }

    function runSpaceItemsEnterAnimation(direction = 0) {
        const animatedNow = Array.from(document.querySelectorAll('.drag-item.space-enter'));
        animatedNow.forEach((node) => {
            node.classList.remove('space-enter');
            node.style.removeProperty('--space-enter-delay');
            node.style.removeProperty('--space-enter-x');
        });
        if (performanceMode === 'eco' || reducedMotionQuery.matches) return;
        const nodes = Array.from(document.querySelectorAll('#grid > .drag-item, #sidebarListLeft > .drag-item, #sidebarListRight > .drag-item'))
            .filter((node) => !!node.dataset?.id);
        if (!nodes.length) return;
        const shiftX = direction > 0 ? 14 : direction < 0 ? -14 : 0;
        const maxStaggerItems = 18;
        const staggerStep = 14;
        nodes.forEach((node, index) => {
            const delay = Math.min(index, maxStaggerItems) * staggerStep;
            node.style.setProperty('--space-enter-delay', `${delay}ms`);
            node.style.setProperty('--space-enter-x', `${shiftX}px`);
        });
        requestAnimationFrame(() => {
            nodes.forEach((node) => node.classList.add('space-enter'));
        });
        clearTimeout(spaceItemsEnterTimer);
        spaceItemsEnterTimer = window.setTimeout(() => {
            nodes.forEach((node) => {
                node.classList.remove('space-enter');
                node.style.removeProperty('--space-enter-delay');
                node.style.removeProperty('--space-enter-x');
            });
        }, 520);
    }

    function setActiveSpace(spaceId, options = null) {
        const nextIndex = data.spaces.findIndex(space => space.id === spaceId);
        if (nextIndex === -1) return;
        const currentIndex = data.spaces.findIndex(space => space.id === data.activeSpaceId);
        if (currentIndex === nextIndex) return;
        const requestedDirection = Number(options?.direction);
        const direction = Number.isFinite(requestedDirection)
            ? Math.sign(requestedDirection)
            : Math.sign(nextIndex - currentIndex);
        data.activeSpaceId = spaceId;
        saveData();
        playSpaceSwitchAnimation(direction);
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
        renderItems();
        renderSpaces();
        applySpaceTheme();
        runSpaceItemsEnterAnimation(direction);
    }

    function setMobileCommandMode(active, options = {}) {
        const next = !!active;
        const clearSelection = options?.clearSelection === true;
        if (mobileCommandMode === next && !clearSelection) return;
        mobileCommandMode = next;
        if (!mobileCommandMode && clearSelection) {
            selectedIds.clear();
            selectionContext = { scope: 'space', folderId: null };
        }
        updateSelectionUI();
    }

    function updateSelectionUI() {
        const selectionActive = selectedIds.size > 0;
        const isFolderScope = selectionContext.scope === 'folder';
        const modifierLikeActive = modifierPressed || mobileCommandMode;
        document.body.classList.toggle('selection-mode', selectionActive);
        document.body.classList.toggle('modifier-hint', modifierLikeActive && !selectionActive);
        document.body.classList.toggle('modifier-options-visible', modifierLikeActive);
        document.body.classList.toggle('mobile-command-mode', mobileCommandMode);
        const mobileCommandBtn = document.getElementById('mobileCommandBtn');
        if (mobileCommandBtn) {
            mobileCommandBtn.classList.toggle('active', mobileCommandMode);
            mobileCommandBtn.setAttribute('aria-pressed', mobileCommandMode ? 'true' : 'false');
        }
        document.querySelectorAll('.drag-item.selected').forEach(el => {
            if (!selectedIds.has(el.dataset.id)) el.classList.remove('selected');
        });
        const countEl = document.getElementById('selectedCount');
        const folderCountEl = document.getElementById('folderSelectedCount');
        const selectedLabel = i18n ? i18n.t('selectedCount', { count: selectedIds.size }) : `${selectedIds.size} выбрано`;
        if (countEl) countEl.innerText = selectedLabel;
        if (folderCountEl) folderCountEl.innerText = selectedLabel;
        const openSelectedBtn = document.getElementById('openSelectedBtn');
        const folderOpenSelectedBtn = document.getElementById('folderOpenSelectedBtn');
        if (openSelectedBtn) openSelectedBtn.disabled = selectedIds.size === 0;
        if (folderOpenSelectedBtn) folderOpenSelectedBtn.disabled = selectedIds.size === 0;
        const groupMainBtn = document.getElementById('groupSelectedBtn');
        const groupFolderBtn = document.getElementById('folderGroupSelectedBtn');
        const deleteMainBtn = document.getElementById('deleteSelectedBtn');
        const deleteFolderBtn = document.getElementById('folderDeleteSelectedBtn');
        if (groupMainBtn) groupMainBtn.disabled = selectedIds.size === 0;
        if (groupFolderBtn) groupFolderBtn.disabled = selectedIds.size === 0;
        if (deleteMainBtn) deleteMainBtn.disabled = selectedIds.size === 0;
        if (deleteFolderBtn) deleteFolderBtn.disabled = selectedIds.size === 0;
        const mainControls = document.getElementById('selectionControls');
        const folderControls = document.getElementById('folderSelectionControls');
        const folderModalOpen = document.getElementById('folderModal')?.classList.contains('active');
        if (!mainControls || !folderControls) return;
        if (selectionActive && isFolderScope && folderModalOpen) {
            mainControls.style.display = 'none';
            folderControls.style.display = 'flex';
        } else if (selectionActive) {
            mainControls.style.display = 'flex';
            folderControls.style.display = 'none';
        } else {
            mainControls.style.display = 'none';
            folderControls.style.display = 'none';
        }
    }

    function reconcileSelectionWithDOM() {
        if (selectedIds.size === 0) return;
        const domIds = new Set();
        document.querySelectorAll('.drag-item').forEach(el => {
            if (el.dataset.id) domIds.add(el.dataset.id);
        });
        let hasVisible = false;
        selectedIds.forEach(id => {
            if (domIds.has(id)) hasVisible = true;
        });
        if (!hasVisible) {
            selectedIds.clear();
            selectionContext = { scope: 'space', folderId: null };
            updateSelectionUI();
        }
    }

    function toggleSelectionForItem(itemEl, scope = 'space', folderId = null) {
        const id = itemEl.dataset.id;
        if (!id) return;
        if (selectionContext.scope !== scope || (scope === 'folder' && selectionContext.folderId !== folderId)) {
            selectedIds.clear();
            selectionContext = { scope, folderId };
        }
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
            itemEl.classList.remove('selected');
        } else {
            selectedIds.add(id);
            itemEl.classList.add('selected');
        }
        if (selectedIds.size === 0) {
            selectionContext = { scope: 'space', folderId: null };
        }
        updateSelectionUI();
    }

    function collectLinksFromEntry(entry) {
        if (!entry) return [];
        const isFolderLike = entry.type === 'folder' || Array.isArray(entry.items);
        if (!isFolderLike) return entry.url ? [entry] : [];
        const links = [];
        (entry.items || []).forEach(child => {
            links.push(...collectLinksFromEntry(child));
        });
        return links;
    }

    function openLinksInTabs(items) {
        if (!Array.isArray(items) || !items.length) return;
        let openedCount = 0;
        items.forEach((item) => {
            const url = normalizeUrl(item?.url || '');
            if (!url) return;
            if (extensionApi?.tabs?.create) {
                try {
                    extensionApi.tabs.create({ url });
                    openedCount += 1;
                    return;
                } catch (error) {
                    // Fallback to window.open below.
                }
            }
            const popup = window.open(url, '_blank');
            if (popup) openedCount += 1;
        });
        if (!extensionApi?.tabs?.create && items.length > 1 && openedCount < items.length) {
            alert(trKey(
                'openTabsPopupBlocked',
                'Браузер заблокировал часть вкладок. Разрешите всплывающие окна для AirTab, чтобы открыть все.'
            ));
        }
    }

    function openSelectedInTabs() {
        const space = getActiveSpace();
        let selectedEntries = [];
        let items = [];

        if (selectionContext.scope === 'folder' && selectionContext.folderId) {
            const folder = getFolderById(space, selectionContext.folderId);
            selectedEntries = folder?.items.filter(item => selectedIds.has(item.id)) || [];
        } else {
            selectedEntries = (space.items || []).filter(item => selectedIds.has(item.id));
        }
        selectedEntries.forEach(entry => {
            items.push(...collectLinksFromEntry(entry));
        });

        if (!items.length) return;
        if (items.length > 10) {
            const ok = confirm(
                trKey('openTabsConfirm', 'Открыть {count} вкладок?', { count: items.length })
            );
            if (!ok) return;
        }
        openLinksInTabs(items);
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
        renderItems();
        renderFolderItems();
    }

    function getSelectionContainerInfo(space) {
        if (selectionContext.scope === 'folder' && selectionContext.folderId) {
            const parentFolder = getFolderById(space, selectionContext.folderId);
            if (!parentFolder) return null;
            if (!Array.isArray(parentFolder.items)) parentFolder.items = [];
            return { container: parentFolder.items, parentFolder };
        }
        if (!Array.isArray(space.items)) space.items = [];
        return { container: space.items, parentFolder: null };
    }

    function createFolderFromSelection() {
        if (selectedIds.size === 0) return;
        const space = getActiveSpace();
        const info = getSelectionContainerInfo(space);
        if (!info?.container) return;
        const selectedItems = info.container.filter(item => selectedIds.has(item.id));
        if (!selectedItems.length) return;
        const selectedSet = new Set(selectedItems.map(item => item.id));
        const firstIndex = info.container.findIndex(item => selectedSet.has(item.id));
        if (firstIndex === -1) return;
        const groupedItems = [];
        for (let i = info.container.length - 1; i >= 0; i -= 1) {
            if (!selectedSet.has(info.container[i].id)) continue;
            groupedItems.unshift(info.container.splice(i, 1)[0]);
        }
        const folderName = selectedItems.length === 1
            ? trKey('folderWithName', 'Папка: {name}', {
                name: selectedItems[0].name || trKey('itemFallbackName', 'Элемент')
            })
            : trKey('newFolder', 'Новая папка');
        info.container.splice(firstIndex, 0, {
            id: createId('folder'),
            type: 'folder',
            name: folderName,
            emoji: '',
            collapsed: true,
            items: groupedItems
        });
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
        saveData();
        renderItems();
        if (currentFolderContext) renderFolderItems();
    }

    function deleteSelectionItems() {
        if (selectedIds.size === 0) return;
        const space = getActiveSpace();
        const info = getSelectionContainerInfo(space);
        if (!info?.container) return;
        const selectedItems = info.container.filter(item => selectedIds.has(item.id));
        if (!selectedItems.length) return;
        const ok = confirm(
            trKey('deleteSelectedConfirm', 'Удалить выбранные элементы ({count})?', {
                count: selectedItems.length
            })
        );
        if (!ok) return;
        const selectedSet = new Set(selectedItems.map(item => item.id));
        for (let i = info.container.length - 1; i >= 0; i -= 1) {
            if (selectedSet.has(info.container[i].id)) info.container.splice(i, 1);
        }
        if (currentFolderContext && selectedSet.has(currentFolderContext.folderId)) {
            closeFolderModal();
        }
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
        saveData();
        renderItems();
        if (currentFolderContext) renderFolderItems();
    }

    function getFolderById(space, folderId) {
        const walk = (items) => {
            for (const item of items || []) {
                if (item.type === 'folder') {
                    if (item.id === folderId) return item;
                    const nested = walk(item.items || []);
                    if (nested) return nested;
                }
            }
            return null;
        };
        return walk(space.items || []);
    }

    function isDescendantFolder(folder, targetId) {
        if (!folder || folder.type !== 'folder') return false;
        for (const item of folder.items || []) {
            if (item.type === 'folder') {
                if (item.id === targetId) return true;
                if (isDescendantFolder(item, targetId)) return true;
            }
        }
        return false;
    }

    function countFolderItems(folder) {
        let count = 0;
        (folder.items || []).forEach(item => {
            count += 1;
            if (item.type === 'folder') count += countFolderItems(item);
        });
        return count;
    }

    function setCurrentFolderContext(folderId) {
        const space = getActiveSpace();
        const folder = getFolderById(space, folderId);
        if (!folder) return;
        currentFolderContext = { spaceId: space.id, folderId: folder.id };
    }

    function toggleFolderCollapsed(folderId) {
        const space = getActiveSpace();
        const folder = getFolderById(space, folderId);
        if (!folder) return;
        folder.collapsed = !folder.collapsed;
        saveData();
        const row = document.querySelector(`.tree-folder[data-id="${folderId}"]`);
        if (row) row.classList.toggle('expanded', !folder.collapsed);
        const children = document.querySelector(`.tree-children[data-parent="${folderId}"]`);
        if (children) children.classList.toggle('expanded', !folder.collapsed);
    }

    function openFolderInTabs(folderId) {
        const space = getActiveSpace();
        const folder = getFolderById(space, folderId);
        if (!folder) return;
        const items = collectLinksFromEntry(folder);
        if (!items.length) return;
        if (items.length > 10) {
            const ok = confirm(
                trKey('openTabsConfirm', 'Открыть {count} вкладок?', { count: items.length })
            );
            if (!ok) return;
        }
        openLinksInTabs(items);
    }

    function toggleFolderMenu(folderId) {
        activeFolderMenuId = activeFolderMenuId === folderId ? null : folderId;
        renderSidebars();
    }

    function updateFolderGradientPreview(from, to, angle = defaultFolderGradient.angle) {
        const preview = document.getElementById('folderGradientPreview');
        if (!preview) return;
        const normalizedAngle = normalizeGradientAngle(angle);
        const fromRgba = hexToRgba(from, 0.2) || from;
        const toRgba = hexToRgba(to, 0.16) || to;
        preview.style.background = `linear-gradient(${normalizedAngle}deg, ${fromRgba}, ${toRgba})`;
        const angleValue = document.getElementById('folderGradientAngleValue');
        if (angleValue) angleValue.innerText = `${normalizedAngle}°`;
    }

    function renderFolderGradientPresets(currentFrom, currentTo, currentAngle) {
        const presetsEl = document.getElementById('folderGradientPresets');
        if (!presetsEl) return;
        const currentKey = `${(currentFrom || '').toLowerCase()}|${(currentTo || '').toLowerCase()}|${normalizeGradientAngle(currentAngle)}`;
        const html = folderGradientPresets.map((preset, index) => {
            const presetKey = `${preset.from.toLowerCase()}|${preset.to.toLowerCase()}|${normalizeGradientAngle(preset.angle)}`;
            const isActive = presetKey === currentKey ? 'active' : '';
            return `
                <button
                    type="button"
                    class="gradient-preset-btn ${isActive}"
                    data-index="${index}"
                    title="${preset.name}"
                    aria-label="${trKey('applyPresetWithName', 'Применить пресет {name}', { name: preset.name })}"
                    style="background: linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to});"
                ></button>
            `;
        }).join('');
        replaceWithFragment(presetsEl, html);
    }

    function applyFolderGradientEditor(from, to, angle, rerenderPresets = true) {
        const fromInput = document.getElementById('folderGradientFrom');
        const toInput = document.getElementById('folderGradientTo');
        const angleInput = document.getElementById('folderGradientAngle');
        const fromCode = document.getElementById('folderGradientFromCode');
        const toCode = document.getElementById('folderGradientToCode');

        const safeFrom = from || defaultFolderGradient.from;
        const safeTo = to || defaultFolderGradient.to;
        const safeAngle = normalizeGradientAngle(angle);

        if (fromInput) fromInput.value = safeFrom;
        if (toInput) toInput.value = safeTo;
        if (angleInput) angleInput.value = String(safeAngle);
        if (fromCode) fromCode.innerText = (safeFrom || '').toUpperCase();
        if (toCode) toCode.innerText = (safeTo || '').toUpperCase();
        const fromSwatch = document.getElementById('folderGradientFromSwatch');
        const toSwatch = document.getElementById('folderGradientToSwatch');
        if (fromSwatch) fromSwatch.style.setProperty('--swatch-color', safeFrom);
        if (toSwatch) toSwatch.style.setProperty('--swatch-color', safeTo);
        updateFolderGradientPreview(safeFrom, safeTo, safeAngle);
        if (rerenderPresets) renderFolderGradientPresets(safeFrom, safeTo, safeAngle);
    }

    function openFolderEditModal(folderId) {
        const space = getActiveSpace();
        const folder = getFolderById(space, folderId);
        if (!folder) return;
        const from = folder.gradient?.from || defaultFolderGradient.from;
        const to = folder.gradient?.to || defaultFolderGradient.to;
        const angle = normalizeGradientAngle(folder.gradient?.angle);
        document.getElementById('folderGradientId').value = folder.id;
        document.getElementById('folderEditName').value = folder.name || trKey('folder', 'Папка');
        setEmoji(document.getElementById('folderEditEmojiBtn'), folder.emoji || '');
        applyFolderGradientEditor(from, to, angle, true);
        openModal('folderGradientModal');
    }

    function saveFolderEditFromModal() {
        const folderId = document.getElementById('folderGradientId').value;
        if (!folderId) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, folderId);
        if (!folder) return;
        let name = document.getElementById('folderEditName').value.trim();
        if (!name) name = folder.name || trKey('folder', 'Папка');
        folder.name = name;
        const emoji = document.getElementById('folderEditEmojiBtn').dataset.emoji || '';
        folder.emoji = emoji;
        const from = document.getElementById('folderGradientFrom').value;
        const to = document.getElementById('folderGradientTo').value;
        const angle = normalizeGradientAngle(document.getElementById('folderGradientAngle').value);
        const isDefaultGradient = (from || '').toLowerCase() === defaultFolderGradient.from
            && (to || '').toLowerCase() === defaultFolderGradient.to
            && angle === defaultFolderGradient.angle;
        if (isDefaultGradient) delete folder.gradient;
        else folder.gradient = { from, to, angle };
        saveData();
        closeModal('folderGradientModal');
    }

    function resetFolderGradientEditor() {
        applyFolderGradientEditor(defaultFolderGradient.from, defaultFolderGradient.to, defaultFolderGradient.angle, true);
    }

    function updateFolderHeader(folder) {
        document.getElementById('folderModalEmoji').innerText = folder.emoji || '';
        document.getElementById('folderModalName').innerText = folder.name || trKey('folder', 'Папка');
        setEmoji(document.getElementById('folderModalEmojiBtn'), folder.emoji || '');
        document.getElementById('folderModalNameInput').value = folder.name || trKey('folder', 'Папка');
    }

    function setFolderEditMode(isEditing) {
        const display = document.getElementById('folderTitleDisplay');
        const edit = document.getElementById('folderTitleEdit');
        display.style.display = isEditing ? 'none' : 'inline-flex';
        edit.classList.toggle('active', isEditing);
        if (isEditing) {
            const input = document.getElementById('folderModalNameInput');
            input.focus();
            input.select();
        }
    }

    function startFolderTitleEdit() {
        if (!currentFolderContext) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, currentFolderContext.folderId);
        if (!folder) return;
        updateFolderHeader(folder);
        setFolderEditMode(true);
    }

    function saveFolderTitleEdit() {
        if (!currentFolderContext) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, currentFolderContext.folderId);
        if (!folder) return;
        let name = document.getElementById('folderModalNameInput').value.trim();
        if (!name) name = folder.name || trKey('folder', 'Папка');
        folder.name = name;
        const modalEmoji = document.getElementById('folderModalEmojiBtn').dataset.emoji;
        folder.emoji = typeof modalEmoji === 'string' ? modalEmoji : (folder.emoji || '');
        saveData();
        renderItems();
        updateFolderHeader(folder);
        setFolderEditMode(false);
    }

    function cancelFolderTitleEdit() {
        if (!currentFolderContext) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, currentFolderContext.folderId);
        if (!folder) return;
        updateFolderHeader(folder);
        setFolderEditMode(false);
    }

    function updateFolderViewUI(view) {
        document.querySelectorAll('#folderViewToggle .view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        const folderGrid = document.getElementById('folderGrid');
        folderGrid.classList.toggle('grid-view', view === 'grid');
        folderGrid.classList.toggle('list-view', view === 'list');
    }

    function setFolderView(view) {
        if (!currentFolderContext) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, currentFolderContext.folderId);
        if (!folder) return;
        const normalized = normalizeFolderView(view);
        folder.folderView = normalized;
        saveData();
        updateFolderViewUI(normalized);
        renderFolderItems();
    }

    function setSettingsTab(tab) {
        if (!document.querySelector(`[data-tab-panel="${tab}"]`)) tab = 'search';
        settingsTab = tab;
        localStorage.setItem('settingsTab', tab);
        document.querySelectorAll('#settingsTabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('[data-tab-panel]').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.tabPanel === tab);
        });
    }

    function openFolder(folderId) {
        const space = getActiveSpace();
        const folder = getFolderById(space, folderId);
        if (!folder) return;
        currentFolderContext = { spaceId: space.id, folderId: folder.id };
        pendingFolderReturn = null;
        updateFolderHeader(folder);
        setFolderEditMode(false);
        const folderView = normalizeFolderView(folder.folderView || defaultFolderView);
        folder.folderView = folderView;
        updateFolderViewUI(folderView);
        renderFolderItems();
        openModal('folderModal');
    }

    function setItemType(type) {
        currentItemType = type;
        document.querySelectorAll('#itemTypeRow .segmented-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.itemType === type);
        });
        updateItemModalFields();
        if (type === 'folder' && !document.getElementById('editItemId').value) {
            const space = getActiveSpace();
            const nameInput = document.getElementById('folderName');
            if (!nameInput.value.trim()) {
                nameInput.value = getUniqueFolderName(space);
            }
        }
    }

    function openItemModalForNew(defaultStyle, scope = 'space', forceType = null, targetSidebar = 'left') {
        resetInteractionState();
        editContext = {
            scope,
            folderId: scope === 'folder' && currentFolderContext ? currentFolderContext.folderId : null,
            defaultStyle: defaultStyle || 'square',
            targetSidebar: targetSidebar || 'left'
        };
        document.getElementById('itemModalTitle').innerText = scope === 'folder'
            ? trKey('addShortcutToFolder', 'Добавить ярлык в папку')
            : trKey('addItem', 'Добавить элемент');
        document.getElementById('editItemId').value = '';
        document.getElementById('linkName').value = '';
        document.getElementById('linkUrl').value = '';
        document.getElementById('linkIcon').value = '';
        document.getElementById('folderName').value = '';
        setEmoji(document.getElementById('folderEmojiBtn'), '');
        document.getElementById('btnDeleteItem').style.display = 'none';
        document.getElementById('moveOutRow').style.display = 'none';

        const typeRow = document.getElementById('itemTypeRow');
        const showTypeRow = scope === 'space' && !forceType;
        typeRow.style.display = showTypeRow ? 'inline-flex' : 'none';
        setItemType(forceType || 'link');

        const folderModalOpen = document.getElementById('folderModal').classList.contains('active');
        if (scope === 'folder' && currentFolderContext && folderModalOpen) {
            pendingFolderReturn = currentFolderContext.folderId;
            closeModal('folderModal');
        }

        openModal('itemModal');
    }

    function openItemModalForEdit(itemId, scope = 'space') {
        closeEmojiPopover();
        const space = getActiveSpace();
        let item = null;
        if (scope === 'folder' && currentFolderContext) {
            const folder = getFolderById(space, currentFolderContext.folderId);
            item = folder?.items.find(entry => entry.id === itemId);
        } else {
            const location = findItemLocation(space, itemId);
            item = location?.item || null;
        }
        if (!item) return;

        editContext = {
            scope,
            folderId: scope === 'folder' && currentFolderContext ? currentFolderContext.folderId : null,
            defaultStyle: 'square',
            targetSidebar: 'left'
        };
        document.getElementById('itemModalTitle').innerText = item.type === 'folder'
            ? trKey('editFolder', 'Редактировать папку')
            : trKey('editShortcut', 'Редактировать ярлык');
        document.getElementById('editItemId').value = item.id;
        document.getElementById('linkName').value = item.name || '';
        document.getElementById('linkUrl').value = item.url || '';
        document.getElementById('linkIcon').value = item.customIcon || '';
        document.getElementById('folderName').value = item.name || '';
        setEmoji(document.getElementById('folderEmojiBtn'), item.emoji || '');
        document.getElementById('btnDeleteItem').style.display = 'block';
        document.getElementById('moveOutRow').style.display = (scope === 'folder' && item.type === 'link') ? 'flex' : 'none';

        document.getElementById('itemTypeRow').style.display = 'none';
        currentItemType = item.type;
        updateItemModalFields();

        const folderModalOpen = document.getElementById('folderModal').classList.contains('active');
        if (scope === 'folder' && currentFolderContext && folderModalOpen) {
            pendingFolderReturn = currentFolderContext.folderId;
            closeModal('folderModal');
        }

        openModal('itemModal');
    }

    function updateItemModalFields() {
        const linkFields = document.getElementById('linkFields');
        const folderFields = document.getElementById('folderFields');
        linkFields.classList.toggle('is-active', currentItemType === 'link');
        folderFields.classList.toggle('is-active', currentItemType === 'folder');
    }

    function saveItemFromModal() {
        const itemId = document.getElementById('editItemId').value;
        const space = getActiveSpace();
        const isEditing = itemId !== '';

        if (currentItemType === 'folder') {
            const baseName = trKey('newFolder', 'Новая папка');
            let name = document.getElementById('folderName').value.trim();
            const emoji = document.getElementById('folderEmojiBtn').dataset.emoji || '';
            if (isEditing && !name) return;
            if (!isEditing && (!name || name.toLowerCase() === baseName.toLowerCase())) {
                name = getUniqueFolderName(space, baseName);
            }

            if (isEditing) {
                const folder = getFolderById(space, itemId);
                if (folder) {
                    folder.name = name;
                    folder.emoji = emoji;
                }
            } else {
                const newFolder = {
                    id: createId('folder'),
                    type: 'folder',
                    name,
                    emoji: emoji,
                    items: [],
                    isCompact: false,
                    folderView: defaultFolderView,
                    collapsed: true,
                    sidebar: editContext.targetSidebar || 'left'
                };
                space.items.push(newFolder);
            }
        } else {
            const name = document.getElementById('linkName').value.trim();
            let url = normalizeUrl(document.getElementById('linkUrl').value.trim());
            const customIcon = document.getElementById('linkIcon').value.trim();
            if (!name || !url) return;

            let existingCompact = false;
            let existingSidebar = 'left';
            if (isEditing) {
                if (editContext.scope === 'folder' && editContext.folderId) {
                    const folder = getFolderById(space, editContext.folderId);
                    existingCompact = folder?.items.find(entry => entry.id === itemId)?.isCompact || false;
                    existingSidebar = folder?.items.find(entry => entry.id === itemId)?.sidebar || 'left';
                } else {
                    const location = findItemLocation(space, itemId);
                    existingCompact = location?.item?.isCompact || false;
                    existingSidebar = location?.item?.sidebar || 'left';
                }
            }
            const isCompact = isEditing ? existingCompact : editContext.defaultStyle === 'compact';
            const sidebar = isEditing ? existingSidebar : (isCompact ? (editContext.targetSidebar || 'left') : 'left');
            const newLink = { id: itemId || createId('link'), type: 'link', name, url, customIcon, isCompact, sidebar };

            if (editContext.scope === 'folder' && editContext.folderId) {
                const folder = getFolderById(space, editContext.folderId);
                if (!folder) return;
                if (isEditing) {
                    const idx = folder.items.findIndex(entry => entry.id === itemId);
                    if (idx > -1) folder.items[idx] = newLink;
                } else {
                    folder.items.push(newLink);
                }
                renderFolderItems();
            } else {
                if (isEditing) {
                    const location = findItemLocation(space, itemId);
                    if (location) location.container[location.index] = newLink;
                } else {
                    space.items.push(newLink);
                }
            }
        }

        saveData();
        renderItems();
        closeItemModal();
    }

    function deleteItemFromModal() {
        const itemId = document.getElementById('editItemId').value;
        if (!itemId) return;
        const space = getActiveSpace();

        if (editContext.scope === 'folder' && editContext.folderId) {
            const folder = getFolderById(space, editContext.folderId);
            if (!folder) return;
            folder.items = folder.items.filter(entry => entry.id !== itemId);
            renderFolderItems();
        } else {
            const location = findItemLocation(space, itemId);
            if (location) location.container.splice(location.index, 1);
        }

        saveData();
        renderItems();
        closeItemModal();
    }

    function moveItemOutOfFolder() {
        const itemId = document.getElementById('editItemId').value;
        if (!itemId) return;
        const space = getActiveSpace();
        if (!editContext.folderId) return;
        const folder = getFolderById(space, editContext.folderId);
        if (!folder) return;
        const idx = folder.items.findIndex(entry => entry.id === itemId);
        if (idx === -1) return;
        const [item] = folder.items.splice(idx, 1);
        space.items.push(item);
        saveData();
        renderItems();
        renderFolderItems();
        closeItemModal();
    }

    function moveItemOutDirect(itemId) {
        if (!currentFolderContext) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, currentFolderContext.folderId);
        if (!folder) return;
        const idx = folder.items.findIndex(entry => entry.id === itemId);
        if (idx === -1) return;
        const [item] = folder.items.splice(idx, 1);
        space.items.push(item);
        saveData();
        renderItems();
        renderFolderItems();
        folderDraggedId = null;
        document.body.classList.remove('dragging-from-folder');
    }

    function handleSpaceSwitch(direction) {
        if (data.spaces.length <= 1) return;
        const currentIndex = data.spaces.findIndex(space => space.id === data.activeSpaceId);
        if (currentIndex === -1) return;
        const nextIndex = (currentIndex + direction + data.spaces.length) % data.spaces.length;
        setActiveSpace(data.spaces[nextIndex].id, { direction });
    }

    function findFolderLocationAcrossSpaces(folderId) {
        if (!folderId) return null;
        for (const space of data.spaces) {
            const location = findItemLocation(space, folderId);
            if (location && location.item?.type === 'folder') {
                return { space, location };
            }
        }
        return null;
    }

    function buildFolderSpaceCreateContext(folderId, preferredSpaceId = '') {
        if (!folderId) return null;
        let sourceSpace = preferredSpaceId
            ? data.spaces.find(space => space.id === preferredSpaceId) || null
            : null;
        let source = sourceSpace ? findItemLocation(sourceSpace, folderId) : null;
        if (!source || source.item?.type !== 'folder') {
            const fallback = findFolderLocationAcrossSpaces(folderId);
            if (!fallback?.location || fallback.location.item?.type !== 'folder') return null;
            sourceSpace = fallback.space;
            source = fallback.location;
        }
        return {
            folderId: source.item.id,
            sourceSpaceId: sourceSpace?.id || data.activeSpaceId,
            name: source.item.name || trKey('folder', 'Папка'),
            emoji: source.item.emoji || ''
        };
    }

    function countSpaceItems(items) {
        let total = 0;
        (Array.isArray(items) ? items : []).forEach((item) => {
            total += 1;
            if (item?.type === 'folder') total += countSpaceItems(item.items || []);
        });
        return total;
    }

    function deleteSpaceById(spaceId) {
        if (!spaceId) return false;
        if (data.spaces.length <= 1) {
            alert(trKey('atLeastOneSpace', 'Должно остаться хотя бы одно пространство.'));
            return false;
        }
        const index = data.spaces.findIndex(space => space.id === spaceId);
        if (index === -1) return false;
        const target = data.spaces[index];
        const totalItems = countSpaceItems(target.items || []);
        const title = target?.name ? `«${target.name}»` : trKey('thisSpace', 'это пространство');
        const ok = totalItems > 0
            ? confirm(
                trKey('deleteSpaceWithItems', 'Удалить пространство {title} и {count} элементов?', {
                    title,
                    count: totalItems
                })
            )
            : confirm(trKey('deleteSpaceOnly', 'Удалить пространство {title}?', { title }));
        if (!ok) return false;

        data.spaces.splice(index, 1);
        if (data.activeSpaceId === spaceId) {
            const nextIndex = Math.max(0, Math.min(index - 1, data.spaces.length - 1));
            data.activeSpaceId = data.spaces[nextIndex].id;
            if (currentFolderContext?.spaceId === spaceId) {
                closeFolderModal();
            }
        }
        saveData();
        renderSpaces();
        renderSpaceSettingsList();
        renderItems();
        applySpaceTheme();
        return true;
    }

    function openSpaceModal(spaceId = null, activateOnSave = false, options = null) {
        closeEmojiPopover();
        const opts = options && typeof options === 'object' ? options : {};
        const fromFolder = opts.fromFolder || null;
        const space = spaceId ? data.spaces.find(entry => entry.id === spaceId) : null;
        const modalTitle = document.getElementById('spaceModalTitle');
        const folderSourceWrap = document.getElementById('spaceFolderSource');
        const folderSourceMode = document.getElementById('spaceFolderSourceMode');
        const isCreateFromFolder = !space && fromFolder?.folderId;
        modalTitle.innerText = space
            ? trKey('editSpace', 'Редактировать пространство')
            : (isCreateFromFolder
                ? trKey('newSpaceFromFolder', 'Новое пространство из папки')
                : trKey('newSpace', 'Новое пространство'));
        document.getElementById('editSpaceId').value = space?.id || '';
        document.getElementById('spaceName').value = isCreateFromFolder
            ? (fromFolder.name || trKey('folder', 'Папка'))
            : (space?.name || '');
        setEmoji(document.getElementById('spaceEmojiBtn'), isCreateFromFolder ? (fromFolder.emoji || '🧭') : (space?.emoji || '🏠'));
        document.getElementById('spaceBgInput').value = space?.bg || '';
        document.getElementById('spaceBgStatus').innerText = '';
        const bgColor = space?.bg && space.bg.startsWith('#') ? space.bg.substring(0,7) : '#2c2c2e';
        document.getElementById('spaceBgColor').value = bgColor;
        const showLeftSidebarInput = document.getElementById('spaceShowLeftSidebar');
        const showRightSidebarInput = document.getElementById('spaceShowRightSidebar');
        if (showLeftSidebarInput) showLeftSidebarInput.checked = space?.showLeftSidebar !== false;
        if (showRightSidebarInput) showRightSidebarInput.checked = space?.showRightSidebar !== false;
        document.getElementById('btnDeleteSpace').style.display = space ? 'block' : 'none';
        if (folderSourceWrap) folderSourceWrap.classList.toggle('active', !!isCreateFromFolder);
        if (folderSourceMode) folderSourceMode.value = 'add_folder';
        pendingSpaceFromFolderContext = isCreateFromFolder
            ? { folderId: fromFolder.folderId, sourceSpaceId: fromFolder.sourceSpaceId || data.activeSpaceId }
            : null;
        if (isCreateFromFolder) {
            pushDndDebug('openSpaceModal.fromFolder', {
                folderId: fromFolder.folderId || '',
                sourceSpaceId: fromFolder.sourceSpaceId || data.activeSpaceId || '',
                name: fromFolder.name || ''
            });
        } else if (!spaceId) {
            pushDndDebug('openSpaceModal.empty');
        }
        document.getElementById('spaceModal').dataset.activateOnSave = activateOnSave ? '1' : '0';
        openModal('spaceModal');
    }

    function saveSpaceFromModal() {
        const spaceId = document.getElementById('editSpaceId').value;
        const name = document.getElementById('spaceName').value.trim();
        const emoji = document.getElementById('spaceEmojiBtn').dataset.emoji || '🏠';
        const bg = document.getElementById('spaceBgInput').value.trim();
        const showLeftSidebar = document.getElementById('spaceShowLeftSidebar')?.checked !== false;
        const showRightSidebar = document.getElementById('spaceShowRightSidebar')?.checked !== false;
        if (!name) return;

        if (spaceId) {
            const space = data.spaces.find(entry => entry.id === spaceId);
            if (!space) return;
            space.name = name;
            space.emoji = emoji || '🧭';
            space.bg = bg;
            space.showLeftSidebar = showLeftSidebar;
            space.showRightSidebar = showRightSidebar;
            if (space.id === data.activeSpaceId) applySpaceTheme();
        } else {
            const newSpace = {
                id: createId('space'),
                name,
                emoji: emoji || '🧭',
                bg,
                showLeftSidebar,
                showRightSidebar,
                items: []
            };
            if (pendingSpaceFromFolderContext?.folderId) {
                const source = findFolderLocationAcrossSpaces(pendingSpaceFromFolderContext.folderId);
                const mode = document.getElementById('spaceFolderSourceMode')?.value === 'convert_folder'
                    ? 'convert_folder'
                    : 'add_folder';
                if (source && source.location?.item?.type === 'folder') {
                    const [folder] = source.location.container.splice(source.location.index, 1);
                    if (folder) {
                        if (mode === 'convert_folder') {
                            newSpace.items = Array.isArray(folder.items) ? folder.items : [];
                        } else {
                            newSpace.items = [folder];
                        }
                        if (currentFolderContext?.folderId === folder.id) {
                            closeFolderModal();
                        }
                    }
                }
            }
            data.spaces.push(newSpace);
            if (document.getElementById('spaceModal').dataset.activateOnSave === '1') {
                data.activeSpaceId = newSpace.id;
            }
        }

        saveData();
        renderSpaces();
        renderSpaceSettingsList();
        renderItems();
        applySpaceTheme();
        pendingSpaceFromFolderContext = null;
        closeModal('spaceModal');
    }

    function deleteSpaceFromModal() {
        const spaceId = document.getElementById('editSpaceId').value;
        const deleted = deleteSpaceById(spaceId);
        if (!deleted) return;
        closeModal('spaceModal');
    }

    function getInsertIndexFromPointer(event, targetElement, targetIndex) {
        const rect = targetElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const isListTarget = !!(targetElement.closest('.sidebar-list') || targetElement.closest('.tree-children'));
        const useX = isListTarget ? false : Math.abs(x - rect.width / 2) > Math.abs(y - rect.height / 2);
        if (isListTarget) {
            const edgePad = 12;
            if (y < edgePad) return targetIndex;
            if (y > rect.height - edgePad) return targetIndex + 1;
        }
        const insertAfter = useX ? x > rect.width / 2 : y > rect.height / 2;
        return targetIndex + (insertAfter ? 1 : 0);
    }

    function findItemLocation(space, id) {
        const walk = (items, parent) => {
            for (let i = 0; i < items.length; i += 1) {
                const item = items[i];
                if (item.id === id) {
                    return { index: i, item, parent, container: items, scope: parent ? 'folder' : 'space' };
                }
                if (item.type === 'folder') {
                    const found = walk(item.items || [], item);
                    if (found) return found;
                }
            }
            return null;
        };
        return walk(space.items || [], null);
    }

    function isCenterDrop(event, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const isListTarget = !!(targetElement.closest('.sidebar-list') || targetElement.closest('.tree-children'));
        const edgePadY = Math.max(6, rect.height * 0.14);
        if (y < edgePadY || y > rect.height - edgePadY) return false;
        if (!isListTarget) {
            const edgePadX = Math.max(6, rect.width * 0.06);
            if (x < edgePadX || x > rect.width - edgePadX) return false;
        }
        return true;
    }

    let draggedId = null;
    let draggedType = null;
    let folderDraggedId = null;
    let draggedFolderCreateContext = null;
    let draggedSpaceId = null;
    let spaceDropTargetId = null;
    let nativeDragActive = false;
    let pendingSpaceCreateFromFolderContext = null;
    let activeDragPreviewEl = null;
    const dndDebugLogEl = document.getElementById('dndDebugLog');
    const dndDebugPanelEl = document.getElementById('dndDebug');
    const dndDebugLines = [];
    let dndDebugSeq = 0;

    const container = document.querySelector('.container');
    const spacesNavEl = document.getElementById('spacesNav');
    const spacesStripEl = document.getElementById('spacesStrip');
    const spaceAddBtnEl = document.getElementById('spaceAddBtn');
    const spaceEditZoneEl = document.getElementById('spaceEditZone');
    const spaceTrashZoneEl = document.getElementById('spaceTrashZone');
    let mobileBottomHidden = false;
    let lastMobileScrollTop = 0;
    const dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
    document.body.appendChild(dropIndicator);
    const listPlaceholder = document.createElement('div');
    listPlaceholder.className = 'list-drop-placeholder';
    const gridPlaceholder = document.createElement('div');
    gridPlaceholder.className = 'grid-drop-placeholder';
    const spaceReorderPlaceholder = document.createElement('div');
    spaceReorderPlaceholder.className = 'space-drop-placeholder';
    let listPlaceholderState = { listEl: null, target: null, position: null };
    let gridPlaceholderState = { gridEl: null, target: null, position: null };
    let spaceReorderState = { target: null, position: null };
    let lastDragPoint = { x: null, y: null };
    let spaceAddIntentActive = false;
    let hoverFolderDropTargetId = null;

    function setMobileBottomHidden(hidden) {
        const next = !!hidden;
        if (mobileBottomHidden === next) return;
        mobileBottomHidden = next;
        document.body.classList.toggle('mobile-bottom-hidden', next);
    }

    function resetMobileBottomVisibilityOnViewportChange() {
        if (!mobileCommandModeQuery.matches) {
            setMobileBottomHidden(false);
            return;
        }
        lastMobileScrollTop = Number(container?.scrollTop || 0);
    }

    function handleMobileScrollVisibility() {
        if (!mobileCommandModeQuery.matches || !container) {
            setMobileBottomHidden(false);
            return;
        }
        const top = Number(container.scrollTop || 0);
        const delta = top - lastMobileScrollTop;
        lastMobileScrollTop = top;
        if (top <= 20) {
            setMobileBottomHidden(false);
            return;
        }
        if (Math.abs(delta) < 6) return;
        setMobileBottomHidden(delta > 0);
    }

    resetMobileBottomVisibilityOnViewportChange();
    container?.addEventListener('scroll', handleMobileScrollVisibility, { passive: true });

    function isDragTransferActive() {
        return !!(draggedId || folderDraggedId);
    }

    function rememberDragPoint(event) {
        if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
            lastDragPoint.x = event.clientX;
            lastDragPoint.y = event.clientY;
        }
    }

    function getDragPoint(event = null) {
        return {
            x: Number.isFinite(event?.clientX) ? event.clientX : lastDragPoint.x,
            y: Number.isFinite(event?.clientY) ? event.clientY : lastDragPoint.y
        };
    }

    function isPointInsideElement(element, clientX, clientY, pad = 0) {
        if (!element || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const rect = element.getBoundingClientRect();
        return clientX >= rect.left - pad
            && clientX <= rect.right + pad
            && clientY >= rect.top - pad
            && clientY <= rect.bottom + pad;
    }

    function isOverQuickAddByPoint(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const hitElements = document.elementsFromPoint(clientX, clientY);
        return hitElements.some(el => el?.matches?.('[data-add]') || el?.closest?.('[data-add]'));
    }

    function isOverSpacePillByPoint(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const hitElements = document.elementsFromPoint(clientX, clientY);
        return hitElements.some(el => el?.classList?.contains('space-pill') || el?.closest?.('.space-pill'));
    }

    function pushDndDebug(tag, payload = null) {
        if (!dndDebugEnabled || !dndDebugLogEl || !dndDebugPanelEl) return;
        const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
        const details = payload && typeof payload === 'object'
            ? Object.entries(payload)
                .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
                .join(' ')
            : '';
        dndDebugSeq += 1;
        dndDebugLines.unshift(`${time} #${dndDebugSeq} ${tag}${details ? ` ${details}` : ''}`);
        if (dndDebugLines.length > 14) dndDebugLines.length = 14;
        dndDebugLogEl.textContent = dndDebugLines.join('\n');
    }

    function applyDndDebugVisibility() {
        if (!dndDebugPanelEl) return;
        dndDebugPanelEl.classList.toggle('is-hidden', !dndDebugEnabled);
        dndDebugPanelEl.setAttribute('aria-hidden', dndDebugEnabled ? 'false' : 'true');
    }

    applyDndDebugVisibility();

    function isSpaceReorderActive() {
        return !!draggedSpaceId;
    }

    function clearActiveDragPreview() {
        if (!activeDragPreviewEl) return;
        if (activeDragPreviewEl.parentElement) activeDragPreviewEl.parentElement.removeChild(activeDragPreviewEl);
        activeDragPreviewEl = null;
    }

    function getDragPreviewSource(item) {
        if (!item) return null;
        if (item.classList.contains('card-container')) return item.querySelector(':scope > .card-box-wrap') || item;
        if (item.classList.contains('compact-wrapper')) return item.querySelector(':scope > .compact-card') || item;
        return item;
    }

    function applyDragPreview(event, item) {
        if (!event?.dataTransfer || typeof event.dataTransfer.setDragImage !== 'function') return;
        const source = getDragPreviewSource(item);
        if (!source) return;
        const rect = source.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        clearActiveDragPreview();
        const preview = source.cloneNode(true);
        preview.classList.remove('selected', 'dragging', 'drop-hint', 'folder-drop', 'drop-before', 'drop-after');
        preview.style.position = 'fixed';
        preview.style.left = '-2000px';
        preview.style.top = '-2000px';
        preview.style.margin = '0';
        preview.style.pointerEvents = 'none';
        preview.style.transition = 'none';
        preview.style.transform = 'none';
        preview.style.opacity = '1';
        preview.style.filter = 'none';
        preview.style.backdropFilter = 'none';
        preview.style.webkitBackdropFilter = 'none';
        preview.style.width = `${Math.max(1, Math.round(rect.width))}px`;
        preview.style.height = `${Math.max(1, Math.round(rect.height))}px`;
        preview.style.boxSizing = 'border-box';
        preview.style.zIndex = '-1';
        document.body.appendChild(preview);
        activeDragPreviewEl = preview;
        const offsetX = Math.max(8, Math.min(Math.round(rect.width * 0.24), 28));
        const offsetY = Math.max(8, Math.min(Math.round(rect.height * 0.5), 24));
        event.dataTransfer.setDragImage(preview, offsetX, offsetY);
    }

    function setSpaceDropMode(active) {
        document.body.classList.toggle('space-drop-mode', !!active);
    }

    function setSpaceReorderMode(active) {
        document.body.classList.toggle('space-reorder-mode', !!active);
        if (!active) {
            document.body.classList.remove('space-trash-visible');
            document.body.classList.remove('space-trash-disabled');
            if (spaceEditZoneEl) spaceEditZoneEl.classList.remove('drop-target');
            if (spaceTrashZoneEl) spaceTrashZoneEl.classList.remove('drop-target');
        }
    }

    function clearSpaceDropTarget() {
        if (spaceDropTargetId) {
            const prev = document.querySelector(`.space-pill[data-id="${spaceDropTargetId}"]`);
            if (prev) prev.classList.remove('drop-target');
        }
        spaceDropTargetId = null;
    }

    function setSpaceDropTarget(spaceId) {
        if (spaceDropTargetId === spaceId) return;
        clearSpaceDropTarget();
        if (!spaceId) return;
        const target = document.querySelector(`.space-pill[data-id="${spaceId}"]`);
        if (!target) return;
        target.classList.add('drop-target');
        spaceDropTargetId = spaceId;
    }

    function clearSpaceReorderPlaceholder() {
        if (spaceReorderPlaceholder.parentElement) {
            spaceReorderPlaceholder.parentElement.removeChild(spaceReorderPlaceholder);
        }
        spaceReorderPlaceholder.classList.remove('active');
        spaceReorderState = { target: null, position: null };
    }

    function getSpacePillsForReorder() {
        if (!spacesStripEl) return [];
        return Array.from(spacesStripEl.querySelectorAll('.space-pill'))
            .filter(pill => pill.dataset.id !== draggedSpaceId);
    }

    function getSpaceInsertionForEvent(event) {
        const pills = getSpacePillsForReorder();
        if (!pills.length) return null;
        const edgePad = 20;
        const firstRect = pills[0].getBoundingClientRect();
        const lastRect = pills[pills.length - 1].getBoundingClientRect();
        if (event.clientX <= firstRect.left + edgePad) {
            return { target: pills[0], position: 'before' };
        }
        if (event.clientX >= lastRect.right - edgePad) {
            return { target: pills[pills.length - 1], position: 'after' };
        }
        for (const pill of pills) {
            const rect = pill.getBoundingClientRect();
            if (event.clientX < rect.left + rect.width / 2) {
                return { target: pill, position: 'before' };
            }
        }
        return { target: pills[pills.length - 1], position: 'after' };
    }

    function showSpaceReorderPlaceholder(insertion) {
        if (!spacesStripEl || !isSpaceReorderActive()) return;
        const sample = insertion?.target || spacesStripEl.querySelector('.space-pill');
        const sampleRect = sample ? sample.getBoundingClientRect() : null;
        const width = Math.max(80, Math.round(sampleRect?.width || 92));
        spaceReorderPlaceholder.style.width = `${width}px`;
        const desiredTarget = insertion?.target || null;
        const desiredPosition = insertion?.position || null;
        if (spaceReorderState.target === desiredTarget
            && spaceReorderState.position === desiredPosition
            && spaceReorderPlaceholder.classList.contains('active')) {
            return;
        }
        const wasActive = spaceReorderPlaceholder.classList.contains('active');
        spaceReorderState = { target: desiredTarget, position: desiredPosition };
        if (!insertion) {
            spacesStripEl.appendChild(spaceReorderPlaceholder);
        } else if (insertion.position === 'before') {
            spacesStripEl.insertBefore(spaceReorderPlaceholder, insertion.target);
        } else {
            spacesStripEl.insertBefore(spaceReorderPlaceholder, insertion.target.nextSibling);
        }
        if (!wasActive) {
            spaceReorderPlaceholder.offsetHeight;
            spaceReorderPlaceholder.classList.add('active');
        }
    }

    function getSpaceInsertIndexFromPlaceholder() {
        if (!spaceReorderPlaceholder.parentElement) return data.spaces.length;
        const targetId = spaceReorderState.target?.dataset?.id || '';
        if (!targetId) return data.spaces.length;
        const targetIndex = data.spaces.findIndex(space => space.id === targetId);
        if (targetIndex === -1) return data.spaces.length;
        return targetIndex + (spaceReorderState.position === 'after' ? 1 : 0);
    }

    function reorderSpaceByDrag(spaceId, insertIndexRaw) {
        const fromIndex = data.spaces.findIndex(space => space.id === spaceId);
        if (fromIndex === -1) return false;
        let insertIndex = Math.max(0, Math.min(insertIndexRaw, data.spaces.length));
        if (fromIndex < insertIndex) insertIndex -= 1;
        if (insertIndex === fromIndex) return false;
        const [moved] = data.spaces.splice(fromIndex, 1);
        data.spaces.splice(insertIndex, 0, moved);
        saveData();
        renderSpaces();
        renderSpaceSettingsList();
        return true;
    }

    function releaseSpaceReorderState() {
        document.querySelectorAll('.space-pill.dragging-space').forEach((pill) => pill.classList.remove('dragging-space'));
        draggedSpaceId = null;
        clearSpaceReorderPlaceholder();
        setSpaceReorderMode(false);
    }

    function canDeleteDraggedSpace() {
        return data.spaces.length > 1;
    }

    function updateSpaceTrashVisibility(event) {
        if (!isSpaceReorderActive()) {
            document.body.classList.remove('space-trash-visible');
            document.body.classList.remove('space-trash-disabled');
            if (spaceEditZoneEl) spaceEditZoneEl.classList.remove('drop-target');
            if (spaceTrashZoneEl) spaceTrashZoneEl.classList.remove('drop-target');
            return;
        }
        const canDelete = canDeleteDraggedSpace();
        document.body.classList.toggle('space-trash-disabled', !canDelete);
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        const overNav = elements.some(el => el?.id === 'spacesNav' || el?.closest?.('#spacesNav'));
        document.body.classList.toggle('space-trash-visible', !overNav);
        const overEdit = elements.some(el => el?.id === 'spaceEditZone' || el?.closest?.('#spaceEditZone'));
        const overTrash = canDelete && elements.some(el => el?.id === 'spaceTrashZone' || el?.closest?.('#spaceTrashZone'));
        if (spaceEditZoneEl) spaceEditZoneEl.classList.toggle('drop-target', overEdit);
        if (spaceTrashZoneEl) spaceTrashZoneEl.classList.toggle('drop-target', overTrash);
    }

    function getDraggedFolderContextForSpaceCreate(event = null) {
        const activeSpaceId = getActiveSpace()?.id || data.activeSpaceId || '';
        if (event?.dataTransfer) {
            try {
                const rawContext = event.dataTransfer.getData('text/airtab-folder');
                if (rawContext) {
                    const parsed = JSON.parse(rawContext);
                    const fromTransfer = buildFolderSpaceCreateContext(parsed?.folderId || '', parsed?.sourceSpaceId || activeSpaceId);
                    if (fromTransfer) return fromTransfer;
                }
            } catch {
                // ignore malformed transfer payload
            }
        }

        let folderId = '';
        let preferredSpaceId = activeSpaceId;
        if (draggedType === 'folder' && draggedId) {
            folderId = draggedId;
        } else {
            const draggingFolderEl = document.querySelector('.drag-item.dragging[data-type="folder"]');
            if (draggingFolderEl?.dataset?.id) folderId = draggingFolderEl.dataset.id;
        }

        if (!folderId && event?.dataTransfer) {
            try {
                folderId = event.dataTransfer.getData('text/plain') || '';
            } catch {
                folderId = '';
            }
        }

        return buildFolderSpaceCreateContext(folderId, preferredSpaceId);
    }

    function resolveCurrentFolderContextForSpaceCreate(event = null) {
        const activeSpaceId = getActiveSpace()?.id || data.activeSpaceId || '';
        return getDraggedFolderContextForSpaceCreate(event)
            || pendingSpaceCreateFromFolderContext
            || (draggedType === 'folder' && draggedId
                ? buildFolderSpaceCreateContext(draggedId, activeSpaceId)
                : null);
    }

    function resolveStableFolderContextForSpaceCreate(event = null) {
        const activeSpaceId = getActiveSpace()?.id || data.activeSpaceId || '';
        const resolved = resolveCurrentFolderContextForSpaceCreate(event);
        if (resolved) return resolved;
        if (pendingSpaceCreateFromFolderContext?.folderId) {
            const pendingResolved = buildFolderSpaceCreateContext(
                pendingSpaceCreateFromFolderContext.folderId,
                pendingSpaceCreateFromFolderContext.sourceSpaceId || activeSpaceId
            );
            if (pendingResolved) return pendingResolved;
        }
        if (draggedType === 'folder' && draggedId) {
            const fromDraggedState = buildFolderSpaceCreateContext(draggedId, activeSpaceId);
            if (fromDraggedState) return fromDraggedState;
        }
        const draggingFolderEl = document.querySelector('.drag-item.dragging[data-type="folder"]');
        if (draggingFolderEl?.dataset?.id) {
            const fromDom = buildFolderSpaceCreateContext(draggingFolderEl.dataset.id, activeSpaceId);
            if (fromDom) return fromDom;
        }
        return null;
    }

    function resolveSpaceCreateFolderContext(event = null) {
        const stable = resolveStableFolderContextForSpaceCreate(event);
        if (stable) return stable;
        if (draggedFolderCreateContext?.folderId) {
            return draggedFolderCreateContext;
        }
        const activeSpaceId = getActiveSpace()?.id || data.activeSpaceId || '';
        if (pendingSpaceCreateFromFolderContext?.folderId) {
            return {
                folderId: pendingSpaceCreateFromFolderContext.folderId,
                sourceSpaceId: pendingSpaceCreateFromFolderContext.sourceSpaceId || activeSpaceId
            };
        }
        return null;
    }

    function resolveSpaceDropTargetFromPoint(clientX, clientY) {
        const elements = document.elementsFromPoint(clientX, clientY);
        const pill = elements.find(el => el?.classList?.contains('space-pill')) || null;
        const id = pill?.dataset?.id || '';
        if (!id || id === data.activeSpaceId) return '';
        return id;
    }

    function updateSpaceDropTargetFromEvent(event) {
        if (!isDragTransferActive()) {
            clearSpaceDropTarget();
            return '';
        }
        const directPillId = event.target.closest('.space-pill')?.dataset?.id || '';
        const targetId = directPillId || resolveSpaceDropTargetFromPoint(event.clientX, event.clientY);
        if (!targetId || targetId === data.activeSpaceId) {
            clearSpaceDropTarget();
            return '';
        }
        setSpaceDropTarget(targetId);
        return targetId;
    }

    function isOverSpaceAddByPoint(clientX, clientY, pad = 10) {
        if (!spaceAddBtnEl) return false;
        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
            const rect = spaceAddBtnEl.getBoundingClientRect();
            const insideExact = clientX >= rect.left
                && clientX <= rect.right
                && clientY >= rect.top
                && clientY <= rect.bottom;
            if (insideExact) return true;
            const hitElements = document.elementsFromPoint(clientX, clientY);
            const overByElement = hitElements.some(el => el?.id === 'spaceAddBtn' || el?.closest?.('#spaceAddBtn'));
            if (overByElement) return true;
            const overPill = hitElements.some(el => el?.classList?.contains('space-pill') || el?.closest?.('.space-pill'));
            if (overPill) return false;
            if (clientX >= rect.left - pad
                && clientX <= rect.right + pad
                && clientY >= rect.top - pad
                && clientY <= rect.bottom + pad) {
                return true;
            }
        }
        return false;
    }

    function tryOpenSpaceCreateFromDraggedFolder(event = null, reason = 'spaceAdd') {
        if (isSpaceReorderActive()) return false;
        const spaceModal = document.getElementById('spaceModal');
        if (spaceModal?.classList.contains('active')) return false;
        const eventX = Number.isFinite(event?.clientX) ? event.clientX : null;
        const eventY = Number.isFinite(event?.clientY) ? event.clientY : null;
        const lastX = Number.isFinite(lastDragPoint.x) ? lastDragPoint.x : null;
        const lastY = Number.isFinite(lastDragPoint.y) ? lastDragPoint.y : null;
        const overAddByEvent = isOverSpaceAddByPoint(eventX, eventY, 24);
        const overAddByLast = isOverSpaceAddByPoint(lastX, lastY, 24);
        const overAddBtn = !!(event?.target?.closest?.('#spaceAddBtn') || overAddByEvent || overAddByLast);
        const overSpacePill = isOverSpacePillByPoint(eventX, eventY) || isOverSpacePillByPoint(lastX, lastY);
        const overQuickAdd = isOverQuickAddByPoint(eventX, eventY) || isOverQuickAddByPoint(lastX, lastY);
        const overSpacesNav = isPointInsideElement(spacesNavEl, eventX, eventY, 16)
            || isPointInsideElement(spacesNavEl, lastX, lastY, 16);
        const addArmed = !!spaceAddBtnEl?.classList.contains('drop-target');
        const addIntent = !!spaceAddIntentActive;
        const shouldOpenFromAdd = overAddBtn
            || addArmed
            || (addIntent && overSpacesNav && !overSpacePill && !overQuickAdd);
        if (!shouldOpenFromAdd) return false;
        const folderContext = resolveSpaceCreateFolderContext(event) || draggedFolderCreateContext;
        if (!folderContext?.folderId) return false;
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        pushDndDebug(`${reason}.open-from-add`, {
            folderId: folderContext.folderId || '',
            overAdd: overAddBtn,
            overAddEvent: overAddByEvent,
            overAddLast: overAddByLast,
            addArmed,
            addIntent,
            overPill: overSpacePill,
            overNav: overSpacesNav
        });
        openSpaceModal(null, true, { fromFolder: folderContext });
        releaseDragState();
        nativeDragActive = false;
        return true;
    }

    function moveDraggedPayloadToSpace(targetSpaceId) {
        if (!targetSpaceId) return false;
        const targetSpace = data.spaces.find(space => space.id === targetSpaceId);
        if (!targetSpace) return false;
        if (targetSpace.id === data.activeSpaceId) return false;

        const sourceSpace = getActiveSpace();
        let moved = null;

        if (folderDraggedId && currentFolderContext) {
            const sourceFolder = getFolderById(sourceSpace, currentFolderContext.folderId);
            if (!sourceFolder) return false;
            const index = sourceFolder.items.findIndex(item => item.id === folderDraggedId);
            if (index === -1) return false;
            moved = sourceFolder.items.splice(index, 1)[0];
            if (!moved) return false;
            if (moved.type === 'link' && sourceFolder.items !== sourceSpace.items && typeof moved.isCompact !== 'boolean') {
                moved.isCompact = false;
            }
        } else if (draggedId) {
            const source = findItemLocation(sourceSpace, draggedId);
            if (!source) return false;
            moved = source.container.splice(source.index, 1)[0];
            if (!moved) return false;
        } else {
            return false;
        }

        targetSpace.items = Array.isArray(targetSpace.items) ? targetSpace.items : [];
        targetSpace.items.push(moved);

        saveData();
        renderItems();
        renderSpaces();
        renderSpaceSettingsList();
        if (currentFolderContext) renderFolderItems();
        return true;
    }

    function hideDropIndicator() {
        dropIndicator.style.opacity = '0';
    }

    function clearListPlaceholder() {
        if (listPlaceholder.parentElement) {
            listPlaceholder.parentElement.removeChild(listPlaceholder);
        }
        listPlaceholder.classList.remove('active');
        listPlaceholderState = { listEl: null, target: null, position: null };
    }

    function clearGridPlaceholder() {
        if (gridPlaceholder.parentElement) {
            gridPlaceholder.parentElement.removeChild(gridPlaceholder);
        }
        gridPlaceholder.classList.remove('active');
        gridPlaceholderState = { gridEl: null, target: null, position: null };
    }

    function showListPlaceholder(listContext, insertion) {
        if (!listContext?.listEl) return;
        const sample = insertion?.target || listContext.listEl.querySelector('.drag-item');
        const sampleHeight = sample ? Math.round(sample.getBoundingClientRect().height) : 40;
        listPlaceholder.style.setProperty('--placeholder-height', `${Math.max(32, sampleHeight)}px`);
        const desiredTarget = insertion?.target || null;
        const desiredPosition = insertion?.position || null;
        if (listPlaceholderState.listEl === listContext.listEl
            && listPlaceholderState.target === desiredTarget
            && listPlaceholderState.position === desiredPosition
            && listPlaceholder.classList.contains('active')) {
            return;
        }
        const wasActive = listPlaceholder.classList.contains('active');
        listPlaceholderState = { listEl: listContext.listEl, target: desiredTarget, position: desiredPosition };
        if (!insertion) {
            listContext.listEl.appendChild(listPlaceholder);
        } else if (insertion.position === 'before') {
            listContext.listEl.insertBefore(listPlaceholder, insertion.target);
        } else {
            listContext.listEl.insertBefore(listPlaceholder, insertion.target.nextSibling);
        }
        if (!wasActive) {
            listPlaceholder.offsetHeight;
            listPlaceholder.classList.add('active');
        }
    }

    function showGridPlaceholder(gridEl, insertion) {
        if (!gridEl) return;
        const sample = insertion?.target || gridEl.querySelector('.drag-item');
        const sampleRect = sample ? sample.getBoundingClientRect() : null;
        gridPlaceholder.style.setProperty('--placeholder-width', `${Math.max(74, Math.round(sampleRect?.width || 90))}px`);
        gridPlaceholder.style.setProperty('--placeholder-height', `${Math.max(90, Math.round(sampleRect?.height || 102))}px`);

        const desiredTarget = insertion?.target || null;
        const desiredPosition = insertion?.position || null;
        if (gridPlaceholderState.gridEl === gridEl
            && gridPlaceholderState.target === desiredTarget
            && gridPlaceholderState.position === desiredPosition
            && gridPlaceholder.classList.contains('active')) {
            return;
        }

        const wasActive = gridPlaceholder.classList.contains('active');
        gridPlaceholderState = { gridEl, target: desiredTarget, position: desiredPosition };
        if (!insertion) {
            const addCard = gridEl.querySelector('[data-add="square"]')?.closest('.card-container');
            if (addCard) gridEl.insertBefore(gridPlaceholder, addCard);
            else gridEl.appendChild(gridPlaceholder);
        } else if (insertion.position === 'before') {
            gridEl.insertBefore(gridPlaceholder, insertion.target);
        } else {
            gridEl.insertBefore(gridPlaceholder, insertion.target.nextSibling);
        }

        if (!wasActive) {
            gridPlaceholder.offsetHeight;
            gridPlaceholder.classList.add('active');
        }
    }

    function releaseDragState() {
        draggedId = null;
        draggedType = null;
        folderDraggedId = null;
        draggedFolderCreateContext = null;
        pendingSpaceCreateFromFolderContext = null;
        lastDragPoint = { x: null, y: null };
        spaceAddIntentActive = false;
        hoverFolderDropTargetId = null;
        clearActiveDragPreview();
        if (draggedSpaceId) releaseSpaceReorderState();
        clearSpaceDropTarget();
        setSpaceDropMode(false);
        document.querySelectorAll('.drag-item').forEach(el => {
            el.classList.remove('dragging');
            el.classList.remove('drop-hint');
            el.classList.remove('folder-drop');
            el.classList.remove('drop-before');
            el.classList.remove('drop-after');
        });
        document.body.classList.remove('dragging-from-folder');
        if (spaceAddBtnEl) spaceAddBtnEl.classList.remove('drop-target');
        hideDropIndicator();
        clearListPlaceholder();
        clearGridPlaceholder();
    }

    function showListDropIndicator(targetElement, position) {
        const rect = targetElement.getBoundingClientRect();
        const top = position === 'after' ? rect.bottom : rect.top;
        dropIndicator.style.left = `${rect.left + 8}px`;
        dropIndicator.style.top = `${top - 1}px`;
        dropIndicator.style.width = `${Math.max(16, rect.width - 16)}px`;
        dropIndicator.style.height = '2px';
        dropIndicator.style.opacity = '1';
    }

    function showEmptyListDropIndicator(listElement) {
        const rect = listElement.getBoundingClientRect();
        dropIndicator.style.left = `${rect.left + 8}px`;
        dropIndicator.style.top = `${rect.top + 8}px`;
        dropIndicator.style.width = `${Math.max(16, rect.width - 16)}px`;
        dropIndicator.style.height = '2px';
        dropIndicator.style.opacity = '1';
    }

    function getListContextFromEvent(event) {
        const treeChildren = event.target.closest('.tree-children');
        if (treeChildren) {
            return { listEl: treeChildren, parentId: treeChildren.dataset.parent || null };
        }
        const sidebarList = event.target.closest('.sidebar-list');
        if (sidebarList) {
            return { listEl: sidebarList, parentId: null };
        }
        const sidebarSection = event.target.closest('.sidebar-section');
        if (sidebarSection) {
            const listEl = sidebarSection.querySelector('.sidebar-list');
            if (listEl) return { listEl, parentId: null };
        }
        const sidebar = event.target.closest('.sidebar');
        if (sidebar) {
            const listEl = sidebar.querySelector('.sidebar-list');
            if (listEl) return { listEl, parentId: null };
        }
        return null;
    }

    function getListItemsForContext(listEl, activeId = null) {
        if (!listEl) return [];
        return Array.from(listEl.querySelectorAll(':scope > .drag-item'))
            .filter(item => item.dataset.id !== activeId);
    }

    function getListInsertionForEvent(listItems, event) {
        if (!listItems.length) return null;
        const sampleHeight = Math.round(listItems[0]?.getBoundingClientRect?.().height || 40);
        const edgePad = Math.max(6, Math.min(14, Math.round(sampleHeight * 0.22)));
        const firstRect = listItems[0].getBoundingClientRect();
        const lastRect = listItems[listItems.length - 1].getBoundingClientRect();
        if (event.clientY <= firstRect.top + edgePad) {
            return { target: listItems[0], position: 'before' };
        }
        if (event.clientY >= lastRect.bottom - edgePad) {
            return { target: listItems[listItems.length - 1], position: 'after' };
        }
        for (const item of listItems) {
            const rect = item.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                return { target: item, position: 'before' };
            }
        }
        return { target: listItems[listItems.length - 1], position: 'after' };
    }

    function getListPlaceholderShiftForTarget(listContext, targetItem) {
        if (!listContext?.listEl || !targetItem) return { top: 0, bottom: 0 };
        if (listPlaceholderState.listEl !== listContext.listEl) return { top: 0, bottom: 0 };
        if (listPlaceholderState.target !== targetItem) return { top: 0, bottom: 0 };
        const placeholderRect = listPlaceholder.getBoundingClientRect();
        const fallbackHeight = parseFloat(listPlaceholder.style.getPropertyValue('--placeholder-height')) || 0;
        const rawHeight = Math.max(0, Math.round(placeholderRect.height || fallbackHeight));
        if (!rawHeight) return { top: 0, bottom: 0 };
        const marginCompensation = listPlaceholder.classList.contains('active') ? 12 : 0;
        const shift = rawHeight + marginCompensation;
        if (listPlaceholderState.position === 'before') return { top: shift, bottom: 0 };
        if (listPlaceholderState.position === 'after') return { top: 0, bottom: shift };
        return { top: 0, bottom: 0 };
    }

    function getFolderCenterTargetInList(listContext, event, activeId = null, preferredFolderId = '') {
        if (!listContext?.listEl) return null;
        const listItems = getListItemsForContext(listContext.listEl, activeId)
            .filter(item => item.dataset.type === 'folder');
        if (!listItems.length) return null;
        const orderedItems = preferredFolderId
            ? listItems.slice().sort((a, b) => {
                if (a.dataset.id === preferredFolderId) return -1;
                if (b.dataset.id === preferredFolderId) return 1;
                return 0;
            })
            : listItems;
        for (const item of orderedItems) {
            const rect = item.getBoundingClientRect();
            const shift = getListPlaceholderShiftForTarget(listContext, item);
            const virtualTop = rect.top - shift.top;
            const virtualBottom = rect.bottom + shift.bottom;
            if (event.clientY < virtualTop || event.clientY > virtualBottom) continue;
            const virtualHeight = Math.max(1, virtualBottom - virtualTop);
            const centerBand = Math.max(6, virtualHeight * 0.18);
            if (event.clientY <= virtualTop + centerBand || event.clientY >= virtualBottom - centerBand) continue;
            if (isCenterDrop(event, item)
                || shift.top > 0
                || shift.bottom > 0
                || item.dataset.id === preferredFolderId) {
                return item;
            }
        }
        return null;
    }

    function getGridItemsForContext(gridEl, activeId = null) {
        if (!gridEl) return [];
        return Array.from(gridEl.querySelectorAll(':scope > .drag-item'))
            .filter(item => item.dataset.id !== activeId);
    }

    function getGridInsertionForEvent(gridEl, event, activeId, explicitTarget = null) {
        const gridItems = getGridItemsForContext(gridEl, activeId);
        if (!gridItems.length) return null;

        const target = explicitTarget
            && explicitTarget.closest('#grid') === gridEl
            && explicitTarget.dataset.id !== activeId
            ? explicitTarget
            : null;

        if (target) {
            const rect = target.getBoundingClientRect();
            return {
                target,
                position: event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
            };
        }

        const firstRect = gridItems[0].getBoundingClientRect();
        const lastRect = gridItems[gridItems.length - 1].getBoundingClientRect();
        if (event.clientY <= firstRect.top) {
            return { target: gridItems[0], position: 'before' };
        }
        if (event.clientY >= lastRect.bottom) {
            return { target: gridItems[gridItems.length - 1], position: 'after' };
        }

        let nearestItem = null;
        let nearestRect = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const item of gridItems) {
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = event.clientX - centerX;
            const dy = (event.clientY - centerY) * 1.2;
            const distance = dx * dx + dy * dy;
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestItem = item;
                nearestRect = rect;
            }
        }

        if (!nearestItem || !nearestRect) return null;
        return {
            target: nearestItem,
            position: event.clientX < nearestRect.left + nearestRect.width / 2 ? 'before' : 'after'
        };
    }

    function getListContextFromElement(listEl) {
        if (!listEl) return null;
        if (listEl.classList.contains('tree-children')) {
            return { listEl, parentId: listEl.dataset.parent || null };
        }
        if (listEl.classList.contains('sidebar-list')) {
            return { listEl, parentId: null };
        }
        return null;
    }

    function getPlaceholderInsertion(space, event) {
        if (gridPlaceholder.parentElement) {
            const info = { container: space.items, parentFolder: null };
            let insertIndex = info.container.length;
            if (gridPlaceholderState.target) {
                const targetIndex = info.container.findIndex(item => item.id === gridPlaceholderState.target.dataset.id);
                if (targetIndex !== -1) {
                    insertIndex = targetIndex + (gridPlaceholderState.position === 'after' ? 1 : 0);
                }
            }
            return { mode: 'grid', info, insertIndex, gridEl: gridPlaceholderState.gridEl || gridPlaceholder.parentElement };
        }

        if (!listPlaceholder.parentElement) return null;
        const listEl = listPlaceholderState.listEl || listPlaceholder.parentElement;
        if (!listEl) return null;
        const listContext = getListContextFromElement(listEl);
        if (!listContext) return null;
        const info = getContainerForListContext(space, listContext);
        if (!info || !info.container) return null;
        let insertIndex = info.container.length;
        if (listPlaceholderState.target) {
            const targetIndex = info.container.findIndex(item => item.id === listPlaceholderState.target.dataset.id);
            if (targetIndex !== -1) {
                insertIndex = targetIndex + (listPlaceholderState.position === 'after' ? 1 : 0);
            }
        }
        return { mode: 'list', info, insertIndex, listEl };
    }

    function getContainerForListContext(space, listContext) {
        if (!listContext) return null;
        if (listContext.parentId) {
            const parentFolder = getFolderById(space, listContext.parentId);
            if (!parentFolder) return null;
            return { container: parentFolder.items || [], parentFolder };
        }
        return { container: space.items, parentFolder: null };
    }

    function showDropIndicator(targetElement, event) {
        const rect = targetElement.getBoundingClientRect();
        if (targetElement.closest('.sidebar-list') || targetElement.closest('.tree-children')) {
            const edgePad = 6;
            const y = event.clientY - rect.top;
            let insertAfter = y > rect.height / 2;
            if (y < edgePad) insertAfter = false;
            if (y > rect.height - edgePad) insertAfter = true;
            showListDropIndicator(targetElement, insertAfter ? 'after' : 'before');
            return;
        }
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const useX = Math.abs(x - rect.width / 2) > Math.abs(y - rect.height / 2);
        const insertAfter = useX ? x > rect.width / 2 : y > rect.height / 2;
        if (useX) {
            const left = insertAfter ? rect.right : rect.left;
            dropIndicator.style.left = `${left - 1}px`;
            dropIndicator.style.top = `${rect.top + 8}px`;
            dropIndicator.style.width = '2px';
            dropIndicator.style.height = `${Math.max(16, rect.height - 16)}px`;
        } else {
            const top = insertAfter ? rect.bottom : rect.top;
            dropIndicator.style.left = `${rect.left + 8}px`;
            dropIndicator.style.top = `${top - 1}px`;
            dropIndicator.style.width = `${Math.max(16, rect.width - 16)}px`;
            dropIndicator.style.height = '2px';
        }
        dropIndicator.style.opacity = '1';
    }

    container.addEventListener('dragstart', (e) => {
        if (document.getElementById('folderModal').classList.contains('active')) return;
        if (e.target.closest('.tree-btn') || e.target.closest('.tree-menu') || e.target.closest('.tree-menu-btn')) {
            e.preventDefault();
            return;
        }
        const item = e.target.closest('.drag-item');
        if (item) {
            if (selectedIds.size > 0) {
                selectedIds.clear();
                selectionContext = { scope: 'space', folderId: null };
                updateSelectionUI();
            }
            nativeDragActive = true;
            lastDragPoint = { x: null, y: null };
            hoverFolderDropTargetId = null;
            draggedId = item.dataset.id;
            draggedType = item.dataset.type;
            pushDndDebug('dragstart.space', { id: draggedId || '', type: draggedType || '' });
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedId);
            if (draggedType === 'folder') {
                const folderContext = buildFolderSpaceCreateContext(draggedId, getActiveSpace()?.id || data.activeSpaceId || '');
                if (folderContext) {
                    e.dataTransfer.setData('text/airtab-folder', JSON.stringify(folderContext));
                    pendingSpaceCreateFromFolderContext = folderContext;
                    draggedFolderCreateContext = folderContext;
                } else {
                    draggedFolderCreateContext = null;
                }
            } else {
                draggedFolderCreateContext = null;
            }
            setSpaceDropMode(true);
            clearSpaceDropTarget();
            applyDragPreview(e, item);
            setTimeout(() => item.classList.add('dragging'), 0);
        }
    });

    container.addEventListener('dragend', (e) => {
        nativeDragActive = false;
        hoverFolderDropTargetId = null;
        clearActiveDragPreview();
        const item = e.target.closest('.drag-item');
        if (item) item.classList.remove('dragging');
        document.querySelectorAll('.drag-item').forEach(el => {
            el.classList.remove('drop-hint');
            el.classList.remove('folder-drop');
            el.classList.remove('drop-before');
            el.classList.remove('drop-after');
        });
        clearListPlaceholder();
        clearGridPlaceholder();
        hideDropIndicator();
        if (tryOpenSpaceCreateFromDraggedFolder(e, 'dragend.space')) {
            return;
        }
        const { x, y } = getDragPoint();
        const keepSpaceCreateState = !!(spaceAddIntentActive || isOverSpaceAddByPoint(x, y, 22));
        if (!keepSpaceCreateState) {
            if (spaceAddBtnEl) spaceAddBtnEl.classList.remove('drop-target');
            clearSpaceDropTarget();
            setSpaceDropMode(false);
        }
    });

    container.addEventListener('dragover', (e) => {
        if (!draggedId && !folderDraggedId) return;
        e.preventDefault();
        rememberDragPoint(e);
        const pointContext = getDropContextFromPoint(e);
        const target = e.target.closest('.drag-item') || pointContext.dropTarget;
        const listContext = getListContextFromEvent(e) || getListContextFromElement(pointContext.dropSidebarList);
        document.querySelectorAll('.drag-item').forEach(el => {
            el.classList.remove('drop-hint');
            el.classList.remove('folder-drop');
            el.classList.remove('drop-before');
            el.classList.remove('drop-after');
        });
        hideDropIndicator();
        const activeId = draggedId || folderDraggedId;
        let folderCenterTarget = null;
        if (target && target.dataset.id !== activeId && target.dataset.type === 'folder' && isCenterDrop(e, target)) {
            folderCenterTarget = target;
        } else {
            folderCenterTarget = getFolderCenterTargetInList(listContext, e, activeId, hoverFolderDropTargetId || '');
        }
        if (folderCenterTarget) {
            hoverFolderDropTargetId = folderCenterTarget.dataset.id || null;
            folderCenterTarget.classList.add('folder-drop');
            clearListPlaceholder();
            clearGridPlaceholder();
            return;
        }
        hoverFolderDropTargetId = null;
        if (listContext) {
            clearGridPlaceholder();
            const listItems = getListItemsForContext(listContext.listEl, activeId);
            const insertion = getListInsertionForEvent(listItems, e);
            showListPlaceholder(listContext, insertion);
            return;
        }
        clearListPlaceholder();
        const dropGrid = e.target.closest('#grid') || pointContext.dropGrid;
        if (dropGrid) {
            const insertion = getGridInsertionForEvent(dropGrid, e, activeId, target);
            showGridPlaceholder(dropGrid, insertion);
            return;
        }
        clearGridPlaceholder();
        if (target && target.dataset.id !== activeId) {
            showDropIndicator(target, e);
        }
    });

    document.querySelectorAll('.sidebar-add').forEach(addEl => {
        addEl.addEventListener('dragover', (e) => {
            if (!draggedId && !folderDraggedId) return;
            e.preventDefault();
            hideDropIndicator();
            clearGridPlaceholder();
            const sidebar = addEl.closest('.sidebar');
            const listEl = sidebar ? sidebar.querySelector('.sidebar-list') : null;
            if (!listEl) return;
            const activeId = draggedId || folderDraggedId;
            const listItems = getListItemsForContext(listEl, activeId);
            const lastItem = listItems[listItems.length - 1] || null;
            const insertion = lastItem ? { target: lastItem, position: 'after' } : null;
            showListPlaceholder({ listEl, parentId: null }, insertion);
        });
    });

    function getDropContextFromPoint(event) {
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        const underlying = elements.find(el => !el.closest('#folderModal') && (el.closest('.drag-item') || el.closest('#grid') || el.closest('.sidebar-list')));
        return {
            dropTarget: underlying ? underlying.closest('.drag-item') : null,
            dropGrid: underlying ? underlying.closest('#grid') : null,
            dropSidebarList: underlying ? underlying.closest('.sidebar-list') : null
        };
    }

    function getTargetContainerInfo(space, dropTarget) {
        if (!dropTarget) return null;
        const parentId = dropTarget.dataset.parent;
        let container = space.items;
        let parentFolder = null;
        if (parentId) {
            parentFolder = getFolderById(space, parentId);
            if (parentFolder) container = parentFolder.items || [];
        }
        const targetIndex = container.findIndex(item => item.id === dropTarget.dataset.id);
        return { container, parentFolder, targetIndex };
    }

    function handleFolderDrop(event, dropContext) {
        if (!folderDraggedId || !currentFolderContext) return;
        const space = getActiveSpace();
        const folder = getFolderById(space, currentFolderContext.folderId);
        if (!folder) return;
        const draggedIndex = folder.items.findIndex(item => item.id === folderDraggedId);
        if (draggedIndex === -1) return;
        const draggedItem = folder.items[draggedIndex];
        const removeFromSource = () => folder.items.splice(draggedIndex, 1)[0];

        let dropTarget = dropContext.dropTarget;
        const dropGrid = dropContext.dropGrid;
        let dropSidebarList = dropContext.dropSidebarList;
        const listContext = getListContextFromEvent(event) || getListContextFromElement(dropSidebarList);
        if (listContext?.listEl?.classList.contains('sidebar-list') && !dropSidebarList) {
            dropSidebarList = listContext.listEl;
        }
        const folderCenterTarget = getFolderCenterTargetInList(listContext, event, folderDraggedId, hoverFolderDropTargetId || '');
        if (folderCenterTarget) dropTarget = folderCenterTarget;
        const dropTargetInSidebar = dropTarget?.closest('.sidebar-list');
        const dropTargetInGrid = dropTarget?.closest('#grid');
        const folderDropIntent = !!(dropTarget
            && dropTarget.dataset.type === 'folder'
            && (isCenterDrop(event, dropTarget) || dropTarget.dataset.id === hoverFolderDropTargetId));

        const placeholderData = getPlaceholderInsertion(space, event);
        if (folderDropIntent) {
            const targetFolder = getFolderById(space, dropTarget.dataset.id);
            if (!targetFolder) return;
            if (targetFolder.id === folder.id) {
                const moved = removeFromSource();
                folder.items.push(moved);
            } else {
                if (isDescendantFolder(draggedItem, targetFolder.id)) return;
                const moved = removeFromSource();
                targetFolder.items = targetFolder.items || [];
                targetFolder.items.push(moved);
            }
        } else if (placeholderData) {
            const { info, insertIndex: rawIndex, listEl, mode } = placeholderData;
            if (draggedItem.type === 'folder' && info.parentFolder) {
                if (draggedItem.id === info.parentFolder.id) return;
                if (isDescendantFolder(draggedItem, info.parentFolder.id)) return;
            }
            const moved = removeFromSource();
            let insertIndex = rawIndex;
            if (info.container === folder.items && draggedIndex < insertIndex) insertIndex--;
            if (moved.type === 'link') moved.isCompact = mode === 'list';
            if (!info.parentFolder && mode === 'list') applySidebarPlacement(moved, listEl || null, null);
            info.container.splice(insertIndex, 0, moved);
        } else if (dropTarget) {
            const targetInfo = getTargetContainerInfo(space, dropTarget);
            if (!targetInfo || targetInfo.targetIndex === -1) return;
            const isFolderRow = dropTarget.dataset.type === 'folder';
            if (isFolderRow && (isCenterDrop(event, dropTarget) || dropTarget.dataset.id === hoverFolderDropTargetId)) {
                const targetFolder = getFolderById(space, dropTarget.dataset.id);
                if (!targetFolder) return;
                if (targetFolder.id === folder.id) {
                    removeFromSource();
                    folder.items.push(draggedItem);
                } else {
                    removeFromSource();
                    targetFolder.items = targetFolder.items || [];
                    targetFolder.items.push(draggedItem);
                }
                saveData();
                renderItems();
                renderFolderItems();
                hideDropIndicator();
                clearListPlaceholder();
                clearGridPlaceholder();
                return;
            }

            let insertIndex = getInsertIndexFromPointer(event, dropTarget, targetInfo.targetIndex);
            const moved = removeFromSource();
            if (targetInfo.container === folder.items && draggedIndex < insertIndex) insertIndex--;
            if (targetInfo.container === space.items) {
                moved.isCompact = dropTargetInSidebar ? true : dropTargetInGrid ? false : moved.isCompact;
                applySidebarPlacement(moved, dropSidebarList, dropTarget);
            } else {
                moved.isCompact = true;
            }
            targetInfo.container.splice(insertIndex, 0, moved);
        } else if (listContext) {
            const info = getContainerForListContext(space, listContext);
            if (!info || !info.container) return;
            if (draggedItem.type === 'folder' && info.parentFolder) {
                if (draggedItem.id === info.parentFolder.id) return;
                if (isDescendantFolder(draggedItem, info.parentFolder.id)) return;
            }
            const listItems = getListItemsForContext(listContext.listEl, folderDraggedId);
            const insertion = getListInsertionForEvent(listItems, event);
            let insertIndex = info.container.length;
            if (insertion) {
                const targetIndex = info.container.findIndex(item => item.id === insertion.target.dataset.id);
                if (targetIndex !== -1) insertIndex = targetIndex + (insertion.position === 'after' ? 1 : 0);
            }
            const moved = removeFromSource();
            if (info.container === folder.items && draggedIndex < insertIndex) insertIndex--;
            if (moved.type === 'link') moved.isCompact = true;
            if (!info.parentFolder) applySidebarPlacement(moved, listContext.listEl, null);
            info.container.splice(insertIndex, 0, moved);
        } else if (dropGrid || dropSidebarList) {
            const moved = removeFromSource();
            moved.isCompact = !!dropSidebarList;
            if (dropGrid) moved.isCompact = false;
            applySidebarPlacement(moved, dropSidebarList, null);
            space.items.push(moved);
        } else {
            const moved = removeFromSource();
            moved.isCompact = false;
            space.items.push(moved);
        }

        saveData();
        renderItems();
        renderFolderItems();
        hideDropIndicator();
        clearListPlaceholder();
        clearGridPlaceholder();
    }

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        rememberDragPoint(e);
        if (!draggedId && !folderDraggedId) return;

        if (folderDraggedId) {
            const pointContext = getDropContextFromPoint(e);
            const listContext = getListContextFromEvent(e) || getListContextFromElement(pointContext.dropSidebarList);
            const folderCenterTarget = getFolderCenterTargetInList(listContext, e, folderDraggedId, hoverFolderDropTargetId || '');
            handleFolderDrop(e, {
                dropTarget: e.target.closest('.drag-item') || pointContext.dropTarget || folderCenterTarget,
                dropGrid: e.target.closest('#grid') || pointContext.dropGrid,
                dropSidebarList: e.target.closest('.sidebar-list') || pointContext.dropSidebarList
            });
            clearListPlaceholder();
            clearGridPlaceholder();
            return;
        }

        const space = getActiveSpace();
        const pointContext = getDropContextFromPoint(e);
        let dropTarget = e.target.closest('.drag-item') || pointContext.dropTarget;
        let dropGrid = e.target.closest('#grid') || pointContext.dropGrid;
        let dropSidebarList = e.target.closest('.sidebar-list') || pointContext.dropSidebarList;
        const listContext = getListContextFromEvent(e) || getListContextFromElement(dropSidebarList);
        if (listContext?.listEl?.classList.contains('sidebar-list') && !dropSidebarList) {
            dropSidebarList = listContext.listEl;
        }
        const folderCenterTarget = getFolderCenterTargetInList(listContext, e, draggedId, hoverFolderDropTargetId || '');
        if (folderCenterTarget) dropTarget = folderCenterTarget;
        pushDndDebug('container.drop.enter', {
            draggedId: draggedId || '',
            draggedType: draggedType || '',
            targetId: dropTarget?.dataset?.id || '',
            inGrid: !!dropGrid,
            inList: !!dropSidebarList
        });
        const dropTargetInSidebar = dropTarget?.closest('.sidebar-list');
        const dropTargetInGrid = dropTarget?.closest('#grid');
        const folderDropIntent = !!(dropTarget
            && dropTarget.dataset.type === 'folder'
            && (isCenterDrop(e, dropTarget) || dropTarget.dataset.id === hoverFolderDropTargetId));

        const source = findItemLocation(space, draggedId);
        if (!source) {
            pushDndDebug('container.drop.source-miss', { draggedId: draggedId || '' });
            return;
        }
        const draggedItem = source.item;

        const removeFromSource = () => {
            return source.container.splice(source.index, 1)[0];
        };

        const placeholderData = getPlaceholderInsertion(space, e);
        if (folderDropIntent) {
            const targetFolder = getFolderById(space, dropTarget.dataset.id);
            if (!targetFolder) return;
            if (draggedItem.type === 'folder') {
                if (draggedItem.id === targetFolder.id) return;
                if (isDescendantFolder(draggedItem, targetFolder.id)) return;
            }
            const moved = removeFromSource();
            targetFolder.items = targetFolder.items || [];
            targetFolder.items.push(moved);
        } else if (placeholderData) {
            const { info, insertIndex: rawIndex, listEl, mode } = placeholderData;
            if (draggedItem.type === 'folder' && info.parentFolder) {
                if (draggedItem.id === info.parentFolder.id) return;
                if (isDescendantFolder(draggedItem, info.parentFolder.id)) return;
            }
            const moved = removeFromSource();
            let insertIndex = rawIndex;
            if (source.container === info.container && source.index < insertIndex) insertIndex--;
            if (moved.type === 'link') moved.isCompact = mode === 'list';
            if (!info.parentFolder && mode === 'list') applySidebarPlacement(moved, listEl || null, null);
            info.container.splice(insertIndex, 0, moved);
        } else if (dropTarget && dropTarget.dataset.id !== draggedId) {
            const targetInfo = getTargetContainerInfo(space, dropTarget);
            if (!targetInfo || targetInfo.targetIndex === -1) return;
            const isFolderRow = dropTarget.dataset.type === 'folder';

            if (isFolderRow && (isCenterDrop(e, dropTarget) || dropTarget.dataset.id === hoverFolderDropTargetId)) {
                const targetFolder = getFolderById(space, dropTarget.dataset.id);
                if (!targetFolder) return;
                if (draggedItem.type === 'folder') {
                    if (draggedItem.id === targetFolder.id) return;
                    if (isDescendantFolder(draggedItem, targetFolder.id)) return;
                }
                const moved = removeFromSource();
                targetFolder.items = targetFolder.items || [];
                targetFolder.items.push(moved);
                saveData();
                renderItems();
                hideDropIndicator();
                clearListPlaceholder();
                clearGridPlaceholder();
                return;
            }

            const moved = removeFromSource();
            let insertIndex = getInsertIndexFromPointer(e, dropTarget, targetInfo.targetIndex);
            if (source.container === targetInfo.container && source.index < insertIndex) insertIndex--;

            if (moved.type === 'link') {
                if (targetInfo.container === space.items) {
                    if (dropTargetInSidebar) moved.isCompact = true;
                    if (dropTargetInGrid) moved.isCompact = false;
                } else {
                    moved.isCompact = true;
                }
            }
            if (targetInfo.container === space.items) {
                applySidebarPlacement(moved, null, dropTarget);
            }
            targetInfo.container.splice(insertIndex, 0, moved);
        } else if (listContext) {
            const info = getContainerForListContext(space, listContext);
            if (!info || !info.container) return;
            if (draggedItem.type === 'folder' && info.parentFolder) {
                if (draggedItem.id === info.parentFolder.id) return;
                if (isDescendantFolder(draggedItem, info.parentFolder.id)) return;
            }
            const moved = removeFromSource();
            const listItems = getListItemsForContext(listContext.listEl, draggedId);
            const insertion = getListInsertionForEvent(listItems, e);
            let insertIndex = info.container.length;
            if (insertion) {
                const targetIndex = info.container.findIndex(item => item.id === insertion.target.dataset.id);
                if (targetIndex !== -1) insertIndex = targetIndex + (insertion.position === 'after' ? 1 : 0);
            }
            if (source.container === info.container && source.index < insertIndex) insertIndex--;
            if (moved.type === 'link') moved.isCompact = true;
            if (!info.parentFolder) applySidebarPlacement(moved, listContext.listEl, null);
            info.container.splice(insertIndex, 0, moved);
        } else if (dropGrid || dropSidebarList) {
            const moved = removeFromSource();
            if (moved.type === 'link') moved.isCompact = !!dropSidebarList;
            if (dropGrid) moved.isCompact = false;
            if (dropSidebarList) applySidebarPlacement(moved, dropSidebarList, null);
            space.items.push(moved);
        } else {
            pushDndDebug('container.drop.no-target', { draggedType: draggedItem?.type || '' });
            return;
        }

        saveData();
        renderItems();
        pushDndDebug('container.drop.applied', {
            draggedId: draggedId || '',
            draggedType: draggedItem?.type || ''
        });
        hideDropIndicator();
        clearListPlaceholder();
        clearGridPlaceholder();
    });

    const folderGrid = document.getElementById('folderGrid');
    const folderModal = document.getElementById('folderModal');

    folderGrid.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.drag-item');
        if (item) {
            nativeDragActive = true;
            lastDragPoint = { x: null, y: null };
            draggedFolderCreateContext = null;
            folderDraggedId = item.dataset.id;
            pushDndDebug('dragstart.folderModal', { id: folderDraggedId || '' });
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', folderDraggedId);
            document.body.classList.add('dragging-from-folder');
            setSpaceDropMode(true);
            clearSpaceDropTarget();
            applyDragPreview(e, item);
            setTimeout(() => item.classList.add('dragging'), 0);
        }
    });

    folderGrid.addEventListener('dragend', (e) => {
        nativeDragActive = false;
        hoverFolderDropTargetId = null;
        clearActiveDragPreview();
        const item = e.target.closest('.drag-item');
        if (item) item.classList.remove('dragging');
        folderDraggedId = null;
        document.body.classList.remove('dragging-from-folder');
        document.querySelectorAll('.drag-item').forEach(el => {
            el.classList.remove('drop-hint');
            el.classList.remove('folder-drop');
            el.classList.remove('drop-before');
            el.classList.remove('drop-after');
        });
        clearListPlaceholder();
        clearGridPlaceholder();
        hideDropIndicator();
        if (spaceAddBtnEl) spaceAddBtnEl.classList.remove('drop-target');
        clearSpaceDropTarget();
        setSpaceDropMode(false);
    });

    folderGrid.addEventListener('dragover', (e) => {
        if (!folderDraggedId) return;
        e.preventDefault();
    });

    folderGrid.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!folderDraggedId || !currentFolderContext) return;
        const space = getActiveSpace();
        const folder = space.items.find(item => item.id === currentFolderContext.folderId && item.type === 'folder');
        if (!folder) return;

        const target = e.target.closest('.drag-item');
        if (!target || target.dataset.id === folderDraggedId) return;
        const draggedIndex = folder.items.findIndex(item => item.id === folderDraggedId);
        const targetIndex = folder.items.findIndex(item => item.id === target.dataset.id);
        if (draggedIndex === -1 || targetIndex === -1) return;

        let insertIndex = getInsertIndexFromPointer(e, target, targetIndex);
        if (draggedIndex < insertIndex) insertIndex--;
        const [item] = folder.items.splice(draggedIndex, 1);
        folder.items.splice(insertIndex, 0, item);

        saveData();
        renderFolderItems();
        clearListPlaceholder();
        clearGridPlaceholder();
    });

    folderModal.addEventListener('dragover', (e) => {
        if (!folderDraggedId) return;
        updateSpaceDropTargetFromEvent(e);
        if (e.target.closest('#folderGrid')) return;
        e.preventDefault();
    });

    folderModal.addEventListener('drop', (e) => {
        if (!folderDraggedId) return;
        if (e.target.closest('#folderGrid')) return;
        e.preventDefault();
        const targetSpaceId = updateSpaceDropTargetFromEvent(e);
        if (targetSpaceId) {
            moveDraggedPayloadToSpace(targetSpaceId);
            releaseDragState();
            return;
        }
        handleFolderDrop(e, getDropContextFromPoint(e));
    });

    document.getElementById('currentEngineBtn').addEventListener('click', () => {
        document.getElementById('engineListMenu').classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.engine-dropdown-container')) {
            document.getElementById('engineListMenu').classList.remove('active');
        }
    });

    document.getElementById('engineListMenu').addEventListener('click', (e) => {
        const btn = e.target.closest('.engine-list-item');
        if (btn) {
            activeEngineId = btn.dataset.id;
            localStorage.setItem('myActiveEngine', activeEngineId);
            renderSearchDropdown();
            document.getElementById('engineListMenu').classList.remove('active');
            document.getElementById('searchInput').focus();
        }
    });

    document.getElementById('searchForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('searchInput').value.trim();
        const activeEngine = engines.find(e => e.id == activeEngineId) || engines[0];
        if (query && activeEngine) window.location.href = activeEngine.url + encodeURIComponent(query);
    });

    container.addEventListener('click', (e) => {
        reconcileSelectionWithDOM();
        const addSplit = e.target.closest('.compact-add-split');
        if (addSplit && !e.target.closest('[data-add]')) {
            const rect = addSplit.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
            const forceType = ratio > 0.7 ? 'folder' : 'link';
            const sidebar = addSplit.closest('.sidebar');
            const targetSidebar = sidebar?.classList.contains('right') ? 'right' : 'left';
            if (forceType === 'folder') {
                createQuickFolder(targetSidebar);
                return;
            }
            openItemModalForNew('compact', 'space', forceType, targetSidebar);
            return;
        }
        if (e.target.closest('.sidebar-list')) return;
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            const id = editBtn.dataset.id;
            openItemModalForEdit(id, 'space');
            return;
        }

        const item = e.target.closest('.drag-item');
        const selectionActive = selectedIds.size > 0;
        const isModifier = isSelectionModifierActive(e);
        if (item && selectionActive && !isModifier) {
            const linkAnchor = e.target.closest('a');
            if (linkAnchor) {
                selectedIds.clear();
                selectionContext = { scope: 'space', folderId: null };
                updateSelectionUI();
                return;
            }
        }
        if ((isModifier || selectionActive) && item) {
            e.preventDefault();
            toggleSelectionForItem(item, 'space', null);
            return;
        }

        const addBtn = e.target.closest('[data-add]');
        if (addBtn) {
            const sidebar = addBtn.closest('.sidebar');
            const targetSidebar = sidebar?.classList.contains('right') ? 'right' : 'left';
            const forceType = addBtn.dataset.forceType || (addBtn.closest('#grid') ? 'link' : null);
            if (forceType === 'folder' && addBtn.closest('.sidebar-add')) {
                createQuickFolder(targetSidebar);
                return;
            }
            openItemModalForNew(addBtn.dataset.add, 'space', forceType, targetSidebar);
            return;
        }

        if (item && item.dataset.type === 'link' && !isModifier && !selectionActive && item.closest('#grid') && !e.target.closest('a')) {
            const anchor = item.querySelector('a');
            if (anchor) anchor.click();
        }
    });

    function handleSidebarListClick(e) {
        reconcileSelectionWithDOM();
        const menuBtn = e.target.closest('.tree-menu-btn');
        if (menuBtn) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            const folderId = menuBtn.closest('.tree-folder')?.dataset.id;
            if (!folderId) return;
            const action = menuBtn.dataset.action;
            if (action === 'open-tabs') {
                openFolderInTabs(folderId);
                activeFolderMenuId = null;
                renderSidebars();
                return;
            }
            if (action === 'edit') {
                openFolderEditModal(folderId);
                activeFolderMenuId = null;
                renderSidebars();
                return;
            }
            if (action === 'delete') {
                const space = getActiveSpace();
                const folder = getFolderById(space, folderId);
                const total = folder ? countFolderItems(folder) : 0;
                const title = folder?.name ? `«${folder.name}»` : trKey('thisFolder', 'эту папку');
                const ok = total > 0
                    ? confirm(
                        trKey('deleteFolderWithItems', 'Удалить папку {title} и {count} элементов?', {
                            title,
                            count: total
                        })
                    )
                    : confirm(trKey('deleteFolderOnly', 'Удалить папку {title}?', { title }));
                if (!ok) return;
                const location = findItemLocation(space, folderId);
                if (location) {
                    location.container.splice(location.index, 1);
                    saveData();
                    renderItems();
                }
                activeFolderMenuId = null;
                return;
            }
        }

        if (e.target.closest('.tree-menu')) return;

        const menuToggle = e.target.closest('.tree-btn');
        if (menuToggle?.dataset.action === 'menu') {
            e.preventDefault();
            e.stopPropagation();
            const folderId = menuToggle.closest('.tree-folder')?.dataset.id;
            if (folderId) toggleFolderMenu(folderId);
            return;
        }

        const folderRow = e.target.closest('.tree-folder');
        const childRow = e.target.closest('.tree-child');

        if (folderRow) {
            const folderId = folderRow.dataset.id;
            const action = e.target.closest('.folder-toggle')?.dataset.action;
            const selectionActive = selectedIds.size > 0;
            const isModifier = isSelectionModifierActive(e);

            if (action === 'toggle') {
                e.preventDefault();
                toggleFolderCollapsed(folderId);
                return;
            }
            if (isModifier || selectionActive) {
                e.preventDefault();
                toggleSelectionForItem(folderRow, 'space', null);
                return;
            }
            toggleFolderCollapsed(folderId);
            return;
        }

        if (childRow) {
            const folderId = childRow.dataset.parent;
            setCurrentFolderContext(folderId);
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                e.preventDefault();
                openItemModalForEdit(editBtn.dataset.id, 'folder');
                return;
            }
            const selectionActive = selectedIds.size > 0;
            const isModifier = isSelectionModifierActive(e);
            if (selectionActive && !isModifier && e.target.closest('a')) {
                selectedIds.clear();
                selectionContext = { scope: 'space', folderId: null };
                updateSelectionUI();
                return;
            }
            if (isModifier || selectionActive) {
                e.preventDefault();
                toggleSelectionForItem(childRow, 'folder', folderId);
                return;
            }
            if (!isModifier && !selectionActive && !e.target.closest('a')) {
                const anchor = childRow.querySelector('a');
                if (anchor) anchor.click();
            }
            return;
        }

        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            const id = editBtn.dataset.id;
            openItemModalForEdit(id, 'space');
            return;
        }

        const item = e.target.closest('.drag-item');
        if (!item) return;
        const selectionActive = selectedIds.size > 0;
        const isModifier = isSelectionModifierActive(e);
        if (isModifier || selectionActive) {
            e.preventDefault();
            toggleSelectionForItem(item, 'space', null);
            return;
        }
        if (item.dataset.type === 'link' && !e.target.closest('a')) {
            const anchor = item.querySelector('a');
            if (anchor) anchor.click();
        }
    }

    document.getElementById('sidebarListLeft').addEventListener('click', handleSidebarListClick);
    document.getElementById('sidebarListRight').addEventListener('click', handleSidebarListClick);

    document.addEventListener('click', (e) => {
        if (!activeFolderMenuId) return;
        if (e.target.closest('.tree-menu') || e.target.closest('.tree-btn')) return;
        activeFolderMenuId = null;
        renderSidebars();
    });

    folderGrid.addEventListener('click', (e) => {
        reconcileSelectionWithDOM();
        const moveBtn = e.target.closest('.move-out-btn');
        if (moveBtn) {
            e.preventDefault();
            moveItemOutDirect(moveBtn.dataset.id);
            return;
        }
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            const id = editBtn.dataset.id;
            openItemModalForEdit(id, 'folder');
            return;
        }

        const item = e.target.closest('.drag-item');
        const selectionActive = selectedIds.size > 0;
        const isModifier = isSelectionModifierActive(e);
        if ((isModifier || selectionActive) && item) {
            e.preventDefault();
            toggleSelectionForItem(item, 'folder', currentFolderContext?.folderId || null);
            return;
        }
        if (item && item.dataset.type === 'link' && !isModifier && !selectionActive && !e.target.closest('a')) {
            const anchor = item.querySelector('a');
            if (anchor) anchor.click();
        }
    });

    document.getElementById('folderTitleDisplay').addEventListener('dblclick', () => {
        startFolderTitleEdit();
    });
    document.getElementById('folderTitleSave').addEventListener('click', saveFolderTitleEdit);
    document.getElementById('folderTitleCancel').addEventListener('click', cancelFolderTitleEdit);
    document.getElementById('folderModalNameInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveFolderTitleEdit();
        if (e.key === 'Escape') cancelFolderTitleEdit();
    });
    document.getElementById('folderViewToggle').addEventListener('click', (e) => {
        const btn = e.target.closest('.view-btn');
        if (btn) setFolderView(btn.dataset.view);
    });

    document.getElementById('clearSelectionBtn').addEventListener('click', () => {
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
        renderItems();
    });

    document.getElementById('openSelectedBtn').addEventListener('click', openSelectedInTabs);
    document.getElementById('folderOpenSelectedBtn').addEventListener('click', openSelectedInTabs);
    document.getElementById('groupSelectedBtn')?.addEventListener('click', createFolderFromSelection);
    document.getElementById('folderGroupSelectedBtn')?.addEventListener('click', createFolderFromSelection);
    document.getElementById('deleteSelectedBtn')?.addEventListener('click', deleteSelectionItems);
    document.getElementById('folderDeleteSelectedBtn')?.addEventListener('click', deleteSelectionItems);
    document.getElementById('folderClearSelectionBtn').addEventListener('click', () => {
        selectedIds.clear();
        selectionContext = { scope: 'space', folderId: null };
        updateSelectionUI();
        renderItems();
        renderFolderItems();
    });

    document.getElementById('btnCancelItem').addEventListener('click', closeItemModal);
    document.getElementById('btnSaveItem').addEventListener('click', saveItemFromModal);
    document.getElementById('btnDeleteItem').addEventListener('click', deleteItemFromModal);
    document.getElementById('btnMoveOut').addEventListener('click', moveItemOutOfFolder);

    document.getElementById('itemTypeRow').addEventListener('click', (e) => {
        const btn = e.target.closest('.segmented-btn');
        if (btn) setItemType(btn.dataset.itemType);
    });

    document.getElementById('spaceEmojiBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEmojiPopover(document.getElementById('spaceEmojiBtn'));
    });

    document.getElementById('folderEmojiBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEmojiPopover(document.getElementById('folderEmojiBtn'));
    });

    document.getElementById('folderModalEmojiBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEmojiPopover(document.getElementById('folderModalEmojiBtn'));
    });

    document.getElementById('folderEditEmojiBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEmojiPopover(document.getElementById('folderEditEmojiBtn'));
    });

    document.getElementById('folderEditName').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        saveFolderEditFromModal();
    });

    emojiGrid.addEventListener('click', (e) => {
        const option = e.target.closest('.emoji-option');
        if (option && emojiTarget) {
            setEmoji(emojiTarget, option.dataset.emoji);
            closeEmojiPopover();
        }
    });

    emojiClearBtn.addEventListener('click', () => {
        if (!emojiTarget) return;
        setEmoji(emojiTarget, '');
        closeEmojiPopover();
    });

    emojiPopover.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    emojiPopover.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    emojiCategoriesEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.emoji-cat-btn');
        if (btn) {
            emojiFilter.category = btn.dataset.category;
            renderEmojiCategories();
            renderEmojiGrid();
        }
    });

    emojiSearch.addEventListener('input', (e) => {
        emojiFilter.query = e.target.value || '';
        renderEmojiGrid();
    });

    document.addEventListener('click', (e) => {
        if (emojiPopover.style.display === 'block' && !emojiPopover.contains(e.target) && !e.target.classList.contains('emoji-btn')) {
            closeEmojiPopover();
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar')) return;
        if (activeFolderMenuId) {
            activeFolderMenuId = null;
            renderSidebars();
        }
    });

    window.addEventListener('resize', () => {
        closeEmojiPopover();
    });

    document.getElementById('btnAddFolderLink').addEventListener('click', () => {
        const space = getActiveSpace();
        const folder = currentFolderContext ? getFolderById(space, currentFolderContext.folderId) : null;
        const targetSidebar = folder?.sidebar || 'left';
        openItemModalForNew('square', 'folder', null, targetSidebar);
    });

    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.modal-close');
        if (closeBtn) {
            const id = closeBtn.dataset.close;
            if (id === 'itemModal') closeItemModal();
            else if (id === 'folderModal') closeFolderModal();
            else closeModal(id);
        }
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) {
                if (modal.id === 'itemModal') closeItemModal();
                else if (modal.id === 'folderModal') closeFolderModal();
                else closeModal(modal.id);
            }
        });
    });

    const mainSettingsBtn = document.getElementById('mainSettingsBtn');
    if (mainSettingsBtn) {
        mainSettingsBtn.addEventListener('click', () => {
            const bgLightValue = getThemeBackground('light');
            const bgDarkValue = getThemeBackground('dark');
            document.getElementById('bgInputLight').value = bgLightValue;
            if (bgLightValue.startsWith('#')) document.getElementById('bgColorPickerLight').value = bgLightValue.substring(0,7);

            document.getElementById('bgInputDark').value = bgDarkValue;
            if (bgDarkValue.startsWith('#')) document.getElementById('bgColorPickerDark').value = bgDarkValue.substring(0,7);

            const performanceModeSelect = document.getElementById('performanceModeSelect');
            if (performanceModeSelect) performanceModeSelect.value = performanceMode;
            renderEngineSettingsList();
            renderSpaceSettingsList();
            setSettingsTab(settingsTab);
            openModal('settingsModal');
        });
    }

    const quickOptionsBtn = document.getElementById('quickOptionsBtn');
    if (quickOptionsBtn) {
        quickOptionsBtn.addEventListener('click', () => {
            window.location.href = new URL('options/', window.location.href).toString();
        });
    }

    const mobileCommandBtn = document.getElementById('mobileCommandBtn');
    if (mobileCommandBtn) {
        mobileCommandBtn.addEventListener('click', () => {
            const nextState = !mobileCommandMode;
            setMobileCommandMode(nextState, { clearSelection: !nextState });
        });
    }

    document.getElementById('settingsTabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (btn) setSettingsTab(btn.dataset.tab);
    });

    async function persistPendingLocalThemeBackground(theme, value) {
        if (!isThemeLocalBgToken(theme, value)) {
            pendingLocalThemeHandles[theme] = null;
            return;
        }
        const pendingHandle = pendingLocalThemeHandles[theme];
        if (pendingHandle) {
            await saveLocalThemeHandle(theme, pendingHandle);
            await setLocalThemeBackgroundFromHandle(theme, pendingHandle);
            pendingLocalThemeHandles[theme] = null;
            return;
        }
        const storedHandle = await getStoredLocalThemeHandle(theme);
        if (storedHandle) {
            await setLocalThemeBackgroundFromHandle(theme, storedHandle);
        }
    }

    document.getElementById('btnSaveSettings').addEventListener('click', async () => {
        const newBgLight = document.getElementById('bgInputLight').value.trim();
        const newBgDark = document.getElementById('bgInputDark').value.trim();

        if (newBgLight.startsWith('data:image/') || newBgDark.startsWith('data:image/')) {
            alert(trKey('dataUrlDisabled', 'Data URL для фона отключён. Используйте URL/цвет или привязку локального файла.'));
            return;
        }

        if (newBgLight || newBgDark) {
            try {
                if (newBgLight) {
                    setThemeBackground('light', newBgLight);
                    await persistPendingLocalThemeBackground('light', newBgLight);
                }
                if (newBgDark) {
                    setThemeBackground('dark', newBgDark);
                    await persistPendingLocalThemeBackground('dark', newBgDark);
                }
                const space = getActiveSpace();
                if (!space.bg) applyCurrentTheme();
            } catch (e) {
                alert(trKey('bgApplyFailed', 'Ошибка: не удалось применить выбранный фон.'));
            }
        }

        const performanceModeSelect = document.getElementById('performanceModeSelect');
        const nextPerformanceMode = performanceModeSelect ? performanceModeSelect.value : 'balanced';
        performanceMode = nextPerformanceMode === 'eco' ? 'eco' : 'balanced';
        localStorage.setItem('airtabPerformanceMode', performanceMode);
        applyPerformanceMode();
        closeModal('settingsModal');
    });

    ['Light', 'Dark'].forEach(theme => {
        document.getElementById(`bgInput${theme}`).addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
                document.getElementById(`bgColorPicker${theme}`).value = val;
            }
        });
        document.getElementById(`bgColorPicker${theme}`).addEventListener('input', (e) => {
            document.getElementById(`bgInput${theme}`).value = e.target.value;
        });
    });

    function pickFileViaInput({ accept = '', multiple = false } = {}) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.multiple = !!multiple;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            input.style.pointerEvents = 'none';
            input.style.width = '1px';
            input.style.height = '1px';
            document.body.appendChild(input);
            input.addEventListener('change', () => {
                const files = Array.from(input.files || []);
                input.remove();
                resolve(files);
            }, { once: true });
            input.click();
        });
    }

    async function pickLocalThemeBackground(theme) {
        if (typeof window.showOpenFilePicker !== 'function') {
            try {
                const [file] = await pickFileViaInput({ accept: 'image/*', multiple: false });
                if (!file) return;
                pendingLocalThemeHandles[theme] = null;
                await deleteLocalThemeHandle(theme);
                const fallbackBlob = await buildThemeFallbackBlob(file);
                await saveLocalThemeFallbackBlob(theme, fallbackBlob || file);
                const labelTheme = theme === 'light' ? 'Light' : 'Dark';
                document.getElementById(`bgInput${labelTheme}`).value = getLocalBgToken(theme);
                alert(trKey('localBgSavedFallback', 'Локальный фон сохранён в fallback-режиме.'));
            } catch (error) {
                alert(trKey('localFileAttachFailed', 'Не удалось привязать локальный файл.'));
            }
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
                return;
            }
            pendingLocalThemeHandles[theme] = handle;
            const labelTheme = theme === 'light' ? 'Light' : 'Dark';
            document.getElementById(`bgInput${labelTheme}`).value = getLocalBgToken(theme);
        } catch (error) {
            if (error?.name === 'AbortError') return;
            alert(trKey('localFileAttachFailed', 'Не удалось привязать локальный файл.'));
        }
    }

    document.getElementById('bgPickLocalLight').addEventListener('click', () => {
        pickLocalThemeBackground('light');
    });
    document.getElementById('bgPickLocalDark').addEventListener('click', () => {
        pickLocalThemeBackground('dark');
    });

    document.getElementById('spaceBgInput').addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
            document.getElementById('spaceBgColor').value = val;
        }
    });
    document.getElementById('spaceBgColor').addEventListener('input', (e) => {
        document.getElementById('spaceBgInput').value = e.target.value;
    });
    document.getElementById('spaceBgFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const status = document.getElementById('spaceBgStatus');
        status.innerText = trKey('spaceBgReading', 'Чтение файла...');
        try {
            const { dataUrl, optimized } = await readBackgroundDataUrl(file);
            document.getElementById('spaceBgInput').value = dataUrl;
            status.innerText = optimized
                ? trKey('spaceBgReadyOptimized', 'Файл готов (оптимизирован для меньшего расхода памяти).')
                : trKey('spaceBgReady', 'Файл готов к применению!');
        } catch (error) {
            status.innerText = trKey('spaceBgReadFailed', 'Не удалось прочитать файл.');
        }
    });

    document.getElementById('engineSettingsList').addEventListener('click', (e) => {
        const moveBtn = e.target.closest('.move-btn');
        if (moveBtn) {
            const index = Number(moveBtn.dataset.index);
            const dir = moveBtn.dataset.action === 'up' ? -1 : 1;
            const newIndex = index + dir;
            if (Number.isNaN(index) || newIndex < 0 || newIndex >= engines.length) return;
            const [moved] = engines.splice(index, 1);
            engines.splice(newIndex, 0, moved);
            localStorage.setItem('myEngines', JSON.stringify(engines));
            renderEngineSettingsList();
            renderSearchDropdown();
            return;
        }
        const editBtn = e.target.closest('.edit-engine-btn');
        if (editBtn) {
            const index = Number(editBtn.dataset.index);
            document.getElementById('engineModalTitle').innerText = trKey('edit', 'Редактировать');
            document.getElementById('btnDeleteEngine').style.display = "block";
            document.getElementById('editEngineIndex').value = index;
            document.getElementById('engineName').value = engines[index].name;
            document.getElementById('engineUrl').value = engines[index].url;
            document.getElementById('engineIcon').value = engines[index].icon;
            openModal('engineEditModal');
        }
    });

    document.getElementById('btnAddEngineModal').addEventListener('click', () => {
        document.getElementById('engineModalTitle').innerText = trKey('addSearchEngine', 'Добавить поисковик');
        document.getElementById('btnDeleteEngine').style.display = "none";
        document.getElementById('editEngineIndex').value = "";
        document.getElementById('engineName').value = "";
        document.getElementById('engineUrl').value = "";
        document.getElementById('engineIcon').value = "";
        openModal('engineEditModal');
    });

    document.getElementById('btnCancelEngine').addEventListener('click', () => closeModal('engineEditModal'));

    document.getElementById('btnSaveEngine').addEventListener('click', () => {
        const index = document.getElementById('editEngineIndex').value;
        const name = document.getElementById('engineName').value.trim();
        const url = document.getElementById('engineUrl').value.trim();
        const icon = document.getElementById('engineIcon').value.trim();
        if (name && url && icon) {
            const newEng = { id: Date.now(), name, url, icon };
            if (index !== "") engines[index] = newEng;
            else engines.push(newEng);
            localStorage.setItem('myEngines', JSON.stringify(engines));
            renderEngineSettingsList();
            renderSearchDropdown();
            closeModal('engineEditModal');
        }
    });

    document.getElementById('btnDeleteEngine').addEventListener('click', () => {
        const index = document.getElementById('editEngineIndex').value;
        if (index !== "" && engines.length > 1) {
            engines.splice(index, 1);
            localStorage.setItem('myEngines', JSON.stringify(engines));
            renderEngineSettingsList();
            renderSearchDropdown();
            closeModal('engineEditModal');
        } else if (engines.length <= 1) {
            alert(trKey('atLeastOneEngine', 'Должен остаться хотя бы один поисковик!'));
        }
    });

    document.getElementById('spaceAddBtn').addEventListener('click', () => openSpaceModal(null, true));

    spaceAddBtnEl?.addEventListener('dragover', (e) => {
        if (isSpaceReorderActive()) return;
        rememberDragPoint(e);
        const folderContext = resolveSpaceCreateFolderContext(e);
        if (!folderContext) return;
        e.preventDefault();
        e.stopPropagation();
        const wasArmed = spaceAddBtnEl.classList.contains('drop-target');
        pendingSpaceCreateFromFolderContext = folderContext;
        spaceAddIntentActive = true;
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        spaceAddBtnEl.classList.add('drop-target');
        if (!wasArmed) {
            pushDndDebug('spaceAdd.dragover.arm', {
                folderId: folderContext.folderId || '',
                sourceSpaceId: folderContext.sourceSpaceId || ''
            });
        }
    });

    spaceAddBtnEl?.addEventListener('dragleave', (e) => {
        if (!isDragTransferActive()) return;
        rememberDragPoint(e);
        const { x, y } = getDragPoint(e);
        const stillOverAdd = isOverSpaceAddByPoint(x, y, 12);
        if (stillOverAdd) return;
        if (spaceAddBtnEl.contains(e.relatedTarget)) return;
        spaceAddBtnEl.classList.remove('drop-target');
        pushDndDebug('spaceAdd.dragleave.disarm');
    });

    spaceAddBtnEl?.addEventListener('drop', (e) => {
        if (isSpaceReorderActive()) return;
        rememberDragPoint(e);
        const folderContext = resolveSpaceCreateFolderContext(e) || draggedFolderCreateContext;
        pushDndDebug('spaceAdd.drop', {
            hasCtx: !!folderContext,
            folderId: folderContext?.folderId || '',
            dragActive: isDragTransferActive()
        });
        if (tryOpenSpaceCreateFromDraggedFolder(e, 'spaceAdd.drop')) return;
        spaceAddBtnEl.classList.remove('drop-target');
    });

    document.getElementById('btnCancelSpace').addEventListener('click', () => closeModal('spaceModal'));
    document.getElementById('btnSaveSpace').addEventListener('click', saveSpaceFromModal);
    document.getElementById('btnDeleteSpace').addEventListener('click', deleteSpaceFromModal);

    const folderGradientFromInput = document.getElementById('folderGradientFrom');
    const folderGradientToInput = document.getElementById('folderGradientTo');
    const folderGradientAngleInput = document.getElementById('folderGradientAngle');
    const folderGradientPresetsEl = document.getElementById('folderGradientPresets');

    const refreshFolderGradientEditor = (rerenderPresets = true) => {
        applyFolderGradientEditor(
            folderGradientFromInput.value,
            folderGradientToInput.value,
            folderGradientAngleInput.value,
            rerenderPresets
        );
    };

    folderGradientFromInput.addEventListener('input', () => refreshFolderGradientEditor(true));
    folderGradientToInput.addEventListener('input', () => refreshFolderGradientEditor(true));
    folderGradientAngleInput.addEventListener('input', () => refreshFolderGradientEditor(true));

    folderGradientPresetsEl.addEventListener('click', (e) => {
        const presetBtn = e.target.closest('.gradient-preset-btn');
        if (!presetBtn) return;
        const presetIndex = Number(presetBtn.dataset.index);
        const preset = folderGradientPresets[presetIndex];
        if (!preset) return;
        applyFolderGradientEditor(preset.from, preset.to, preset.angle, true);
    });

    document.getElementById('btnGradientSwap').addEventListener('click', () => {
        const currentFrom = folderGradientFromInput.value;
        const currentTo = folderGradientToInput.value;
        applyFolderGradientEditor(currentTo, currentFrom, folderGradientAngleInput.value, true);
    });

    document.getElementById('btnSaveFolderGradient').addEventListener('click', saveFolderEditFromModal);
    document.getElementById('btnResetFolderGradient').addEventListener('click', resetFolderGradientEditor);
    document.getElementById('btnCancelFolderGradient').addEventListener('click', () => closeModal('folderGradientModal'));

    document.getElementById('spacePrevBtn').addEventListener('click', () => handleSpaceSwitch(-1));
    document.getElementById('spaceNextBtn').addEventListener('click', () => handleSpaceSwitch(1));

    spacesStripEl?.addEventListener('dragstart', (e) => {
        const pill = e.target.closest('.space-pill');
        if (!pill || isDragTransferActive()) return;
        nativeDragActive = true;
        lastDragPoint = { x: null, y: null };
        draggedSpaceId = pill.dataset.id || null;
        if (!draggedSpaceId) return;
        setSpaceReorderMode(true);
        document.body.classList.toggle('space-trash-disabled', !canDeleteDraggedSpace());
        clearSpaceReorderPlaceholder();
        clearSpaceDropTarget();
        if (spaceAddBtnEl) spaceAddBtnEl.classList.remove('drop-target');
        if (spaceEditZoneEl) spaceEditZoneEl.classList.remove('drop-target');
        if (spaceTrashZoneEl) spaceTrashZoneEl.classList.remove('drop-target');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedSpaceId);
        setTimeout(() => pill.classList.add('dragging-space'), 0);
    });

    spacesStripEl?.addEventListener('dragend', (e) => {
        nativeDragActive = false;
        const pill = e.target.closest('.space-pill');
        if (pill) pill.classList.remove('dragging-space');
        if (isSpaceReorderActive()) releaseSpaceReorderState();
    });

    spacesNavEl?.addEventListener('dragenter', (e) => {
        if (isSpaceReorderActive()) return;
        rememberDragPoint(e);
        const folderContext = resolveSpaceCreateFolderContext(e);
        if (!folderContext) return;
        const { x, y } = getDragPoint(e);
        const overAddBtn = !!(e.target.closest('#spaceAddBtn') || isOverSpaceAddByPoint(x, y, 20));
        if (!overAddBtn) return;
        e.preventDefault();
        clearSpaceDropTarget();
        spaceAddBtnEl?.classList.add('drop-target');
        pendingSpaceCreateFromFolderContext = folderContext;
        spaceAddIntentActive = true;
    });

    spacesNavEl?.addEventListener('dragover', (e) => {
        rememberDragPoint(e);
        if (isSpaceReorderActive()) {
            e.preventDefault();
            updateSpaceTrashVisibility(e);
            return;
        }
        const folderContext = resolveSpaceCreateFolderContext(e);
        if (!isDragTransferActive() && !folderContext) return;
        const { x, y } = getDragPoint(e);
        const overAddBtn = !!(e.target.closest('#spaceAddBtn') || isOverSpaceAddByPoint(x, y, 16));
        if (folderContext && overAddBtn) {
            e.preventDefault();
            clearSpaceDropTarget();
            spaceAddBtnEl?.classList.add('drop-target');
            pendingSpaceCreateFromFolderContext = folderContext;
            spaceAddIntentActive = true;
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            return;
        }
        spaceAddBtnEl?.classList.remove('drop-target');
        if (!isDragTransferActive()) return;
        e.preventDefault();
        updateSpaceDropTargetFromEvent(e);
    });

    spacesStripEl?.addEventListener('dragover', (e) => {
        rememberDragPoint(e);
        if (isSpaceReorderActive()) {
            e.preventDefault();
            hideDropIndicator();
            clearListPlaceholder();
            clearGridPlaceholder();
            clearSpaceDropTarget();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const insertion = getSpaceInsertionForEvent(e);
            showSpaceReorderPlaceholder(insertion);
            updateSpaceTrashVisibility(e);
            return;
        }
        if (!isDragTransferActive()) return;
        e.preventDefault();
        hideDropIndicator();
        clearListPlaceholder();
        clearGridPlaceholder();
        const { x, y } = getDragPoint(e);
        if (!isOverSpaceAddByPoint(x, y, 16)) {
            spaceAddBtnEl?.classList.remove('drop-target');
        }
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        updateSpaceDropTargetFromEvent(e);
    });

    spacesNavEl?.addEventListener('dragleave', (e) => {
        if (isSpaceReorderActive()) {
            if (spacesNavEl.contains(e.relatedTarget)) return;
            document.body.classList.add('space-trash-visible');
            return;
        }
        if (!isDragTransferActive()) return;
        if (spacesNavEl.contains(e.relatedTarget)) return;
        spaceAddBtnEl?.classList.remove('drop-target');
        clearSpaceDropTarget();
    });

    spacesStripEl?.addEventListener('drop', (e) => {
        rememberDragPoint(e);
        if (isSpaceReorderActive()) {
            e.preventDefault();
            e.stopPropagation();
            const fallbackInsertion = getSpaceInsertionForEvent(e);
            if (!spaceReorderPlaceholder.parentElement && fallbackInsertion) {
                showSpaceReorderPlaceholder(fallbackInsertion);
            }
            const insertIndex = getSpaceInsertIndexFromPlaceholder();
            if (draggedSpaceId) reorderSpaceByDrag(draggedSpaceId, insertIndex);
            releaseSpaceReorderState();
            return;
        }
        if (!isDragTransferActive()) return;
        if (tryOpenSpaceCreateFromDraggedFolder(e, 'spacesStrip.drop')) return;
        const folderContextForAdd = resolveSpaceCreateFolderContext(e);
        const { x, y } = getDragPoint(e);
        const nearAdd = isOverSpaceAddByPoint(x, y, 22);
        const overSpacePill = isOverSpacePillByPoint(x, y);
        const overQuickAdd = isOverQuickAddByPoint(x, y);
        const addArmed = !!spaceAddBtnEl?.classList.contains('drop-target');
        const addIntent = !!spaceAddIntentActive;
        pushDndDebug('spacesStrip.drop', {
            hasCtx: !!folderContextForAdd,
            addArmed,
            addIntent,
            nearAdd,
            overPill: overSpacePill,
            overQuickAdd,
            dragActive: isDragTransferActive()
        });
        if (folderContextForAdd && (nearAdd || addArmed || (addIntent && !overSpacePill && !overQuickAdd))) {
            e.preventDefault();
            e.stopPropagation();
            spaceAddBtnEl?.classList.remove('drop-target');
            pendingSpaceCreateFromFolderContext = null;
            openSpaceModal(null, true, { fromFolder: folderContextForAdd });
            releaseDragState();
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        spaceAddBtnEl?.classList.remove('drop-target');
        pendingSpaceCreateFromFolderContext = null;
        const targetSpaceId = updateSpaceDropTargetFromEvent(e);
        if (!targetSpaceId) {
            releaseDragState();
            return;
        }
        moveDraggedPayloadToSpace(targetSpaceId);
        releaseDragState();
    });

    spacesNavEl?.addEventListener('drop', (e) => {
        rememberDragPoint(e);
        if (isSpaceReorderActive()) return;
        if (tryOpenSpaceCreateFromDraggedFolder(e, 'spacesNav.drop')) return;
        const folderContext = resolveSpaceCreateFolderContext(e);
        const { x, y } = getDragPoint(e);
        const overAddBtn = !!(e.target.closest('#spaceAddBtn') || isOverSpaceAddByPoint(x, y, 22));
        const overSpacePill = isOverSpacePillByPoint(x, y);
        const overQuickAdd = isOverQuickAddByPoint(x, y);
        const addArmed = !!spaceAddBtnEl?.classList.contains('drop-target');
        const addIntent = !!spaceAddIntentActive;
        pushDndDebug('spacesNav.drop', {
            hasCtx: !!folderContext,
            overAdd: overAddBtn,
            addArmed,
            addIntent,
            overPill: overSpacePill,
            overQuickAdd
        });
        if (folderContext && (overAddBtn || addArmed || (addIntent && !overSpacePill && !overQuickAdd))) {
            e.preventDefault();
            e.stopPropagation();
            spaceAddBtnEl?.classList.remove('drop-target');
            pendingSpaceCreateFromFolderContext = null;
            openSpaceModal(null, true, { fromFolder: folderContext });
            releaseDragState();
            return;
        }
        if (!isDragTransferActive()) return;
    });

    spaceTrashZoneEl?.addEventListener('dragover', (e) => {
        if (!isSpaceReorderActive()) return;
        if (!canDeleteDraggedSpace()) {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
            document.body.classList.add('space-trash-visible');
            spaceEditZoneEl?.classList.remove('drop-target');
            spaceTrashZoneEl.classList.remove('drop-target');
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        document.body.classList.add('space-trash-visible');
        spaceEditZoneEl?.classList.remove('drop-target');
        spaceTrashZoneEl.classList.add('drop-target');
        clearSpaceReorderPlaceholder();
    });

    spaceTrashZoneEl?.addEventListener('dragleave', (e) => {
        if (!isSpaceReorderActive()) return;
        if (spaceTrashZoneEl.contains(e.relatedTarget)) return;
        spaceTrashZoneEl.classList.remove('drop-target');
    });

    spaceTrashZoneEl?.addEventListener('drop', (e) => {
        if (!isSpaceReorderActive()) return;
        e.preventDefault();
        e.stopPropagation();
        if (!canDeleteDraggedSpace()) {
            releaseSpaceReorderState();
            return;
        }
        if (draggedSpaceId) deleteSpaceById(draggedSpaceId);
        releaseSpaceReorderState();
    });

    spaceEditZoneEl?.addEventListener('dragover', (e) => {
        if (!isSpaceReorderActive()) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        document.body.classList.add('space-trash-visible');
        spaceTrashZoneEl?.classList.remove('drop-target');
        spaceEditZoneEl.classList.add('drop-target');
        clearSpaceReorderPlaceholder();
    });

    spaceEditZoneEl?.addEventListener('dragleave', (e) => {
        if (!isSpaceReorderActive()) return;
        if (spaceEditZoneEl.contains(e.relatedTarget)) return;
        spaceEditZoneEl.classList.remove('drop-target');
    });

    spaceEditZoneEl?.addEventListener('drop', (e) => {
        if (!isSpaceReorderActive()) return;
        e.preventDefault();
        e.stopPropagation();
        const targetSpaceId = draggedSpaceId;
        releaseSpaceReorderState();
        if (targetSpaceId) openSpaceModal(targetSpaceId, false);
    });

    document.addEventListener('dragover', (e) => {
        rememberDragPoint(e);
        if (isSpaceReorderActive()) {
            updateSpaceTrashVisibility(e);
            return;
        }
        const folderContext = resolveSpaceCreateFolderContext(e);
        if (!folderContext) return;
        const { x, y } = getDragPoint(e);
        const overAddBtn = isOverSpaceAddByPoint(x, y, 22);
        const overSpacesNav = isPointInsideElement(spacesNavEl, x, y, 14);
        const overQuickAdd = isOverQuickAddByPoint(x, y);
        if (overAddBtn) {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            spaceAddBtnEl?.classList.add('drop-target');
            pendingSpaceCreateFromFolderContext = folderContext;
            spaceAddIntentActive = true;
            clearSpaceDropTarget();
            return;
        }
        if (!overSpacesNav || overQuickAdd) {
            spaceAddBtnEl?.classList.remove('drop-target');
        }
    });

    document.getElementById('spacesStrip').addEventListener('click', (e) => {
        if (isDragTransferActive() || isSpaceReorderActive()) return;
        const btn = e.target.closest('.space-pill');
        if (!btn) return;
        const currentIndex = data.spaces.findIndex(space => space.id === data.activeSpaceId);
        const targetIndex = data.spaces.findIndex(space => space.id === btn.dataset.id);
        setActiveSpace(btn.dataset.id, { direction: Math.sign(targetIndex - currentIndex) });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Meta' || e.key === 'Control') {
            if (!modifierPressed) {
                modifierPressed = true;
                updateSelectionUI();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Meta' || e.key === 'Control') {
            modifierPressed = false;
            updateSelectionUI();
        }
    });

    document.addEventListener('drop', (e) => {
        rememberDragPoint(e);
        if (!isSpaceReorderActive()) {
            const { x, y } = getDragPoint(e);
            const overAddBtn = !!(e.target.closest?.('#spaceAddBtn') || isOverSpaceAddByPoint(x, y, 22));
            const overSpacePill = isOverSpacePillByPoint(x, y);
            const overSpacesNav = isPointInsideElement(spacesNavEl, x, y, 16);
            const overQuickAdd = isOverQuickAddByPoint(x, y);
            const folderContext = resolveSpaceCreateFolderContext(e);
            const addArmed = !!spaceAddBtnEl?.classList.contains('drop-target');
            const addIntent = !!spaceAddIntentActive;
            const pointContext = getDropContextFromPoint(e);
            const hasContainerTarget = !!(pointContext.dropTarget || pointContext.dropGrid || pointContext.dropSidebarList);
            pushDndDebug('document.drop.capture', {
                hasCtx: !!folderContext,
                overAdd: overAddBtn,
                addArmed,
                addIntent,
                overPill: overSpacePill,
                overNav: overSpacesNav,
                overQuickAdd,
                hasContainerTarget
            });
            const shouldOpenFromAdd = overAddBtn
                || addArmed
                || (addIntent && overSpacesNav && !overSpacePill && !overQuickAdd && !hasContainerTarget);
            if (shouldOpenFromAdd) {
                if (tryOpenSpaceCreateFromDraggedFolder(e, 'document.drop.capture')) return;
            }
        }
        nativeDragActive = false;
    }, true);

    window.addEventListener('blur', () => {
        modifierPressed = false;
        updateSelectionUI();
    });

    window.addEventListener('pointerup', (e) => {
        rememberDragPoint(e);
        if (!isSpaceReorderActive()) {
            const { x, y } = getDragPoint(e);
            const overAddBtn = isOverSpaceAddByPoint(x, y, 22);
            const overSpacePill = isOverSpacePillByPoint(x, y);
            const overSpacesNav = isPointInsideElement(spacesNavEl, x, y, 16);
            const overQuickAdd = isOverQuickAddByPoint(x, y);
            const addArmed = !!spaceAddBtnEl?.classList.contains('drop-target');
            const folderContext = resolveSpaceCreateFolderContext();
            const addIntent = !!spaceAddIntentActive;
            pushDndDebug('window.pointerup', {
                hasCtx: !!folderContext,
                overAdd: overAddBtn,
                addArmed,
                addIntent,
                overPill: overSpacePill,
                overNav: overSpacesNav,
                overQuickAdd,
                nativeDragActive
            });
            const shouldOpenFromAdd = overAddBtn
                || addArmed
                || (addIntent && overSpacesNav && !overSpacePill && !overQuickAdd);
            if (shouldOpenFromAdd) {
                if (tryOpenSpaceCreateFromDraggedFolder(e, 'window.pointerup')) return;
            }
        }
        if (!nativeDragActive) {
            releaseDragState();
            if (isSpaceReorderActive()) releaseSpaceReorderState();
        }
        if (!e.metaKey && !e.ctrlKey && modifierPressed) {
            modifierPressed = false;
            updateSelectionUI();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented) return;
        const active = document.activeElement;
        const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        const modalOpen = document.querySelector('.modal.active');
        if (e.key === 'Escape' && modalOpen) {
            if (modalOpen.id === 'itemModal') closeItemModal();
            else if (modalOpen.id === 'folderModal') closeFolderModal();
            else closeModal(modalOpen.id);
            return;
        }
        if (e.key === 'Escape' && emojiPopover.style.display === 'block') {
            closeEmojiPopover();
            return;
        }
        const isSearchShortcut = (e.key === '/' || e.code === 'Slash') && !e.metaKey && !e.ctrlKey && !e.altKey;
        if (!modalOpen && !isTyping && isSearchShortcut) {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            searchInput?.focus();
            searchInput?.select();
            return;
        }
        if (isTyping || modalOpen) return;
        if (e.key === 'ArrowLeft') handleSpaceSwitch(-1);
        if (e.key === 'ArrowRight') handleSpaceSwitch(1);
    });

    let lastWheelSwitch = 0;
    window.addEventListener('wheel', (e) => {
        const now = Date.now();
        if (now - lastWheelSwitch < 500) return;
        const modalOpen = document.querySelector('.modal.active');
        if (modalOpen) return;
        if (e.target.closest('.sidebar')) return;
        const absX = Math.abs(e.deltaX);
        const absY = Math.abs(e.deltaY);
        if (absX > 40 && absX > absY) {
            handleSpaceSwitch(e.deltaX > 0 ? 1 : -1);
            lastWheelSwitch = now;
            return;
        }
        if (absY > 40) {
            handleSpaceSwitch(e.deltaY > 0 ? 1 : -1);
            lastWheelSwitch = now;
        }
    }, { passive: true });

    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        if (!e.touches.length) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!touchStartX || !touchStartY) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        const modalOpen = document.querySelector('.modal.active');
        if (modalOpen) return;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            handleSpaceSwitch(dx > 0 ? -1 : 1);
        }
        touchStartX = 0;
        touchStartY = 0;
    }, { passive: true });

    document.getElementById('btnExport').addEventListener('click', async () => {
        const dataToExport = {
            version: DATA_VERSION,
            data: data,
            engines: engines,
            activeEngine: activeEngineId,
            bgLight: getThemeBackground('light'),
            bgDark: getThemeBackground('dark'),
            performanceMode: performanceMode,
            dndDebugEnabled: dndDebugEnabled
        };
        const localThemeFallbacks = await collectBackupLocalThemeFallbacks();
        if (Object.keys(localThemeFallbacks).length) {
            dataToExport.localThemeFallbacks = localThemeFallbacks;
        }
        const blob = new Blob([JSON.stringify(dataToExport)], { type: "application/json" });
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = "AirTab_Backup.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(evt) {
            try {
                const imported = JSON.parse(evt.target.result);
                if (imported.data) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(imported.data));
                    data = loadData();
                } else if (imported.spaces) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        version: DATA_VERSION,
                        spaces: imported.spaces,
                        activeSpaceId: imported.activeSpaceId || imported.spaces[0]?.id
                    }));
                    data = loadData();
                } else if (imported.links) {
                    const migrated = buildDefaultData(imported.links);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                    data = loadData();
                }
                if (imported.engines) localStorage.setItem('myEngines', JSON.stringify(imported.engines));
                if (imported.activeEngine) localStorage.setItem('myActiveEngine', String(imported.activeEngine));
                if (imported.bgLight) localStorage.setItem('myBgLight', imported.bgLight);
                if (imported.bgDark) localStorage.setItem('myBgDark', imported.bgDark);
                if (imported.performanceMode) localStorage.setItem('airtabPerformanceMode', imported.performanceMode === 'eco' ? 'eco' : 'balanced');
                if (Object.prototype.hasOwnProperty.call(imported, 'dndDebugEnabled')) {
                    localStorage.setItem(DND_DEBUG_STORAGE_KEY, imported.dndDebugEnabled ? '1' : '0');
                    dndDebugEnabled = readDndDebugEnabled();
                    applyDndDebugVisibility();
                }
                const restoredLight = typeof imported.bgLight === 'string' ? imported.bgLight : getThemeBackground('light');
                const restoredDark = typeof imported.bgDark === 'string' ? imported.bgDark : getThemeBackground('dark');
                await restoreBackupLocalThemeFallbacks(imported.localThemeFallbacks, {
                    light: restoredLight,
                    dark: restoredDark
                });
                markLocalDataUpdated(Date.now());

                alert(trKey('reloadSuccess', 'Успешно! Страница будет перезагружена.'));
                location.reload();
            } catch (err) {
                alert(trKey('importErrorBadFile', 'Ошибка! Неверный файл.'));
            }
        };
        reader.readAsText(file);
    });

    scheduleClock();
    applySpaceTheme();
    hydrateLocalThemeBackgrounds();
    applyPerformanceMode();
    requestAnimationFrame(() => document.documentElement.classList.remove('preload'));
    updateSelectionUI();
    renderItems();
    renderSpaces();
    renderSearchDropdown();
    runAutoSyncPull(true).catch(() => {});
});
