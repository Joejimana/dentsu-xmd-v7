// ============================================================
//  DENTSUS V7 XMD — plugins/fun/fun.js
//  25 fun commands
// ============================================================

const { registerPlugin } = global;
const { fetchJson, pickRandom } = require('../../lib/utils');

const JOKES_FR = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tomberaient dans le bateau !",
  "Qu'est-ce qu'un canif ? C'est un petit fien !",
  "Un homme entre dans une bibliothèque : « Avez-vous des livres sur la paranoïa ? » — « Oui, ils sont derrière vous ! »",
  "Pourquoi les souris nagent-elles sur le dos ? Pour ne pas mouiller leurs baskets.",
  "Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ? Un chat-peint de Noël !",
  "Qu'est-ce qu'un crocodile qui surveille la cour d'école ? Un sac à dents !",
  "Pourquoi l'épouvantail a-t-il eu un prix ? Parce qu'il était exceptionnel dans son domaine.",
  "Deux antennes se marient. La cérémonie était nulle, mais la réception était excellente !",
  "Je voulais raconter une blague sur le papier... mais c'est déchirant.",
  "Qu'est-ce qu'un caniche ? Un chien qui n'a pas de bouche !",
];

const QUOTES = [
  "La vie, c'est comme une bicyclette : pour garder l'équilibre, il faut avancer. — Einstein",
  "Sois le changement que tu veux voir dans le monde. — Gandhi",
  "Le seul moyen de faire du bon travail est d'aimer ce que vous faites. — Steve Jobs",
  "L'imagination est plus importante que le savoir. — Einstein",
  "La créativité c'est l'intelligence qui s'amuse. — Einstein",
  "Commencez par faire ce qui est nécessaire, puis ce qui est possible, et soudain vous ferez l'impossible. — François d'Assise",
  "La vie est trop courte pour être petite. — Disraeli",
  "L'avenir appartient à ceux qui se lèvent tôt. — Proverbe",
  "Rien de grand ne s'est accompli dans le monde sans passion. — Hegel",
  "Il n'est jamais trop tard pour devenir ce que l'on aurait pu être. — George Eliot",
];

const FACTS = [
  "Les fourmis ne dorment jamais et n'ont pas de poumons.",
  "La pieuvre a trois cœurs et du sang bleu.",
  "Un escargot peut dormir pendant 3 ans.",
  "Les chats passent 70% de leur vie à dormir.",
  "La banane est techniquement une baie.",
  "Les flamants roses sont blancs à la naissance.",
  "Un groupe de flamants roses s'appelle une 'flamboyance'.",
  "L'eau chaude gèle plus vite que l'eau froide — c'est l'effet Mpemba.",
  "Il y a plus de connexions dans le cerveau humain qu'étoiles dans la Voie Lactée.",
  "Les abeilles peuvent reconnaître les visages humains.",
];

const ROASTS = [
  "Tu es la preuve vivante qu'on peut exister sans apporter de valeur.",
  "Je ne dis pas que tu es bête, mais t'as dû mettre du temps à apprendre à lire ça.",
  "Ton Wi-Fi et ta personnalité ont quelque chose en commun : ils coupent tout le temps.",
  "Tu es le genre de personne qui met une pizza entière au micro-ondes.",
  "Même ton ombre te fuit parfois.",
  "Tu parles tellement que même Google te suggèrerait de te taire.",
];

const COMPLIMENTS = [
  "Tu illumines chaque conversation que tu rejoins ! ✨",
  "Ta présence rend les gens plus heureux sans qu'ils sachent pourquoi 🌟",
  "Tu as une intelligence rare et un cœur encore plus rare 💎",
  "Le monde est meilleur parce que tu y es 🌍",
  "Tu inspires les autres par ta façon d'être, continue comme ça 🚀",
];

const TRUTHS = [
  "Quel est ton pire souvenir d'école ?",
  "As-tu déjà menti à un(e) ami(e) proche ? Pour quoi ?",
  "Quelle est ta plus grande peur secrète ?",
  "As-tu déjà eu le béguin pour quelqu'un dans ce groupe ?",
  "Quelle est la chose la plus stupide que tu aies faite pour impressionner quelqu'un ?",
  "As-tu déjà trahi la confiance de quelqu'un ? Que s'est-il passé ?",
];

const DARES = [
  "Envoie un message 'Je t'aime' à ta maman.",
  "Chante une chanson de 30 secondes en vocal.",
  "Écris un message embarrassant et envoie-le dans ce groupe.",
  "Fais 20 pompes et prouve-le en vocal.",
  "Appelle quelqu'un et dis-lui 'Tu me manques' sans explication.",
  "Change ton nom WhatsApp en 'Patate' pendant 1 heure.",
];

