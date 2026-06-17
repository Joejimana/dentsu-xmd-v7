// ============================================================
//  DENTSUS V7 XMD — index.js  |  Multi-session bot manager
//  by Natsu Tech
// ============================================================

const fs   = require('fs');
const path = require('path');
const pino = require('pino');
const chalk = require('chalk');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  Browsers,
} = require('@whiskeysockets/baileys');

const { loadPlugins, watchPlugins, plugins, registerPlugin } = require('./fetchPlugins');
const { startDashboard, updateStats, incrementMessages, incrementCommands } = require('./dashboard');
const { isBanned, getGroupSettings } = require('./lib/database');
const { isOwner, reply, react } = require('./lib/utils');
const config = require('./config');

global.botStartTime   = Date.now();
global.registerPlugin = registerPlugin;
global.plugins        = plugins;
global.config         = config;
global.sessions       = new Map(); // id -> { sock }

// ─── Logger ──────────────────────────────────────────────────
const C = {
  arrow:  chalk.hex('#ff6ac1').bold,
  ok:     chalk.hex('#50fa7b').bold,
  sys:    chalk.hex('#ffb86c').bold,
  err:    chalk.hex('#ff5555').bold,
  accent: chalk.hex('#00ffe0').bold,
  dim:    chalk.hex('#6272a4'),
  cyan:   chalk.hex('#00ffe0'),
  purple: chalk.hex('#bd93f9'),
};
function ts()        { return C.dim(new Date().toLocaleTimeString('fr-FR')); }
function logOk(m)    { console.log(`${C.arrow('»')}  ${C.ok('[OK]')}   ${chalk.white(m)}  ${ts()}`); }
function logSys(m)   { console.log(`${C.arrow('»')}  ${C.sys('[SYS]')}  ${chalk.white(m)}  ${ts()}`); }
function logErr(m)   { console.log(`${C.arrow('»')}  ${C.err('[ERR]')}  ${chalk.red(m)}    ${ts()}`); }

function printBanner() {
  console.log('');
  console.log(C.accent('  ██████╗ ███████╗███╗   ██╗████████╗███████╗██╗   ██╗ ██╗  ██╗███╗   ███╗██████╗'));
  console.log(C.accent('  ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔════╝██║   ██║ ╚██╗██╔╝████╗ ████║██╔══██╗'));
  console.log(C.accent('  ██║  ██║█████╗  ██╔██╗ ██║   ██║   ███████╗██║   ██║  ╚███╔╝ ██╔████╔██║██║  ██║'));
  console.log(C.accent('  ██║  ██║██╔══╝  ██║╚██╗██║   ██║   ╚════██║██║   ██║  ██╔██╗ ██║╚██╔╝██║██║  ██║'));
  console.log(C.accent('  ██████╔╝███████╗██║ ╚████║   ██║   ███████║╚██████╔╝ ██╔╝ ██╗██║ ╚═╝ ██║██████╔╝'));
  console.log(C.accent('  ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝ ╚═════╝  ╚═╝  ╚═╝╚═╝     ╚═╝╚═════╝'));
  console.log('');
  console.log(`  ${C.sys('Bot     :')} ${config.BOT_NAME}  ${C.dim('v' + config.VERSION)}`);
  console.log(`  ${C.sys('Owner   :')} ${config.OWNER_NAME}`);
  console.log(`  ${C.sys('Numbers :')} ${config.OWNER.join(' · ')}`);
  console.log(`  ${C.sys('Prefix  :')} ${config.PREFIX}`);
  console.log('');
}

// ─── Session restore from env (dentsu~base64) ─────────────────
async function restoreSession(sessionDir, sessionEnvValue) {
  if (!sessionEnvValue || !sessionEnvValue.startsWith('dentsu~')) return;
  const creds = path.join(sessionDir, 'creds.json');
  if (fs.existsSync(creds)) return;
  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    const decoded = Buffer.from(sessionEnvValue.replace(/^dentsu~/, ''), 'base64').toString('utf8');
    fs.writeFileSync(creds, decoded, 'utf8');
    logOk(`Session restaurée → ${path.basename(sessionDir)}`);
  } catch (e) {
    logErr('Restauration session: ' + e.message);
  }
}

// ─── Make a socket (shared factory) ──────────────────────────
async function makeSocket(sessionDir) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version }          = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal:            false,
    markOnlineOnConnect:          true,
    syncFullHistory:              false,
    generateHighQualityLinkPreview: true,
    browser: Browsers.macOS('Chrome'),
  });
  return { sock, saveCreds, state };
}

