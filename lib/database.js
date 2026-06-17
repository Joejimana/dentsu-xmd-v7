// ============================================================
//  DENTSUS V7 XMD — lib/database.js
//  SQLite wrapper (economy, notes, settings, cooldowns)
// ============================================================

const path = require('path');
const fs   = require('fs');

const DB_DIR  = path.join(__dirname, '..', 'database');
const DB_PATH = path.join(DB_DIR, 'dentsu.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS economy (
    jid TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    bank    INTEGER DEFAULT 0,
    last_daily TEXT DEFAULT NULL,
    last_work  TEXT DEFAULT NULL,
    xp      INTEGER DEFAULT 0,
    level   INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    jid     TEXT NOT NULL,
    title   TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    jid     TEXT NOT NULL,
    task    TEXT NOT NULL,
    done    INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS group_settings (
    group_jid TEXT PRIMARY KEY,
    antilink  INTEGER DEFAULT 0,
    antispam  INTEGER DEFAULT 0,
    welcome   INTEGER DEFAULT 0,
    welcome_msg TEXT DEFAULT 'Welcome {name}!',
    goodbye   INTEGER DEFAULT 0,
    goodbye_msg TEXT DEFAULT 'Goodbye {name}!'
  );

  CREATE TABLE IF NOT EXISTS banned (
    jid TEXT PRIMARY KEY,
    reason TEXT,
    banned_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cooldowns (
    key TEXT PRIMARY KEY,
    expires_at INTEGER
  );
`);

// ─── Economy ──────────────────────────────────────────────────
function getUser(jid) {
  let user = db.prepare('SELECT * FROM economy WHERE jid = ?').get(jid);
  if (!user) {
    db.prepare('INSERT OR IGNORE INTO economy (jid) VALUES (?)').run(jid);
    user = db.prepare('SELECT * FROM economy WHERE jid = ?').get(jid);
  }
  return user;
}

function updateBalance(jid, amount) {
  getUser(jid);
  return db.prepare('UPDATE economy SET balance = balance + ? WHERE jid = ?').run(amount, jid);
}

function updateBank(jid, amount) {
  getUser(jid);
  return db.prepare('UPDATE economy SET bank = bank + ? WHERE jid = ?').run(amount, jid);
}

function setLastDaily(jid) {
  return db.prepare('UPDATE economy SET last_daily = datetime("now") WHERE jid = ?').run(jid);
}

function setLastWork(jid) {
  return db.prepare('UPDATE economy SET last_work = datetime("now") WHERE jid = ?').run(jid);
}

function getLeaderboard(limit = 10) {
  return db.prepare('SELECT jid, balance + bank as total FROM economy ORDER BY total DESC LIMIT ?').all(limit);
}

// ─── Notes ────────────────────────────────────────────────────
function addNote(jid, title, content) {
  return db.prepare('INSERT INTO notes (jid, title, content) VALUES (?, ?, ?)').run(jid, title, content);
}

function getNotes(jid) {
  return db.prepare('SELECT * FROM notes WHERE jid = ? ORDER BY created_at DESC').all(jid);
}

function deleteNote(jid, id) {
  return db.prepare('DELETE FROM notes WHERE jid = ? AND id = ?').run(jid, id);
}

// ─── Todos ────────────────────────────────────────────────────
function addTodo(jid, task) {
  return db.prepare('INSERT INTO todos (jid, task) VALUES (?, ?)').run(jid, task);
}

function getTodos(jid) {
  return db.prepare('SELECT * FROM todos WHERE jid = ? AND done = 0').all(jid);
}

function doneTodo(jid, id) {
  return db.prepare('UPDATE todos SET done = 1 WHERE jid = ? AND id = ?').run(jid, id);
}

function deleteTodo(jid, id) {
  return db.prepare('DELETE FROM todos WHERE jid = ? AND id = ?').run(jid, id);
}

// ─── Settings ─────────────────────────────────────────────────
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

// ─── Group settings ───────────────────────────────────────────
function getGroupSettings(groupJid) {
  let row = db.prepare('SELECT * FROM group_settings WHERE group_jid = ?').get(groupJid);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO group_settings (group_jid) VALUES (?)').run(groupJid);
    row = db.prepare('SELECT * FROM group_settings WHERE group_jid = ?').get(groupJid);
  }
  return row;
}

function setGroupSetting(groupJid, key, value) {
  getGroupSettings(groupJid);
  return db.prepare(`UPDATE group_settings SET ${key} = ? WHERE group_jid = ?`).run(value, groupJid);
}

// ─── Ban ──────────────────────────────────────────────────────
function banUser(jid, reason = 'No reason') {
  return db.prepare('INSERT OR REPLACE INTO banned (jid, reason) VALUES (?, ?)').run(jid, reason);
}

function unbanUser(jid) {
  return db.prepare('DELETE FROM banned WHERE jid = ?').run(jid);
}

function isBanned(jid) {
  return !!db.prepare('SELECT jid FROM banned WHERE jid = ?').get(jid);
}

// ─── Cooldowns ────────────────────────────────────────────────
function setCooldown(key, seconds) {
  const expires = Date.now() + seconds * 1000;
  return db.prepare('INSERT OR REPLACE INTO cooldowns (key, expires_at) VALUES (?, ?)').run(key, expires);
}

function getCooldown(key) {
  const row = db.prepare('SELECT expires_at FROM cooldowns WHERE key = ?').get(key);
  if (!row) return 0;
  const remaining = row.expires_at - Date.now();
  if (remaining <= 0) {
    db.prepare('DELETE FROM cooldowns WHERE key = ?').run(key);
    return 0;
  }
  return Math.ceil(remaining / 1000);
}

module.exports = {
  db,
  getUser, updateBalance, updateBank, setLastDaily, setLastWork, getLeaderboard,
  addNote, getNotes, deleteNote,
  addTodo, getTodos, doneTodo, deleteTodo,
  getSetting, setSetting,
  getGroupSettings, setGroupSetting,
  banUser, unbanUser, isBanned,
  setCooldown, getCooldown,
};
