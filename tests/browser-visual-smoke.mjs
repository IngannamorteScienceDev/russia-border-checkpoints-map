import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUTPUT_DIR = await mkdtemp(join(tmpdir(), "kpp-map-visual-"));
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const WINDOWS_BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];
const UNIX_BROWSER_NAMES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
  "msedge"
];

async function pathExists(path) {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findInPath(command) {
  const pathDirectories = String(process.env.PATH || "")
    .split(process.platform === "win32" ? ";" : ":")
    .filter(Boolean);
  const executableNames =
    process.platform === "win32" && !command.endsWith(".exe")
      ? [`${command}.exe`, command]
      : [command];

  for (const directory of pathDirectories) {
    for (const executableName of executableNames) {
      const candidate = join(directory, executableName);
      if (await pathExists(candidate)) return candidate;
    }
  }

  return "";
}

async function findBrowserExecutable() {
  if (process.env.BROWSER_BIN && (await pathExists(process.env.BROWSER_BIN))) {
    return process.env.BROWSER_BIN;
  }

  for (const candidate of WINDOWS_BROWSER_PATHS) {
    if (await pathExists(candidate)) return candidate;
  }

  for (const command of UNIX_BROWSER_NAMES) {
    const candidate = await findInPath(command);
    if (candidate) return candidate;
  }

  throw new Error(
    "Headless browser was not found. Install Chrome/Chromium/Edge or set BROWSER_BIN."
  );
}

function safeResolveRequestPath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const absolutePath = resolve(ROOT, relativePath);

  if (absolutePath !== ROOT && !absolutePath.startsWith(`${ROOT}${sep}`)) {
    return "";
  }

  return absolutePath;
}

function createThemeSetterHtml(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";

  return `<!doctype html>
    <html lang="ru">
      <head><meta charset="utf-8"><title>Set visual theme</title></head>
      <body>
        <script>
          localStorage.setItem("kpp-map-theme", ${JSON.stringify(safeTheme)});
          location.replace("/index.html?visual-theme=${safeTheme}");
        </script>
      </body>
    </html>`;
}

async function readVisualIndex() {
  const source = await readFile(resolve(ROOT, "index.html"), "utf-8");

  return source
    .replace(/\s*<link rel="stylesheet" href="https:\/\/unpkg\.com\/maplibre-gl@[^"]+" \/>\n/, "\n")
    .replace(/\s*<link rel="stylesheet" href="\.\/js\/vendor\/maplibre-gl\.css" \/>\n/, "\n")
    .replace(/\s*<script src="https:\/\/unpkg\.com\/maplibre-gl@[^"]+"><\/script>\n/, "\n")
    .replace(/\s*<script src="\.\/js\/vendor\/maplibre-gl\.js"><\/script>\n/, "\n");
}

function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");

      if (requestUrl.pathname === "/__set-theme") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(createThemeSetterHtml(requestUrl.searchParams.get("theme")));
        return;
      }

      if (requestUrl.pathname === "/index.html" && requestUrl.searchParams.has("visual-theme")) {
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "text/html; charset=utf-8"
        });
        response.end(await readVisualIndex());
        return;
      }

      const filePath = safeResolveRequestPath(requestUrl.pathname);
      assert(filePath, "Blocked path traversal attempt.");

      const body = await readFile(filePath);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream"
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === "ENOENT" ? 404 : 500, {
        "content-type": "text/plain; charset=utf-8"
      });
      response.end(String(error?.message || error));
    }
  });

  return new Promise((resolveServer, rejectServer) => {
    server.on("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      resolveServer(server);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

function runBrowser(browserPath, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(browserPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error(`Browser screenshot timed out.\n${stderr || stdout}`));
    }, 30000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }

      rejectRun(new Error(`Browser exited with code ${code}.\n${stderr || stdout}`));
    });
  });
}

function readPngSize(buffer) {
  const pngSignature = "89504e470d0a1a0a";
  assert(buffer.subarray(0, 8).toString("hex") === pngSignature, "Screenshot should be a PNG.");

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function takeScreenshot({ browserPath, baseUrl, name, width, height, theme }) {
  const screenshotPath = join(OUTPUT_DIR, `${name}.png`);
  const userDataDir = join(OUTPUT_DIR, `${name}-profile`);
  await mkdir(userDataDir, { recursive: true });

  await runBrowser(browserPath, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--no-sandbox",
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    `--screenshot=${screenshotPath}`,
    `${baseUrl}/__set-theme?theme=${theme}`
  ]);

  const screenshotStat = await stat(screenshotPath);
  assert(screenshotStat.size > 12000, `${name} screenshot is unexpectedly small.`);

  const screenshot = await readFile(screenshotPath);
  const dimensions = readPngSize(screenshot);
  assert(
    dimensions.width === width && dimensions.height === height,
    `${name} screenshot dimensions should be ${width}x${height}, got ${dimensions.width}x${dimensions.height}.`
  );

  return {
    path: screenshotPath,
    hash: createHash("sha256").update(screenshot).digest("hex")
  };
}

const browserPath = await findBrowserExecutable();
const server = await createStaticServer();
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const shots = await Promise.all([
    takeScreenshot({
      browserPath,
      baseUrl,
      name: "desktop-light",
      width: 1440,
      height: 900,
      theme: "light"
    }),
    takeScreenshot({
      browserPath,
      baseUrl,
      name: "desktop-dark",
      width: 1440,
      height: 900,
      theme: "dark"
    }),
    takeScreenshot({
      browserPath,
      baseUrl,
      name: "mobile-light",
      width: 390,
      height: 844,
      theme: "light"
    }),
    takeScreenshot({
      browserPath,
      baseUrl,
      name: "mobile-dark",
      width: 390,
      height: 844,
      theme: "dark"
    })
  ]);

  assert(
    shots[0].hash !== shots[1].hash,
    "Desktop light and dark screenshots should not be identical."
  );
  assert(
    shots[2].hash !== shots[3].hash,
    "Mobile light and dark screenshots should not be identical."
  );

  console.log("browser visual smoke test passed");
} finally {
  await closeServer(server);
  await rm(OUTPUT_DIR, { recursive: true, force: true });
}
