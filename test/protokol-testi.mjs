// Astact online protokol testi — tahta 10 satir x 11 sutun, oyuncular SAG-SOL.
//   Mavi (2. Oyuncu): 0-3. sutunlar, saga ilerler (dc > 0)
//   Kirmizi (1. Oyuncu): 7-10. sutunlar, sola ilerler (dc < 0)
//   Arazi ARTIK SABIT DEGIL: her oyunda sunucuda uretiliyor. Bu yuzden test
//   hicbir orman/gol koordinatini varsaymiyor; araziyi sunucudan OKUYUP uygun
//   kareleri seciyor. Boylece uretici ayarlaninca test kendiliginden uyum saglar.

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

// Taslar arazi okunduktan SONRA diziliyor (asagida): mavinin ilerleyecegi
// (SATIR, 4) karesi gol olmamali, gol yeri artik her oyunda degisiyor.

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

// Arazi room_joined ile geliyor, yani dizilimden ONCE okunabiliyor. Test hicbir
// gol/orman koordinati VARSAYMIYOR: mavinin ilerleyecegi (SATIR,4) karesinin gol
// olmadigi bir satiri arazinin kendisinden seciyor. Boylece uretici degisince
// test kendiliginden uyum saglar.
// r!==2 kosulu: mavi bombasi SABIT (2,3) karesinde; ileri hamle (SATIR,3)'e gidiyor,
// SATIR=2 secilirse hedef bomba olur ve hamle reddedilir (kendi tasina saldiri).
const arazi = joined?.roomState?.terrain;
const golMu = (r, c) => !!arazi?.lakes.some((l) => l.row === r && l.col === c);
let SATIR = 0;
for (let r = 0; r < 10; r++) if (!golMu(r, 4) && r !== 2) { SATIR = r; break; }
check(!!arazi, "arazi room_joined ile geldi");
check(!golMu(SATIR, 4), `hamleler icin gol olmayan satir secildi (satir ${SATIR})`);

const RED = [
  piece("r1", "Bayrak", 0, "1. Oyuncu", 0, 10, { movable: false }),
  piece("r2", "Mareşal", 10, "1. Oyuncu", SATIR, 7),
  piece("r3", "Er", 2, "1. Oyuncu", 3, 7),
];
const BLUE = [
  piece("b1", "Bayrak", 0, "2. Oyuncu", 0, 0, { movable: false }),
  piece("b2", "Er", 2, "2. Oyuncu", SATIR, 3),
  piece("b3", "Bomba", 11, "2. Oyuncu", 2, 3, { movable: false }),
];

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
}

