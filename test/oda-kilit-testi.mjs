// Astact — Oda kodu tek seferlik / 3. kisi testi.
//
// Beklenen davranis:
//   1) Iki oyuncu doldiktan sonra (SETUP'tan itibaren) ayni koda baglanan 3. kisi
//      ROOM_FULL alir ve odaya giremez.
//   2) Bu engel oyunun her fazinda (dizilim, oyun, oyun sonu) gecerli.
//   3) Oyun bitip oyuncular ciktiktan sonra kod bir daha KULLANILAMAZ: yeni
//      baglanti ROOM_CLOSED alir (tek seferlik).
//
//   node oda-kilit-testi.mjs
//   ASTACT_WS=wss://astact.hasanso.workers.dev/ws/game-room node oda-kilit-testi.mjs

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function piece(id, name, rank, owner, row, col, opts = {}) {
  return { id, name, rank, owner, special: opts.special ?? null, movable: opts.movable ?? true, position: { row, col } };
}
const RED = [
  piece("r1", "Sancak", 0, "1. Oyuncu", 0, 10, { movable: false }),
  piece("r2", "Er", 2, "1. Oyuncu", 3, 7),
];
const BLUE = [
  piece("b1", "Sancak", 0, "2. Oyuncu", 0, 0, { movable: false }),
  piece("b2", "Er", 2, "2. Oyuncu", 3, 3),
];

function connect(room, name, token, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${name}&token=${token}`);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    const ek = [m.code && "code=" + m.code, m.reason && "reason=" + m.reason,
                m.roomState?.gamePhase && "faz=" + m.roomState.gamePhase].filter(Boolean).join(" ");
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
// 3. kisi baglantisi: acilir, gelen ilk room_error'u yakalar.
async function ucusDene(room, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=Ucus&token=uc-${Date.now()}`);
  let mesaj = null;
  ws.addEventListener("message", (e) => { if (!mesaj) mesaj = JSON.parse(e.data); });
  await new Promise((res) => ws.addEventListener("open", res));
  await sleep(500);
  ws.close();
  console.log(`  [${etiket}] <- ${mesaj ? mesaj.type + " code=" + mesaj.code : "<-- mesaj yok"}`);
  return mesaj;
}

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

const tok = Date.now();
console.log(`Hedef: ${BASE}\n`);

// ─── 1) SETUP'ta 3. kisi engeli ────────────────────────────────────────────
const oda1 = "KLT-" + Math.random().toString(36).slice(2, 6).toUpperCase();
console.log(`=== 1) iki oyuncu dolduktan sonra 3. kisi giremez (oda ${oda1}) ===`);
const p1 = await connect(oda1, "Oyuncu1", "t1-" + tok, "P1");
await sleep(400);
// LOBİ'de henuz ikinci oyuncu yok: gelen ikinci kisi 2. oyuncu olur (normal).
const p2 = await connect(oda1, "Oyuncu2", "t2-" + tok, "P2");
await sleep(600);
const setupFaz = p1.messages.find((m) => m.roomState?.gamePhase === "SETUP");
check(!!setupFaz, "iki oyuncu katildi, oda dizilim fazinda");

const u1 = await ucusDene(oda1, "ucus-SETUP");
check(u1?.type === "room_error" && u1?.code === "ROOM_FULL", "dizilimde 3. kisi ROOM_FULL aldi", u1 ? `(${u1.code})` : "");

// ─── 2) Oyun sirasinda 3. kisi engeli ──────────────────────────────────────
p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED }));
await sleep(200);
p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
const bs = await waitFor(p1, "both_setup_complete", 4000);
check(!!bs, "oyun basladi", bs ? `faz=${bs.gamePhase}` : "");

const u2 = await ucusDene(oda1, "ucus-PLAY");
check(u2?.type === "room_error" && u2?.code === "ROOM_FULL", "oyun sirasinda 3. kisi ROOM_FULL aldi", u2 ? `(${u2.code})` : "");

