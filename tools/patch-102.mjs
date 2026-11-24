// Update 1.0.2: Tipp, Zuruecknehmen, geschlagene Figuren, Bewertung, neue Bretter, Statistik.
import fs from 'node:fs';
const f = 'www/app.js'; let s = fs.readFileSync(f, 'utf8'); let n = 0;
const R = (a, b) => { if (!s.includes(a)) { console.log('FEHLT:', a.slice(0, 70)); return; } s = s.replace(a, b); n++; };
R("const VERSION = '1.0.1';", `const VERSION = '1.0.2';
// ---- Neue Texte (Update 1.0.2) ----
Object.assign(STR.en, { act_hint: 'Hint', act_undo: 'Take back', hint_thinking: 'Looking for a good move…', hint_none: 'No hint available.', eval_btn: 'Evaluate position', eval_text: 'Evaluation: %1$s (from White’s view)', eval_mate: 'mate in %1$d', stats_title: 'Statistics', stats_games: 'Finished games: %1$d', stats_vs: 'Against the computer', stats_two: 'Two players on this device', stats_level: 'Level %1$d', stats_wdl: 'Won %1$d · Draw %2$d · Lost %3$d', stats_empty: 'No finished games yet.', board_ocean: 'Ocean', board_rose: 'Rose', undo_none: 'Nothing to take back.' });
Object.assign(STR.de, { act_hint: 'Tipp', act_undo: 'Zurücknehmen', hint_thinking: 'Suche einen guten Zug …', hint_none: 'Kein Tipp verfügbar.', eval_btn: 'Stellung bewerten', eval_text: 'Bewertung: %1$s (aus Sicht von Weiß)', eval_mate: 'Matt in %1$d', stats_title: 'Statistik', stats_games: 'Beendete Partien: %1$d', stats_vs: 'Gegen den Computer', stats_two: 'Zwei Spieler an diesem Gerät', stats_level: 'Stufe %1$d', stats_wdl: 'Gewonnen %1$d · Remis %2$d · Verloren %3$d', stats_empty: 'Noch keine beendeten Partien.', board_ocean: 'Ozean', board_rose: 'Rosé', undo_none: 'Nichts zum Zurücknehmen.' });`);
R("contrast: ['#FFFFFF', '#3D6A99'] };", "contrast: ['#FFFFFF', '#3D6A99'], ocean: ['#DEE9F2', '#4F7CA0'], rose: ['#F3E1E1', '#B5656A'] };");
R("${th('contrast', t('board_contrast'))}</div>", "${th('contrast', t('board_contrast'))}${th('ocean', t('board_ocean'))}${th('rose', t('board_rose'))}</div>");
R("const isLast = last && (last.from === sq || last.to === sq);", "const isLast = (last && (last.from === sq || last.to === sq)) || (opts.hint && (opts.hint.from === sq || opts.hint.to === sq));");
R("boardHtml(p, bottom, { sel: ui.sel, targets: tg, last, pending: ui.pending })", "boardHtml(p, bottom, { sel: ui.sel, targets: tg, last: ui.hint ? null : last, hint: ui.hint, pending: ui.pending })");
R('<div class="gbtns">${running() ? `<button class="btn outline" data-act="pause">', '${running() && isHumanTurn(p) && !ui.thinking && !G.paused ? `<div class="gbtns"><button class="btn outline" data-act="hint">💡 ${t(\'act_hint\')}</button><button class="btn outline" data-act="undo">↶ ${t(\'act_undo\')}</button></div>` : \'\'}<div class="gbtns">${running() ? `<button class="btn outline" data-act="pause">');
R('<span class="n">${esc(name)}</span>', '<span class="n">${esc(name)} <span class="cap">${capturedHtml(c, p)}</span></span>');
R('<button class="btn outline" data-go="rules">', '<button class="btn outline" data-go="stats">${t(\'stats_title\')}</button>\n    <button class="btn outline" data-go="rules">');
R('info: vInfo, licenses: vLicenses }', 'info: vInfo, licenses: vLicenses, stats: vStats }');
R('<p class="small" style="padding:0 8px">${t(\'replay_note\')}</p></div>`;', '<div class="gbtns"><button class="btn outline" data-act="eval">${t(\'eval_btn\')}</button></div><p class="status" id="evalout"></p>\n    <p class="small" style="padding:0 8px">${t(\'replay_note\')}</p></div>`;');
R("act('moves', () => { ui.showMoves = !ui.showMoves; render(); });", `act('moves', () => { ui.showMoves = !ui.showMoves; render(); });
  act('hint', showHint);
  act('undo', takeBack);
  act('eval', evalReplay);`);
// Tipp verschwindet beim naechsten Zug
R("ui.sel = null; ui.pending = null;\n  const q = pos();", "ui.sel = null; ui.pending = null; ui.hint = null;\n  const q = pos();");
s += `
// ---------- Update 1.0.2 ----------
const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
function capturedHtml(c, p) { // Figuren, die Farbe c geschlagen hat, + Materialvorsprung
  const start = posFrom(G.startFen); const count = (pos2, col) => { const m = {}; for (const r of Object.keys(VALUE)) m[r] = 0; for (const sq of pos2.board[col]) m[pos2.board.get(sq).role]++; return m; };
  const opp = c === 'w' ? 'black' : 'white', me = c === 'w' ? 'white' : 'black';
  const s0 = count(start, opp), s1 = count(p, opp); let html = '', mat = 0;
  for (const r of ['queen', 'rook', 'bishop', 'knight', 'pawn']) { const k = Math.max(0, s0[r] - s1[r]); for (let i = 0; i < k; i++) html += \`<img src="\${pieceImg(opp, r)}" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-left:-3px">\`; }
  const val = (m) => Object.entries(m).reduce((a, [r, k]) => a + VALUE[r] * k, 0);
  mat = val(count(p, me)) - val(s1);
  return html + (mat > 0 ? \` <small>+\${mat}</small>\` : '');
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
  if (!arch.length) return \`<div class="page">\${backBtn()}<h1>\${t('stats_title')}</h1><p>\${t('stats_empty')}</p></div>\`;
  const cpu = arch.filter((g) => g.opp === 'cpu'), two = arch.filter((g) => g.opp === 'two');
  const wdl = (list) => { let w = 0, d = 0, l = 0; list.forEach((g) => { if (!g.result.winner) d++; else if (g.result.winner === g.human) w++; else l++; }); return t('stats_wdl', w, d, l); };
  let h = \`<div class="page">\${backBtn()}<h1>\${t('stats_title')}</h1><p>\${t('stats_games', arch.length)}</p><h3>\${t('stats_vs')}</h3><p>\${wdl(cpu)}</p>\`;
  for (let L = 1; L <= 5; L++) { const g = cpu.filter((x) => x.level === L); if (g.length) h += \`<p class="small">\${t('stats_level', L)}: \${wdl(g)}</p>\`; }
  const ww = two.filter((g) => g.result.winner === 'w').length, bw = two.filter((g) => g.result.winner === 'b').length, dd = two.length - ww - bw;
  h += \`<h3>\${t('stats_two')}</h3><p>\${t('result_white_wins')}: \${ww} · \${t('result_black_wins')}: \${bw} · \${t('result_draw')}: \${dd}</p></div>\`;
  return h;
}
`;
fs.writeFileSync(f, s); console.log('Ersetzungen:', n);
