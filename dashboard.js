// ============================================================
//  DENTSUS V7 XMD — by Natsu Tech
//  dashboard.js  |  Web dashboard + Pairing page
// ============================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');

// ─── Stats store ─────────────────────────────────────────────
const stats = {
  status:       'starting',
  botNumber:    null,
  groupCount:   0,
  chatCount:    0,
  pluginCount:  0,
  prefix:       '.',
  messagesIn:   0,
  commandsRan:  0,
  deployedAt:   Date.now(),
  connectedAt:  null,
  processStart: global.botStartTime || Date.now(),
};

const DEPLOY_FILE = path.join(__dirname, '.deploy_ts');
function loadDeployTs() {
  try {
    if (fs.existsSync(DEPLOY_FILE)) {
      const ts = parseInt(fs.readFileSync(DEPLOY_FILE, 'utf8').trim(), 10);
      if (!isNaN(ts)) return ts;
    }
  } catch {}
  return null;
}
function saveDeployTs(ts) { try { fs.writeFileSync(DEPLOY_FILE, String(ts), 'utf8'); } catch {} }

const savedTs = loadDeployTs();
if (savedTs) stats.deployedAt = savedTs;
else saveDeployTs(stats.deployedAt);

function updateStats(patch)   { Object.assign(stats, patch); }
function incrementMessages()  { stats.messagesIn++; }
function incrementCommands()  { stats.commandsRan++; }
function getStats() {
  const now = Date.now();
  return { ...stats, uptimeMs: now - stats.processStart, connectedForMs: stats.connectedAt ? now - stats.connectedAt : 0, serverTime: new Date().toISOString() };
}

// ─── Pairing handler — delegates to global.pairSession ───────
// global.pairSession is defined in index.js and creates a FRESH
// dedicated socket for each pairing request, avoiding all state
// issues with the main bot socket.
async function doPair(phoneNumber, sessionId) {
  if (typeof global.pairSession !== 'function') {
    throw new Error('Le bot n\'est pas encore prêt. Attends 10 secondes et réessaie.');
  }
  return global.pairSession(sessionId || 'main', phoneNumber);
}

