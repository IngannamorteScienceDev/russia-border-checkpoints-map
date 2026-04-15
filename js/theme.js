export const THEME_STORAGE_KEY = "kpp-map-theme";

const THEMES = new Set(["light", "dark"]);
const THEME_META_COLORS = {
  light: "#123029",
  dark: "#071411"
};

function normalizeTheme(theme) {
  return THEMES.has(theme) ? theme : "light";
}

function safeGetStoredTheme(storage = globalThis.localStorage) {
  try {
    const storedTheme = storage?.getItem?.(THEME_STORAGE_KEY);
    return THEMES.has(storedTheme) ? storedTheme : "";
  } catch {
    return "";
  }
}

function safeSetStoredTheme(theme, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme persistence is a convenience; the UI should still switch without storage access.
  }
}

function getSystemTheme(matchMedia = globalThis.matchMedia) {
  return matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function resolveInitialTheme({ storage, matchMedia } = {}) {
  return safeGetStoredTheme(storage) || getSystemTheme(matchMedia);
}

export function applyTheme(theme, { root, meta } = {}) {
  const nextTheme = normalizeTheme(theme);
  const documentRoot = root || globalThis.document?.documentElement;
  const themeMeta =
    meta ||
    globalThis.document?.getElementById?.("themeColorMeta") ||
    globalThis.document?.querySelector?.('meta[name="theme-color"]');

  if (documentRoot?.dataset) {
    documentRoot.dataset.theme = nextTheme;
  }

  if (documentRoot?.style) {
    documentRoot.style.colorScheme = nextTheme;
  }

  themeMeta?.setAttribute?.("content", THEME_META_COLORS[nextTheme]);

  return nextTheme;
}

function syncThemeButton(button, theme) {
  if (!button) return;

  const isDark = theme === "dark";
  button.textContent = isDark ? "Светлая тема" : "Темная тема";
  if (button.dataset) {
    button.dataset.theme = theme;
  }
  button.classList?.toggle?.("is-active", isDark);
  button.setAttribute?.("aria-pressed", isDark ? "true" : "false");
  button.setAttribute?.(
    "title",
    isDark ? "Переключить на светлую тему" : "Переключить на темную тему"
  );
}

export function setupThemeToggle({ button, storage, root, meta, matchMedia } = {}) {
  let currentTheme = applyTheme(resolveInitialTheme({ storage, matchMedia }), { root, meta });
  syncThemeButton(button, currentTheme);

  if (button) {
    button.onclick = () => {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      safeSetStoredTheme(currentTheme, storage);
      applyTheme(currentTheme, { root, meta });
      syncThemeButton(button, currentTheme);
    };
  }

  return {
    getTheme: () => currentTheme,
    setTheme(theme) {
      currentTheme = applyTheme(theme, { root, meta });
      safeSetStoredTheme(currentTheme, storage);
      syncThemeButton(button, currentTheme);
      return currentTheme;
    }
  };
}
