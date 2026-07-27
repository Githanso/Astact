// Astact — SUNUCU tur saati testi (duzeltme sonrasi).
//
// Beklenen davranis: tur suresi dolunca SUNUCU sirayi cevirir ve iki tarafa
// `turn_timeout` yayinlar. Istemci sirayi kendi cevirmez.
//
// Duzeltme oncesi bu test KALIR: sunucu hicbir sey yayinlamaz, faz PLAY_RED'de
// kalir, sirasi geldigini sanan oyuncunun hamlesi NOT_YOUR_TURN ile reddedilir.
//
//   node tur-saati-testi.mjs
//   ASTACT_WS=wss://astact.hasanso.workers.dev/ws/game-room node tur-saati-testi.mjs

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const TUR_SN = 8; // sunucunun MIN_TURN_TIME_MS sinirinin (5sn) uzerinde, test hizli kalsin
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
    const ek = [m.code && "code=" + m.code, m.nextPhase && "nextPhase=" + m.nextPhase,
                m.remainingMs !== undefined && m.remainingMs !== null && "remainingMs=" + m.remainingMs].filter(Boolean).join(" ");
    console.log(`  [${etiket}] <- ${m.type}${ek ? " " + ek : ""}`);
  });
  return new Promise((res, rej) => {
    ws.addEventListener("open", () => res(ws));
    ws.addEventListener("error", rej);
  });
}
const waitFor = async (ws, type, ms = 5000) => {
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

const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
const tok = Date.now();
console.log(`Hedef: ${BASE}`);
console.log(`Oda:   ${room}   tur suresi: ${TUR_SN}sn\n`);

console.log("=== 1) kurulum (oda kurucusu turnTime bildiriyor) ===");
const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
await sleep(800);
p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED, turnTime: TUR_SN }));
await sleep(300);
p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE, turnTime: 999 })); // yok sayilmali
await sleep(1200);
const bs = await waitFor(p1, "both_setup_complete");
check(!!bs, "oyun basladi", bs ? `faz=${bs.gamePhase}` : "");
check(bs?.turnTimeMs === TUR_SN * 1000, "sunucu oda kurucusunun tur suresini aldi", `(${bs?.turnTimeMs}ms)`);

console.log(`\n=== 2) kimse oynamiyor — sunucu ${TUR_SN}sn sonra sirayi cevirmeli ===`);
p1.messages.length = 0; p2.messages.length = 0;
const t0 = Date.now();
const to1 = await waitFor(p1, "turn_timeout", (TUR_SN + 6) * 1000);
const to2 = await waitFor(p2, "turn_timeout", 3000);
const gecen = ((Date.now() - t0) / 1000).toFixed(1);
check(!!to1, "P1 turn_timeout aldi", to1 ? `${gecen}sn sonra, nextPhase=${to1.nextPhase}` : "<-- HIC GELMEDI");
check(!!to2, "P2 turn_timeout aldi", to2 ? `nextPhase=${to2.nextPhase}` : "<-- HIC GELMEDI");
check(to1?.nextPhase === "PLAY_BLUE", "sira 2. Oyuncu'ya gecti", to1 ? `(${to1.nextPhase})` : "");

console.log("\n=== 3) sunucu gercekten sirayi cevirdi mi? P2 hamle deniyor ===");
p2.messages.length = 0; p1.messages.length = 0;
p2.send(JSON.stringify({ type: "move", from: { row: 3, col: 3 }, to: { row: 4, col: 3 } }));
await sleep(1500);
const kabul = await waitFor(p2, "move_executed", 3000);
const hata = p2.messages.find((m) => m.type === "move_error");
check(!!kabul, "sunucu P2'nin hamlesini KABUL etti", kabul ? `nextPhase=${kabul.nextPhase}` : `<-- ${hata?.code || "yanit yok"}`);
check(!!(await waitFor(p1, "move_executed", 2000)), "P1 rakip hamlesini aldi");

console.log("\n=== 4) hamle tur saatini sifirliyor mu? ===");
p1.messages.length = 0; p2.messages.length = 0;
const t1 = Date.now();
const to3 = await waitFor(p1, "turn_timeout", (TUR_SN + 6) * 1000);
const gecen2 = ((Date.now() - t1) / 1000).toFixed(1);
check(!!to3, "hamleden sonra yeni tur saati basladi", to3 ? `${gecen2}sn sonra doldu (beklenen ~${TUR_SN}sn)` : "<-- GELMEDI");
check(!!to3 && Number(gecen2) >= TUR_SN - 2, "sure tam tur kadar surdu (erken dolmadi)", `(${gecen2}sn)`);

console.log("\n=== 5) yeniden baglanan oyuncu KALAN sureyi aliyor mu? ===");
await sleep(2000); // turun ~2sn'si gecsin
const p3 = await connect(room, "Oyuncu2", "t2-" + tok, "P2-yeniden");
await sleep(1500);
const rest = await waitFor(p3, "game_state_restored", 3000);
const kalan = rest?.remainingMs;
check(typeof kalan === "number", "game_state_restored remainingMs iceriyor", `(${kalan}ms)`);
check(typeof kalan === "number" && kalan > 0 && kalan < TUR_SN * 1000,
      "kalan sure tam turdan AZ (tur ortasindan devam)", `(${kalan}ms < ${TUR_SN * 1000}ms)`);

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
p1.close(); p2.close(); p3.close();
await sleep(300);
process.exit(fails === 0 ? 0 : 1);
