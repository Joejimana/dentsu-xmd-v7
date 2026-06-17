// ============================================================
//  DENTSUS V7 XMD — by Natsu Tech
//  extPluginManager.js  |  External plugin installer
// ============================================================

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');

const REGISTRY_PATH = path.join(__dirname, 'extPluginRegistry.json');
const STATE_PATH    = path.join(__dirname, 'database', 'extPlugins.json');

const MARKER_START = (id) => `\n// ──── EXT_PLUGIN_START:${id} ────\n`;
const MARKER_END   = (id) => `\n// ──── EXT_PLUGIN_END:${id} ────\n`;

function log(msg) { console.log(`»  \x1b[36m[EXT-PLUG]\x1b[0m ${msg}`); }
function err(msg) { console.log(`»  \x1b[31m[EXT-PLUG]\x1b[0m ${msg}`); }

// ─── State ───────────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {}
  return {};
}

function saveState(state) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// ─── Registry ────────────────────────────────────────────────
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {}
  return [];
}

function findPlugin(nameOrId) {
  const q = nameOrId.toLowerCase();
  return loadRegistry().find(p =>
    p.id.toLowerCase() === q ||
    p.name.toLowerCase() === q ||
    (p.aliases || []).some(a => a.toLowerCase() === q)
  );
}

// ─── HTTP download ────────────────────────────────────────────
function downloadText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const parsed  = new URL(url);
    const client  = parsed.protocol === 'https:' ? https : http;
    const req = client.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'User-Agent': 'DentsuXMD/7.0' },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return resolve(downloadText(res.headers.location, redirects + 1));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── Install ─────────────────────────────────────────────────
async function installPlugin(nameOrId) {
  const plugin = findPlugin(nameOrId);
  if (!plugin) { err(`Plugin not found: ${nameOrId}`); return false; }

  const state = loadState();
  if (state[plugin.id]) { log(`Plugin already installed: ${plugin.name}`); return true; }

  log(`Downloading plugin: ${plugin.name} from ${plugin.url}`);
  let code;
  try {
    code = await downloadText(plugin.url);
  } catch (e) {
    err(`Download failed: ${e.message}`);
    return false;
  }

  const targetDir  = path.join(__dirname, 'plugins', plugin.category || 'misc');
  const targetFile = path.join(targetDir, `${plugin.id}.js`);

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const wrapped = MARKER_START(plugin.id) + code + MARKER_END(plugin.id);
  fs.writeFileSync(targetFile, wrapped, 'utf8');

  state[plugin.id] = { id: plugin.id, name: plugin.name, category: plugin.category, installedAt: Date.now() };
  saveState(state);
  log(`Installed: ${plugin.name} → plugins/${plugin.category}/${plugin.id}.js`);
  return true;
}

// ─── Uninstall ────────────────────────────────────────────────
function uninstallPlugin(nameOrId) {
  const plugin = findPlugin(nameOrId);
  if (!plugin) { err(`Plugin not found: ${nameOrId}`); return false; }

  const state = loadState();
  if (!state[plugin.id]) { log(`Plugin not installed: ${plugin.name}`); return false; }

  const targetFile = path.join(__dirname, 'plugins', plugin.category || 'misc', `${plugin.id}.js`);
  if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

  delete state[plugin.id];
  saveState(state);
  log(`Uninstalled: ${plugin.name}`);
  return true;
}

// ─── List ─────────────────────────────────────────────────────
function listAvailablePlugins() {
  return loadRegistry();
}

function listInstalledPlugins() {
  return Object.values(loadState());
}

module.exports = { installPlugin, uninstallPlugin, listAvailablePlugins, listInstalledPlugins };