// ─── HTML pages ───────────────────────────────────────────────
const PAIR_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>DENTSUS V7 XMD — Connexion</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet"/>
<style>
  :root {
    --bg:     #080a10;
    --panel:  #0d0f1a;
    --border: #1a1e30;
    --accent: #00ffe0;
    --purple: #bd93f9;
    --pink:   #ff6ac1;
    --green:  #50fa7b;
    --yellow: #ffdd57;
    --red:    #ff5555;
    --text:   #cdd6f4;
    --muted:  #6272a4;
    --glow:   0 0 20px rgba(0,255,224,0.3);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Rajdhani', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 40px 16px;
    background-image: radial-gradient(ellipse at 20% 50%, rgba(0,255,224,0.03) 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, rgba(189,147,249,0.04) 0%, transparent 60%);
  }
  nav {
    display: flex; gap: 8px; margin-bottom: 40px;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 50px; padding: 6px;
  }
  nav a {
    padding: 8px 24px; border-radius: 50px; text-decoration: none;
    font-weight: 600; font-size: 0.9rem; color: var(--muted); transition: all 0.2s;
  }
  nav a.active { background: var(--accent); color: #000; }
  nav a:not(.active):hover { color: var(--text); }
  .logo { font-family: 'Orbitron', monospace; font-size: 2rem; font-weight: 900;
    color: var(--accent); text-shadow: var(--glow); letter-spacing: 3px; margin-bottom: 6px; }
  .tagline { color: var(--muted); font-size: 0.85rem; margin-bottom: 40px; letter-spacing: 1px; }
  .card {
    width: 100%; max-width: 520px;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 20px; padding: 36px 32px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.4); margin-bottom: 20px;
  }
  .card-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 6px; color: var(--text); }
  .card-sub   { color: var(--muted); font-size: 0.85rem; margin-bottom: 28px; line-height: 1.5; }
  .field { margin-bottom: 20px; }
  label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  input[type=tel] {
    width: 100%; padding: 14px 16px; border-radius: 12px;
    background: #0a0c14; border: 1px solid var(--border);
    color: var(--text); font-size: 1rem; font-family: 'Share Tech Mono', monospace;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s; letter-spacing: 1px;
  }
  input[type=tel]:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,255,224,0.1); }
  input::placeholder { color: var(--muted); }
  button {
    width: 100%; padding: 14px; border-radius: 12px; border: none;
    background: var(--accent); color: #000;
    font-family: 'Orbitron', monospace; font-size: 0.9rem; font-weight: 700;
    cursor: pointer; letter-spacing: 1px;
    transition: opacity 0.2s, transform 0.1s, box-shadow 0.2s; box-shadow: var(--glow);
  }
  button:hover  { opacity: 0.9; box-shadow: 0 0 30px rgba(0,255,224,0.5); }
  button:active { transform: scale(0.98); }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  #code-box {
    display: none; margin-top: 28px; text-align: center; padding: 28px 24px;
    background: #0a0c14; border: 1px solid var(--accent);
    border-radius: 16px; box-shadow: 0 0 30px rgba(0,255,224,0.1);
  }
  #code-box .code-label { color: var(--muted); font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 2px; margin-bottom: 16px; }
  #code-display {
    font-family: 'Orbitron', monospace; font-size: 2.6rem; font-weight: 900;
    color: var(--accent); letter-spacing: 8px; text-shadow: var(--glow); margin-bottom: 20px;
  }
  /* ── STEPS (how to use the code) ── */
  .how-title { font-size: 0.8rem; font-weight: 700; color: var(--yellow); text-transform: uppercase;
    letter-spacing: 1px; margin-bottom: 14px; }
  .step-list { text-align: left; display: flex; flex-direction: column; gap: 10px; }
  .step { display: flex; gap: 12px; align-items: flex-start; }
  .step-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
    background: var(--accent); color: #000; font-size: 0.72rem; font-weight: 900;
    display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .step-text { color: var(--text); font-size: 0.85rem; line-height: 1.5; }
  .step-text em { color: var(--accent); font-style: normal; font-weight: 700; }
  .step-warn { background: rgba(255,221,87,0.1); border: 1px solid rgba(255,221,87,0.3);
    border-radius: 10px; padding: 10px 14px; margin-top: 14px;
    color: var(--yellow); font-size: 0.8rem; line-height: 1.5; }
  #timer { font-size: 0.8rem; color: var(--yellow); margin-top: 14px; font-family: 'Share Tech Mono'; }
  .loader { display: inline-block; width: 18px; height: 18px; border: 2px solid #000;
    border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite;
    vertical-align: middle; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .alert { padding: 12px 16px; border-radius: 10px; font-size: 0.85rem; margin-top: 16px; display: none; }
  .alert.error   { background: rgba(255,85,85,0.12); border: 1px solid var(--red);   color: var(--red); }
  .alert.success { background: rgba(80,250,123,0.1); border: 1px solid var(--green); color: var(--green); }
  .session-info { font-size: 0.78rem; color: var(--muted); margin-top: 20px; text-align: center; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
  .badge.online  { background: rgba(80,250,123,0.15); color: var(--green); }
  .badge.offline { background: rgba(255,85,85,0.15);  color: var(--red); }
  .badge.wait    { background: rgba(255,221,87,0.15); color: var(--yellow); }
  footer { margin-top: 48px; color: var(--muted); font-size: 0.78rem; text-align: center; }
</style>
</head>
<body>

<div class="logo">⚡ DENTSUS V7 XMD</div>
<p class="tagline">by Natsu Tech · Multi-Session WhatsApp Bot</p>

<nav>
  <a href="/" class="active">🔗 Connexion</a>
  <a href="/dashboard">📊 Dashboard</a>
</nav>

<div class="card">
  <div class="card-title">Étape 1 — Génère ton code de jumelage</div>
  <p class="card-sub">Entre ton numéro WhatsApp ci-dessous pour obtenir un code à 8 chiffres.</p>

  <div class="field">
    <label>Numéro WhatsApp</label>
    <input type="tel" id="phone" placeholder="Ex: 242053323191" autocomplete="tel" inputmode="tel"/>
    <div style="font-size:0.75rem;color:var(--muted);margin-top:6px">Sans le + ni espaces — indicatif pays inclus (ex: 33612345678 pour la France)</div>
  </div>

  <div class="field">
    <label>Identifiant de session</label>
    <input type="text" id="sessionId" placeholder="main" value="main"/>
    <div style="font-size:0.75rem;color:var(--muted);margin-top:6px">Utilise "main" pour le 1er numéro, "bot2", "bot3"… jusqu'à "bot100" pour les suivants</div>
  </div>

  <button id="btn" onclick="getPairingCode()">
    Générer le code
  </button>

  <div class="alert error"   id="err-box"></div>
  <div class="alert success" id="ok-box"></div>

  <div id="code-box">
    <div class="code-label">🔐 Ton code de jumelage</div>
    <div id="code-display">----</div>

    <div class="how-title">Étape 2 — Entre ce code dans WhatsApp</div>
    <div class="step-list">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Ouvre <em>WhatsApp</em> sur ton téléphone</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Appuie sur les <em>3 points ⋮</em> en haut à droite → <em>Appareils connectés</em></div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Appuie sur <em>Lier un appareil</em></div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">⚠️ Tu vois un lecteur QR code — cherche le petit bouton en bas qui dit <em>"Lier avec un numéro de téléphone"</em> et appuie dessus</div>
      </div>
      <div class="step">
        <div class="step-num">5</div>
        <div class="step-text">Entre le code affiché ci-dessus (ex: <em>ABCD-1234</em>)</div>
      </div>
    </div>

    <div class="step-warn">
      ⚠️ Le code expire en <strong>2 minutes</strong>. Si tu rates le délai, clique à nouveau sur "Générer le code".
    </div>
    <div id="timer"></div>
  </div>

  <div class="session-info" id="session-info"></div>
</div>

<footer>DENTSUS V7 XMD &nbsp;·&nbsp; Natsu Tech &nbsp;·&nbsp; +242053323191 · +242065121108</footer>

<script>
let timerInterval = null;

function showError(msg) {
  const el = document.getElementById('err-box');
  el.textContent = '❌ ' + msg;
  el.style.display = 'block';
  document.getElementById('ok-box').style.display = 'none';
}
function showSuccess(msg) {
  const el = document.getElementById('ok-box');
  el.textContent = '✅ ' + msg;
  el.style.display = 'block';
  document.getElementById('err-box').style.display = 'none';
}
function clearAlerts() {
  document.getElementById('err-box').style.display = 'none';
  document.getElementById('ok-box').style.display = 'none';
}

function startTimer(seconds) {
  if (timerInterval) clearInterval(timerInterval);
  const el = document.getElementById('timer');
  let s = seconds;
  function tick() {
    if (s <= 0) {
      clearInterval(timerInterval);
      el.textContent = '⚠️ Code expiré — génère-en un nouveau.';
      el.style.color = '#ff5555';
      return;
    }
    const m = Math.floor(s / 60), sec = s % 60;
    el.textContent = '⏳ Expire dans ' + (m > 0 ? m + 'm ' : '') + sec + 's';
    s--;
  }
  tick();
  timerInterval = setInterval(tick, 1000);
}

async function getPairingCode() {
  clearAlerts();
  const phone     = document.getElementById('phone').value.trim().replace(/\\D/g, '');
  const sessionId = (document.getElementById('sessionId').value.trim() || 'main');
  if (!phone || phone.length < 7) return showError('Numéro invalide. Ex: 242053323191');

  const btn = document.getElementById('btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span>Connexion à WhatsApp...';
  document.getElementById('code-box').style.display = 'none';

  try {
    const res  = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: phone, sessionId }),
    });
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error || 'Erreur serveur');

    const raw = data.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const fmt = raw.length >= 8 ? raw.slice(0, 4) + '-' + raw.slice(4, 8) : raw;

    document.getElementById('code-display').textContent = fmt;
    document.getElementById('code-box').style.display = 'block';
    document.getElementById('session-info').innerHTML =
      'Session: <span class="badge online">' + (data.sessionId || sessionId) + '</span>';
    showSuccess('Code généré pour ' + sessionId + ' ! Tu as 2 minutes pour l\\'entrer dans WhatsApp.');
    startTimer(120);

  } catch (e) {
    showError(e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Générer le code';
  }
}