// ─── 3b) ARAZI URETICI SOZLESMESI ──────────────────────────────────────────
// Arazi artik SABIT DEGIL, her oyunda sunucuda uretiliyor. Bu yuzden eski
// "istemci sabitleri sunucununkiyle ayni mi" kontrolu anlamsizlasti: karsilastiracak
// sabit kalmadi. Yerine ureticinin SOZLESMESI dogrulaniyor — sayilar, bolgeler,
// simetri. Sozlesme bozulursa iki oyuncu farkli zorlukta tahtada oynar ya da
// tahta gecilemez hale gelir.
console.log("\n=== 3b) ARAZI URETICI SOZLESMESI ===");
{
  const arazi = bs1?.terrain;
  check(!!arazi && Array.isArray(arazi.lakes) && Array.isArray(arazi.forests),
        "sunucu araziyi both_setup_complete ile yolluyor");

  if (arazi) {
    const golKare = arazi.lakes.map((l) => `${l.row},${l.col}`);
    const ormanKare = arazi.forests.map((f) => `${f.row},${f.col}`);
    const sutun = (kare) => +kare.split(",")[1];

    check(golKare.length === 6, "gol toplami 6 kare", `(${golKare.length})`);
    check(golKare.every((k) => sutun(k) >= 4 && sutun(k) <= 6),
          "gollerin HEPSI tarafsiz bantta (4-6. sutun)",
          golKare.filter((k) => sutun(k) < 4 || sutun(k) > 6).join(" ") || "");

    const mavi = ormanKare.filter((k) => sutun(k) <= 3).length;
    const bant = ormanKare.filter((k) => sutun(k) >= 4 && sutun(k) <= 6).length;
    const kirmizi = ormanKare.filter((k) => sutun(k) >= 7).length;
    check(ormanKare.length === 30, "toplam 30 orman", `(${ormanKare.length})`);
    check(mavi === 10 && bant === 10 && kirmizi === 10,
          "10 mavi bolgesi / 10 bant / 10 kirmizi bolgesi", `(${mavi}/${bant}/${kirmizi})`);

    // 180 derece donme simetrisi: her arazi karesinin (9-r, 10-c) esi ayni turde.
    // Iki oyuncunun esit zorlukta oynamasinin tek garantisi bu.
    const es = (k) => { const [r, c] = k.split(",").map(Number); return `${9 - r},${10 - c}`; };
    const golEksik = golKare.filter((k) => !golKare.includes(es(k)));
    const ormanEksik = ormanKare.filter((k) => !ormanKare.includes(es(k)));
    check(golEksik.length === 0, "goller 180 derece simetrik", golEksik.join(" ") || "");
    check(ormanEksik.length === 0, "ormanlar 180 derece simetrik", ormanEksik.join(" ") || "");

    const cakisma = golKare.filter((k) => ormanKare.includes(k));
    check(cakisma.length === 0, "gol ve orman cakismiyor", cakisma.join(" ") || "");

    // Sunucunun bildirdigi tahta ile arazi listesi ayni seyi soylemeli. Tas duran
    // kareler haric: orada sunucu araziyi degil tasi yaziyor.
    const grid = bs1.myPieces;
    const tahtaGol = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 11; c++) if (grid[r][c] === "LAKE") tahtaGol.push(`${r},${c}`);
    check(tahtaGol.length === golKare.length && tahtaGol.every((k) => golKare.includes(k)),
          "tahtadaki goller arazi listesiyle ayni", `(tahta=${tahtaGol.length} liste=${golKare.length})`);
  }
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
p2.send(JSON.stringify({ type: "move", from: { row: SATIR, col: 3 }, to: { row: SATIR, col: 4 } }));
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

// Geri hareket: mavi icin sola gitmek geridir. ARTIK SERBEST — yon sinirlamasi
// kaldirildi, yalnizca "tek kare + duz" kurali duruyor (bkz. serbest-hamle-testi).
p2.messages.length = 0;
p2.send(JSON.stringify({ type: "move", from: { row: SATIR, col: 3 }, to: { row: SATIR, col: 2 } }));
await sleep(700);
check(!!(await waitFor(p2, "move_executed", 2000)), "GERI hareket KABUL EDILDI (yon sinirlamasi yok)");

// Sira kirmiziya gecti; ileri hareketi denemek icin bir tur da o oynamali.
p1.messages.length = 0;
p1.send(JSON.stringify({ type: "move", from: { row: 4, col: 7 }, to: { row: 5, col: 7 } }));
await waitFor(p1, "move_executed", 2000);

// Ileri hareket: mavi icin saga gitmek ileridir. Tas bir onceki hamlede 2. sutuna
// gectigi icin oradan yolluyoruz.
p2.messages.length = 0;
p2.send(JSON.stringify({ type: "move", from: { row: SATIR, col: 2 }, to: { row: SATIR, col: 3 } }));
await sleep(700);
check(!!(await waitFor(p2, "move_executed", 2000)), "ILERI hareket (sutun ekseni) kabul edildi");

console.log(`\n=== SONUC: ${fails === 0 ? "TUM TESTLER GECTI" : fails + " TEST KALDI"} ===`);
p1.close(); p2.close();
await sleep(200);
process.exit(fails === 0 ? 0 : 1);