const RIDDLES = [
  { q: "Plus je sèche, plus je suis mouillée. Qu'est-ce que je suis ?", r: "Une serviette !" },
  { q: "J'ai des mains mais je ne peux rien toucher, un visage mais pas de yeux. Qui suis-je ?", r: "Une horloge !" },
  { q: "Je peux courir mais pas marcher, j'ai une bouche mais ne parle pas. Qu'est-ce que je suis ?", r: "Une rivière !" },
  { q: "Plus on m'enlève, plus je grandis. Qu'est-ce que je suis ?", r: "Un trou !" },
  { q: "Je commence la nuit et finis le matin. Je suis ?", r: "La lettre N !" },
];

const WYR = [
  "Voler ou être invisible ?",
  "Savoir toutes les langues ou jouer de tous les instruments ?",
  "Voyager dans le passé ou le futur ?",
  "Être très intelligent(e) ou très riche ?",
  "Ne plus jamais dormir ou dormir 16h par jour ?",
  "Contrôler le feu ou l'eau ?",
];

const HOROSCOPES = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];

registerPlugin('joke', async ({ reply }) => {
  await reply(`😂 *Blague du jour :*\n\n${pickRandom(JOKES_FR)}`);
});

registerPlugin('8ball', async ({ args, reply }) => {
  const question = args.join(' ');
  if (!question) return reply('❓ Pose-moi une question ! Ex: .8ball Est-ce que je vais réussir ?');
  const answers = ['🟢 Oui, définitivement !','🟢 C\'est certain.','🟢 Sans aucun doute.','🟡 Il est possible.','🟡 Concentre-toi et redemande.','🔴 Ne compte pas là-dessus.','🔴 Mes sources disent non.','🔴 Très peu probable.'];
  await reply(`🎱 *Question :* ${question}\n\n*Réponse :* ${pickRandom(answers)}`);
});

registerPlugin('flip', async ({ reply }) => {
  const result = Math.random() < 0.5 ? '🪙 FACE' : '🪙 PILE';
  await reply(`🪙 *Lancer de pièce :*\n\n*Résultat :* ${result}`);
});

registerPlugin('dice', async ({ args, reply }) => {
  const sides = parseInt(args[0]) || 6;
  const result = Math.floor(Math.random() * sides) + 1;
  await reply(`🎲 *Lancer de dé (${sides} faces) :*\n\n*Résultat :* ${result}`);
});

registerPlugin('love', async ({ args, sender, reply }) => {
  const target = args[0] || 'quelqu\'un';
  const pct = Math.floor(Math.random() * 101);
  const bar = '❤️'.repeat(Math.floor(pct / 10)) + '🖤'.repeat(10 - Math.floor(pct / 10));
  await reply(`💕 *Calculateur d'amour*\n\n${bar}\n*${pct}%* de compatibilité entre toi et ${target} !`);
});

registerPlugin('roast', async ({ args, reply }) => {
  const target = args[0] || 'toi';
  await reply(`🔥 *Roast pour ${target} :*\n\n${pickRandom(ROASTS)}`);
});

registerPlugin('compliment', async ({ pushName, reply }) => {
  await reply(`💖 *Compliment pour ${pushName} :*\n\n${pickRandom(COMPLIMENTS)}`);
});

registerPlugin('quote', async ({ reply }) => {
  await reply(`💬 *Citation du jour :*\n\n_"${pickRandom(QUOTES)}"_`);
});

registerPlugin('fact', async ({ reply }) => {
  await reply(`🧠 *Le savais-tu ?*\n\n${pickRandom(FACTS)}`);
});

registerPlugin('truth', async ({ reply }) => {
  await reply(`🤍 *VÉRITÉ :*\n\n${pickRandom(TRUTHS)}`);
});

registerPlugin('dare', async ({ reply }) => {
  await reply(`🔥 *DÉFI :*\n\n${pickRandom(DARES)}`);
});

registerPlugin('wyr', async ({ reply }) => {
  await reply(`🤔 *Tu préfères...*\n\n${pickRandom(WYR)}\n\nRéponds honnêtement !`);
});

registerPlugin('riddle', async ({ reply }) => {
  const r = pickRandom(RIDDLES);
  await reply(`🧩 *Devinette :*\n\n${r.q}\n\n||Réponse : ${r.r}||`);
});

registerPlugin('story', async ({ reply }) => {
  const stories = [
    "Il était une fois un développeur qui voulait juste dormir... mais son bot tombait en panne toutes les nuits. Fin. 💻😴",
    "Un jour, un jeune homme envoya un message à un bot WhatsApp. Le bot répondit si vite qu'il crut à un fantôme. Fin. 👻",
    "Dans une galaxie lointaine, un bot nommé DENTSUS V7 XMD sauvait des groupes WhatsApp du chaos... et c'est toujours en cours. 🚀",
  ];
  await reply(`📖 *Histoire courte :*\n\n${pickRandom(stories)}`);
});