document.getElementById('phone').addEventListener('keydown', e => {
  if (e.key === 'Enter') getPairingCode();
});

async function checkStatus() {
  try {
    const r = await fetch('/stats');
    const d = await r.json();
    const map    = { online: 'online', starting: 'wait', reconnecting: 'wait', offline: 'offline' };
    const labels = { online: '🟢 Bot en ligne', starting: '🟡 Démarrage...', reconnecting: '🟡 Reconnexion...', offline: '🔴 Bot hors ligne' };
    document.getElementById('session-info').innerHTML =
      '<span class="badge ' + (map[d.status] || 'wait') + '">' + (labels[d.status] || d.status) + '</span>';
  } catch {}
}
checkStatus();
setInterval(checkStatus, 5000);
</script>
</body>
</html>`;

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>DENTSUS V7 XMD · Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet"/>
<style>
  :root { --bg:#080a10;--panel:#0d0f1a;--border:#1a1e30;--accent:#00ffe0;--purple:#bd93f9;--pink:#ff6ac1;--green:#50fa7b;--yellow:#ffdd57;--red:#ff5555;--text:#cdd6f4;--muted:#6272a4; }
  * { box-sizing:border-box;margin:0;padding:0; }
  body { background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;min-height:100vh;padding:40px 16px;display:flex;flex-direction:column;align-items:center;
    background-image:radial-gradient(ellipse at 20% 50%,rgba(0,255,224,.03) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(189,147,249,.04) 0%,transparent 60%); }
  nav { display:flex;gap:8px;margin-bottom:40px;background:var(--panel);border:1px solid var(--border);border-radius:50px;padding:6px; }
  nav a { padding:8px 24px;border-radius:50px;text-decoration:none;font-weight:600;font-size:.9rem;color:var(--muted);transition:all .2s; }
  nav a.active { background:var(--accent);color:#000; }
  nav a:not(.active):hover { color:var(--text); }
  .logo { font-family:'Orbitron',monospace;font-size:2rem;font-weight:900;color:var(--accent);text-shadow:0 0 20px rgba(0,255,224,.3);letter-spacing:3px;margin-bottom:6px;text-align:center; }
  .tagline { color:var(--muted);font-size:.85rem;margin-bottom:40px;letter-spacing:1px; }
  .grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;max-width:900px;width:100%;margin-bottom:24px; }
  .card { background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:22px;text-align:center; }
  .card .lbl { color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px; }
  .card .val { font-size:1.9rem;font-weight:700;color:var(--accent);font-family:'Share Tech Mono',monospace; }
  .val.g{color:var(--green)}.val.p{color:var(--purple)}.val.pk{color:var(--pink)}.val.y{color:var(--yellow)}
  .status-bar { display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:24px; }
  .badge { display:inline-block;padding:6px 16px;border-radius:20px;font-size:.82rem;font-weight:700; }
  .badge.online  { background:rgba(80,250,123,.15);color:var(--green); }
  .badge.offline { background:rgba(255,85,85,.15);color:var(--red); }
  .badge.wait    { background:rgba(255,221,87,.15);color:var(--yellow); }
  .bot-num { color:var(--muted);font-family:'Share Tech Mono';font-size:.85rem; }
  footer { margin-top:32px;color:var(--muted);font-size:.78rem;text-align:center; }
  .pair-btn { margin-top:8px;display:inline-block;padding:10px 28px;border-radius:50px;background:var(--accent);color:#000;font-family:'Orbitron',monospace;font-size:.78rem;font-weight:700;text-decoration:none;letter-spacing:1px;box-shadow:0 0 20px rgba(0,255,224,.3); }
</style>
</head>
<body>
<div class="logo">⚡ DENTSUS V7 XMD</div>
<p class="tagline">by Natsu Tech · Live Dashboard</p>
<nav>
  <a href="/">🔗 Connexion</a>
  <a href="/dashboard" class="active">📊 Dashboard</a>
</nav>
<div id="app"><p style="color:var(--muted);text-align:center">Chargement...</p></div>
<footer>Auto-refresh 5s &nbsp;·&nbsp; DENTSUS V7 XMD &nbsp;·&nbsp; Natsu Tech</footer>
<script>
function fmt(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24);if(d>0)return d+'j '+(h%24)+'h '+(m%60)+'m';if(h>0)return h+'h '+(m%60)+'m '+(s%60)+'s';if(m>0)return m+'m '+(s%60)+'s';return s+'s';}
async function refresh(){
  try{
    const r=await fetch('/stats');const d=await r.json();
    const sm={'online':'online','starting':'wait','reconnecting':'wait','offline':'offline'};
    const sl={'online':'🟢 En ligne','starting':'🟡 Démarrage','reconnecting':'🟡 Reconnexion','offline':'🔴 Hors ligne'};
    document.getElementById('app').innerHTML=\`
      <div class="status-bar">
        <span class="badge \${sm[d.status]||'wait'}">\${sl[d.status]||d.status}</span>
        <span class="bot-num">\${d.botNumber||'Non connecté'}</span>
      </div>
      <div class="grid">
        <div class="card"><div class="lbl">Uptime</div><div class="val g">\${fmt(d.uptimeMs)}</div></div>
        <div class="card"><div class="lbl">Messages</div><div class="val p">\${d.messagesIn}</div></div>
        <div class="card"><div class="lbl">Commandes</div><div class="val pk">\${d.commandsRan}</div></div>
        <div class="card"><div class="lbl">Groupes</div><div class="val y">\${d.groupCount}</div></div>
        <div class="card"><div class="lbl">Sessions</div><div class="val">\${d.sessionCount||1}</div></div>
        <div class="card"><div class="lbl">Plugins</div><div class="val g">\${d.pluginCount}</div></div>
      </div>
      <div style="text-align:center">
        <a href="/" class="pair-btn">+ Connecter un numéro</a>
      </div>
    \`;
  }catch(e){document.getElementById('app').innerHTML='<p style="color:var(--red);text-align:center">Erreur de connexion au bot</p>';}
}
refresh();setInterval(refresh,5000);
</script>
</body>
</html>`;

