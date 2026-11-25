'use strict';
/* Lumvero Chess – iOS-Version (Web-Oberflaeche in Capacitor). GPL-3.0-or-later.
   Nachbau der Android-App 1.0.1: gleiche Bildschirme, Texte (DE/EN), Einstellungen und Engine-Stufen. */
const CO = window.CO;
const Cap = window.Capacitor;
const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const plug = (n) => (native && Cap.registerPlugin ? Cap.registerPlugin(n) : null);
const Haptics = plug('Haptics'), Share = plug('Share'), Clip = plug('Clipboard'), FS = plug('Filesystem'), Keep = plug('KeepAwake'), CapApp = plug('App');
const VERSION = '1.0.2';
// ---- Neue Texte (Update 1.0.2) ----
Object.assign(STR.en, { act_hint: 'Hint', act_undo: 'Take back', hint_thinking: 'Looking for a good move…', hint_none: 'No hint available.', eval_btn: 'Evaluate position', eval_text: 'Evaluation: %1$s (from White’s view)', eval_mate: 'mate in %1$d', stats_title: 'Statistics', stats_games: 'Finished games: %1$d', stats_vs: 'Against the computer', stats_two: 'Two players on this device', stats_level: 'Level %1$d', stats_wdl: 'Won %1$d · Draw %2$d · Lost %3$d', stats_empty: 'No finished games yet.', board_ocean: 'Ocean', board_rose: 'Rose', undo_none: 'Nothing to take back.' });
Object.assign(STR.de, { act_hint: 'Tipp', act_undo: 'Zurücknehmen', hint_thinking: 'Suche einen guten Zug …', hint_none: 'Kein Tipp verfügbar.', eval_btn: 'Stellung bewerten', eval_text: 'Bewertung: %1$s (aus Sicht von Weiß)', eval_mate: 'Matt in %1$d', stats_title: 'Statistik', stats_games: 'Beendete Partien: %1$d', stats_vs: 'Gegen den Computer', stats_two: 'Zwei Spieler an diesem Gerät', stats_level: 'Stufe %1$d', stats_wdl: 'Gewonnen %1$d · Remis %2$d · Verloren %3$d', stats_empty: 'Noch keine beendeten Partien.', board_ocean: 'Ozean', board_rose: 'Rosé', undo_none: 'Nichts zum Zurücknehmen.' });
const SOURCE_URL = 'https://github.com/AndiiSharp/lumvero-chess-ios';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Speicher ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem('lc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lc.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('lc.' + k); } catch (e) {} },
};
const DEF = { theme: 'system', board: 'classic', pieces: 'classic', coords: true, lastMove: true, confirm: false, targets: true, tpv: 'fixed',
  sound: false, haptics: false, anim: true, reduce: false, keep: false, lang: 'system' };
let S = Object.assign({}, DEF, LS.get('settings', {}));
const saveS = () => LS.set('settings', S);
let setup = Object.assign({ v: 'classical', opp: 'cpu', color: 'w', level: 2, time: 0, inc: 0 }, LS.get('setup', {}));

// ---------- Texte ----------
function lang() { return S.lang === 'system' ? ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en') : S.lang; }
function t(k, ...a) {
  let s = (STR[lang()] && STR[lang()][k]) || STR.en[k] || k;
  let i = 0;
  return s.replace(/%(\d+\$)?[sd]/g, (m, n) => { const v = n ? a[parseInt(n, 10) - 1] : a[i++]; return v == null ? '' : v; });
}

// ---------- Design ----------
const BOARDS = { classic: ['#EEE8D2', '#5F7F4E'], slate: ['#E4E8EC', '#5A7085'], warm: ['#EDDFC4', '#93683F'], contrast: ['#FFFFFF', '#3D6A99'], ocean: ['#DEE9F2', '#4F7CA0'], rose: ['#F3E1E1', '#B5656A'] };
function applyLook() {
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const b = BOARDS[S.board] || BOARDS.classic;
  document.documentElement.style.setProperty('--light', b[0]); document.documentElement.style.setProperty('--dark', b[1]);
  document.documentElement.lang = lang();
  document.body.classList.toggle('reduce', S.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.body.classList.toggle('anim', S.anim && !S.reduce);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyLook);
const pieceImg = (color, role, set = S.pieces) => `img/piece_${set === 'modern' ? 'm_' : ''}${color}_${role}.png`;

// ---------- Ton & Haptik ----------
const SND = {};
function sound(n) { if (!S.sound) return; try { const a = SND[n] || (SND[n] = new Audio('snd/sfx_' + n + '.wav')); a.currentTime = 0; a.play().catch(() => {}); } catch (e) {} }
function buzz() { if (!S.haptics) return; try { if (Haptics) Haptics.impact({ style: 'LIGHT' }); else if (navigator.vibrate) navigator.vibrate(15); } catch (e) {} }
function keepAwake(on) { try { if (Keep) on ? Keep.keepAwake() : Keep.allowSleep(); } catch (e) {} }

// ---------- Schach-Hilfen ----------
const ROLES = ['bishop', 'knight', 'queen', 'rook'];
function start960(n) { // Scharnagl-Nummerierung 0..959 (518 = Standard)
  const r = Array(8).fill(null);
  let k = n;
  r[(k % 4) * 2 + 1] = 'b'; k = Math.floor(k / 4);
  r[(k % 4) * 2] = 'b'; k = Math.floor(k / 4);
  const free = () => r.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  r[free()[k % 6]] = 'q'; k = Math.floor(k / 6);
  const KN = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]][k];
  let f = free(); r[f[KN[0]]] = 'n'; r[f[KN[1]]] = 'n';
  f = free(); r[f[0]] = 'r'; r[f[1]] = 'k'; r[f[2]] = 'r';
  const back = r.join('');
  const files = 'abcdefgh';
  const rooks = r.map((x, i) => (x === 'r' ? files[i] : null)).filter(Boolean);
  const castle = n === 518 ? 'KQkq' : (rooks[1].toUpperCase() + rooks[0].toUpperCase() + rooks[1] + rooks[0]);
  return `${back}/pppppppp/8/8/8/8/PPPPPPPP/${back.toUpperCase()} w ${castle} - 0 1`;
}
const STD = start960(518);
function posFrom(fen) { return CO.Chess.fromSetup(CO.parseFen(fen).unwrap()).unwrap(); }
function replay(g, upto = g.moves.length) {
  const p = posFrom(g.startFen);
  for (let i = 0; i < upto; i++) p.play(CO.parseUci(g.moves[i]));
  return p;
}
const posKey = (p) => CO.makeFen(p.toSetup()).split(' ').slice(0, 4).join(' ');
function repCount(g, upto = g.moves.length) {
  const p = posFrom(g.startFen); const m = new Map(); const inc = () => { const k = posKey(p); m.set(k, (m.get(k) || 0) + 1); return m.get(k); };
  let c = inc();
  for (let i = 0; i < upto; i++) { p.play(CO.parseUci(g.moves[i])); c = inc(); }
  return c;
}
const colorName = (c) => t(c === 'w' || c === 'white' ? 'side_white' : 'side_black');
const sideOf = (p) => (p.turn === 'white' ? 'w' : 'b');
const other = (c) => (c === 'w' ? 'b' : 'w');
function engineUci(g, uci) { // intern: Rochade = Koenig auf Turm. Klassisch erwartet Stockfish e1g1.
  if (g.v !== 'classical') return uci;
  const m = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
  return m[uci] || uci;
}

