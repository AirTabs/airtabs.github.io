(() => {
    try {
        const LOCAL_BG_TOKEN_PREFIX = 'local-file://';
        const getBrightness = (color) => {
            const value = String(color || '').trim().toLowerCase();
            let r = 0; let g = 0; let b = 0;
            if (value.startsWith('#')) {
                const hex = value.slice(1);
                if (hex.length === 3) {
                    r = parseInt(hex[0] + hex[0], 16);
                    g = parseInt(hex[1] + hex[1], 16);
                    b = parseInt(hex[2] + hex[2], 16);
                } else if (hex.length === 6) {
                    r = parseInt(hex.slice(0, 2), 16);
                    g = parseInt(hex.slice(2, 4), 16);
                    b = parseInt(hex.slice(4, 6), 16);
                }
            } else if (value.startsWith('rgb')) {
                const match = value.match(/\d+/g);
                if (match?.length >= 3) {
                    [r, g, b] = match.slice(0, 3).map(Number);
                }
            }
            if ([r, g, b].some(Number.isNaN)) return 0;
            return (r * 299 + g * 587 + b * 114) / 1000;
        };
        const setLightTokens = (root) => {
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
        };
        const setDarkTokens = (root) => {
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
        };
        const root = document.documentElement;
        const dataRaw = localStorage.getItem('airtabData');
        const data = dataRaw ? JSON.parse(dataRaw) : null;
        const activeSpaceId = data?.activeSpaceId;
        const space = data?.spaces?.find(s => s.id === activeSpaceId);
        const spaceBgRaw = String(space?.bg || '').trim();
        const normalizeStoredThemeBg = (value, fallback) => {
            const raw = String(value || '').trim();
            if (!raw || raw.startsWith(LOCAL_BG_TOKEN_PREFIX)) return fallback;
            return raw;
        };
        const bgLight = normalizeStoredThemeBg(
            localStorage.getItem('myBgLight') || localStorage.getItem('myBg') || '#f2f2f7',
            '#f2f2f7'
        );
        const bgDark = normalizeStoredThemeBg(
            localStorage.getItem('myBgDark') || '#2c2c2e',
            '#2c2c2e'
        );
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const themeFallbackBg = isDark ? bgDark : bgLight;
        const isLocalBgToken = spaceBgRaw.startsWith(LOCAL_BG_TOKEN_PREFIX);
        const initialBgRaw = (spaceBgRaw && !isLocalBgToken) ? spaceBgRaw : themeFallbackBg;
        const initialBg = initialBgRaw.startsWith(LOCAL_BG_TOKEN_PREFIX)
            ? (isDark ? '#2c2c2e' : '#f2f2f7')
            : initialBgRaw;
        const isSolidColor = initialBg.startsWith('#') || initialBg.startsWith('rgb');
        root.style.setProperty('--initial-bg', initialBg);
        root.style.setProperty('--preload-bg-image', 'none');
        root.classList.add('preload');

        if (isSolidColor) {
            if (getBrightness(initialBg) > 130) setLightTokens(root);
            else setDarkTokens(root);
            root.style.setProperty('--overlay-opacity', '0');
        } else {
            setDarkTokens(root);
            root.style.setProperty('--overlay-opacity', '0.32');
            const safeImageUrl = initialBg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            root.style.setProperty('--preload-bg-image', `url("${safeImageUrl}")`);
        }

        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta && (initialBg.startsWith('#') || initialBg.startsWith('rgb'))) {
            themeMeta.setAttribute('content', initialBg);
        }
    } catch (e) {}
})();