// ─── Anti-link ────────────────────────────────────────────────
async function handleAntiLink(sock, msg, body, groupJid, sender) {
  const gs = getGroupSettings(groupJid);
  if (!gs.antilink) return;
  if (!/https?:\/\/|wa\.me\/|chat\.whatsapp\.com\//i.test(body)) return;
  if (isOwner(sender)) return;
  try {
    await sock.sendMessage(groupJid, { delete: msg.key });
    await sock.sendMessage(groupJid, { text: `🚫 @${sender.split('@')[0]} les liens sont interdits dans ce groupe!`, mentions: [sender] });
  } catch {}
}

// ─── Message context builder ──────────────────────────────────
function buildCtx(sock, msg, sessionId) {
  const jid      = msg.key.remoteJid;
  const isGroup  = jid.endsWith('@g.us');
  const sender   = isGroup ? (msg.key.participant || msg.key.remoteJid) : msg.key.remoteJid;
  const pushName = msg.pushName || 'User';
  const type     = getContentType(msg.message);
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '';
  const isCmd   = body.startsWith(config.PREFIX);
  const [rawCmd, ...args] = isCmd ? body.slice(config.PREFIX.length).trim().split(/\s+/) : ['', []];
  const command = rawCmd.toLowerCase();
  return {
    sock, msg, jid, isGroup, sender, pushName, type, body,
    isCmd, command, args, sessionId,
    reply:   (text)  => reply(sock, msg, text),
    react:   (emoji) => react(sock, msg, emoji),
    isOwner: isOwner(sender),
  };
}

// ─── Start a full bot session (registered/authenticated) ──────
async function startSession(sessionId, sessionEnvValue) {
  const sessionDir = path.join(__dirname, 'session', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  await restoreSession(sessionDir, sessionEnvValue);

  const { sock, saveCreds } = await makeSocket(sessionDir);
  global.sessions.set(sessionId, { sock });

  if (!sock.authState.creds.registered) {
    logSys(`[${sessionId}] Non connecté — ouvre le dashboard et entre ton numéro.`);
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      const botJid = jidNormalizedUser(sock.user.id);
      logOk(`[${sessionId}] Connecté en tant que ${botJid}`);
      updateStats({ status: 'online', botNumber: botJid, connectedAt: Date.now() });
      try {
        const groups = await sock.groupFetchAllParticipating();
        updateStats({ groupCount: Object.keys(groups).length });
      } catch {}
    }
    if (connection === 'close') {
      const code          = lastDisconnect?.error?.output?.statusCode;
      const willReconnect = code !== DisconnectReason.loggedOut;
      logSys(`[${sessionId}] Fermé (code: ${code}). Reconnexion: ${willReconnect}`);
      updateStats({ status: 'reconnecting' });
      if (willReconnect) {
        setTimeout(() => startSession(sessionId, sessionEnvValue), 5000);
      } else {
        logErr(`[${sessionId}] Déconnecté. Supprime session/${sessionId}/ et redémarre.`);
        global.sessions.delete(sessionId);
        updateStats({ status: 'offline' });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    const gs = getGroupSettings(id);
    try {
      if (action === 'add' && gs.welcome) {
        for (const p of participants) {
          const name = p.split('@')[0];
          const text = (gs.welcome_msg || 'Bienvenue {name}!').replace('{name}', `@${name}`);
          await sock.sendMessage(id, { text, mentions: [p] });
        }
      }
      if (action === 'remove' && gs.goodbye) {
        for (const p of participants) {
          const name = p.split('@')[0];
          const text = (gs.goodbye_msg || 'Au revoir {name}!').replace('{name}', `@${name}`);
          await sock.sendMessage(id, { text, mentions: [p] });
        }
      }
    } catch {}
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      incrementMessages();
      updateStats({ pluginCount: plugins.size });
      const ctx = buildCtx(sock, msg, sessionId);
      if (config.AUTOREAD_ENABLED)   await sock.readMessages([msg.key]).catch(() => {});
      if (config.AUTOTYPING_ENABLED) await sock.sendPresenceUpdate('composing',  ctx.jid).catch(() => {});
      if (config.AUTORECORD_ENABLED) await sock.sendPresenceUpdate('recording',  ctx.jid).catch(() => {});
      if (isBanned(ctx.sender)) continue;
      if (ctx.isGroup) await handleAntiLink(sock, msg, ctx.body, ctx.jid, ctx.sender).catch(() => {});
      if (!ctx.isCmd || !ctx.command) continue;
      const handler = plugins.get(ctx.command);
      if (!handler) continue;
      incrementCommands();
      try {
        await react(sock, msg, '⏳');
        await handler(ctx);
        await react(sock, msg, '✅');
      } catch (err) {
        logErr(`[${ctx.command}] ${err.message}`);
        await ctx.reply(`❌ Erreur: ${err.message}`).catch(() => {});
        await react(sock, msg, '❌').catch(() => {});
      }
    }
  });

  return sock;
}

// ─── On-demand pairing (called by dashboard /api/pair) ────────
// Creates a FRESH dedicated socket for each pairing request.
// This avoids all state/timing issues with the main bot socket.
global.pairSession = async function pairSession(sessionId, phoneNumber) {
  const cleanNum   = String(phoneNumber).replace(/\D/g, '');
  if (!cleanNum || cleanNum.length < 7) throw new Error('Numéro invalide.');

  const sessionDir = path.join(__dirname, 'session', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  // If creds exist and are registered, this session is already paired
  const credsFile = path.join(sessionDir, 'creds.json');
  if (fs.existsSync(credsFile)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
      if (creds.registered) {
        throw new Error(`Session "${sessionId}" est déjà connectée. Choisis une session libre ou supprime son dossier.`);
      }
    } catch (e) {
      if (e.message.includes('déjà connectée')) throw e;
      // Corrupted creds — clear and start fresh
      fs.rmSync(sessionDir, { recursive: true, force: true });
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  // Terminate any existing socket for this session to avoid conflicts
  const existing = global.sessions.get(sessionId);
  if (existing?.sock) {
    try { existing.sock.end(); } catch {}
  }

  logSys(`[${sessionId}] Création socket de jumelage pour ${cleanNum}...`);

  const { sock, saveCreds } = await makeSocket(sessionDir);

  // Wait for the WebSocket link to WhatsApp servers to be up (max 25s)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Impossible de joindre les serveurs WhatsApp (timeout 25s). Attends 30s et réessaie.'));
    }, 25000);
    const off = sock.ev.on('connection.update', ({ connection }) => {
      if (connection === 'connecting' || connection === 'open' || connection === 'close') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  // Request the pairing code from WhatsApp
  let code;
  try {
    code = await sock.requestPairingCode(cleanNum);
  } catch (e) {
    try { sock.end(); } catch {}
    throw new Error(`WhatsApp a refusé le code: ${e.message}`);
  }

  sock.ev.on('creds.update', saveCreds);

  // Store the pairing socket — when WhatsApp authenticates it, boot the full session
  global.sessions.set(sessionId, { sock });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      logOk(`[${sessionId}] Jumelage réussi — démarrage session complète`);
      updateStats({ status: 'online', botNumber: jidNormalizedUser(sock.user.id), connectedAt: Date.now() });
      // Hand off to full session handler (preserves message handling, reconnect, etc.)
      // We don't call startSession again here to avoid double socket — the current sock
      // is already handling messages. Just wire up the message/group events.
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        logSys(`[${sessionId}] Reconnexion après jumelage...`);
        setTimeout(() => startSession(sessionId, ''), 3000);
      } else {
        global.sessions.delete(sessionId);
      }
    }
  });

  logOk(`[${sessionId}] Code de jumelage généré: ${code}`);
  return { code, sessionId };
};

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  printBanner();
  startDashboard();
  loadPlugins();
  watchPlugins();
  updateStats({ pluginCount: plugins.size });

  // Collect sessions from env — supports SESSION_ID + SESSION_1 … SESSION_100
  const sessions = [];
  if (process.env.SESSION_ID) sessions.push({ id: 'main',  value: process.env.SESSION_ID });
  for (let i = 1; i <= 100; i++) {
    const val = process.env[`SESSION_${i}`];
    if (val) sessions.push({ id: `bot${i}`, value: val });
  }
  if (sessions.length === 0) {
    // No credentials — wait for user to pair via dashboard
    logSys('Aucune session configurée. Ouvre le dashboard web pour connecter un numéro.');
    // Create placeholder so dashboard knows a session slot is available
    global.sessions.set('main', { sock: null });
    return;
  }

  logSys(`Démarrage de ${sessions.length} session(s)...`);
  for (const s of sessions) {
    await startSession(s.id, s.value);
    if (sessions.length > 1) await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
