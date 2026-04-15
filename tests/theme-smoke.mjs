import {
  applyTheme,
  resolveInitialTheme,
  setupThemeToggle,
  THEME_STORAGE_KEY
} from "../js/theme.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createStorage(initial = new Map()) {
  return {
    values: initial,
    getItem(key) {
      return this.values.get(key) ?? null;
    },
    setItem(key, value) {
      this.values.set(key, String(value));
    }
  };
}

function createButton() {
  return {
    dataset: {},
    textContent: "",
    attributes: new Map(),
    classList: {
      active: false,
      toggle(_className, force) {
        this.active = Boolean(force);
      }
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }
  };
}

const darkStorage = createStorage(new Map([[THEME_STORAGE_KEY, "dark"]]));
assert(
  resolveInitialTheme({ storage: darkStorage, matchMedia: () => ({ matches: false }) }) === "dark",
  "Stored dark theme should win over system preference."
);

assert(
  resolveInitialTheme({
    storage: createStorage(),
    matchMedia: () => ({ matches: true })
  }) === "dark",
  "System dark preference should be used when no theme is stored."
);

const root = { dataset: {}, style: {} };
const meta = {
  content: "",
  setAttribute(name, value) {
    if (name === "content") this.content = value;
  }
};

assert(applyTheme("dark", { root, meta }) === "dark", "Dark theme should be applied.");
assert(root.dataset.theme === "dark", "Dark theme should set document data-theme.");
assert(root.style.colorScheme === "dark", "Dark theme should set browser color scheme.");
assert(meta.content === "#071411", "Dark theme should update theme-color meta.");

const button = createButton();
const storage = createStorage();
const controller = setupThemeToggle({
  button,
  storage,
  root,
  meta,
  matchMedia: () => ({ matches: false })
});

assert(controller.getTheme() === "light", "Theme controller should initialize with light theme.");
assert(button.textContent === "Темная тема", "Theme button should offer dark mode initially.");
assert(button.attributes.get("aria-pressed") === "false", "Theme button should start unpressed.");

button.onclick();

assert(controller.getTheme() === "dark", "Theme button should switch to dark theme.");
assert(storage.values.get(THEME_STORAGE_KEY) === "dark", "Theme choice should be persisted.");
assert(
  button.textContent === "Светлая тема",
  "Theme button should offer light mode in dark theme."
);
assert(
  button.attributes.get("aria-pressed") === "true",
  "Theme button should mark dark mode active."
);
assert(button.classList.active === true, "Theme button should receive active state in dark theme.");

controller.setTheme("light");
assert(root.dataset.theme === "light", "Theme controller should switch back to light theme.");
assert(meta.content === "#123029", "Light theme should restore light theme-color meta.");

console.log("theme smoke test passed");
