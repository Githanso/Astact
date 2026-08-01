// Astact — serbest hamle + "oynayacak tasi kalmayan kaybeder" testi.
//
// Beklenen davranis:
//   1) Yon SERBEST: ileri, geri, saga, sola tek kare. Eskiden geri adim BACKWARD
//      koduyla reddediliyordu (kirmizi icin dc>0, mavi icin dc<0).
//   2) Oynayacak tasi kalmayan oyuncu KAYBEDER: son hareketli tasini yitirip
//      elinde yalnizca Mayın/Sancak kalan taraf icin oyun NO_MOVES ile biter.
//      Eskiden oyun bitmiyor, kimse oynayamadigi halde masa acik kaliyordu.
//
// Taslar dogrudan setup_complete ile yerlestiriliyor; sunucu dizilim bolgesini
// dogrulamadigi icin senaryo tek satirda kurulabiliyor. Tum kareler 7-10.
// sutunlarda: goller yalnizca tarafsiz bantta (4-6) uretiliyor, boylece rastgele
// arazi senaryoyu bozamiyor.
//
//   node serbest-hamle-testi.mjs
//   ASTACT_WS=wss://astact.hasanso.workers.dev/ws/game-room node serbest-hamle-testi.mjs

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function piece(id, name, rank, owner, row, col, opts = {}) {
  return { id, name, rank, owner, special: opts.special ?? null, movable: opts.movable ?? true, position: { row, col } };
}
const RED = [
  piece("r1", "Sancak", 0, "1. Oyuncu", 0, 10, { movable: false }),
  piece("r2", "Er", 2, "1. Oyuncu", 5, 7),
];
const BLUE = [
  piece("b1", "Sancak", 0, "2. Oyuncu", 0, 0, { movable: false }),
  piece("b2", "Mareşal", 10, "2. Oyuncu", 5, 9),
  piece("b3", "Er", 2, "2. Oyuncu", 9, 3),
];

function connect(room, name, token, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${name}&token=${token}`);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    const ek = [m.code && "code=" + m.code, m.nextPhase && "nextPhase=" + m.nextPhase,
                m.reason && "reason=" + m.reason, m.winner && "winner=" + m.winner].filter(Boolean).join(" ");
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

// Bir hamleyi yollar ve sonucunu dondurur.
const hamle = async (ws, from, to) => {
  ws.messages.length = 0;
  ws.send(JSON.stringify({ type: "move", from, to }));
  const ok = await waitFor(ws, "move_executed", 3000);
  const hata = ws.messages.find((m) => m.type === "move_error");
  return { ok, hata };
};

const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
const tok = Date.now();
console.log(`Hedef: ${BASE}`);
console.log(`Oda:   ${room}\n`);

console.log("=== 1) kurulum ===");
const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
await sleep(800);
p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED }));
await sleep(200);
p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
const bs = await waitFor(p1, "both_setup_complete", 4000);
check(!!bs, "oyun basladi", bs ? `faz=${bs.gamePhase}` : "");

console.log("\n=== 2) GERI adim serbest ===");
// Kirmizi 7-10. sutunlarda ve sola ilerliyor; dc>0 ESKIDEN geri adimdi.
const g1 = await hamle(p1, { row: 5, col: 7 }, { row: 5, col: 8 });
check(!!g1.ok, "1. Oyuncu geri adim atabildi (5,7 -> 5,8)", g1.ok ? "" : `<-- ${g1.hata?.code || "yanit yok"}`);
// Mavi 0-3'te ve saga ilerliyor; dc<0 ESKIDEN geri adimdi.
const g2 = await hamle(p2, { row: 9, col: 3 }, { row: 9, col: 2 });
check(!!g2.ok, "2. Oyuncu geri adim atabildi (9,3 -> 9,2)", g2.ok ? "" : `<-- ${g2.hata?.code || "yanit yok"}`);

console.log("\n=== 3) YAN hareket hala serbest ===");
const y1 = await hamle(p1, { row: 5, col: 8 }, { row: 4, col: 8 });
check(!!y1.ok, "1. Oyuncu yana gidebildi (5,8 -> 4,8)", y1.ok ? "" : `<-- ${y1.hata?.code || "yanit yok"}`);
await hamle(p2, { row: 9, col: 2 }, { row: 9, col: 3 });

console.log("\n=== 4) CAPRAZ hala yasak ===");
const c1 = await hamle(p1, { row: 4, col: 8 }, { row: 5, col: 9 });
check(!c1.ok && c1.hata?.code === "STRAIGHT_ONLY", "capraz hamle reddedildi", `(${c1.hata?.code || "KABUL EDILDI"})`);

console.log("\n=== 5) son hareketli tasini yitiren KAYBEDER ===");
// Kirmizinin Er'i (4,8) -> (4,9) -> (5,9)'daki Mareşal'e saldiriyor: Er oluyor ve
// kirmizinin elinde yalnizca Sancak kaliyor.
const a1 = await hamle(p1, { row: 4, col: 8 }, { row: 4, col: 9 });
check(!!a1.ok, "kirmizi Mareşal'in yanina ilerledi (4,8 -> 4,9)", a1.ok ? "" : `<-- ${a1.hata?.code || "yanit yok"}`);
await hamle(p2, { row: 9, col: 3 }, { row: 9, col: 2 });
p1.messages.length = 0; p2.messages.length = 0;
p1.send(JSON.stringify({ type: "move", from: { row: 4, col: 9 }, to: { row: 5, col: 9 } }));
const go1 = await waitFor(p1, "game_over", 4000);
const go2 = await waitFor(p2, "game_over", 3000);
check(!!go1, "oyun bitti (kirmizinin oynayacak tasi kalmadi)", go1 ? "" : "<-- OYUN BITMEDI");
check(go1?.reason === "NO_MOVES", "sebep NO_MOVES", go1 ? `(${go1.reason})` : "");
check(go1?.winner === "2. Oyuncu", "kazanan 2. Oyuncu", go1 ? `(${go1.winner})` : "");
check(!!go2 && go2.reason === go1?.reason, "iki tarafa da ayni sonuc gitti");

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
p1.close(); p2.close();
await sleep(300);
process.exit(fails === 0 ? 0 : 1);