// ─── HTTP server + API ────────────────────────────────────────
function startDashboard(port) {
  const PORT = port || parseInt(process.env.DASHBOARD_PORT || process.env.PORT || '3000', 10);

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // ── GET /stats ──────────────────────────────────────────
    if (req.method === 'GET' && url === '/stats') {
      const s = getStats();
      s.sessionCount = global.sessions ? global.sessions.size : 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(s));
    }

    // ── POST /api/pair ──────────────────────────────────────
    if (req.method === 'POST' && url === '/api/pair') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { number, sessionId } = JSON.parse(body || '{}');
          if (!number) throw new Error('Numéro manquant.');
          const result = await doPair(number, sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: result.code, sessionId: result.sessionId }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // ── GET /api/sessions ───────────────────────────────────
    if (req.method === 'GET' && url === '/api/sessions') {
      const list = [];
      if (global.sessions) {
        for (const [id, entry] of global.sessions) {
          const sock = entry?.sock;
          list.push({
            id,
            registered: sock?.authState?.creds?.registered || false,
            connected:  sock?.user != null,
          });
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(list));
    }

    // ── GET /dashboard ──────────────────────────────────────
    if (req.method === 'GET' && url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(DASHBOARD_HTML);
    }

    // ── GET / (pairing page) ────────────────────────────────
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAIR_HTML);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`»  [DASHBOARD] http://localhost:${PORT}  — Page de connexion + stats`);
  });

  return server;
}

module.exports = { startDashboard, updateStats, incrementMessages, incrementCommands, getStats };
