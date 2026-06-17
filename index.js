// ============================================================
//  DENTSUS V7 XMD — index.js  |  Multi-session bot manager
//  by Natsu Tech
// ============================================================

const fs      = require('fs');
const path    = require('path');
const pino    = require('pino');
const chalk   = require('chalk');
const readline = require('readline');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
} = require('@whiskeysockets/baileys');

const { loadPlugins, watchPlugins, plugins, registerPlugin } = require('./fetchPlugins');
const { startDashboard, updateStats, incrementMessages, incrementCommands } = require('./dashboard');
const { isBanned, getGroupSettings, setGroupSetting } = require('./lib/database');
const { isOwner, reply, react } = require('./lib/utils');
const config = require('./config');

global.botStartTime    = Date.now();
global.registerPlugin  = registerPlugin;
global.plugins         = plugins;
global.config          = config;
global.sessions        = new Map(); // id -> sock

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

function ts() {
  return C.dim(new Date().toLocaleTimeString('fr-FR'));
}
function logOk(msg)  { console.log(`${C.arrow('»')}  ${C.ok('[OK]')}   ${chalk.white(msg)}  ${ts()}`); }
function logSys(msg) { console.log(`${C.arrow('»')}  ${C.sys('[SYS]')}  ${chalk.white(msg)}  ${ts()}`); }
function logErr(msg) { console.log(`${C.arrow('»')}  ${C.err('[ERR]')}  ${chalk.red(msg)}    ${ts()}`); }
function logMsg(from, name, body, isGC, group) {
  if (isGC) {
    console.log(`${C.arrow('»')}  ${C.purple('[GC]')}   ${C.cyan(group)} › ${chalk.green.bold(name)}: ${chalk.hex('#8be9fd')(body.slice(0, 80))}`);
  } else {
    console.log(`${C.arrow('»')}  ${C.sys('[DM]')}   ${chalk.yellow.bold(name)}: ${chalk.hex('#ff9f43')(body.slice(0, 80))}`);
  }
}

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

// ─── Session restore ──────────────────────────────────────────
async function restoreSession(sessionDir, sessionId) {
  if (!sessionId || !sessionId.startsWith('dentsu~')) return;
  const b64  = sessionId.replace(/^dentsu~/, '');
  const creds = path.join(sessionDir, 'creds.json');
  if (fs.existsSync(creds)) return;
  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(creds, Buffer.from(b64, 'base64').toString('utf8'), 'utf8');
    logOk(`Session restored → ${path.basename(sessionDir)}`);
  } catch (e) {
    logErr('Session restore failed: ' + e.message);
  }
}

