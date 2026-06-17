// ============================================================
//  DENTSUS V7 XMD — index.js  |  Multi-session bot manager
//  by Natsu Tech
// ============================================================

const fs      = require('fs');
const path    = require('path');
const pino    = require('pino');
const chalk   = require('chalk');
const QRCode  = require('qrcode');

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
global.qrCodes        = new Map(); // id -> { dataUrl, expiresAt }

// ─── Logger ──────────────────────────────────────────────────
const C = {
  arrow:  chalk.hex('#ff6ac1').bold,
  ok:     chalk.hex('#50fa7b').bold,
  sys:    chalk.hex('#ffb86c').bold,
  err:    chalk.hex('#ff5555').bold,
  accent: chalk.hex('#00ffe0').bold,
  dim:    chalk.hex('#6272a4'),
};
const ts     = () => C.dim(new Date().toLocaleTimeString('fr-FR'));
const logOk  = m => console.log(`${C.arrow('»')}  ${C.ok('[OK]')}   ${chalk.white(m)}  ${ts()}`);
const logSys = m => console.log(`${C.arrow('»')}  ${C.sys('[SYS]')}  ${chalk.white(m)}  ${ts()}`);
const logErr = m => console.log(`${C.arrow('»')}  ${C.err('[ERR]')}  ${chalk.red(m)}    ${ts()}`);

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
    fs.writeFileSync(creds, Buffer.from(sessionEnvValue.replace(/^dentsu~/, ''), 'base64').toString('utf8'), 'utf8');
    logOk(`Session restaurée → ${path.basename(sessionDir)}`);
  } catch (e) {
    logErr('Restauration session: ' + e.message);
  }
}

// ─── Anti-link ────────────────────────────────────────────────
async function handleAntiLink(sock, msg, body, groupJid, sender) {
  const gs = getGroupSettings(groupJid);
  if (!gs.antilink) return;
  if (!/https?:\/\/|wa\.me\/|chat\.whatsapp\.com\//i.test(body)) return;
  if (isOwner(sender)) return;
  try {
    await sock.sendMessage(groupJid, { delete: msg.key });
    await sock.sendMessage(groupJid, { text: `🚫 @${sender.split('@')[0]} les liens sont interdits!`, mentions: [sender] });
  } catch {}
}

// ─── Message context ─────────────────────────────────────────
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
    reply:   text  => reply(sock, msg, text),
    react:   emoji => react(sock, msg, emoji),
    isOwner: isOwner(sender),
  };
}

// ─── Core session starter ────────────────────────────────────
async function startSession(sessionId, sessionEnvValue) {
  const sessionDir = path.join(__dirname, 'session', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  await restoreSession(sessionDir, sessionEnvValue);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal:              false,
    markOnlineOnConnect:            true,
    syncFullHistory:                false,
    generateHighQualityLinkPreview: true,
    browser: Browsers.macOS('Chrome'),
  });

  global.sessions.set(sessionId, { sock });

  // ── QR code generation (when not yet authenticated) ───────
  sock.ev.on('qr', async qrString => {
    try {
      const dataUrl = await QRCode.toDataURL(qrString, {
        width: 320, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      // QR codes expire in ~25 seconds in WhatsApp
      global.qrCodes.set(sessionId, { dataUrl, expiresAt: Date.now() + 25000 });
      logSys(`[${sessionId}] QR code prêt — ouvre le dashboard pour scanner`);
    } catch (e) {
      logErr('QR génération: ' + e.message);
    }
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      global.qrCodes.delete(sessionId); // clear QR — no longer needed
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
        logErr(`[${sessionId}] Déconnecté définitivement.`);
        global.sessions.delete(sessionId);
        global.qrCodes.delete(sessionId);
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
      if (config.AUTOTYPING_ENABLED) await sock.sendPresenceUpdate('composing', ctx.jid).catch(() => {});
      if (config.AUTORECORD_ENABLED) await sock.sendPresenceUpdate('recording', ctx.jid).catch(() => {});
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

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  printBanner();
  startDashboard();
  loadPlugins();
  watchPlugins();
  updateStats({ pluginCount: plugins.size });

  // Collect sessions — SESSION_ID + SESSION_1 … SESSION_100
  const sessions = [];
  if (process.env.SESSION_ID) sessions.push({ id: 'main',  value: process.env.SESSION_ID });
  for (let i = 1; i <= 100; i++) {
    const val = process.env[`SESSION_${i}`];
    if (val) sessions.push({ id: `bot${i}`, value: val });
  }

  // If no session env vars → start one slot so QR is available in the dashboard
  if (sessions.length === 0) {
    sessions.push({ id: 'main', value: '' });
  }

  logSys(`Démarrage de ${sessions.length} session(s)...`);
  for (const s of sessions) {
    await startSession(s.id, s.value);
    if (sessions.length > 1) await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
