// ============================================================
//  DENTSUS V7 XMD — lib/menu.js
//  Menu text generator
// ============================================================

const config = require('../config');

const CATEGORIES = [
  {
    icon: '🌐', name: 'GÉNÉRAL',
    cmds: ['menu','help','alive','ping','botinfo','owner','repo','donate','id','jid','time','date','runtime','version','speed','serverinfo','myinfo','support','contact','qr'],
  },
  {
    icon: '🎭', name: 'DIVERTISSEMENT',
    cmds: ['joke','8ball','flip','dice','love','roast','compliment','quote','fact','truth','dare','wyr','riddle','story','poem','horoscope','trivia','rps','coinflip','password','number','rate','word','slap','hug'],
  },
  {
    icon: '🖼️', name: 'STICKERS & MÉDIA',
    cmds: ['sticker','s','toimg','attp','ttp','blur','grayscale','invert','rotate','circle','resize','meme'],
  },
  {
    icon: '📥', name: 'TÉLÉCHARGEMENTS',
    cmds: ['ytmp3','ytmp4','play','lyrics','tiktok','instagram','ig','twitter','tw','facebook','fb','soundcloud','sc','pinterest','wallpaper','catimg','dogimg','giphy'],
  },
  {
    icon: '👥', name: 'GROUPE & ADMIN',
    cmds: ['kick','add','promote','demote','mute','unmute','open','close','revoke','setname','setdesc','invite','listmembers','listadmins','tagall','hidetag','groupinfo','antilink','antispam','welcome','setwelcome','goodbye'],
  },
  {
    icon: '🤖', name: 'IA & OUTILS',
    cmds: ['gpt','ask','translate','dictionary','wikipedia','wiki','calculate','calc','currency','qrcode','shorturl','weather','news','country','github','npm','base64','md5','sha256','color'],
  },
  {
    icon: '💰', name: 'ÉCONOMIE',
    cmds: ['balance','bal','daily','work','rob','pay','leaderboard','lb','deposit','dep','withdraw','shop'],
  },
  {
    icon: '📝', name: 'NOTES & RAPPELS',
    cmds: ['note','notes','listnotes','delnote','todo','listtodo','deltodo','poll','vote','feedback','report','rules','announce','tagannounce','reminder'],
  },
  {
    icon: '👑', name: 'PROPRIÉTAIRE',
    cmds: ['broadcast','bc','block','unblock','ban','unban','listblock','eval','restart','shutdown','setprefix','addowner','removeowner','cleardb','update','exec','log','setbotname'],
  },
];

function buildMenuText() {
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Brazzaville' });
  const totalCmds = CATEGORIES.reduce((n, c) => n + c.cmds.length, 0);

  let text = `╔══════════════════════╗\n`;
  text += `║  ⚡ *${config.BOT_NAME}*  ║\n`;
  text += `╚══════════════════════╝\n\n`;
  text += `👤 *Propriétaire :* ${config.OWNER_NAME}\n`;
  text += `🔧 *Préfixe :* \`${config.PREFIX}\`\n`;
  text += `📦 *Total commandes :* ${totalCmds}\n`;
  text += `🕐 *Heure :* ${now}\n`;
  text += `\n${'─'.repeat(30)}\n\n`;

  for (const cat of CATEGORIES) {
    text += `${cat.icon} *${cat.name}*\n`;
    text += cat.cmds.map(c => `  ╰ \`${config.PREFIX}${c}\``).join('\n');
    text += `\n\n`;
  }

  text += `${'─'.repeat(30)}\n`;
  text += `✨ _DENTSUS V7 XMD — by Natsu Tech_`;
  return text;
}

module.exports = { buildMenuText, CATEGORIES };
