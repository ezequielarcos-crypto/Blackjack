'use strict';

/* ================= Lógica pura (sin DOM) ================= */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECKS = 6;
const ACTION_NAMES = { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir' };

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number(rank);
}

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

function newShoe() {
  const shoe = [];
  let id = 0;
  for (let d = 0; d < DECKS; d++)
    for (const s of SUITS)
      for (const r of RANKS) shoe.push({ r, s, id: id++ });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

/**
 * Estrategia básica (6 barajas, crupier se planta en 17 blando, doblar tras dividir).
 * up: valor de la carta visible del crupier (2–11, 11 = As).
 * Devuelve { action: 'H'|'S'|'D'|'P', reason }.
 */
function recommend(cards, up, opts) {
  const canDouble = !opts || opts.canDouble !== false;
  const canSplit = !opts || opts.canSplit !== false;
  const { total, soft } = handValue(cards);
  const weak = up >= 2 && up <= 6;
  const upName = up === 11 ? 'un As' : 'un ' + up;

  if (canSplit && cards.length === 2 && cardValue(cards[0].r) === cardValue(cards[1].r)) {
    const v = cardValue(cards[0].r);
    if (v === 11) return { action: 'P', reason: 'Siempre divide los Ases: dos manos que empiezan en 11 valen mucho más que un 12 blando.' };
    if (v === 8) return { action: 'P', reason: 'Siempre divide los ochos: 16 es la peor mano, y dos manos que empiezan en 8 son mucho mejores.' };
    if (v === 9 && up !== 7 && up !== 10 && up !== 11)
      return { action: 'P', reason: 'Divide los nueves contra 2–6, 8 y 9: dos manos que empiezan en 9 rinden más que un 18.' };
    if (v === 7 && up <= 7) return { action: 'P', reason: 'Divide los sietes contra 2–7: 14 es una mano mala y el crupier no está fuerte.' };
    if (v === 6 && up <= 6) return { action: 'P', reason: 'Divide los seises contra 2–6: el crupier está débil y 12 es una mano mala.' };
    if (v === 4 && (up === 5 || up === 6)) return { action: 'P', reason: 'Divide los cuatros solo contra 5 o 6, cuando el crupier está más débil.' };
    if ((v === 2 || v === 3) && up <= 7) return { action: 'P', reason: 'Divide doses y treses contra 2–7: aprovechas que el crupier no está fuerte.' };
    // Si no se divide, se juega como mano normal (abajo).
  }

  if (soft) {
    if (total >= 19) return { action: 'S', reason: 'Un ' + total + ' blando ya es una mano muy buena: plántate.' };
    if (total === 18) {
      if (up >= 3 && up <= 6) return canDouble
        ? { action: 'D', reason: 'Con 18 blando contra carta débil (3–6), dobla: no puedes pasarte y el crupier sí.' }
        : { action: 'S', reason: 'Con 18 blando contra carta débil, plántate (doblarías si pudieras).' };
      if (up === 2 || up === 7 || up === 8) return { action: 'S', reason: 'Con 18 blando contra ' + upName + ', tu 18 es suficiente: plántate.' };
      return { action: 'H', reason: 'Con 18 blando contra ' + upName + ', 18 suele perder. Pide: el As te protege de pasarte.' };
    }
    const lo = total === 17 ? 3 : total >= 15 ? 4 : 5;
    if (canDouble && up >= lo && up <= 6)
      return { action: 'D', reason: 'Mano blanda contra carta débil del crupier: dobla. No puedes pasarte con una carta y el crupier probablemente sí.' };
    return { action: 'H', reason: 'Con ' + total + ' blando no puedes pasarte al pedir una carta, y ' + total + ' rara vez gana: pide.' };
  }

  if (total >= 17) return { action: 'S', reason: 'Con ' + total + ' duro, pedir es demasiado arriesgado: plántate siempre.' };
  if (total >= 13) return weak
    ? { action: 'S', reason: 'El crupier muestra carta débil (2–6) y es probable que se pase. No te arriesgues: plántate.' }
    : { action: 'H', reason: 'El crupier muestra ' + upName + ' y probablemente llegue a 17 o más. Con ' + total + ' necesitas mejorar: pide.' };
  if (total === 12) return up >= 4 && up <= 6
    ? { action: 'S', reason: 'Con 12 contra 4, 5 o 6, deja que el crupier se pase: plántate.' }
    : { action: 'H', reason: 'Con 12 contra ' + upName + ', pide: solo las cartas de 10 te hacen pasarte.' };
  if (total === 11) {
    if (canDouble && up !== 11) return { action: 'D', reason: 'Con 11, dobla: cualquier carta de 10 te da 21.' };
    return { action: 'H', reason: canDouble ? 'Con 11 contra un As, solo pide.' : 'Con 11, pide (doblarías si pudieras).' };
  }
  if (total === 10) {
    if (canDouble && up <= 9) return { action: 'D', reason: 'Con 10 contra ' + upName + ', dobla: tienes ventaja sobre el crupier.' };
    return { action: 'H', reason: up <= 9 ? 'Con 10, pide (doblarías si pudieras).' : 'Con 10 contra ' + upName + ', el crupier está demasiado fuerte para doblar: solo pide.' };
  }
  if (total === 9) {
    if (canDouble && up >= 3 && up <= 6) return { action: 'D', reason: 'Con 9 contra carta débil (3–6), dobla.' };
    return { action: 'H', reason: 'Con 9, pide: no puedes pasarte.' };
  }
  return { action: 'H', reason: 'Con ' + total + ' o menos no puedes pasarte: pide siempre.' };
}

if (typeof module !== 'undefined') module.exports = { handValue, recommend, isBlackjack, cardValue };

/* ================= Interfaz ================= */

if (typeof document !== 'undefined') (function () {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const STORE_KEY = 'blackjack-aprende-v1';
  const START_CHIPS = 1000;
  const MIN_BET = 10;

  const state = {
    shoe: newShoe(),
    dealer: [],
    hands: [],
    active: 0,
    phase: 'bet', // bet | player | dealer
    hideHole: true,
    bankroll: START_CHIPS,
    bet: 20,
    stats: { decisions: 0, correct: 0, hands: 0, won: 0, lost: 0, push: 0 },
    hintUsed: false,
    seen: new Set(),
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && typeof saved.bankroll === 'number') {
      state.bankroll = saved.bankroll;
      Object.assign(state.stats, saved.stats);
      if (saved.bet) state.bet = saved.bet;
    }
  } catch (e) { /* sin almacenamiento */ }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ bankroll: state.bankroll, stats: state.stats, bet: state.bet }));
    } catch (e) { /* ignorar */ }
  }

  /* ---------- Pestañas ---------- */
  function showTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab, .go').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ---------- Tablas de estrategia ---------- */
  const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const CODE = { H: 'P', S: 'PL', D: 'D', P: 'DV' };
  const mk = (...ranks) => ranks.map((r) => ({ r: String(r), s: '♠' }));

  function buildTable(el, rows) {
    let html = '<table class="strat"><tr><th class="rowh"></th>' + UPS.map((u) => '<th>' + (u === 11 ? 'A' : u) + '</th>').join('') + '</tr>';
    for (const [label, cards, opts] of rows) {
      html += '<tr><th class="rowh">' + label + '</th>';
      for (const u of UPS) {
        const a = recommend(cards, u, opts).action;
        html += '<td class="a-' + a + '" title="' + ACTION_NAMES[a] + '">' + CODE[a] + '</td>';
      }
      html += '</tr>';
    }
    el.innerHTML = html + '</table>';
  }

  const noSplit = { canSplit: false };
  buildTable($('tbl-hard'), [
    ['8 o −', mk(5, 3), noSplit], ['9', mk(5, 4), noSplit], ['10', mk(6, 4), noSplit], ['11', mk(6, 5), noSplit],
    ['12', mk(10, 2), noSplit], ['13', mk(10, 3), noSplit], ['14', mk(10, 4), noSplit], ['15', mk(10, 5), noSplit],
    ['16', mk(10, 6), noSplit], ['17 o +', mk(10, 7), noSplit],
  ]);
  buildTable($('tbl-soft'), [2, 3, 4, 5, 6, 7, 8, 9].map((n) => ['A + ' + n, mk('A', n), noSplit]));
  buildTable($('tbl-pairs'), ['A', 10, 9, 8, 7, 6, 5, 4, 3, 2].map((r) => [r + ' + ' + r, mk(r, r)]));

  /* ---------- Juego ---------- */
  function draw() {
    if (state.shoe.length < 60) state.shoe = newShoe();
    const c = state.shoe.pop();
    return { r: c.r, s: c.s, id: ++draw.n };
  }
  draw.n = 0;

  const hand = () => state.hands[state.active];
  const upValue = () => cardValue(state.dealer[0].r);

  function options() {
    const h = hand();
    const two = h.cards.length === 2;
    const afford = state.bankroll >= h.bet;
    return {
      canDouble: two && afford && !h.splitAces,
      canSplit: two && afford && state.hands.length === 1 && cardValue(h.cards[0].r) === cardValue(h.cards[1].r),
    };
  }

  function setMessage(text) { $('message').textContent = text; }

  function setCoach(kind, html) {
    const box = $('coach-box');
    box.className = 'coach-box' + (kind ? ' ' + kind : '');
    box.innerHTML = html || '';
  }

  function cardEl(c, hidden) {
    const el = document.createElement('div');
    const isNew = !state.seen.has(c.id);
    state.seen.add(c.id);
    if (hidden) {
      el.className = 'card back' + (isNew ? ' new' : '');
      return el;
    }
    const red = c.s === '♥' || c.s === '♦';
    el.className = 'card' + (red ? ' red' : '') + (isNew ? ' new' : '');
    el.innerHTML = '<span class="corner">' + c.r + '<i>' + c.s + '</i></span><span class="pip">' + c.s + '</span>';
    return el;
  }

  function totalLabel(cards) {
    const v = handValue(cards);
    if (isBlackjack(cards)) return 'Blackjack';
    if (v.total > 21) return v.total + ' · se pasa';
    return v.soft && v.total < 21 ? v.total + ' blando' : String(v.total);
  }

  function render() {
    $('bankroll').textContent = state.bankroll;
    const inPlay = state.phase !== 'bet';
    $('bet').textContent = inPlay ? state.hands.reduce((s, h) => s + h.bet, 0) : state.bet;
    const st = state.stats;
    $('accuracy').textContent = st.decisions ? Math.round((st.correct / st.decisions) * 100) + ' %' : '—';
    $('record').textContent = 'Manos: ' + st.hands + ' · Ganadas: ' + st.won + ' · Perdidas: ' + st.lost + ' · Empates: ' + st.push;

    const dh = $('dealer-hand');
    dh.innerHTML = '';
    state.dealer.forEach((c, i) => dh.appendChild(cardEl(c, i === 1 && state.hideHole)));
    $('dealer-total').textContent = !state.dealer.length ? ''
      : state.hideHole ? String(handValue([state.dealer[0]]).total) : totalLabel(state.dealer);

    const ph = $('player-hands');
    ph.innerHTML = '';
    state.hands.forEach((h, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'phand' + (state.phase === 'player' && i === state.active && state.hands.length > 1 ? ' active' : '');
      const row = document.createElement('div');
      row.className = 'hand';
      h.cards.forEach((c) => row.appendChild(cardEl(c)));
      wrap.appendChild(row);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = '<span class="total">' + totalLabel(h.cards) + '</span> · Apuesta ' + h.bet +
        (h.result ? ' · <span class="res ' + h.result.kind + '">' + h.result.text + '</span>' : '');
      wrap.appendChild(meta);
      ph.appendChild(wrap);
    });

    $('bet-controls').classList.toggle('hidden', state.phase !== 'bet');
    $('play-controls').classList.toggle('hidden', state.phase === 'bet');
    const playing = state.phase === 'player';
    const o = playing ? options() : { canDouble: false, canSplit: false };
    $('hit').disabled = $('stand').disabled = $('hint').disabled = !playing;
    $('double').disabled = !o.canDouble;
    $('split').disabled = !o.canSplit;

    document.querySelectorAll('.chip').forEach((b) => {
      b.disabled = state.bet + Number(b.dataset.chip) > state.bankroll;
    });
    $('deal').disabled = state.bet < MIN_BET || state.bet > state.bankroll;
    $('clear-bet').disabled = state.bet === 0;
  }

  async function deal() {
    if (state.phase !== 'bet' || state.bet < MIN_BET || state.bet > state.bankroll) return;
    state.bankroll -= state.bet;
    state.hands = [{ cards: [], bet: state.bet }];
    state.dealer = [];
    state.active = 0;
    state.hideHole = true;
    state.hintUsed = false;
    state.phase = 'dealer'; // bloquea los botones mientras se reparte
    setCoach('', '');
    setMessage('Repartiendo…');

    for (const target of [state.hands[0].cards, state.dealer, state.hands[0].cards, state.dealer]) {
      target.push(draw());
      render();
      await sleep(260);
    }

    const playerBJ = isBlackjack(state.hands[0].cards);
    const dealerBJ = isBlackjack(state.dealer);
    if (playerBJ || dealerBJ) {
      state.hands[0].done = true;
      return settle();
    }
    state.phase = 'player';
    prompt();
    render();
  }

  function prompt() {
    const multi = state.hands.length > 1 ? ' (mano ' + (state.active + 1) + ')' : '';
    setMessage('Tu turno' + multi + ': ¿qué haces?');
  }

  function judge(action) {
    const rec = recommend(hand().cards, upValue(), options());
    if (!$('coach').checked) return;
    if (state.hintUsed) { state.hintUsed = false; return; }
    state.stats.decisions++;
    if (rec.action === action) {
      state.stats.correct++;
      setCoach('ok', '<b class="ok">✓ Correcto.</b> ' + rec.reason);
    } else {
      setCoach('bad', '<b class="bad">✗ Lo mejor era ' + ACTION_NAMES[rec.action] + '.</b> ' + rec.reason);
    }
  }

  function showHint() {
    if (state.phase !== 'player') return;
    const rec = recommend(hand().cards, upValue(), options());
    state.hintUsed = true;
    setCoach('tip', '<b class="tip">💡 ' + ACTION_NAMES[rec.action] + '.</b> ' + rec.reason);
  }

  function act(action) {
    if (state.phase !== 'player') return;
    const o = options();
    if ((action === 'D' && !o.canDouble) || (action === 'P' && !o.canSplit)) return;
    judge(action);
    const h = hand();

    if (action === 'H') {
      h.cards.push(draw());
      if (handValue(h.cards).total >= 21) h.done = true;
    } else if (action === 'S') {
      h.done = true;
    } else if (action === 'D') {
      state.bankroll -= h.bet;
      h.bet *= 2;
      h.cards.push(draw());
      h.done = true;
    } else if (action === 'P') {
      state.bankroll -= h.bet;
      const aces = h.cards[0].r === 'A';
      const [a, b] = h.cards;
      state.hands = [a, b].map((c) => {
        const cards = [c, draw()];
        return { cards, bet: h.bet, split: true, splitAces: aces, done: aces || handValue(cards).total === 21 };
      });
      state.active = 0;
    }
    advance();
  }

  function advance() {
    while (state.active < state.hands.length && state.hands[state.active].done) state.active++;
    if (state.active >= state.hands.length) {
      state.active = state.hands.length - 1;
      return dealerTurn();
    }
    prompt();
    render();
  }

  async function dealerTurn() {
    state.phase = 'dealer';
    render();
    const anyAlive = state.hands.some((h) => handValue(h.cards).total <= 21);
    if (anyAlive) {
      setMessage('Turno del crupier…');
      await sleep(500);
      state.hideHole = false;
      render();
      while (handValue(state.dealer).total < 17) {
        await sleep(650);
        state.dealer.push(draw());
        render();
      }
      await sleep(400);
    }
    settle();
  }

  function settle() {
    state.hideHole = false;
    const d = handValue(state.dealer).total;
    const dealerBJ = isBlackjack(state.dealer);
    let net = 0;

    for (const h of state.hands) {
      const p = handValue(h.cards).total;
      const bj = isBlackjack(h.cards) && !h.split;
      let kind, text, payout;
      if (p > 21) { kind = 'lose'; text = 'Te pasaste'; payout = 0; }
      else if (bj && !dealerBJ) { kind = 'win'; text = '¡Blackjack! +' + h.bet * 1.5; payout = h.bet * 2.5; }
      else if (dealerBJ && !bj) { kind = 'lose'; text = 'Blackjack del crupier'; payout = 0; }
      else if (d > 21) { kind = 'win'; text = 'El crupier se pasó +' + h.bet; payout = h.bet * 2; }
      else if (p > d) { kind = 'win'; text = 'Ganas +' + h.bet; payout = h.bet * 2; }
      else if (p < d) { kind = 'lose'; text = 'Pierdes'; payout = 0; }
      else { kind = 'push'; text = 'Empate'; payout = h.bet; }
      h.result = { kind, text };
      state.bankroll += payout;
      net += payout - h.bet;
      state.stats.hands++;
      state.stats[kind === 'win' ? 'won' : kind === 'lose' ? 'lost' : 'push']++;
    }

    let msg = net > 0 ? '¡Ganaste ' + net + ' fichas!' : net < 0 ? 'Perdiste ' + -net + ' fichas.' : 'Empate: recuperas tu apuesta.';
    if (state.bankroll < MIN_BET) {
      state.bankroll = START_CHIPS;
      msg += ' Te quedaste sin fichas: te damos ' + START_CHIPS + ' para seguir practicando.';
    }
    state.bet = Math.min(state.bet, Math.floor(state.bankroll / 10) * 10);
    if (state.bet < MIN_BET) state.bet = MIN_BET;
    setMessage(msg + ' Ajusta tu apuesta y reparte de nuevo.');
    state.phase = 'bet';
    save();
    render();
  }

  /* ---------- Eventos ---------- */
  document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    const v = Number(b.dataset.chip);
    if (state.phase === 'bet' && state.bet + v <= state.bankroll) { state.bet += v; render(); }
  }));
  $('clear-bet').addEventListener('click', () => { state.bet = 0; render(); });
  $('deal').addEventListener('click', deal);
  $('hit').addEventListener('click', () => act('H'));
  $('stand').addEventListener('click', () => act('S'));
  $('double').addEventListener('click', () => act('D'));
  $('split').addEventListener('click', () => act('P'));
  $('hint').addEventListener('click', showHint);
  $('coach').addEventListener('change', () => setCoach('', ''));
  $('reset').addEventListener('click', () => {
    if (state.phase !== 'bet') return;
    state.bankroll = START_CHIPS;
    state.bet = 20;
    state.stats = { decisions: 0, correct: 0, hands: 0, won: 0, lost: 0, push: 0 };
    state.hands = [];
    state.dealer = [];
    setCoach('', '');
    setMessage('Elige tu apuesta y pulsa “Repartir”.');
    save();
    render();
  });

  render();
})();
