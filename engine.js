// Питомец живёт по часам устройства. 100 — хорошо (сыт, бодр, чист).
// Пока клиент закрыт, время всё равно считается: следующий запуск догоняет lastTick.

const HOUR = 3600000;

const ARCH = {
  dog: { label: 'собачьи', hunger: 6.5, energy: 5, clean: 4.5, food: 'кусок варёной курицы', spot: 'коврик у двери' },
  cat: { label: 'кошачьи', hunger: 5.5, energy: 4, clean: 2.5, food: 'полоску рыбы', spot: 'подоконник' },
  herb: { label: 'травоядные', hunger: 7, energy: 4.5, clean: 6, food: 'пучок зелени', spot: 'тень под креслом' },
  bird: { label: 'птицы', hunger: 6, energy: 4, clean: 5, food: 'горсть семечек', spot: 'плечо' },
  rodent: { label: 'грызуны', hunger: 8, energy: 5.5, clean: 6.5, food: 'семечко', spot: 'гнездо из тряпки' },
  slow: { label: 'медлительные', hunger: 2, energy: 2, clean: 2, food: 'лист салата', spot: 'тёплый камень' },
  reptile: { label: 'рептилии', hunger: 1.2, energy: 1.5, clean: 1.5, food: 'кусок мяса', spot: 'ветку под лампой' },
  other: { label: 'свой зверь', hunger: 5.5, energy: 4, clean: 4, food: 'привычную еду', spot: 'своё место' },
};

const ARCH_WORDS = [
  ['dog', 'собак пёс пес щен волк лис корг такс хаск овчар'],
  ['cat', 'кош кот кис рысь пантер тигр лев ягуар'],
  ['herb', 'крол заяц коз олен лошад пони овц'],
  ['bird', 'попуг птиц ворон сов сокол орёл орел голуб'],
  ['rodent', 'хомя крыс мыш хорёк хорек шиншилл свинк'],
  ['slow', 'черепах улитк ленив'],
  ['reptile', 'зме ящер игуан геккон дракон варан'],
];

const TEMPER = {
  calm: { label: 'спокойный', freq: 0.6 },
  playful: { label: 'игривый', freq: 1.3 },
  naughty: { label: 'вредный', freq: 1.2 },
  shy: { label: 'пугливый', freq: 0.8 },
  clingy: { label: 'ласковый', freq: 1.15 },
};

const STAGES = [
  { id: 'pup', label: 'детёныш', at: 0 },
  { id: 'teen', label: 'подросток', at: 72 },
  { id: 'adult', label: 'взрослый', at: 240 },
  { id: 'old', label: 'пожилой', at: 1440 },
];

const BONDS = [
  { at: 0, label: 'чужой' },
  { at: 20, label: 'привык' },
  { at: 45, label: 'друг' },
  { at: 70, label: 'предан' },
  { at: 90, label: 'неразлучны' },
];

const ACTS = {
  hungry: ['крутится у пустой миски и не уходит', 'тычется в руку и смотрит в сторону еды', 'садится напротив и ждёт, не моргая'],
  bored: ['приносит то, чем играют, и роняет под ноги', 'ложится поперёк прохода', 'лезет в середину разговора'],
  dirty: ['оставляет следы там, где только что было чисто', 'трясётся и разбрасывает подстилку'],
  love: ['кладёт голову на колено и замирает', 'подставляется под руку и не даёт её убрать'],
  mischief: ['тянет со стола то, что плохо лежит', 'лезет туда, куда нельзя, и делает вид, что так и надо'],
  sleepy: ['зевает и устраивается на самом тёплом месте', 'затихает и перестаёт отзываться'],
  sick: ['лежит и не поднимает головы', 'отворачивается от еды'],
  hurt: ['смотрит из угла и не подходит', 'ложится спиной и делает вид, что спит'],
  jeal: ['вклинивается между людьми и требует внимания себе', 'тычется именно сейчас и не уходит'],
  happy: ['носится так, что задевает мебель', 'не может усидеть и заглядывает в глаза'],
};