// ---------- Engine (Stockfish 17.1 lite, Web Worker) ----------
const LEVELS = { 1: [0, 150], 2: [3, 300], 3: [7, 500], 4: [12, 800], 5: [18, 1200] }; // wie Android: Skill Level, ms
const Engine = {
  w: null, ready: null, wait: null, opts: {},
  start() {
    if (this.w) return this.ready;
    this.w = new Worker('engine/stockfish.js');
    this.w.onmessage = (e) => { const line = String(e.data);
      const sc = / score (cp|mate) (-?\d+)/.exec(line); if (sc) this.lastScore = { kind: sc[1], v: +sc[2] };
      if (this.wait && line.startsWith(this.wait.tok)) { const r = this.wait; this.wait = null; r.res(line); } };
    this.w.onerror = () => { if (this.wait) { const r = this.wait; this.wait = null; r.rej(new Error('engine')); } };
    this.ready = (async () => {
      this.send('uci'); await this.expect('uciok', 15000);
      this.send('setoption name Threads value 1'); this.send('setoption name Hash value 16');
      this.send('setoption name Ponder value false'); this.send('setoption name UCI_LimitStrength value false');
      this.send('isready'); await this.expect('readyok', 15000);
    })();
    return this.ready;
  },
  send(c) { this.w.postMessage(c); },
  expect(tok, ms) { return new Promise((res, rej) => { const to = setTimeout(() => { this.wait = null; rej(new Error('timeout')); }, ms); this.wait = { tok, res: (l) => { clearTimeout(to); res(l); }, rej }; }); },
  async best(g, o = {}) {
    await this.start();
    let [skill, ms] = LEVELS[g.level] || LEVELS[2];
    if (o.skill != null) skill = o.skill; if (o.ms != null) ms = o.ms;
    const mvList = o.upto != null ? g.moves.slice(0, o.upto) : g.moves;
    this.lastScore = null;
    const c960 = g.v !== 'classical';
    if (this.opts.c960 !== c960) { this.send('setoption name UCI_Chess960 value ' + c960); this.opts.c960 = c960; }
    if (this.opts.skill !== skill) { this.send('setoption name Skill Level value ' + skill); this.opts.skill = skill; }
    if (this.opts.game !== g.id) { this.send('ucinewgame'); this.opts.game = g.id; }
    this.send('isready'); await this.expect('readyok', 10000);
    this.send('position fen ' + g.startFen + (mvList.length ? ' moves ' + mvList.map((u) => engineUci(g, u)).join(' ') : ''));
    this.send('go movetime ' + ms);
    let line;
    try { line = await this.expect('bestmove', ms + 3000); } catch (e) { this.send('stop'); line = await this.expect('bestmove', 1000); }
    const mv = line.split(' ')[1];
    return mv && mv !== '(none)' && mv !== '0000' ? mv : null;
  },
  reset() { try { this.w && this.w.terminate(); } catch (e) {} this.w = null; this.ready = null; this.opts = {}; this.wait = null; },
};

// ---------- Spielzustand ----------
let G = LS.get('game', null);   // laufende oder gerade beendete Partie
let ui = { sel: null, flip: false, showMoves: false, pending: null, thinking: false, handoff: false, drag: null, over: false };
let tick = null;
function saveG() { if (G) LS.set('game', G); else LS.del('game'); }
function newGame(cfg, startFen) {
  const n = cfg.v === 'classical' ? 518 : Math.floor(Math.random() * 960);
  G = { id: Date.now(), v: cfg.v, n960: n, startFen: startFen || start960(n), opp: cfg.opp, human: cfg.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : cfg.color,
    colorChoice: cfg.color, level: cfg.level, time: cfg.time, inc: cfg.inc, moves: [], sans: [], clock: cfg.time ? { w: cfg.time * 60000, b: cfg.time * 60000 } : null,
    turnStart: null, paused: false, result: null, started: new Date().toISOString(), offered: null };
  if (cfg.opp === 'two') G.human = 'w';
  ui = { sel: null, flip: false, showMoves: false, pending: null, thinking: false, handoff: false, drag: null, over: false };
  saveG();
}
const running = () => G && !G.result;
const pos = () => replay(G);
const isHumanTurn = (p = pos()) => G.opp === 'two' || sideOf(p) === G.human;
function bottomColor(p = pos()) {
  let c;
  if (G.opp === 'cpu') c = G.human;
  else if (S.tpv === 'rotate' || S.tpv === 'handoff') c = sideOf(p);
  else c = 'w';
  return ui.flip ? other(c) : c;
}

// Uhr
function clockNow(c) {
  if (!G.clock) return null;
  let v = G.clock[c];
  if (running() && !G.paused && G.turnStart && sideOf(pos()) === c && !ui.handoff) v -= Date.now() - G.turnStart;
  return Math.max(0, v);
}
function fmtClock(ms) { const s = Math.ceil(ms / 1000); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }
function startTick() {
  clearInterval(tick);
  if (!G || !G.clock || !running()) return;
  tick = setInterval(() => {
    if (!running() || G.paused) return;
    const p = pos(); const c = sideOf(p);
    if (clockNow(c) <= 0) { G.clock[c] = 0; flagFall(c, p); return; }
    document.querySelectorAll('[data-clk]').forEach((el) => { const v = clockNow(el.dataset.clk); el.textContent = fmtClock(v); el.classList.toggle('low', v < 10000); });
  }, 200);
}
function stopClockForMove(c) { if (G.clock && G.turnStart) { G.clock[c] = clockNow(c); } }
function flagFall(c, p) {
  const win = other(c);
  const insuff = p.hasInsufficientMaterial(win === 'w' ? 'white' : 'black');
  finish(insuff ? null : win, insuff ? 'reason_timeout_insufficient' : 'reason_timeout');
}

// Zug ausfuehren
function play(uci, opts = {}) {
  const p = pos(); const mover = sideOf(p);
  const mv = CO.parseUci(uci);
  const san = CO.makeSan(p, mv);
  const capture = p.board.get(mv.to) && p.board.get(mv.to).color !== p.turn || /x/.test(san);
  if (G.clock) { stopClockForMove(mover); if (G.moves.length >= 1 || mover === 'b') G.clock[mover] += G.inc * 1000; }
  G.moves.push(CO.makeUci(mv)); G.sans.push(san); G.offered = null;
  ui.sel = null; ui.pending = null; ui.hint = null;
  const q = pos();
  G.turnStart = G.clock ? Date.now() : null;
  // Spielende?
  let end = null;
  if (q.isCheckmate()) end = [mover, 'reason_checkmate'];
  else if (q.isStalemate()) end = [null, 'reason_stalemate'];
  else if (q.isInsufficientMaterial()) end = [null, 'reason_insufficient'];
  else if (repCount(G) >= 5) end = [null, 'reason_fivefold'];
  else if (q.halfmoves >= 150) end = [null, 'reason_seventyfive'];
  else if (opts.claim) end = [null, opts.claim];
  sound(end ? 'game_end' : capture ? 'capture' : 'move'); buzz();
  saveG();
  if (end) { finish(end[0], end[1]); return; }
  if (G.opp === 'two' && S.tpv === 'handoff') ui.handoff = true;
  render();
  maybeEngine();
}
function finish(winner, reason) {
  if (!G || G.result) return;
  if (G.clock && G.turnStart) { const c = sideOf(pos()); G.clock[c] = clockNow(c); }
  G.result = { winner, reason, at: new Date().toISOString() };
  G.turnStart = null; clearInterval(tick); keepAwake(false);
  const arch = LS.get('archive', []); arch.unshift(JSON.parse(JSON.stringify(G))); LS.set('archive', arch.slice(0, 500));
  saveG(); ui.over = true; render(); showResult();
}
async function maybeEngine() {
  if (!running() || G.opp !== 'cpu' || G.paused) return;
  const p = pos(); if (sideOf(p) === G.human) return;
  ui.thinking = true; render();
  const gid = G.id, n = G.moves.length;
  try {
    const best = await Engine.best(G);
    if (!G || G.id !== gid || G.moves.length !== n || !running()) return;
    ui.thinking = false;
    if (!best) return;
    const mv = CO.normalizeMove(p, CO.parseUci(best));
    play(CO.makeUci(mv));
  } catch (e) {
    ui.thinking = false; Engine.reset();
    if (G && G.id === gid) { G.paused = true; saveG(); render(); engineError(); }
  }
}

