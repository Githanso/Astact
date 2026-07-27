// Astact online protokol testi — tahta 10 satir x 11 sutun, oyuncular SAG-SOL.
//   Mavi (2. Oyuncu): 0-3. sutunlar, saga ilerler (dc > 0)
//   Kirmizi (1. Oyuncu): 7-10. sutunlar, sola ilerler (dc < 0)
//   Goller: 1,2,7,8. satirlar x 4,5,6. sutunlar
const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";

const log = (who, ...a) => console.log(`[${who}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function piece(id, name, rank, owner, row, col, opts = {}) {
  return {
    id, name, rank, owner,
    special: opts.special ?? null,
    movable: opts.movable ?? true,
    position: { row, col },
  };
}

const RED = [
  piece("r1", "Bayrak", 0, "1. Oyuncu", 0, 10, { movable: false }),
  piece("r2", "Mareşal", 10, "1. Oyuncu", 5, 7),
  piece("r3", "Er", 2, "1. Oyuncu", 3, 7),
];
const BLUE = [
  piece("b1", "Bayrak", 0, "2. Oyuncu", 0, 0, { movable: false }),
  piece("b2", "Er", 2, "2. Oyuncu", 5, 3),
  piece("b3", "Bomba", 11, "2. Oyuncu", 2, 3, { movable: false }),
];

function connect(room, name, token) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${name}&token=${token}`);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    log(name, "<-", m.type);
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

const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

console.log("=== 1) iki oyuncu baglaniyor ===");
const tok = Date.now();
const p1 = await connect(room, "Oyuncu1", "t1-" + tok);
const p2 = await connect(room, "Oyuncu2", "t2-" + tok);
await sleep(600);

check(!!(await waitFor(p1, "room_created")), "Oyuncu1 odayi kurdu");
const joined = await waitFor(p2, "room_joined");
check(!!joined, "Oyuncu2 odaya katildi", joined ? `(takim: ${joined.playerTeam})` : "");

console.log("\n=== 2) kurulum gonderiliyor ===");
p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED }));
await sleep(300);
p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
await sleep(800);

const bs1 = await waitFor(p1, "both_setup_complete");
const bs2 = await waitFor(p2, "both_setup_complete");
check(!!bs1 && !!bs2, "iki tarafa da both_setup_complete ulasti");

console.log("\n=== 3) TAHTA BOYUTU 10 satir x 11 sutun ===");
if (bs1) {
  const grid = bs1.myPieces;
  check(Array.isArray(grid) && grid.length === 10, "tahta 10 satir", `(${grid?.length})`);
  check(Array.isArray(grid?.[0]) && grid[0].length === 11, "tahta 11 sutun", `(${grid?.[0]?.length})`);
  check(grid?.[1]?.[5] === "LAKE", "gol dogru yerde (1,5)", `(${JSON.stringify(grid?.[1]?.[5])})`);
}

console.log("\n=== 4) RUTBE GIZLEME ===");
if (bs1) {
  const opp = (bs1.opponentPieces || []).flat().filter((c) => c && typeof c === "object" && c.owner);
  const leaked = opp.filter((c) => c.rank !== undefined || c.name !== undefined);
  check(opp.length > 0, "Oyuncu1 rakip taslarini goruyor (konum)", `(${opp.length} tas)`);
  check(leaked.length === 0, "rakip taslarinda rutbe/isim YOK", leaked.length ? `SIZINTI: ${JSON.stringify(leaked[0])}` : "");
  const mine = (bs1.myPieces || []).flat().filter((c) => c && typeof c === "object" && c.owner);
  check(mine.some((c) => c.rank !== undefined), "kendi taslarinda rutbe VAR");
}

console.log("\n=== 5) hamle kurallari (ileri = sutun ekseni) ===");
// Sirasi olmayan oyuncu (PLAY_RED iken mavi oynuyor)
p2.send(JSON.stringify({ type: "move", from: { row: 5, col: 3 }, to: { row: 5, col: 4 } }));
await sleep(500);
check(!!(await waitFor(p2, "move_error", 1500)), "sira disi hamle REDDEDILDI");

// Hareket edemeyen tas (Bayrak)
p1.send(JSON.stringify({ type: "move", from: { row: 0, col: 10 }, to: { row: 0, col: 9 } }));
await sleep(500);
const errs = p1.messages.filter((m) => m.type === "move_error");
check(errs.length > 0, "Bayrak hareketi REDDEDILDI", errs.length ? `("${errs[errs.length - 1].message}")` : "");

// Yanal hareket: artik SATIR ekseninde (ilerleme eksenine dik)
p1.messages.length = 0;
p1.send(JSON.stringify({ type: "move", from: { row: 3, col: 7 }, to: { row: 4, col: 7 } }));
await sleep(700);
const yanal = await waitFor(p1, "move_executed", 2000);
check(!!yanal, "YANAL hareket (satir ekseni) kabul edildi", yanal ? "" : `(gelen: ${JSON.stringify(p1.messages.map((m) => m.type))})`);

// Geri hareket: mavi icin sola gitmek geridir
p2.messages.length = 0;
p2.send(JSON.stringify({ type: "move", from: { row: 5, col: 3 }, to: { row: 5, col: 2 } }));
await sleep(500);
check(!!(await waitFor(p2, "move_error", 1500)), "GERI hareket reddedildi");

// Ileri hareket: mavi icin saga gitmek ileridir
p2.messages.length = 0;
p2.send(JSON.stringify({ type: "move", from: { row: 5, col: 3 }, to: { row: 5, col: 4 } }));
await sleep(700);
check(!!(await waitFor(p2, "move_executed", 2000)), "ILERI hareket (sutun ekseni) kabul edildi");

console.log(`\n=== SONUC: ${fails === 0 ? "TUM TESTLER GECTI" : fails + " TEST KALDI"} ===`);
p1.close(); p2.close();
await sleep(200);
process.exit(fails === 0 ? 0 : 1);