registerPlugin('poem', async ({ reply }) => {
  const poems = [
    "Dans le silence du soir,\nLe bot répond avec espoir,\nChaque commande un trésor,\nDENTSU XMD, le plus fort. 🌙",
    "Sous les étoiles connectées,\nLes messages sont envoyés,\nToi et moi, dans ce réseau,\nTout est beau, tout est chaud. ✨",
  ];
  await reply(`🎭 *Poème :*\n\n${pickRandom(poems)}`);
});

registerPlugin('horoscope', async ({ args, reply }) => {
  const sign = args[0];
  if (!sign) return reply(`♈ *Signes disponibles :*\n${HOROSCOPES.join(', ')}\n\nEx: .horoscope Lion`);
  const messages = ['Excellente journée en perspective ! ⭐', 'Restez prudent(e) aujourd\'hui 🌙', 'Une surprise vous attend 🎁', 'Excellent moment pour prendre des décisions importantes 💡', 'Votre entourage aura besoin de vous aujourd\'hui 💖'];
  await reply(`${sign} *Horoscope du jour :*\n\n${pickRandom(messages)}`);
});

registerPlugin('trivia', async ({ reply }) => {
  const questions = [
    { q: 'Quelle est la capitale du Congo-Brazzaville ?', a: 'Brazzaville' },
    { q: 'Combien de continents y a-t-il sur Terre ?', a: '7' },
    { q: 'Qui a peint la Joconde ?', a: 'Léonard de Vinci' },
    { q: 'Quel est le plus grand océan du monde ?', a: 'Pacifique' },
    { q: 'En quelle année l\'homme a-t-il marché sur la Lune ?', a: '1969' },
  ];
  const q = pickRandom(questions);
  await reply(`🧠 *TRIVIA*\n\n❓ ${q.q}\n\n||Réponse : ${q.a}||`);
});

registerPlugin('rps', async ({ args, reply }) => {
  const choices = ['Pierre 🪨', 'Feuille 📄', 'Ciseaux ✂️'];
  const botChoice = pickRandom(choices);
  const userRaw = args[0]?.toLowerCase() || '';
  const map = { pierre: 'Pierre 🪨', feuille: 'Feuille 📄', ciseaux: 'Ciseaux ✂️' };
  const userChoice = map[userRaw];
  if (!userChoice) return reply('❌ Choisis: `.rps pierre`, `.rps feuille` ou `.rps ciseaux`');

  let result;
  if (userChoice === botChoice) result = '🤝 Égalité !';
  else if (
    (userChoice.includes('Pierre') && botChoice.includes('Ciseaux')) ||
    (userChoice.includes('Feuille') && botChoice.includes('Pierre')) ||
    (userChoice.includes('Ciseaux') && botChoice.includes('Feuille'))
  ) result = '🎉 Tu as gagné !';
  else result = '😈 Le bot a gagné !';

  await reply(`✊✋✌️ *Pierre-Feuille-Ciseaux*\n\nTu : ${userChoice}\nBot : ${botChoice}\n\n${result}`);
});

registerPlugin('coinflip', async ({ reply }) => {
  await reply(`🪙 ${Math.random() < 0.5 ? '*FACE !* 😊' : '*PILE !* 🌚'}`);
});

registerPlugin('password', async ({ args, reply }) => {
  const len = Math.min(parseInt(args[0]) || 12, 64);
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pwd = '';
  for (let i = 0; i < len; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  await reply(`🔐 *Mot de passe généré (${len} caractères) :*\n\`${pwd}\``);
});

registerPlugin('number', async ({ args, reply }) => {
  const [min, max] = [parseInt(args[0]) || 1, parseInt(args[1]) || 100];
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  await reply(`🎲 *Nombre aléatoire entre ${min} et ${max} :*\n*${n}*`);
});

registerPlugin('rate', async ({ args, pushName, reply }) => {
  const thing = args.join(' ') || pushName;
  const score = Math.floor(Math.random() * 11);
  const bar   = '⭐'.repeat(score) + '☆'.repeat(10 - score);
  await reply(`⭐ *Évaluation de "${thing}" :*\n${bar}\n*${score}/10*`);
});

registerPlugin('word', async ({ reply }) => {
  const words = ['Épanouissement','Synesthésie','Phospholuminescent','Ineffable','Sérendipité','Mélancolie','Quintessence','Vellichor'];
  const w = pickRandom(words);
  await reply(`📚 *Mot du jour :*\n\n*${w}*`);
});

registerPlugin('slap', async ({ args, sender, reply }) => {
  const target = args[0]?.replace('@', '') || 'quelqu\'un';
  await reply(`👋 *${sender.split('@')[0]} gifle ${target} !*\n\nBAFFF! 💥`);
});

registerPlugin('hug', async ({ args, sender, reply }) => {
  const target = args[0]?.replace('@', '') || 'quelqu\'un';
  await reply(`🤗 *${sender.split('@')[0]} fait un câlin à ${target} !*\n\n*${target}* se sent aimé(e) 💖`);
});