// ---------- Menschliche Eingabe ----------
function targetsFor(p, sq) {
  const d = [...p.dests(sq)];
  const pc = p.board.get(sq);
  if (G.v === 'classical' && pc && pc.role === 'king') { // Rochade klassisch: Ziel g/c statt Turm
    return d.map((to) => { const own = p.board.get(to); if (own && own.color === pc.color && own.role === 'rook') return (CO.squareFile(to) === 7 ? to - 1 : to + 2); return to; });
  }
  return d;
}
function toInternal(p, from, to) {
  const pc = p.board.get(from);
  if (G.v === 'classical' && pc && pc.role === 'king' && Math.abs(CO.squareFile(to) - CO.squareFile(from)) === 2)
    to = (CO.squareFile(to) === 6 ? to + 1 : to - 2);
  return { from, to };
}
function tryMove(from, to) {
  const p = pos(); if (!running() || !isHumanTurn(p) || ui.thinking || G.paused) return false;
  if (!targetsFor(p, from).includes(to)) return false;
  let mv = toInternal(p, from, to);
  const pc = p.board.get(from);
  if (pc.role === 'pawn' && (CO.squareRank(to) === 7 || CO.squareRank(to) === 0)) { askPromotion(pc.color, (role) => commit({ ...mv, promotion: role })); return true; }
  commit(mv); return true;
}
function commit(mv) {
  const uci = CO.makeUci(mv);
  if (S.confirm) { ui.pending = uci; ui.sel = null; render(); return; }
  claimCheckThenPlay(uci);
}
function claimCheckThenPlay(uci) {
  const test = JSON.parse(JSON.stringify(G)); test.moves.push(uci);
  const q = replay(test);
  if (q.isCheckmate() || q.isStalemate()) return play(uci);
  const three = repCount(test) >= 3 && repCount(test) < 5, fifty = q.halfmoves >= 100 && q.halfmoves < 150;
  if (three || fifty) {
    const reason = three ? 'reason_threefold_claim' : 'reason_fifty_claim';
    dialog(t('claim_title'), t(three ? 'claim_text_threefold' : 'claim_text_fifty'),
      [[t('claim_play_only'), () => play(uci)], [t('claim_play_and_claim'), () => play(uci, { claim: reason })]]);
    return;
  }
  play(uci);
}
function castleMoves(p) {
  const k = p.board.kingOf(p.turn); if (k == null) return {};
  const out = {};
  for (const to of p.dests(k)) { const pc = p.board.get(to); if (pc && pc.color === p.turn && pc.role === 'rook') out[CO.squareFile(to) > CO.squareFile(k) ? 'k' : 'q'] = { from: k, to }; }
  return out;
}

// ---------- Overlays ----------
const ov = () => $('#overlay');
function closeOv() { ov().innerHTML = ''; }
function dialog(title, text, actions, opts = {}) {
  ov().innerHTML = `<div class="scrim"></div><div class="dlg" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${text ? `<p>${esc(text).replace(/\n/g, '<br>')}</p>` : ''}${opts.html || ''}
    <div class="${opts.column ? 'col' : 'acts'}">${actions.map((a, i) => `<button class="btn ${opts.column ? (i === 0 ? 'filled' : 'outline') : 'text'}" data-i="${i}">${esc(a[0])}</button>`).join('')}</div></div>`;
  ov().querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { const a = actions[+b.dataset.i]; closeOv(); a[1] && a[1](); });
  if (opts.dismiss !== false) $('.scrim', ov()).onclick = () => { closeOv(); opts.onDismiss && opts.onDismiss(); };
}
function snack(msg) { const s = $('#snack'); s.textContent = msg; s.classList.add('show'); clearTimeout(snack.t); snack.t = setTimeout(() => s.classList.remove('show'), 2600); }
function askPromotion(color, cb) {
  const c = color;
  ov().innerHTML = `<div class="scrim"></div><div class="dlg"><h3>${t('promotion_title')}</h3><div class="promo">${['queen', 'rook', 'bishop', 'knight'].map((r) =>
    `<button data-r="${r}" aria-label="${esc(t('promo_' + r))}" style="background-image:url(${pieceImg(c, r)})"></button>`).join('')}</div>
    <div class="acts"><button class="btn text" data-x>${t('back')}</button></div></div>`;
  ov().querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { closeOv(); cb(b.dataset.r); });
  $('[data-x]', ov()).onclick = () => { closeOv(); ui.sel = null; render(); };
}
function engineError() {
  dialog(t('engine_error_title'), t('engine_error_text'), [[t('result_home'), () => go('home')], [t('engine_error_retry'), () => { G.paused = false; G.turnStart = G.clock ? Date.now() : null; saveG(); render(); maybeEngine(); }]], { dismiss: false });
}
function resultTitle(r) { return r.winner === 'w' ? t('result_white_wins') : r.winner === 'b' ? t('result_black_wins') : t('result_draw'); }
function showResult() {
  const r = G.result; const acts = [[t('result_view_board'), null], [t('result_replay'), () => openReplay(G)]];
  if (G.v !== 'classical') { acts.push([t('result_same_position'), () => restart(true)]); acts.push([t('result_new_random'), () => restart(false)]); }
  else acts.push([t('result_same_config'), () => restart(false)]);
  acts.push([t('result_home'), () => go('home')]);
  dialog(resultTitle(r), t(r.reason), acts, { column: true });
}
function restart(samePos) {
  const cfg = { v: G.v, opp: G.opp, color: G.colorChoice, level: G.level, time: G.time, inc: G.inc };
  newGame(cfg, samePos ? G.startFen : null); startGame();
}

