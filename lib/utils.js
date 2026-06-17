// ============================================================
//  DENTSUS V7 XMD — lib/utils.js
//  Shared helpers for all plugins
// ============================================================

const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const config = require('../config');

// ─── Reply helpers ────────────────────────────────────────────
async function reply(sock, msg, text) {
  return sock.sendMessage(msg.key.remoteJid, { text: String(text) }, { quoted: msg });
}

async function react(sock, msg, emoji) {
  return sock.sendMessage(msg.key.remoteJid, {
    react: { text: emoji, key: msg.key }
  });
}

async function sendImage(sock, msg, buffer, caption = '') {
  return sock.sendMessage(msg.key.remoteJid, { image: buffer, caption }, { quoted: msg });
}

async function sendVideo(sock, msg, buffer, caption = '') {
  return sock.sendMessage(msg.key.remoteJid, { video: buffer, caption }, { quoted: msg });
}

async function sendAudio(sock, msg, buffer) {
  return sock.sendMessage(msg.key.remoteJid, { audio: buffer, mimetype: 'audio/mpeg' }, { quoted: msg });
}

async function sendSticker(sock, msg, buffer) {
  return sock.sendMessage(msg.key.remoteJid, { sticker: buffer }, { quoted: msg });
}

// ─── Auth helpers ─────────────────────────────────────────────
function isOwner(sender) {
  const num = sender.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
  return config.OWNER.includes(num);
}

async function isGroupAdmin(sock, groupJid, sender) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
  } catch { return false; }
}

async function isBotAdmin(sock, groupJid) {
  try {
    const botJid = sock.user.id;
    const meta   = await sock.groupMetadata(groupJid);
    return meta.participants.some(p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin'));
  } catch { return false; }
}

// ─── Media helpers ────────────────────────────────────────────
async function downloadMedia(msg) {
  const type    = getContentType(msg.message);
  const content = msg.message?.[type];
  if (!content) return null;

  const stream  = await downloadContentFromMessage(content, type.replace('Message', ''));
  const chunks  = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getQuoted(msg) {
  const type = getContentType(msg.message);
  return msg.message?.[type]?.contextInfo?.quotedMessage || null;
}

function getMsgType(msg) {
  return getContentType(msg.message) || 'unknown';
}

// ─── Text helpers ─────────────────────────────────────────────
function getPhoneFromJid(jid) {
  return jid?.split('@')[0] || jid;
}

function formatNumber(n) {
  return Number(n).toLocaleString('fr-FR');
}

function msToHuman(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── HTTP helper ──────────────────────────────────────────────
async function fetchJson(url, opts = {}) {
  const axios = require('axios');
  const res   = await axios.get(url, { timeout: 10000, ...opts });
  return res.data;
}

async function fetchText(url, opts = {}) {
  const axios = require('axios');
  const res   = await axios.get(url, { timeout: 10000, responseType: 'text', ...opts });
  return res.data;
}

async function fetchBuffer(url, opts = {}) {
  const axios = require('axios');
  const res   = await axios.get(url, { timeout: 20000, responseType: 'arraybuffer', ...opts });
  return Buffer.from(res.data);
}

module.exports = {
  reply, react, sendImage, sendVideo, sendAudio, sendSticker,
  isOwner, isGroupAdmin, isBotAdmin,
  downloadMedia, getQuoted, getMsgType,
  getPhoneFromJid, formatNumber, msToHuman, pickRandom, chunk,
  fetchJson, fetchText, fetchBuffer,
};