const SCENES = [
  { id: 'storm', words: ['гром', 'молни', 'гроза'], mood: 'hurt', line: 'вздрагивает и жмётся к ногам' },
  { id: 'food', words: ['обед', 'ужин', 'завтрак', 'кухн', 'еда'], mood: 'hungry', line: 'срывается на запах еды' },
  { id: 'door', words: ['дверь', 'звонок', 'вернул'], mood: 'bored', line: 'бежит к порогу раньше всех' },
  { id: 'fight', words: ['ссор', 'крик', 'удар'], mood: 'hurt', line: 'уходит под мебель и не высовывается' },
  { id: 'close', words: ['поцел', 'обня', 'обним', 'прижал'], mood: 'jeal', line: 'лезет между ними и требует себя' },
  { id: 'sleep', words: ['спать', 'кроват', 'засыпа'], mood: 'sleepy', line: 'укладывается рядом и зевает' },
];

function clamp(n) {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 10) / 10;
}

function guessArch(kind) {
  const s = String(kind || '').toLowerCase().replace(/ё/g, 'е');
  let best = 'other';
  let bestLen = 0;
  ARCH_WORDS.forEach(([id, words]) => {
    words.split(' ').forEach((w) => {
      if (w && s.indexOf(w) !== -1 && w.length > bestLen) { best = id; bestLen = w.length; }
    });
  });
  return best;
}

function stageOf(livedHours) {
  let cur = STAGES[0];
  STAGES.forEach((s) => { if (livedHours >= s.at) cur = s; });
  return cur;
}

function bondLabel(v) {
  let cur = BONDS[0];
  BONDS.forEach((b) => { if (v >= b.at) cur = b; });
  return cur.label;
}

function blankPet(input, now) {
  const kind = String(input.kind || 'зверь').trim().slice(0, 40);
  const arch = input.arch && ARCH[input.arch] ? input.arch : guessArch(kind);
  return {
    id: input.id || ('p' + now.toString(36)),
    name: String(input.name || 'Питомец').trim().slice(0, 32) || 'Питомец',
    kind,
    arch,
    temper: TEMPER[input.temper] ? input.temper : 'calm',
    icon: String(input.icon || '🐾').slice(0, 4),
    owner: ['me', 'char', 'both'].indexOf(input.owner) === -1 ? 'me' : input.owner,
    born: now,
    lived: Number(input.lived) || 0,
    lastTick: now,
    lastCare: now,
    st: { hunger: 80, energy: 80, clean: 80 },
    mo: { joy: 10, hurt: 0, jeal: 0 },
    bond: Number(input.bond) || 20,
    sleeping: false,
    sick: false,
    now: null,
    log: [],
    memo: [],
    habits: [],
    careCount: { feed: 0, play: 0, wash: 0 },
    cd: {},
  };
}

function logAdd(pet, text, now) {
  pet.log.unshift({ t: now, text });
  pet.log = pet.log.slice(0, 40);
}

function memoAdd(pet, text) {
  if (pet.memo.indexOf(text) !== -1) return;
  pet.memo.unshift(text);
  pet.memo = pet.memo.slice(0, 12);
}

function archOf(pet) { return ARCH[pet.arch] || ARCH.other; }

function topNeed(pet) {
  if (pet.sick) return 'sick';
  if (pet.sleeping || pet.st.energy < 18) return 'sleepy';
  if (pet.mo.hurt > 18) return 'hurt';
  if (pet.st.hunger < 28) return 'hungry';
  if (pet.st.clean < 28) return 'dirty';
  if (pet.mo.jeal > 16) return 'jeal';
  if (pet.mo.joy > 18) return 'happy';
  if (pet.bond > 55 && Math.random() < 0.4) return 'love';
  if ((TEMPER[pet.temper] || TEMPER.calm).freq > 1 && Math.random() < 0.5) return 'mischief';
  return 'bored';
}

function phraseFor(pet, need) {
  const bank = ACTS[need] || ACTS.bored;
  return pet.name + ' ' + bank[Math.floor(Math.random() * bank.length)];
}

