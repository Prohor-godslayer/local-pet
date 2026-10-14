function bootPet(host) {
  const shell = globalThis.LocalShell;
  const eng = globalThis.LocalPetEngine;
  const ui = shell.mount({
    id: 'pet', glyph: '🐾', label: 'Локальный питомец', accent: '#9cba7a', bottom: 156, right: 16,
  });
  let db = null;
  let chatId = 'g';
  let view = 'list';
  let activeId = null;
  const ICONS = ['🐾', '🐕', '🐈', '🐇', '🦜', '🐹', '🐢', '🐍', '🦊', '🐉', '🦉', '🐝'];

  function cfg() { return db.cfg || (db.cfg = { inject: true, watcher: true, every: 5 }); }
  function bag() {
    db.byChat = db.byChat || {};
    if (!db.byChat[chatId]) db.byChat[chatId] = { pets: [], activeId: null, seen: 0 };
    return db.byChat[chatId];
  }
  function pets() { return bag().pets; }
  function active() { return pets().find((p) => p.id === (activeId || bag().activeId)) || null; }

  async function persist() {
    await host.save('db', db);
    publish();
  }

  async function publish() {
    if (!cfg().inject) { host.setContext(''); return; }
    const names = await host.names();
    const blocks = pets().map((p) => eng.promptBlock(p, names)).filter(Boolean);
    host.setContext(blocks.join('\n\n'));
  }

  async function load() {
    chatId = await host.chatId();
    db = await host.load('db');
    if (!db || typeof db !== 'object') db = { v: 1, byChat: {}, cfg: { inject: true, watcher: true, every: 5 } };
    const now = Date.now();
    pets().forEach((p) => eng.tickPet(p, now));
    activeId = bag().activeId;
    await persist();
  }

  function bar(label, value) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    return '<div><div class="lx-row"><span class="lx-grow">' + label + '</span><span class="lx-muted">' + v + '</span></div><div class="lx-bar"><span style="width:' + v + '%"></span></div></div>';
  }

  function renderList() {
    ui.setBack(null);
    ui.setTitle('живёт по часам устройства', 'Питомцы');
    const esc = shell.esc;
    const list = pets();
    ui.body.innerHTML =
      '<div class="lx-row"><button type="button" class="lx-btn primary" data-act="new">Новый</button><button type="button" class="lx-btn" data-act="gear">Настройки</button></div>' +
      '<div class="lx-list">' + (list.length ? list.map((p) => {
        const stage = eng.stageOf(p.lived || 0);
        return '<button type="button" class="lx-card" data-act="open" data-id="' + esc(p.id) + '" style="text-align:left;width:100%">' +
          '<div class="lx-row"><strong class="lx-grow">' + esc(p.icon) + ' ' + esc(p.name) + '</strong><span class="lx-muted">' + esc(eng.moodWord(p)) + '</span></div>' +
          '<div class="lx-muted">' + esc(p.kind) + ' · ' + esc(stage.label) + ' · ' + esc(eng.bondLabel(p.bond)) + '</div></button>';
      }).join('') : '<div class="lx-empty">В этом чате никого нет. Заведи зверя — он останется в файле настроек клиента.</div>') + '</div>' +
      '<div class="lx-row"><button type="button" class="lx-btn" data-act="export">Скачать файл</button><label class="lx-btn">Вложить файл<input data-act="import" type="file" accept="application/json" hidden></label></div>';
  }

  function renderPet() {
    const p = active();
    if (!p) { view = 'list'; renderList(); return; }
    ui.setBack(() => { view = 'list'; render(); });
    ui.setTitle(eng.moodWord(p), p.name);
    const esc = shell.esc;
    const stage = eng.stageOf(p.lived || 0);
    ui.body.innerHTML =
      '<div class="lx-card"><div style="font:600 28px/1 Palatino,serif">' + esc(p.icon) + '</div>' +
      '<div>' + esc(p.kind) + ' · ' + esc(stage.label) + ' · ' + esc((eng.TEMPER[p.temper] || eng.TEMPER.calm).label) + '</div>' +
      '<div class="lx-muted">' + esc(eng.bondLabel(p.bond)) + (p.habits && p.habits.length ? ' · ' + esc(p.habits.join(', ')) : '') + '</div>' +
      (p.now ? '<div style="margin-top:6px">' + esc(p.now.text) + '</div>' : '') + '</div>' +
      bar('Сытость', p.st.hunger) + bar('Энергия', p.st.energy) + bar('Чистота', p.st.clean) +
      '<div class="lx-grid">' +
        '<button type="button" class="lx-btn" data-act="care" data-care="feed">Покормить</button>' +
        '<button type="button" class="lx-btn" data-act="care" data-care="play">Играть</button>' +
        '<button type="button" class="lx-btn" data-act="care" data-care="wash">Мыть</button>' +
        '<button type="button" class="lx-btn" data-act="care" data-care="stroke">Гладить</button>' +
        '<button type="button" class="lx-btn" data-act="care" data-care="walk">Гулять</button>' +
        '<button type="button" class="lx-btn" data-act="care" data-care="' + (p.sleeping ? 'wake' : 'rest') + '">' + (p.sleeping ? 'Разбудить' : 'Уложить') + '</button>' +
      '</div>' +
      '<button type="button" class="lx-btn" data-act="watch">Спросить модель, что он делает</button>' +
      '<div class="lx-muted">Последнее</div><div class="lx-list">' +
        (p.log || []).slice(0, 6).map((l) => '<div class="lx-card">' + esc(l.text) + '</div>').join('') +
      '</div>' +
      '<button type="button" class="lx-btn" data-act="remove">Убрать из чата</button>';
  }

  function renderNew() {
    ui.setBack(() => { view = 'list'; render(); });
    ui.setTitle('кто это', 'Новый питомец');
    const tempers = Object.keys(eng.TEMPER).map((id) => '<option value="' + id + '">' + shell.esc(eng.TEMPER[id].label) + '</option>').join('');
    ui.body.innerHTML =
      '<label class="lx-field">Имя<input id="lx-pet-name" maxlength="32" placeholder="Барс"></label>' +
      '<label class="lx-field">Кто это словами<input id="lx-pet-kind" maxlength="40" placeholder="рыжий кот, дракон, хорёк"></label>' +
      '<label class="lx-field">Нрав<select id="lx-pet-temper">' + tempers + '</select></label>' +
      '<label class="lx-field">Чей<select id="lx-pet-owner"><option value="me">мой</option><option value="char">персонажа</option><option value="both">общий</option></select></label>' +
      '<div class="lx-row" id="lx-pet-icons">' + ICONS.map((ic) => '<button type="button" class="lx-icon" data-act="icon" data-icon="' + ic + '">' + ic + '</button>').join('') + '</div>' +
      '<button type="button" class="lx-btn primary" data-act="create">Завести</button>';
    ui.body.dataset.icon = '🐾';
  }

  function renderGear() {
    ui.setBack(() => { view = 'list'; render(); });
    ui.setTitle('без чужого сервера', 'Настройки');
    const c = cfg();
    ui.body.innerHTML =
      '<label class="lx-row"><input type="checkbox" id="lx-pet-inject"' + (c.inject ? ' checked' : '') + '> Отдавать состояние в промпт</label>' +
      '<label class="lx-row"><input type="checkbox" id="lx-pet-watch"' + (c.watcher ? ' checked' : '') + '> Модель-наблюдатель через клиент</label>' +
      '<label class="lx-field">Раз в сколько сообщений<select id="lx-pet-every">' +
        [3, 4, 5, 6, 8, 10].map((n) => '<option value="' + n + '"' + (Number(c.every) === n ? ' selected' : '') + '>' + n + '</option>').join('') +
      '</select></label>' +
      '<p class="lx-muted">Наблюдатель вызывает ту же модель, что уже подключена в SillyTavern или Tavo. Отдельный адрес и ключ не вводятся. Пока клиент закрыт, голод и сон всё равно идут по часам.</p>' +
      '<button type="button" class="lx-btn primary" data-act="save-gear">Сохранить</button>';
  }

  function render() {
    if (view === 'pet') return renderPet();
    if (view === 'new') return renderNew();
    if (view === 'gear') return renderGear();
    return renderList();
  }

  async function onMessage() {
    if (host.generating) return;
    await load();
    const msgs = await host.messages();
    const last = msgs[msgs.length - 1];
    pets().forEach((p) => { if (last) eng.sceneReact(p, last.text, Date.now()); });
    const every = Math.max(1, Number(cfg().every) || 5);
    const seen = bag().seen || 0;
    if (cfg().watcher && msgs.length > 0 && msgs.length % every === 0 && msgs.length !== seen) {
      bag().seen = msgs.length;
      const p = active() || pets()[0];
      if (p) await runWatcher(p, msgs);
    }
    await persist();
    if (view === 'list' || view === 'pet') render();
  }

  async function runWatcher(p, msgs) {
    const recent = (msgs || []).slice(-6).map((m) => (m.role === 'user' ? 'Человек' : 'Персонаж') + ': ' + String(m.text || '').slice(0, 500)).join('\n');
    ui.toast('Наблюдатель думает…');
    try {
      const raw = await host.generate(eng.watcherPrompt(p, recent));
      const line = eng.acceptWatcher(raw);
      if (line) {
        p.now = { text: line, kind: 'watch', ts: Date.now(), by: 'model' };
        p.log.unshift({ t: Date.now(), text: line });
        p.log = p.log.slice(0, 40);
        ui.toast('');
      } else ui.toast('Модель ответила не по делу, оставлено своё поведение');
    } catch (e) {
      ui.toast('Наблюдатель не ответил: ' + (e && e.message ? e.message : 'ошибка клиента'));
    }
  }

  ui.body.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.getAttribute('data-act');
    if (act === 'new') { view = 'new'; render(); return; }
    if (act === 'gear') { view = 'gear'; render(); return; }
    if (act === 'open') {
      activeId = el.getAttribute('data-id');
      bag().activeId = activeId;
      view = 'pet';
      await persist();
      render();
      return;
    }
    if (act === 'icon') { ui.body.dataset.icon = el.getAttribute('data-icon') || '🐾'; ui.toast('Значок ' + ui.body.dataset.icon); return; }
    if (act === 'create') {
      const pet = eng.blankPet({
        name: ui.body.querySelector('#lx-pet-name').value,
        kind: ui.body.querySelector('#lx-pet-kind').value,
        temper: ui.body.querySelector('#lx-pet-temper').value,
        owner: ui.body.querySelector('#lx-pet-owner').value,
        icon: ui.body.dataset.icon || '🐾',
      }, Date.now());
      pets().push(pet);
      activeId = pet.id;
      bag().activeId = pet.id;
      view = 'pet';
      await persist();
      render();
      return;
    }
    if (act === 'care') {
      const p = active();
      if (!p) return;
      const res = eng.care(p, el.getAttribute('data-care'), Date.now());
      ui.toast(res.line || '');
      await persist();
      render();
      return;
    }
    if (act === 'watch') {
      const p = active();
      if (!p) return;
      await runWatcher(p, await host.messages());
      await persist();
      render();
      return;
    }
    if (act === 'remove') {
      const id = activeId;
      bag().pets = pets().filter((p) => p.id !== id);
      bag().activeId = bag().pets[0] ? bag().pets[0].id : null;
      activeId = bag().activeId;
      view = 'list';
      await persist();
      render();
      return;
    }
    if (act === 'save-gear') {
      cfg().inject = ui.body.querySelector('#lx-pet-inject').checked;
      cfg().watcher = ui.body.querySelector('#lx-pet-watch').checked;
      cfg().every = Number(ui.body.querySelector('#lx-pet-every').value) || 5;
      await persist();
      ui.toast('Сохранено на устройстве');
      return;
    }
    if (act === 'export') {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'local-pet.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });

  ui.body.addEventListener('change', async (e) => {
    const input = e.target;
    if (!input || input.getAttribute('data-act') !== 'import' || !input.files || !input.files[0]) return;
    try {
      const text = await input.files[0].text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || !data.byChat) throw new Error('нет питомцев');
      db = data;
      await persist();
      view = 'list';
      render();
      ui.toast('Файл принят');
    } catch (err) {
      ui.toast('Файл не подошёл');
    }
  });

  host.on('chat', async () => { await load(); if (view === 'list' || view === 'pet') render(); });
  host.on('message', onMessage);
  const tickWin = shell.win();
  if (tickWin.__lxPetTick) clearInterval(tickWin.__lxPetTick);
  tickWin.__lxPetTick = setInterval(() => {
    if (!db) return;
    const now = Date.now();
    pets().forEach((p) => eng.tickPet(p, now));
    persist();
    if (view === 'pet' || view === 'list') render();
  }, 60000);

  const open = async () => { await load(); view = active() ? 'pet' : 'list'; ui.open(); render(); };
  host.addMenu('Локальный питомец', open);
  shell.listen(shell.win(), 'open-pet', 'local-pet-open', open);
  load();
  return { open, close: () => ui.close() };
}

const LocalPetApp = { boot: bootPet };
globalThis.LocalPetApp = LocalPetApp;
export { LocalPetApp };