// ---------- Navigation ----------
let screen = 'home', replayG = null, replayPly = 0;
function go(s) { screen = s; closeOv(); if (s !== 'game') { clearInterval(tick); keepAwake(false); } render(); window.scrollTo(0, 0); }
function startGame() {
  G.turnStart = G.clock ? Date.now() : null; G.paused = false; saveG(); screen = 'game'; render(); startTick();
  if (S.keep) keepAwake(true);
  if (G.v !== 'classical' && !LS.get('hint960', false)) { dialog(t('hint960_title'), t('hint960_text'), [[t('hint960_ok'), () => { LS.set('hint960', true); maybeEngine(); }]]); return; }
  maybeEngine();
}
function continueGame() {
  screen = 'game'; ui = { sel: null, flip: false, showMoves: false, pending: null, thinking: false, handoff: false, drag: null, over: false };
  if (G.clock) { G.paused = true; } else { G.paused = false; }
  saveG(); render(); startTick(); if (S.keep) keepAwake(true);
  if (!G.paused) maybeEngine();
}
function pauseGame() { if (!running()) return; if (G.clock && G.turnStart) { const c = sideOf(pos()); G.clock[c] = clockNow(c); } G.paused = true; G.turnStart = null; saveG(); render(); }
function resumeGame() { G.paused = false; G.turnStart = G.clock ? Date.now() : null; saveG(); render(); startTick(); maybeEngine(); }