// ─── Pairing code ─────────────────────────────────────────────
async function askNumber(sessionId) {
  if (config.OWNER[0]) return config.OWNER[0];
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  [${sessionId}] Enter WhatsApp number: `, num => { rl.close(); resolve(num.trim().replace(/\D/g, '')); });
  });
}

// ─── Anti-link handler ────────────────────────────────────────
async function handleAntiLink(sock, msg, body, groupJid, sender) {
  const gs = getGroupSettings(groupJid);
  if (!gs.antilink) return;
  const linkRe = /https?:\/\/|wa\.me\/|chat\.whatsapp\.com\//i;
  if (!linkRe.test(body)) return;
  if (isOwner(sender)) return;
  try {
    await sock.sendMessage(groupJid, { delete: msg.key });
    await sock.sendMessage(groupJid, { text: `🚫 @${sender.split('@')[0]} les liens sont interdits dans ce groupe!`, mentions: [sender] });
  } catch {}
}

// ─── Message handler ──────────────────────────────────────────
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

  const isCmd    = body.startsWith(config.PREFIX);
  const [rawCmd, ...args] = isCmd ? body.slice(config.PREFIX.length).trim().split(/\s+/) : ['', []];
  const command  = rawCmd.toLowerCase();

  return { sock, msg, jid, isGroup, sender, pushName, type, body, isCmd, command, args, sessionId,
    reply: (text) => reply(sock, msg, text),
    react: (emoji) => react(sock, msg, emoji),
    isOwner: isOwner(sender),
  };
}

// ─── Start one session ────────────────────────────────────────
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
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    browser: [config.BOT_NAME, 'Chrome', '120.0.0'],
  });

  global.sessions.set(sessionId, sock);

  // Pairing
  if (!sock.authState.creds.registered) {
    logSys(`[${sessionId}] No session — requesting pairing code...`);
    const num = await askNumber(sessionId);
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(num);
        console.log(`\n  ${C.accent('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
        console.log(`  ${C.sys('[' + sessionId + ']')} Pairing code for ${C.cyan(num)}:`);
        console.log(`  ${C.accent.bold('  ' + code)}`);
        console.log(`  ${C.dim('WhatsApp → Appareils connectés → Lier avec un numéro')}`);
        console.log(`  ${C.accent('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}\n`);
      } catch (e) { logErr(`[${sessionId}] Pairing error: ${e.message}`); }
    }, 3000);
  }

  // Connection events
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      const botJid = jidNormalizedUser(sock.user.id);
      logOk(`[${sessionId}] Connected as ${botJid}`);
      updateStats({ status: 'online', botNumber: botJid, connectedAt: Date.now() });
      try {
        const groups = await sock.groupFetchAllParticipating();
        updateStats({ groupCount: Object.keys(groups).length });
      } catch {}
    }
    if (connection === 'close') {
      const code         = lastDisconnect?.error?.output?.statusCode;
      const willReconnect = code !== DisconnectReason.loggedOut;
      logSys(`[${sessionId}] Closed (code: ${code}). Reconnect: ${willReconnect}`);
      updateStats({ status: 'reconnecting' });
      if (willReconnect) {
        setTimeout(() => startSession(sessionId, sessionEnvValue), 5000);
      } else {
        logErr(`[${sessionId}] Logged out. Delete session/${sessionId}/ and restart.`);
        global.sessions.delete(sessionId);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Group participant update (welcome/goodbye)
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    const gs = getGroupSettings(id);
    try {
      if (action === 'add' && gs.welcome) {
        for (const p of participants) {
          const name = p.split('@')[0];
          const text = (gs.welcome_msg || 'Welcome {name}!').replace('{name}', `@${name}`);
          await sock.sendMessage(id, { text, mentions: [p] });
        }
      }
      if (action === 'remove' && gs.goodbye) {
        for (const p of participants) {
          const name = p.split('@')[0];
          const text = (gs.goodbye_msg || 'Goodbye {name}!').replace('{name}', `@${name}`);
          await sock.sendMessage(id, { text, mentions: [p] });
        }
      }
    } catch {}
  });

  // Message handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      incrementMessages();
      updateStats({ pluginCount: plugins.size });

      const ctx = buildCtx(sock, msg, sessionId);

      // Auto-read
      if (config.AUTOREAD_ENABLED) {
        await sock.readMessages([msg.key]).catch(() => {});
      }

      // Auto-presence
      if (config.AUTOTYPING_ENABLED) {
        await sock.sendPresenceUpdate('composing', ctx.jid).catch(() => {});
      }
      if (config.AUTORECORD_ENABLED) {
        await sock.sendPresenceUpdate('recording', ctx.jid).catch(() => {});
      }

      // Ban check
      if (isBanned(ctx.sender)) continue;

      // Antilink
      if (ctx.isGroup) {
        await handleAntiLink(sock, msg, ctx.body, ctx.jid, ctx.sender).catch(() => {});
      }

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

  // Collect sessions from env
  const sessions = [];

  if (process.env.SESSION_ID) {
    sessions.push({ id: 'main', value: process.env.SESSION_ID });
  }
  for (let i = 1; i <= 10; i++) {
    const val = process.env[`SESSION_${i}`];
    if (val) sessions.push({ id: `bot${i}`, value: val });
  }
  if (sessions.length === 0) {
    sessions.push({ id: 'main', value: '' });
  }

  logSys(`Starting ${sessions.length} session(s)...`);
  for (const s of sessions) {
    await startSession(s.id, s.value);
    if (sessions.length > 1) await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
