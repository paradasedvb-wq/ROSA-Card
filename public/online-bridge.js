/* Adds online rendering to the unchanged original HTML. Room writes stay in the parent app. */
(() => {
  let online = false;
  let latest = null;
  let winnerShown = null;
  const originalMode = setMode;
  const originalPlay = playCard;
  const originalRender = renderAll;
  const originalQuit = document.getElementById('quitBtn').onclick;
  const originalDraw = document.getElementById('drawBtn').onclick;
  const originalPass = document.getElementById('passBtn').onclick;
  const originalUno = document.getElementById('unoBtn').onclick;
  const emit = (data) => parent.postMessage({ source: 'vkuno-original', ...data }, location.origin);
  const style = document.createElement('style');
  style.textContent = `
    body.online-mode .online-hide { display:none!important; }
    #onlineControls .brow { flex-wrap:wrap; }
    #onlineControls .cb { min-width:34px; flex:1; }
    #onlineControls .online-code { font-size:30px; letter-spacing:3px; }
    #onlineControls .online-players { list-style:none; margin:12px 0; }
    #onlineControls .online-players li { padding:6px 0; color:var(--ink); }
    #onlineControls .online-error { color:var(--red); font-size:13px; margin-top:10px; }
    #onlineControls .online-row { display:flex; gap:8px; margin-top:14px; }
    #onlineControls .online-row .nick-in { min-width:0; flex:1; }
    #onlineControls .online-row .cb { flex:0 0 auto; }
    #onlineMode { flex-shrink:0; }
    body.online-mode #setupScreen { justify-content:flex-start; padding-top:24px; }
    body.online-mode .opps { flex-wrap:nowrap; overflow-x:auto; flex-shrink:0; justify-content:flex-start; }
    body.online-mode .opp { flex:0 0 108px; }
    body.online-mode .online-turn { color:var(--gold); font-weight:800; }
    @media (max-width:480px) { body.online-mode #logBox { top:0; max-height:62px; } }
  `;
  document.head.appendChild(style);
  const modeSlot = document.createElement('span');
  modeSlot.id = 'onlineMode';
  document.getElementById('modeHuman').parentElement.appendChild(modeSlot);
  const controls = document.createElement('div');
  controls.id = 'onlineControls';
  document.getElementById('startBtn').after(controls);
  const hiddenIds = ['oppRow', 'humanNames', 'G_lDiff', 'diffRow', 'adaptBox', 'G_lDelay', 'startBtn', 'algoNote'];
  hiddenIds.forEach(id => document.getElementById(id).classList.add('online-hide'));
  const delayRow = document.getElementById('delaySlider').parentElement;
  delayRow.classList.add('online-hide');
  delayRow.nextElementSibling.classList.add('online-hide');

  function changeMode(value) {
    online = value;
    originalMode('ai');
    document.body.classList.toggle('online-mode', value);
    document.getElementById('modeAI').classList.toggle('on', !value);
    document.getElementById('modeHuman').classList.remove('on');
    if (!value) latest = null;
  }
  setMode = function(mode) {
    changeMode(false);
    originalMode(mode);
    emit({ kind: 'mode', online: false });
  };

  playCard = function(player, card, color) {
    if (!online) return originalPlay(player, card, color);
    emit({ kind: 'action', action: 'play', cardId: card.id, ...(color ? { color } : {}) });
  };
  document.getElementById('drawBtn').onclick = () => online ? emit({ kind: 'action', action: 'draw' }) : originalDraw();
  document.getElementById('passBtn').onclick = () => online ? emit({ kind: 'action', action: 'pass' }) : originalPass();
  document.getElementById('unoBtn').onclick = () => online ? emit({ kind: 'action', action: latest?.state?.vuln === latest?.pid ? 'uno' : 'catch' }) : originalUno();
  document.getElementById('quitBtn').onclick = () => {
    if (online) emit({ kind: 'quit' });
    else originalQuit();
  };

  function renderRoom(room, pid) {
    latest = { ...room, pid };
    changeMode(true);
    if (!room.state) {
      document.getElementById('setupScreen').classList.remove('hidden');
      document.getElementById('game').classList.add('hidden');
      return;
    }
    const state = room.state;
    const ids = [pid, ...state.order.filter(id => id !== pid)];
    const players = ids.map((id, index) => ({
      id: index,
      isAI: false,
      name: room.players.find(p => p.id === id)?.name || '?',
      hand: state.hands[id] || [],
      uno: (state.hands[id]?.length === 1 && state.vuln !== id),
      vuln: state.vuln === id,
      ct: [],
    }));
    clearTimers();
    GAME_MODE = 'human';
    DIFF = 3;
    const firstDeal = !S || !document.getElementById('setupScreen').classList.contains('hidden');
    S = { players, deck: state.deck, discard: state.discard, turn: ids.indexOf(state.order[state.turn]), dir: state.dir, color: state.color, logs: state.logs, over: !!state.winner, drawn: state.drawn, firstDeal };
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('passScreen').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    document.getElementById('pname').textContent = players[0].name;
    const names = players.map(p => p.name);
    players.forEach(p => { p.name = escH(p.name); });
    originalRender();
    players.forEach((p, index) => { p.name = names[index]; });
    document.getElementById('aiPill').classList.add('hidden');
    document.getElementById('topMeta').textContent = `방 ${room.code} · ${state.dir === 1 ? '⟳' : '⟲'} · ${ap().name}의 차례`;
    document.getElementById('unoBtn').classList.toggle('hidden', !state.vuln || !!state.winner);
    document.getElementById('passBtn').classList.toggle('hidden', ap().id !== 0 || !state.drawn || !!state.winner);
    document.querySelectorAll('#oppsRow .opp').forEach((el, index) => {
      const id = ids[index + 1];
      const position = state.order.indexOf(id) + 1;
      el.querySelector('.ol').textContent = `${position}번째`;
      // Player-provided names must be rendered as text, not HTML.
      el.querySelector('.on').textContent = players[index + 1].name;
    });
    document.getElementById('logBox').replaceChildren(...state.logs.map(log => {
      const line = document.createElement('div'); line.textContent = log; return line;
    }));
    if (!state.winner) {
      winnerShown = null;
      document.querySelector('.online-winner')?.remove();
    } else if (winnerShown !== state.winner) {
      winnerShown = state.winner;
      const overlay = document.createElement('div'); overlay.className = 'wbg online-winner';
      const box = document.createElement('div'); box.className = 'wbox';
      const title = document.createElement('div'); title.className = 'wtitle';
      title.textContent = L.winT(room.players.find(p => p.id === state.winner)?.name || '?');
      const slot = document.createElement('div'); slot.id = 'onlineWinner';
      box.append(title, slot); overlay.appendChild(box); document.body.appendChild(overlay);
      emit({ kind: 'winner' });
    }
  }
  window.unoOnline = { changeMode, renderRoom };
})();