// ---------- Darstellung ----------
function render() {
  applyLook();
  const a = $('#app');
  const fn = { home: vHome, setup: vSetup, game: vGame, archive: vArchive, replay: vReplay, rules: vRules, settings: vSettings, info: vInfo, licenses: vLicenses, stats: vStats }[screen] || vHome;
  a.innerHTML = fn(); bind();
}
const backBtn = (to = 'home') => `<button class="back" data-go="${to}">← ${t('back')}</button>`;
function vHome() {
  return `<div class="home"><p class="title">${t('app_name')}</p><p class="sub">${t('app_subtitle')}</p>
    <button class="btn filled" data-act="play">${t('home_play')}</button>
    ${running() ? `<button class="btn filled" data-act="continue">${t('home_continue')}</button>` : ''}
    <button class="btn outline" data-go="archive">${t('home_archive')}</button>
    <button class="btn outline" data-go="stats">${t('stats_title')}</button>
    <button class="btn outline" data-go="rules">${t('home_rules')}</button>
    <button class="btn outline" data-go="settings">${t('home_settings')}</button>
    <div class="foot"><button class="btn text" data-go="info">${t('home_info')}</button><p class="small">${t('home_version', VERSION)}</p></div></div>`;
}
const radio = (on, label, attrs) => `<button class="radio ${on ? 'on' : ''}" ${attrs} role="radio" aria-checked="${on}"><i></i><span>${label}</span></button>`;
const sw = (on, label, help, key) => `<button class="switch ${on ? 'on' : ''}" data-sw="${key}" role="switch" aria-checked="${on}"><span><b>${label}</b>${help ? `<span class="small">${help}</span>` : ''}</span><i></i></button>`;
function vSetup() {
  const s = setup;
  return `<div class="page">${backBtn()}<h1>${t('setup_title')}</h1>
    <h3>${t('setup_variant')}</h3>
    ${radio(s.v === 'classical', t('variant_classical'), 'data-set="v:classical"')}
    ${radio(s.v === '960', t('variant_chess960'), 'data-set="v:960"')}
    ${s.v === '960' ? `<p class="small" style="margin-left:40px">${t('variant_chess960_help')}</p>` : ''}
    <h3>${t('setup_opponent')}</h3>
    ${radio(s.opp === 'cpu', t('opponent_computer'), 'data-set="opp:cpu"')}
    ${radio(s.opp === 'two', t('opponent_two'), 'data-set="opp:two"')}
    ${s.opp === 'cpu' ? `<h3>${t('setup_color')}</h3>
      ${radio(s.color === 'w', t('color_white'), 'data-set="color:w"')}${radio(s.color === 'b', t('color_black'), 'data-set="color:b"')}${radio(s.color === 'r', t('color_random'), 'data-set="color:r"')}
      <h3>${t('setup_level')}</h3>${[1, 2, 3, 4, 5].map((l) => radio(s.level === l, t('level_' + l), `data-set="level:${l}"`)).join('')}` : ''}
    <h3>${t('setup_time')}</h3>
    <div class="chips">${[0, 1, 3, 5, 10, 15, 30].map((m) => `<button class="chip ${s.time === m ? 'on' : ''}" data-set="time:${m}">${m ? t('time_minutes', m) : t('time_unlimited')}</button>`).join('')}</div>
    ${s.time ? `<h3>${t('setup_increment')}</h3><div class="chips">${[0, 1, 2, 3, 5, 10].map((x) => `<button class="chip ${s.inc === x ? 'on' : ''}" data-set="inc:${x}">${x ? t('increment_seconds', x) : '0 s'}</button>`).join('')}</div>` : ''}
    <button class="btn filled" style="margin-top:22px" data-act="start">${t('setup_start')}</button></div>`;
}
function playerName(c) { return G.opp === 'cpu' ? (c === G.human ? t('player_you') : t('player_computer_level', G.level)) : null; }
function pbar(c, p) {
  const act = running() && sideOf(p) === c;
  const name = playerName(c) ? `${playerName(c)} · ${colorName(c)}` : colorName(c);
  return `<div class="pbar ${act ? 'act' : ''}" aria-label="${esc(act ? t('player_to_move', name) : name)}">${act ? '▶ ' : '&nbsp;&nbsp;&nbsp;'}<span class="n">${esc(name)} <span class="cap">${capturedHtml(c, p)}</span></span>${G.clock ? `<span class="clk ${clockNow(c) < 10000 ? 'low' : ''}" data-clk="${c}">${fmtClock(clockNow(c))}</span>` : ''}</div>`;
}
function boardHtml(p, bottom, opts = {}) {
  const sel = opts.sel, tg = opts.targets || [], last = opts.last, pend = opts.pending;
  let shown = p;
  if (pend) { shown = p.clone(); shown.play(CO.parseUci(pend)); }
  const chkSq = shown.isCheck() ? shown.board.kingOf(shown.turn) : null;
  let h = '';
  for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) {
    const rank = bottom === 'w' ? r : 7 - r, file = bottom === 'w' ? f : 7 - f, sq = rank * 8 + file;
    const pc = shown.board.get(sq);
    const isLast = (last && (last.from === sq || last.to === sq)) || (opts.hint && (opts.hint.from === sq || opts.hint.to === sq));
    const cls = ['sq', (rank + file) % 2 === 0 ? 'd' : '', isLast ? 'last' : '', sel === sq ? 'sel' : '', chkSq === sq ? 'chk' : ''].join(' ');
    const isT = tg.includes(sq);
    h += `<div class="${cls}" data-sq="${sq}">`;
    if (S.coords && !opts.noCoords) {
      if ((bottom === 'w' ? file === 0 : file === 7)) h += `<span class="cr r">${rank + 1}</span>`;
      if ((bottom === 'w' ? rank === 0 : rank === 7)) h += `<span class="cr f">${'abcdefgh'[file]}</span>`;
    }
    if (pc) h += `<div class="pc" style="background-image:url(${pieceImg(pc.color, pc.role)})"></div>`;
    if (isT && S.targets) h += pc ? '<div class="ring"></div>' : '<div class="dot"></div>';
    h += '</div>';
  }
  return `<div class="board" id="board">${h}</div>`;
}
function lastMoveOf(g, n = g.moves.length) { if (!n) return null; const m = CO.parseUci(g.moves[n - 1]); return m; }
function vGame() {
  if (!G) return vHome();
  const p = pos(); const bottom = bottomColor(p);
  const label = `${(G.v === 'classical' ? t('label_variant_classical') : t('label_variant_960', G.n960))} · ${G.opp === 'cpu' ? t('label_vs_computer', G.level) : t('label_two_players')}`;
  const turn = colorName(sideOf(p));
  let status = !running() ? `${resultTitle(G.result)} – ${t(G.result.reason)}` : G.paused ? t('status_paused') : ui.thinking ? t('status_thinking')
    : ui.pending ? t('status_pending', G.sans.length ? '' : '').replace('  ', ' ') : p.isCheck() ? t('status_check', turn) : t('status_to_move', turn);
  if (ui.pending) { const pp = pos(); status = t('status_pending', CO.makeSan(pp, CO.parseUci(ui.pending))); }
  const tg = ui.sel != null ? targetsFor(p, ui.sel) : [];
  const last = S.lastMove ? lastMoveOf(G) : null;
  const sans = G.sans;
  const ml = sans.length ? t('last_move', (Math.ceil(sans.length / 2)) + (sans.length % 2 ? '. ' : '… ') + sans[sans.length - 1]) : t('moves_empty');
  let list = '';
  if (ui.showMoves && sans.length) { for (let i = 0; i < sans.length; i += 2) list += `<div><span>${i / 2 + 1}.</span> ${esc(sans[i])} ${sans[i + 1] ? esc(sans[i + 1]) : ''}</div>`; }
  const castle = running() && G.v !== 'classical' && isHumanTurn(p) && !ui.thinking ? castleMoves(p) : null;
  const top = other(bottom);
  return `<div class="game"><div class="ghead">${esc(label)}</div>${pbar(top, p)}
    <div class="bwrap">${boardHtml(p, bottom, { sel: ui.sel, targets: tg, last: ui.hint ? null : last, hint: ui.hint, pending: ui.pending })}</div>
    ${pbar(bottom, p)}
    <div class="status" aria-live="polite">${esc(status)}</div>
    ${ui.pending ? `<div class="confirm"><button class="btn outline" data-act="cancelpend">${t('back')}</button><button class="btn filled" data-act="confirm">${t('action_confirm_move')}</button></div>` : ''}
    ${castle ? `<div class="castle"><button class="btn outline" ${castle.k ? '' : 'disabled style="opacity:.4"'} data-castle="k" aria-label="${t('castle_kingside_desc')}">${t('castle_kingside')}</button><button class="btn outline" ${castle.q ? '' : 'disabled style="opacity:.4"'} data-castle="q" aria-label="${t('castle_queenside_desc')}">${t('castle_queenside')}</button></div>` : ''}
    <div class="mline"><span class="l">${esc(ml)}</span><button data-act="moves">${ui.showMoves ? t('moves_hide') : t('moves_show')}</button></div>
    ${list ? `<div class="mlist">${list}</div>` : ''}
    ${running() && isHumanTurn(p) && !ui.thinking && !G.paused ? `<div class="gbtns"><button class="btn outline" data-act="hint">💡 ${t('act_hint')}</button><button class="btn outline" data-act="undo">↶ ${t('act_undo')}</button></div>` : ''}<div class="gbtns">${running() ? `<button class="btn outline" data-act="pause">${t('action_pause')}</button>` : ''}<button class="btn outline" data-act="flip">${t('action_flip')}</button><button class="btn outline" data-act="more">${t('action_more')}</button></div>
    ${G.paused && running() ? '' : ''}</div>`;
}
function vArchive() {
  const arch = LS.get('archive', []);
  if (!arch.length) return `<div class="page">${backBtn()}<h1>${t('archive_title')}</h1><p>${t('archive_empty')}</p></div>`;
  const loc = lang() === 'de' ? 'de-DE' : 'en-US';
  return `<div class="page">${backBtn()}<h1>${t('archive_title')}</h1>
    ${arch.map((g, i) => {
      const d = new Date(g.result.at || g.started);
      const who = g.opp === 'cpu' ? t('archive_vs_computer', g.level, colorName(g.human)) : t('label_two_players');
      return `<div class="arch"><b>${esc(resultTitle(g.result))}</b> <span class="small">– ${esc(t(g.result.reason))}</span>
        <div class="small">${d.toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' })} · ${t(g.v === 'classical' ? 'variant_classical' : 'variant_chess960')}</div>
        <div class="small">${esc(who)}${g.time ? ' · ' + t('archive_time', g.time, g.inc) : ''} · ${g.sans.length}</div>
        <div class="r"><button class="btn outline" data-open="${i}">${t('archive_open')}</button><button class="btn text" data-del="${i}">${t('action_delete')}</button></div></div>`;
    }).join('')}
    <button class="btn outline" style="margin-top:16px" data-act="delall">${t('archive_delete_all')}</button></div>`;
}
function openReplay(g) { replayG = g; replayPly = g.moves.length; screen = 'replay'; closeOv(); render(); }
function vReplay() {
  const g = replayG; const p = replay(g, replayPly);
  const bottom = g.opp === 'cpu' ? g.human : 'w';
  const pos2 = replayPly ? t('replay_position_after', `${Math.ceil(replayPly / 2)}${replayPly % 2 ? '.' : '…'} ${g.sans[replayPly - 1]}`) : t('replay_start_position');
  return `<div class="game">${backBtn(screen === 'replay' && G === g ? 'game' : 'archive')}<h1 style="margin:0 0 6px">${t('replay_title')}</h1>
    <div class="bwrap">${boardHtml(p, bottom, { last: S.lastMove ? lastMoveOf(g, replayPly) : null })}</div>
    <div class="status">${esc(pos2)}</div><p class="small" style="text-align:center">${t('replay_ply_of', replayPly, g.moves.length)}</p>
    <div class="gbtns"><button class="btn outline" data-rp="first" aria-label="${t('replay_first')}">⏮</button><button class="btn outline" data-rp="prev" aria-label="${t('replay_prev')}">◀</button>
    <button class="btn outline" data-rp="next" aria-label="${t('replay_next')}">▶</button><button class="btn outline" data-rp="last" aria-label="${t('replay_last')}">⏭</button></div>
    <div class="gbtns"><button class="btn outline" data-ex="share">${t('export_share_pgn')}</button><button class="btn outline" data-ex="save">${t('export_save_pgn')}</button><button class="btn outline" data-ex="fen">${t('export_copy_fen')}</button></div>
    <div class="gbtns"><button class="btn outline" data-act="eval">${t('eval_btn')}</button></div><p class="status" id="evalout"></p>
    <p class="small" style="padding:0 8px">${t('replay_note')}</p></div>`;
}
const RULES = ['goal', 'pieces', 'check', 'stalemate', 'promotion', 'castling', 'ep', '960', '960castle', 'clock', 'levels', 'buttons'];
function vRules() { return `<div class="page">${backBtn()}<h1>${t('rules_title')}</h1>${RULES.map((k) => `<h3>${t('rules_' + k + '_h')}</h3><p>${esc(t('rules_' + k)).replace(/\n/g, '<br>')}</p>`).join('')}</div>`; }
function vSettings() {
  const th = (k, label) => `<button class="thumb ${S.board === k ? 'on' : ''}" data-set2="board:${k}"><div class="t">${[['b', 'knight', 1], ['w', 'queen', 0], ['w', 'king', 0], ['b', 'pawn', 1]].map(([c, r, d], i) => `<div style="background-color:${BOARDS[k][(i === 0 || i === 3) ? 1 : 0]};background-image:url(${pieceImg(c === 'w' ? 'white' : 'black', r)})"></div>`).join('')}</div>${label}</button>`;
  const ps = (k, label) => `<button class="thumb ${S.pieces === k ? 'on' : ''}" data-set2="pieces:${k}"><div class="t">${[['black', 'knight'], ['white', 'queen'], ['white', 'king'], ['black', 'pawn']].map(([c, r], i) => `<div style="background-color:${BOARDS[S.board][(i === 0 || i === 3) ? 1 : 0]};background-image:url(${pieceImg(c, r, k)})"></div>`).join('')}</div>${label}</button>`;
  return `<div class="page">${backBtn()}<h1>${t('settings_title')}</h1>
    <h2>${t('group_display')}</h2><h3>${t('setting_theme')}</h3>
    ${radio(S.theme === 'system', t('theme_system'), 'data-set2="theme:system"')}${radio(S.theme === 'light', t('theme_light'), 'data-set2="theme:light"')}${radio(S.theme === 'dark', t('theme_dark'), 'data-set2="theme:dark"')}
    <h3>${t('setting_board')}</h3><div class="thumbs">${th('classic', t('board_classic'))}${th('slate', t('board_slate'))}${th('warm', t('board_warm'))}${th('contrast', t('board_contrast'))}${th('ocean', t('board_ocean'))}${th('rose', t('board_rose'))}</div>
    <h3>${t('setting_pieces')}</h3><div class="thumbs">${ps('classic', t('pieces_classic'))}${ps('modern', t('pieces_modern'))}</div>
    ${sw(S.coords, t('setting_coordinates'), '', 'coords')}${sw(S.lastMove, t('setting_last_move'), '', 'lastMove')}
    <h2>${t('group_controls')}</h2>
    ${sw(S.confirm, t('setting_confirm'), t('setting_confirm_help'), 'confirm')}${sw(S.targets, t('setting_targets'), '', 'targets')}
    <h3>${t('setting_two_player_view')}</h3>
    ${radio(S.tpv === 'fixed', t('tpv_fixed'), 'data-set2="tpv:fixed"')}${radio(S.tpv === 'rotate', t('tpv_rotate'), 'data-set2="tpv:rotate"')}${radio(S.tpv === 'handoff', t('tpv_handoff'), 'data-set2="tpv:handoff"')}
    <p class="small">${t('tpv_' + S.tpv + '_help')}</p>
    <h2>${t('group_feedback')}</h2>
    ${sw(S.sound, t('setting_sound'), t('setting_sound_help'), 'sound')}${sw(S.haptics, t('setting_haptics'), '', 'haptics')}
    ${sw(S.anim, t('setting_animation'), '', 'anim')}${sw(S.reduce, t('setting_reduce_motion'), t('setting_reduce_motion_help').replace('Android', 'iOS'), 'reduce')}
    ${sw(S.keep, t('setting_keep_screen'), t('setting_keep_screen_help'), 'keep')}
    <h2>${t('group_general')}</h2><h3>${t('setting_language')}</h3>
    ${radio(S.lang === 'system', t('language_system'), 'data-set2="lang:system"')}${radio(S.lang === 'de', 'Deutsch', 'data-set2="lang:de"')}${radio(S.lang === 'en', 'English', 'data-set2="lang:en"')}
    <hr class="sep"><button class="btn text" style="text-align:left" data-go="info">${t('setting_privacy')}</button></div>`;
}
const iosText = (s) => s.replace(/Android cloud backup/g, 'iCloud backup').replace(/Android-Cloud-Backup/g, 'iCloud-Backup')
  .replace(/Computer opponent: Stockfish 19[^\n]*/, 'Computer opponent: Stockfish 17.1 lite (official-stockfish, WebAssembly port stockfish.js by Nathan Rugg), GPLv3, unmodified, built for iOS. Including its embedded small NNUE network.')
  .replace(/Computergegner: Stockfish 19[^\n]*/, 'Computergegner: Stockfish 17.1 lite (official-stockfish, WebAssembly-Portierung stockfish.js von Nathan Rugg), GPLv3, unverändert, für iOS. Einschließlich des eingebetteten kleinen NNUE-Netzes.');
function vInfo() {
  return `<div class="page">${backBtn()}<h1>${t('info_title')}</h1>
    <h3>${t('info_privacy_heading')}</h3><p>${esc(iosText(t('info_privacy_text'))).replace(/\n/g, '<br>')}</p>
    <hr class="sep"><h3>${t('info_licenses_heading')}</h3><p>${esc(iosText(t('info_licenses_text'))).replace(/\n/g, '<br>')}</p>
    <h3>${t('info_source_heading')}</h3><p>${esc(t('info_source_text')).replace(/\n/g, '<br>')}</p><p class="small">${esc(t('info_source_url', SOURCE_URL))}</p>
    <button class="btn outline" data-go="licenses">${t('info_show_licenses')}</button>
    <p class="small" style="margin-top:18px">${t('info_version', VERSION)}</p></div>`;
}
function vLicenses() {
  return `<div class="page">${backBtn('info')}<h1>${t('licenses_title')}</h1>
    <h3>Lumvero Chess (iOS)</h3><p>GNU General Public License v3.0 or later.</p>
    <h3>Stockfish 17.1 (lite, WebAssembly)</h3><p>GNU GPL v3. © The Stockfish developers. Source: github.com/official-stockfish/Stockfish, WebAssembly port: github.com/nmrugg/stockfish.js (GPL v3).</p>
    <h3>chessops</h3><p>GNU GPL v3. © Niklas Fiekas. github.com/niklasf/chessops</p>
    <h3>Capacitor</h3><p>MIT License. © Ionic.</p>
    <h3>${t('pieces_classic')}</h3><p>“Cburnett” by Colin M. L. Burnett, Wikimedia Commons, GFDL / BSD / GPL – used under the GPL.</p>
    <h3>${t('pieces_modern')}, boards, sounds</h3><p>Created for Lumvero Chess, CC0 1.0.</p></div>`;
}

// ---------- Ereignisse ----------
function bind() {
  document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.dataset.go));
  document.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => { const [k, v] = b.dataset.set.split(':'); setup[k] = /^\d+$/.test(v) ? +v : v; if (k === 'time' && !setup.time) setup.inc = 0; LS.set('setup', setup); render(); });
  document.querySelectorAll('[data-set2]').forEach((b) => b.onclick = () => { const [k, v] = b.dataset.set2.split(':'); S[k] = v; saveS(); render(); });
  document.querySelectorAll('[data-sw]').forEach((b) => b.onclick = () => { const k = b.dataset.sw; S[k] = !S[k]; saveS(); if (k === 'keep') keepAwake(S.keep && screen === 'game' && running()); render(); });
  const act = (n, f) => document.querySelectorAll(`[data-act="${n}"]`).forEach((b) => b.onclick = f);
  act('play', () => { if (running()) dialog(t('discard_title'), t('discard_text'), [[t('back'), null], [t('setup_start'), () => go('setup')]]); else if (G && G.result) dialog(t('new_game_title'), t('new_game_text_finished'), [[t('back'), null], [t('home_play'), () => go('setup')]]); else go('setup'); });
  act('continue', continueGame);
  act('start', () => { newGame(setup); startGame(); });
  act('moves', () => { ui.showMoves = !ui.showMoves; render(); });
  act('hint', showHint);
  act('undo', takeBack);
  act('eval', evalReplay);
  act('flip', () => { ui.flip = !ui.flip; render(); });
  act('pause', () => { pauseGame(); dialog(t('resume_title'), t('resume_text'), [[t('resume_action'), resumeGame]], { dismiss: false }); });
  act('more', moreMenu);
  act('confirm', () => { const u = ui.pending; ui.pending = null; claimCheckThenPlay(u); });
  act('cancelpend', () => { ui.pending = null; render(); });
  act('delall', () => dialog(t('archive_delete_all_title'), t('archive_delete_all_text'), [[t('back'), null], [t('action_delete'), () => { LS.set('archive', []); render(); }]]));
  document.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => openReplay(LS.get('archive', [])[+b.dataset.open]));
  document.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => dialog(t('archive_delete_one_title'), t('archive_delete_one_text'), [[t('back'), null], [t('action_delete'), () => { const a = LS.get('archive', []); a.splice(+b.dataset.del, 1); LS.set('archive', a); render(); }]]));
  document.querySelectorAll('[data-rp]').forEach((b) => b.onclick = () => { const n = replayG.moves.length; replayPly = { first: 0, prev: Math.max(0, replayPly - 1), next: Math.min(n, replayPly + 1), last: n }[b.dataset.rp]; render(); });
  document.querySelectorAll('[data-ex]').forEach((b) => b.onclick = () => exportGame(b.dataset.ex, screen === 'replay' ? replayG : G, screen === 'replay' ? replayPly : null));
  document.querySelectorAll('[data-castle]').forEach((b) => b.onclick = () => { const c = castleMoves(pos())[b.dataset.castle]; if (c) commit(c); });
  const board = $('#board');
  if (board && screen === 'game') bindBoard(board);
  if (screen === 'game' && running() && ui.handoff) showHandoff();
}
function sqFromPoint(x, y) { const el = document.elementFromPoint(x, y); const s = el && el.closest && el.closest('[data-sq]'); return s ? +s.dataset.sq : null; }
function bindBoard(board) {
  board.onpointerdown = (e) => {
    const sq = sqFromPoint(e.clientX, e.clientY); if (sq == null) return;
    const p = pos(); if (!running() || !isHumanTurn(p) || ui.thinking || G.paused || ui.pending) { if (ui.pending) { ui.pending = null; render(); } return; }
    const pc = p.board.get(sq);
    if (ui.sel != null && ui.sel !== sq) {
      if (tryMove(ui.sel, sq)) return;
      if (G.v !== 'classical' && pc && pc.role === 'rook' && pc.color === p.turn && p.board.get(ui.sel).role === 'king') { const c = Object.values(castleMoves(p)).find((m) => m.to === sq); if (c) { commit(c); return; } }
    }
    if (pc && pc.color === p.turn) {
      ui.sel = sq; render(); buzz();
      const size = $('#board').getBoundingClientRect().width / 8;
      const d = document.createElement('div'); d.className = 'drag'; d.style.width = d.style.height = size * 1.15 + 'px'; d.style.backgroundImage = `url(${pieceImg(pc.color, pc.role)})`;
      ui.drag = { from: sq, el: d, moved: false, x: e.clientX, y: e.clientY };
      const nb = $('#board'); nb.setPointerCapture && nb.setPointerCapture(e.pointerId);
    } else { ui.sel = null; render(); }
  };
  board.onpointermove = (e) => {
    const d = ui.drag; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { d.moved = true; document.body.appendChild(d.el); const src = $(`[data-sq="${d.from}"] .pc`); if (src) src.style.opacity = '.3'; }
    if (d.moved) { d.el.style.left = e.clientX + 'px'; d.el.style.top = e.clientY + 'px'; }
  };
  board.onpointerup = board.onpointercancel = (e) => {
    const d = ui.drag; ui.drag = null; if (!d) return;
    if (d.el.parentNode) d.el.remove();
    if (d.moved) { const to = sqFromPoint(e.clientX, e.clientY); if (to != null && to !== d.from && tryMove(d.from, to)) return; render(); }
  };
}
function showHandoff() {
  const p = pos();
  ov().innerHTML = `<div class="handoff"><h3>${esc(t('handoff_title', colorName(sideOf(p))))}</h3><p>${t(G.clock ? 'handoff_text_clock' : 'handoff_text')}</p><button class="btn filled" style="max-width:280px" data-ready>${t('handoff_ready')}</button></div>`;
  $('[data-ready]', ov()).onclick = () => { ui.handoff = false; closeOv(); if (G.clock) G.turnStart = Date.now(); saveG(); render(); };
  if (G.clock && !G.turnStart) G.turnStart = Date.now();
}
function moreMenu() {
  const p = pos(); const items = [];
  items.push([ui.showMoves ? t('moves_hide') : t('moves_show').replace(' ▾', ''), () => { ui.showMoves = !ui.showMoves; render(); }]);
  if (running()) {
    const claimable = isHumanTurn(p) && (repCount(G) >= 3 || p.halfmoves >= 100);
    if (claimable) items.push([t('action_claim_draw'), () => finish(null, repCount(G) >= 3 ? 'reason_threefold_claim' : 'reason_fifty_claim')]);
    if (G.opp === 'two' && G.moves.length) items.push([t('action_offer_draw'), () => {
      const offerer = colorName(sideOf(p)), to = colorName(other(sideOf(p)));
      dialog(t('draw_offer_title'), t('draw_offer_text', offerer, to), [[t('draw_decline'), null], [t('draw_accept'), () => finish(null, 'reason_agreement')]], { dismiss: false });
    }]);
    items.push([t('action_resign'), () => dialog(t('resign_title'), t('resign_text'), [[t('back'), null], [t('action_resign'), () => finish(other(G.opp === 'cpu' ? G.human : sideOf(p)), 'reason_resignation')]])]);
  }
  if (G.moves.length) { items.push([t('export_share_pgn'), () => exportGame('share', G)]); items.push([t('export_save_pgn'), () => exportGame('save', G)]); }
  items.push([t('export_copy_fen'), () => exportGame('fen', G)]);
  if (!running()) items.push([t('result_replay'), () => openReplay(G)]);
  items.push([t('action_new_game'), () => { if (running()) dialog(t('new_game_title'), t('new_game_text'), [[t('back'), null], [t('home_play'), () => go('setup')]]); else go('setup'); }]);
  items.push([t('result_home'), () => go('home')]);
  ov().innerHTML = `<div class="scrim" style="background:transparent"></div><div class="menu">${items.map((it, i) => `<button data-m="${i}">${esc(it[0])}</button>`).join('')}</div>`;
  $('.scrim', ov()).onclick = closeOv;
  ov().querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { closeOv(); items[+b.dataset.m][1](); });
}

