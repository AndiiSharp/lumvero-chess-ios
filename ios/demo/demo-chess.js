// Lumvero-Chess-Rundgang: Partie gegen den Computer (Stufe 2), Tipp, Zuruecknehmen, Zugliste, Statistik, Regeln, Einstellungen.
(function () {
  const D = window.DEMO;
  const PLAN = ['e2e4', 'g1f3', 'f1c4', 'd2d3', 'b1c3', 'e1g1', 'c1g5', 'h2h3', 'a2a3', 'f1e1'];
  const sqIdx = (s) => 'abcdefgh'.indexOf(s[0]) + 8 * (+s[1] - 1);
  const ready = async (ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (G && running() && !ui.thinking && isHumanTurn(pos())) return true; await D.wait(300); } return false; };
  const pick = () => {
    const p = pos();
    for (const u of PLAN) { const m = CO.parseUci(u); if (m && p.isLegal(m)) return [m.from, m.to]; }
    const all = []; for (const [f, ds] of p.allDests()) for (const to of ds) all.push([f, to]);
    return all.length ? all[Math.floor(Math.random() * all.length)] : null;
  };
  const myMove = async () => {
    if (!(await ready())) return;
    const mv = pick(); if (!mv) return;
    const u = 'abcdefgh'[mv[0] % 8] + (Math.floor(mv[0] / 8) + 1) + 'abcdefgh'[mv[1] % 8] + (Math.floor(mv[1] / 8) + 1);
    const i = PLAN.indexOf(u); if (i >= 0) PLAN.splice(i, 1);
    await D.tap(`[data-sq="${mv[0]}"]`, { after: 600 });
    await D.tap(`[data-sq="${mv[1]}"]`, { after: 1500 });
    if (ui.pending) await D.tap('[data-act=confirm]', { after: 1200 });
  };
  D.run([
    () => D.wait(1500),
    () => D.tap('[data-act=play]', { after: 1500 }),
    () => D.scroll(400), () => D.scroll(-400),
    () => D.tap('[data-act=start]', { after: 2000 }),
    myMove, myMove, myMove,
    async () => { await ready(); await D.tap('[data-act=hint]', { after: 4500 }); },
    myMove,
    async () => { await ready(); await D.tap('[data-act=undo]', { after: 2000 }); },
    myMove, myMove,
    async () => { await ready(); await D.tap('[data-act=moves]', { after: 2500 }); },
    async () => { await ready(); await D.tap('[data-act=more]', { after: 2500 }); },
    async () => { const ov = document.querySelector('#ov button, .ov button, dialog button'); const c = [...document.querySelectorAll('button')].find((b) => /cancel|abbrechen|close|schlie/i.test(b.innerText)); if (c) await D.tap(c, { after: 1200 }); else if (ov) await D.tap(ov, { after: 1200 }); },
    async () => { const b = document.querySelector('[data-go=home]'); if (b) await D.tap(b, { after: 1500 }); else { go('home'); await D.wait(1500); } },
    () => D.tap('[data-go=stats]', { after: 2000 }),
    () => D.tap('[data-go=home]', { after: 1200 }),
    () => D.tap('[data-go=rules]', { after: 1500 }),
    () => D.scroll(600), () => D.scroll(-600),
    () => D.tap('[data-go=home]', { after: 1200 }),
    () => D.tap('[data-go=settings]', { after: 1500 }),
    () => D.scroll(500), () => D.scroll(-500),
    () => D.tap('[data-go=home]', { after: 2000 }),
  ]);
})();
