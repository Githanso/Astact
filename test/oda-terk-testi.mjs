// Astact — "Odadan Cik" testi.
//
// Beklenen davranis:
//   1) Oyun surerken ayrilan oyuncunun rakibi ANINDA game_over aliyor
//      (reason=OPPONENT_QUIT) — 60sn kopma penceresini beklemiyor.
//   2) Karsi tarafa "baglantisi koptu" bildirimi GITMIYOR. Kasitli ayrilma ile
//      kopma ayrisana kadar istemci yalnizca WS'i kapatiyordu, sunucu bunu kopma
//      saniyor ve rakip 60sn boyunca yanlis uyariya bakiyordu.
//   3) Dizilim asamasinda ayrilma = LOBİYE DÖNÜŞ: slot bosalir, oda LOBBY'ye
//      doner, kalan oyuncu yeni rakip bekler (hukmen galibiyet YOK).
//
//   node oda-terk-testi.mjs
//   ASTACT_WS=wss://astact.hasanso.workers.dev/ws/game-room node oda-terk-testi.mjs

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function piece(id, name, rank, owner, row, col, opts = {}) {
  return { id, name, rank, owner, special: opts.special ?? null, movable: opts.movable ?? true, position: { row, col } };
}
const RED = [
  piece("r1", "Bayrak", 0, "1. Oyuncu", 0, 10, { movable: false }),
  piece("r2", "Er", 2, "1. Oyuncu", 3, 7),
];
const BLUE = [
  piece("b1", "Bayrak", 0, "2. Oyuncu", 0, 0, { movable: false }),
  piece("b2", "Er", 2, "2. Oyuncu", 3, 3),
];

function connect(room, name, token, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${name}&token=${token}`);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    const ek = [m.reason && "reason=" + m.reason, m.winner && "winner=" + m.winner,
                m.roomState?.gamePhase && "roomFaz=" + m.roomState.gamePhase].filter(Boolean).join(" ");
    console.log(`  [${etiket}] <- ${m.type}${ek ? " " + ek : ""}`);
  });
  return new Promise((res, rej) => {
    ws.addEventListener("open", () => res(ws));
    ws.addEventListener("error", rej);
  });
}
const waitFor = async (ws, type, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const m = ws.messages.find((x) => x.type === type);
    if (m) return m;
    await sleep(50);
  }
  return null;
};

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

const tok = Date.now();
console.log(`Hedef: ${BASE}\n`);

// ─── 1) Oyun surerken ayrilma ──────────────────────────────────────────────
const oda1 = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
console.log(`=== 1) oyun surerken "Odadan Cik" (oda ${oda1}) ===`);
const p1 = await connect(oda1, "Oyuncu1", "t1-" + tok, "P1");
const p2 = await connect(oda1, "Oyuncu2", "t2-" + tok, "P2");
await sleep(800);
p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED }));
await sleep(200);
p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
const bs = await waitFor(p1, "both_setup_complete", 4000);
check(!!bs, "oyun basladi", bs ? `faz=${bs.gamePhase}` : "");

p1.messages.length = 0;
const t0 = Date.now();
p2.send(JSON.stringify({ type: "leave_room" }));
await sleep(100);
p2.close();
const go = await waitFor(p1, "game_over", 5000);
const gecen = Date.now() - t0;
check(!!go, "kalan oyuncu game_over aldi", go ? `${gecen}ms sonra` : "<-- HIC GELMEDI");
check(gecen < 3000, "ANINDA geldi (60sn kopma penceresi beklenmedi)", `(${gecen}ms)`);
check(go?.reason === "OPPONENT_QUIT", "sebep OPPONENT_QUIT", go ? `(${go.reason})` : "");
check(go?.winner === "1. Oyuncu", "kalan oyuncu hukmen kazandi", go ? `(${go.winner})` : "");
// "Baglantisi koptu" seridini istemci player_connection_change ile aciyor.
// Kasitli ayrilmada bu bildirim HIC gelmemeli: oyunu zaten game_over bitirdi.
await sleep(700);
const kopmaBildirimi = p1.messages.find((m) => m.type === "player_connection_change");
check(!kopmaBildirimi, "yanlis 'baglanti koptu' bildirimi GELMEDI", kopmaBildirimi ? "<-- geldi" : "");
p1.close();

// ─── 2) Dizilim asamasinda ayrilma ─────────────────────────────────────────
await sleep(300);
const oda2 = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
console.log(`\n=== 2) dizilim asamasinda "Odadan Cik" (oda ${oda2}) ===`);
const q1 = await connect(oda2, "Oyuncu1", "u1-" + tok, "Q1");
const q2 = await connect(oda2, "Oyuncu2", "u2-" + tok, "Q2");
await sleep(800);
const setupFazi = q1.messages.find((m) => m.roomState?.gamePhase === "SETUP");
check(!!setupFazi, "oda dizilim fazina gecti");

// Dizilimde ayrilma = LOBİYE DÖNÜŞ: slot bosalir, oda LOBBY'ye doner.
q1.messages.length = 0;
q2.send(JSON.stringify({ type: "leave_room" }));
await sleep(100);
q2.close();
const pcc = await waitFor(q1, "player_connection_change", 4000);
check(!!pcc, "kalan oyuncu durum guncellemesi aldi");
check(pcc?.roomState?.gamePhase === "LOBBY", "oda LOBBY'ye dondu (lobiye donus)", `(${pcc?.roomState?.gamePhase})`);
check(pcc?.roomState?.bluePresent === false, "ayrilan oyuncunun slotu bosaldi", `(bluePresent=${pcc?.roomState?.bluePresent})`);
check(pcc?.roomState?.setupRemainingMs === null, "dizilim saati durdu (tek basina rastgele dizilme yok)", `(${pcc?.roomState?.setupRemainingMs})`);
await sleep(500);
const hukmen = q1.messages.find((m) => m.type === "game_over");
check(!hukmen, "HUKMEN GALIBIYET YOK (kalan oyuncuya game_over gelmedi)", hukmen ? "<-- geldi" : "");

// Yeni rakip AYNI KODLA katilabilir: oda tekrar SETUP'a doner, dizilim yeniden baslar.
const q3 = await connect(oda2, "Oyuncu3", "u3-" + tok, "Q3");
await sleep(600);
const setupFaz2 = q1.messages.find((m) => m.roomState?.gamePhase === "SETUP");
check(!!setupFaz2, "yeni rakip ayni kodla katildi, oda yeniden SETUP", setupFaz2 ? `(faz=${setupFaz2.roomState?.gamePhase})` : "");
q3.close();

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
await sleep(300);
process.exit(fails === 0 ? 0 : 1);