// ---------- Export ----------
function pgnOf(g) {
  const d = new Date(g.started); const ds = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const res = g.result ? (g.result.winner === 'w' ? '1-0' : g.result.winner === 'b' ? '0-1' : '1/2-1/2') : '*';
  const name = (c) => (g.opp === 'cpu' ? (c === g.human ? 'Player' : `Stockfish level ${g.level}`) : (c === 'w' ? 'White' : 'Black'));
  const h = [['Event', 'Lumvero Chess'], ['Site', 'Lumvero Chess (iOS)'], ['Date', ds], ['Round', '-'], ['White', name('w')], ['Black', name('b')], ['Result', res]];
  if (g.v !== 'classical') { h.push(['Variant', 'Chess960']); h.push(['SetUp', '1']); h.push(['FEN', g.startFen]); }
  if (g.time) h.push(['TimeControl', `${g.time * 60}+${g.inc}`]);
  let body = ''; g.sans.forEach((s, i) => { body += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s + ' '; });
  return h.map(([k, v]) => `[${k} "${v}"]`).join('\n') + '\n\n' + (body + res).replace(/(.{1,79})(\s|$)/g, '$1\n').trim() + '\n';
}
async function exportGame(kind, g, ply) {
  try {
    if (kind === 'fen') {
      const fen = CO.makeFen(replay(g, ply == null ? g.moves.length : ply).toSetup());
      if (Clip) await Clip.write({ string: fen }); else await navigator.clipboard.writeText(fen);
      snack(t('msg_fen_copied')); return;
    }
    const pgn = pgnOf(g); const fname = `lumvero-chess-${new Date(g.started).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.pgn`;
    if (kind === 'share') {
      if (Share) await Share.share({ title: t('export_share_title'), text: pgn, dialogTitle: t('export_share_title') });
      else if (navigator.share) await navigator.share({ title: t('export_share_title'), text: pgn });
      return;
    }
    if (FS) { const r = await FS.writeFile({ path: fname, data: pgn, directory: 'DOCUMENTS', encoding: 'utf8' }); if (Share) await Share.share({ title: fname, url: r.uri }); snack(t('msg_export_saved')); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([pgn], { type: 'application/x-chess-pgn' })); a.download = fname; a.click(); snack(t('msg_export_saved')); }
  } catch (e) {
    if (e && /cancel/i.test(String(e.message || e))) snack(t('msg_export_cancelled')); else snack(t('msg_export_failed'));
  }
}