// ─── 3) Oyun sonunda da 3. kisi giremez ────────────────────────────────────
p2.messages.length = 0;
p1.send(JSON.stringify({ type: "leave_room" }));
await sleep(100);
p1.close();
const go = await waitFor(p2, "game_over", 4000);
check(!!go && go.reason === "OPPONENT_QUIT", "kalan oyuncu hukmen kazandi", go ? `(${go.reason})` : "");

const u3 = await ucusDene(oda1, "ucus-GAME_OVER");
check(u3?.type === "room_error" && u3?.code === "ROOM_FULL", "oyun sonunda 3. kisi ROOM_FULL aldi", u3 ? `(${u3.code})` : "");

// ─── 4) Kod tek seferlik: oyun bitince bir daha kullanilamaz ───────────────
p2.send(JSON.stringify({ type: "leave_room" }));
await sleep(150);
p2.close();
await sleep(300);
const u4 = await ucusDene(oda1, "ucus-KOD-ATIK");
check(u4?.type === "room_error" && u4?.code === "ROOM_CLOSED", "kullanilmis kod ROOM_CLOSED aldi (tek seferlik)", u4 ? `(${u4.code})` : "");

// ─── 5) Yepyeni bir kod hala kurulabilir ───────────────────────────────────
const oda2 = "KLT-" + Math.random().toString(36).slice(2, 6).toUpperCase();
console.log(`\n=== 5) yepyeni kodla oda kurulabiliyor (oda ${oda2}) ===`);
const n1 = await connect(oda2, "Oyuncu1", "n1-" + tok, "N1");
await sleep(400);
const created = n1.messages.find((m) => m.type === "room_created");
check(!!created, "yeni kod yeni oda kurdu", created ? `(faz=${created.roomState?.gamePhase})` : "");
n1.close();

// ─── 6) Oyun sonunda "Lobiye Don": odadan cikan HERKESI lobiye yollar ──────
const oda3 = "KLT-" + Math.random().toString(36).slice(2, 6).toUpperCase();
console.log(`\n=== 6) oyun sonunda cikis rakip tarafa room_closed iletiliyor (oda ${oda3}) ===`);
const r1 = await connect(oda3, "Oyuncu1", "v1-" + tok, "R1");
const r2 = await connect(oda3, "Oyuncu2", "v2-" + tok, "R2");
await sleep(500);
r1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED }));
await sleep(200);
r2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
await waitFor(r1, "both_setup_complete", 4000);
r1.send(JSON.stringify({ type: "leave_room" }));
await sleep(100);
r1.close();
const go2 = await waitFor(r2, "game_over", 4000);
check(!!go2 && go2.reason === "OPPONENT_QUIT", "oyun sirasinda cikis hukmen yenilgi sayildi", go2 ? `(${go2.reason})` : "");
// Ayrilan oyuncu ayni token ile geri dondu (slot ve token korunuyor).
const r1d = await connect(oda3, "Oyuncu1", "v1-" + tok, "R1-donen");
const restored = await waitFor(r1d, "game_state_restored", 4000);
check(!!restored, "ayrilan oyuncu ayni token ile geri donebildi", restored ? `(faz=${restored.gamePhase})` : "");
// Kalan oyuncu "Lobiye Don" (leave_room) dedi: diger tarafa room_closed gider.
r2.send(JSON.stringify({ type: "leave_room" }));
await sleep(150);
r2.close();
const rc = await waitFor(r1d, "room_closed", 4000);
check(!!rc, "kalan oyuncunun cikisi diger tarafa room_closed olarak ulasti", rc ? "" : "<-- HIC GELMEDI");
await sleep(200);
const u5 = await ucusDene(oda3, "ucus-SON");
check(u5?.type === "room_error" && u5?.code === "ROOM_CLOSED", "oda kapandi, kod artik kullanilamiyor", u5 ? `(${u5.code})` : "");
r1d.close();

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
await sleep(300);
process.exit(fails === 0 ? 0 : 1);