function applyHours(pet, hours, now) {
  const a = archOf(pet);
  const hungerRate = pet.sleeping ? a.hunger * 0.7 : a.hunger;
  pet.st.hunger = clamp(pet.st.hunger - hungerRate * hours);
  if (pet.sleeping) pet.st.energy = clamp(pet.st.energy + 12 * hours);
  else pet.st.energy = clamp(pet.st.energy - a.energy * hours);
  pet.st.clean = clamp(pet.st.clean - a.clean * hours * (pet.sleeping ? 0.4 : 1));
  pet.lived += hours;
  if (!pet.sleeping && pet.st.energy <= 8) pet.sleeping = true;
  const wasSick = pet.sick;
  pet.sick = pet.st.hunger < 8 || pet.st.clean < 8;
  if (pet.sick && !wasSick) pet.mo.joy = clamp(pet.mo.joy - 10);
  pet.mo.joy = clamp(pet.mo.joy - hours * 0.4);
  pet.mo.hurt = clamp(pet.mo.hurt - hours * 0.15);
  pet.mo.jeal = clamp(pet.mo.jeal - hours * 0.5);
  const caredAt = pet.lastCare == null ? (pet.born || now) : pet.lastCare;
  const neglected = now - caredAt;
  if (neglected >= 8 * HOUR && hours >= 1) {
    pet.mo.hurt = clamp(pet.mo.hurt + Math.min(24, neglected / HOUR / 6));
    pet.bond = clamp(pet.bond - Math.min(8, hours / 6));
  }
}

function tickPet(pet, now) {
  const prev = pet.lastTick == null ? now : pet.lastTick;
  let elapsed = now - prev;
  if (elapsed < 0) elapsed = 0;
  if (elapsed > 14 * 24 * HOUR) elapsed = 14 * 24 * HOUR;
  const hours = elapsed / HOUR;
  if (hours > 0) applyHours(pet, hours, now);
  pet.lastTick = now;
  const need = topNeed(pet);
  const quietFor = now - (pet.now && pet.now.ts || 0);
  const temper = TEMPER[pet.temper] || TEMPER.calm;
  if (!pet.sleeping && !pet.sick && hours >= 0.4 && quietFor > HOUR / temper.freq) {
    const line = phraseFor(pet, need);
    pet.now = { text: line, kind: need, ts: now, by: 'self' };
    logAdd(pet, line, now);
    memoAdd(pet, line);
  }
  return pet;
}

function sceneReact(pet, text, now) {
  if (!pet || !text || pet.sleeping || pet.sick) return false;
  const low = String(text).toLowerCase().replace(/ё/g, 'е');
  if (pet.cd && pet.cd.scene && now - pet.cd.scene < 10 * 60000) return false;
  for (let i = 0; i < SCENES.length; i++) {
    const sc = SCENES[i];
    if (sc.words.some((w) => low.indexOf(w) !== -1)) {
      const line = pet.name + ' ' + sc.line;
      pet.now = { text: line, kind: sc.mood, ts: now, by: 'scene' };
      pet.cd = pet.cd || {};
      pet.cd.scene = now;
      if (sc.mood === 'hurt') pet.mo.hurt = clamp(pet.mo.hurt + 8);
      if (sc.mood === 'jeal') pet.mo.jeal = clamp(pet.mo.jeal + 10);
      if (sc.mood === 'hungry') pet.st.hunger = clamp(pet.st.hunger - 2);
      logAdd(pet, line, now);
      memoAdd(pet, line);
      return true;
    }
  }
  return false;
}

function care(pet, action, now) {
  const a = archOf(pet);
  let line = '';
  if (action === 'feed') {
    pet.st.hunger = clamp(pet.st.hunger + 36);
    pet.mo.joy = clamp(pet.mo.joy + 6);
    pet.sick = pet.st.hunger < 8;
    pet.careCount.feed = (pet.careCount.feed || 0) + 1;
    line = pet.name + ' ест ' + a.food + ' и успокаивается';
  } else if (action === 'play') {
    if (pet.st.energy < 15) return { ok: false, line: pet.name + ' слишком вымотан для игры' };
    pet.st.energy = clamp(pet.st.energy - 12);
    pet.mo.joy = clamp(pet.mo.joy + 12);
    pet.bond = clamp(pet.bond + 1);
    pet.careCount.play = (pet.careCount.play || 0) + 1;
    line = pet.name + ' срывается играть и забывает про обиды';
  } else if (action === 'wash') {
    pet.st.clean = clamp(pet.st.clean + 40);
    pet.sick = pet.st.clean < 8 || pet.st.hunger < 8;
    pet.careCount.wash = (pet.careCount.wash || 0) + 1;
    line = pet.name + ' терпит мытьё и потом отряхивается';
  } else if (action === 'rest') {
    pet.sleeping = true;
    line = pet.name + ' сворачивается на ' + a.spot;
  } else if (action === 'wake') {
    pet.sleeping = false;
    pet.st.energy = clamp(pet.st.energy - 4);
    line = pet.name + ' просыпается и ищет, кто его поднял';
  } else if (action === 'stroke') {
    pet.bond = clamp(pet.bond + 2);
    pet.mo.hurt = clamp(pet.mo.hurt - 10);
    pet.mo.joy = clamp(pet.mo.joy + 6);
    line = pet.name + ' замирает под рукой';
  } else if (action === 'walk') {
    pet.st.energy = clamp(pet.st.energy - 10);
    pet.st.clean = clamp(pet.st.clean - 8);
    pet.mo.joy = clamp(pet.mo.joy + 8);
    line = pet.name + ' возвращается с прогулки взъерошенным';
  } else {
    return { ok: false, line: '' };
  }
  pet.lastCare = now;
  pet.now = { text: line, kind: action, ts: now, by: 'care' };
  logAdd(pet, line, now);
  memoAdd(pet, line);
  const habits = [];
  if (pet.careCount.feed >= 3) habits.push('ждёт еду из рук');
  if (pet.careCount.play >= 3) habits.push('сам приносит игру');
  if (pet.careCount.wash >= 3) habits.push('уже не прячется от мытья');
  pet.habits = habits;
  return { ok: true, line };
}