// ---------- Start ----------
document.addEventListener('visibilitychange', () => { if (document.hidden && G && running() && screen === 'game' && G.clock && !G.paused) { pauseGame(); dialog(t('resume_title'), t('resume_text'), [[t('resume_action'), resumeGame]], { dismiss: false }); } });
if (CapApp) CapApp.addListener('backButton', () => { if (screen !== 'home') go(screen === 'licenses' ? 'info' : 'home'); });
try { if (G && (!G.startFen || !Array.isArray(G.moves))) throw new Error('bad'); if (G) replay(G); }
catch (e) { G = null; LS.del('game'); setTimeout(() => dialog(t('load_error_title'), t('load_error_text'), [[t('hint960_ok'), null]]), 50); }
render();
Engine.start().catch(() => {});

// ---------- Update 1.0.2 ----------
const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
function capturedHtml(c, p) { // Figuren, die Farbe c geschlagen hat, + Materialvorsprung
  const start = posFrom(G.startFen); const count = (pos2, col) => { const m = {}; for (const r of Object.keys(VALUE)) m[r] = 0; for (const sq of pos2.board[col]) m[pos2.board.get(sq).role]++; return m; };
  const opp = c === 'w' ? 'black' : 'white', me = c === 'w' ? 'white' : 'black';
  const s0 = count(start, opp), s1 = count(p, opp); let html = '', mat = 0;
  for (const r of ['queen', 'rook', 'bishop', 'knight', 'pawn']) { const k = Math.max(0, s0[r] - s1[r]); for (let i = 0; i < k; i++) html += `<img src="${pieceImg(opp, r)}" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-left:-3px">`; }
  const val = (m) => Object.entries(m).reduce((a, [r, k]) => a + VALUE[r] * k, 0);
  mat = val(count(p, me)) - val(s1);
  return html + (mat > 0 ? ` <small>+${mat}</small>` : '');
}
async function showHint() {
  const p = pos(); if (!running() || !isHumanTurn(p)) return;
  snack(t('hint_thinking'));
  try { const b = await Engine.best(G, { skill: 20, ms: 900 }); if (!b) { snack(t('hint_none')); return; }
    const mv = CO.normalizeMove(p, CO.parseUci(b)); let to = mv.to; const pc = p.board.get(mv.from);
    if (G.v === 'classical' && pc && pc.role === 'king' && p.board.get(to) && p.board.get(to).role === 'rook' && p.board.get(to).color === pc.color) to = CO.squareFile(to) === 7 ? to - 1 : to + 2;
    ui.hint = { from: mv.from, to }; ui.sel = mv.from; buzz(); render();
  } catch (e) { Engine.reset(); snack(t('hint_none')); }
}
function takeBack() {
  if (!running() || !G.moves.length) { snack(t('undo_none')); return; }
  let k = 1; if (G.opp === 'cpu') { k = sideOf(pos()) === G.human ? 2 : 1; }
  k = Math.min(k, G.moves.length);
  G.moves.splice(-k); G.sans.splice(-k); ui.sel = null; ui.hint = null; ui.pending = null;
  if (G.clock) G.turnStart = Date.now();
  saveG(); render(); if (G.opp === 'cpu' && sideOf(pos()) !== G.human) maybeEngine();
}
async function evalReplay() {
  const el = $('#evalout'); if (!el) return; el.textContent = '…';
  try { await Engine.best(replayG, { skill: 20, ms: 1200, upto: replayPly }); const sc = Engine.lastScore; if (!sc) { el.textContent = '–'; return; }
    const whiteToMove = sideOf(replay(replayG, replayPly)) === 'w'; const v = whiteToMove ? sc.v : -sc.v;
    el.textContent = t('eval_text', sc.kind === 'mate' ? t('eval_mate', Math.abs(v)) + (v < 0 ? ' (−)' : ' (+)') : (v >= 0 ? '+' : '−') + (Math.abs(v) / 100).toFixed(2));
  } catch (e) { Engine.reset(); el.textContent = '–'; }
}
function vStats() {
  const arch = LS.get('archive', []);
  if (!arch.length) return `<div class="page">${backBtn()}<h1>${t('stats_title')}</h1><p>${t('stats_empty')}</p></div>`;
  const cpu = arch.filter((g) => g.opp === 'cpu'), two = arch.filter((g) => g.opp === 'two');
  const wdl = (list) => { let w = 0, d = 0, l = 0; list.forEach((g) => { if (!g.result.winner) d++; else if (g.result.winner === g.human) w++; else l++; }); return t('stats_wdl', w, d, l); };
  let h = `<div class="page">${backBtn()}<h1>${t('stats_title')}</h1><p>${t('stats_games', arch.length)}</p><h3>${t('stats_vs')}</h3><p>${wdl(cpu)}</p>`;
  for (let L = 1; L <= 5; L++) { const g = cpu.filter((x) => x.level === L); if (g.length) h += `<p class="small">${t('stats_level', L)}: ${wdl(g)}</p>`; }
  const ww = two.filter((g) => g.result.winner === 'w').length, bw = two.filter((g) => g.result.winner === 'b').length, dd = two.length - ww - bw;
  h += `<h3>${t('stats_two')}</h3><p>${t('result_white_wins')}: ${ww} · ${t('result_black_wins')}: ${bw} · ${t('result_draw')}: ${dd}</p></div>`;
  return h;
}