function moodWord(pet) {
  if (pet.sick) return 'болеет';
  if (pet.sleeping) return 'спит';
  if (pet.mo.hurt > 20) return 'обижен';
  if (pet.mo.jeal > 18) return 'ревнует';
  if (pet.st.hunger < 25) return 'голоден';
  if (pet.mo.joy > 20) return 'рад';
  return 'спокоен';
}

function promptBlock(pet, names) {
  if (!pet) return '';
  const stage = stageOf(pet.lived || 0);
  const who = pet.owner === 'char' ? (names.char || 'персонажа') : (pet.owner === 'both' ? 'общий' : (names.user || 'хозяина'));
  const lines = [
    '[Питомец в сцене. Учитывай его, не описывай цифры.]',
    pet.icon + ' ' + pet.name + ' — ' + pet.kind + ', ' + stage.label + ', нрав: ' + (TEMPER[pet.temper] || TEMPER.calm).label + '.',
    'Чей: ' + who + '. Привязанность: ' + bondLabel(pet.bond) + '. Сейчас ' + moodWord(pet) + '.',
    'Голод ' + Math.round(pet.st.hunger) + '/100 (100 сыт), энергия ' + Math.round(pet.st.energy) + ', чистота ' + Math.round(pet.st.clean) + '.',
  ];
  if (pet.habits && pet.habits.length) lines.push('Привычки: ' + pet.habits.join('; ') + '.');
  if (pet.now && pet.now.text) lines.push('Прямо сейчас: ' + pet.now.text + '.');
  if (pet.memo && pet.memo[0]) lines.push('Недавно: ' + pet.memo.slice(0, 3).join('; ') + '.');
  return lines.join('\n');
}

function watcherPrompt(pet, recent) {
  const stage = stageOf(pet.lived || 0);
  return [
    'Опиши одним коротким предложением, что делает питомец прямо сейчас.',
    'Третье лицо, настоящее время, без кавычек, без реплик людей, без слов «промпт», «модель», «ассистент».',
    'Питомец: ' + pet.name + ', ' + pet.kind + ', ' + stage.label + ', нрав ' + (TEMPER[pet.temper] || TEMPER.calm).label + '.',
    'Состояние: сытость ' + Math.round(pet.st.hunger) + '/100, энергия ' + Math.round(pet.st.energy) + ', чистота ' + Math.round(pet.st.clean) + ', ' + moodWord(pet) + '.',
    pet.now && pet.now.text ? ('Уже происходит: ' + pet.now.text) : '',
    'Сцена:',
    recent || '(пусто)',
    'Ответ — только действие питомца.',
  ].filter(Boolean).join('\n');
}

function acceptWatcher(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 240) return '';
  if (/(промпт|модель|ассистент|как ии|system|prompt)/i.test(t)) return '';
  return t.replace(/^["«]|["»]$/g, '');
}

const LocalPetEngine = {
  ARCH, TEMPER, STAGES, blankPet, tickPet, sceneReact, care, promptBlock,
  watcherPrompt, acceptWatcher, guessArch, stageOf, bondLabel, moodWord, topNeed,
};
globalThis.LocalPetEngine = LocalPetEngine;
export { LocalPetEngine };
