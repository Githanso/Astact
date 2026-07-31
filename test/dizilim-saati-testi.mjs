// Astact — dizilim saati testi.
//
// Beklenen davranis:
//   1) Dizilim suresi dolunca SUNUCU hazir olmayan oyuncunun taslarini RASTGELE
//      dizip hazir sayar ve oyunu baslatir (both_setup_complete). Oyun artik
//      "rakip taslarini dizmedi" diye sonsuza kadar kilitlenmiyor.
//   2) Sure dolduktan SONRA gelen setup_complete oyunu BASA SARMAZ. Faz korumasi
//      olmadan bu mesaj taslari eksik listeyle eziyor, tur saatini sifirliyor ve
//      iki oyuncunun tahtasini yeniden kuruyordu.
//
// Dizilim suresi normalde herkes icin 180sn (SETUP_SURESI_MS). Test 3 dakika
// bekleyemez: odayi KURAN baglanti ?setupMs= ile sureyi kisaltiyor (bkz. ?seed=).
//
//   node dizilim-saati-testi.mjs
//   ASTACT_WS=wss://astact.hasanso.workers.dev/ws/game-room node dizilim-saati-testi.mjs

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const DIZILIM_MS = 8000; // sunucunun MIN_SETUP_TIME_MS sinirinin (5sn) uzerinde
const TOPLAM_TAS = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function piece(id, name, rank, owner, row, col, opts = {}) {
  return { id, name, rank, owner, special: opts.special ?? null, movable: opts.movable ?? true, position: { row, col } };
}
// P1 hazir diyecek; P2 hic dizmeyecek ve sureyi doldurmasi beklenecek.
const RED = [
  piece("r1", "Bayrak", 0, "1. Oyuncu", 0, 10, { movable: false }),
  piece("r2", "Er", 2, "1. Oyuncu", 3, 7),
];
const BLUE_GEC = [
  piece("b1", "Bayrak", 0, "2. Oyuncu", 0, 0, { movable: false }),
  piece("b2", "Er", 2, "2. Oyuncu", 3, 3),
];

function connect(url, etiket) {
  const ws = new WebSocket(url);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    const ek = [m.gamePhase && "gamePhase=" + m.gamePhase,
                m.roomState?.gamePhase && "roomFaz=" + m.roomState.gamePhase].filter(Boolean).join(" ");
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
// Tahta gorunumundeki tas sayisi. Bos kareler null, arazi kareleri "LAKE"/"FOREST".
const tasSay = (board) => (board || []).flat().filter((c) => c && typeof c === "object").length;

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
const tok = Date.now();
console.log(`Hedef: ${BASE}`);
console.log(`Oda:   ${room}   dizilim suresi: ${DIZILIM_MS}ms\n`);

console.log("=== 1) kurulum: P1 hazir, P2 kismi dizilim gonderiyor (Hazir demiyor) ===");
// ?setupMs YALNIZCA odayi kuran ilk baglantida okunuyor.
const p1 = await connect(`${BASE}?room=${room}&name=Oyuncu1&token=t1-${tok}&setupMs=${DIZILIM_MS}`, "P1");
const p2 = await connect(`${BASE}?room=${room}&name=Oyuncu2&token=t2-${tok}`, "P2");
await sleep(800);
const oda = p2.messages.find((m) => m.roomState)?.roomState;
check(typeof oda?.setupRemainingMs === "number", "roomState KALAN dizilim suresini tasiyor", `(${oda?.setupRemainingMs}ms)`);
check(oda?.setupRemainingMs <= DIZILIM_MS, "kalan sure toplam sureyi asmiyor", `(${oda?.setupRemainingMs} <= ${DIZILIM_MS})`);
p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED }));
await sleep(300);

console.log(`\n=== 2) sure dolunca sunucu P2'nin KISMI dizilimini koruyup kalanlari rastgele dizmeli ===`);
// P2 "Hazir" demiyor; yalnizca kismi tahtasini setup_update ile bildiriyor.
// Sunucu sure dolunca bunu KORUMALI (rastgele dizilen oyuncunun kendi koydugu
// taslari bozulmamali) ve kalan taslari bos karelere yerlestermeli.
p2.send(JSON.stringify({ type: "setup_update", placedPieces: BLUE_GEC }));
await sleep(200);
const t0 = Date.now();
const bs2 = await waitFor(p2, "both_setup_complete", DIZILIM_MS + 8000);
const bs1 = await waitFor(p1, "both_setup_complete", 3000);
const gecen = ((Date.now() - t0) / 1000).toFixed(1);
check(!!bs2, "P2 both_setup_complete aldi", bs2 ? `${gecen}sn sonra` : "<-- HIC GELMEDI (oyun kilitli kaldi)");
check(!!bs1, "P1 both_setup_complete aldi");
check(bs2?.gamePhase === "PLAY_RED", "faz PLAY_RED", bs2 ? `(${bs2.gamePhase})` : "");
check(tasSay(bs2?.myPieces) === TOPLAM_TAS, "P2'nin tahtasinda 40 tas var (kismi + rastgele)", `(${tasSay(bs2?.myPieces)})`);
// P2'nin kendisi dizmis oldugu iki tas KORUNMALI: Bayrak 0,0 ve Er 3,3 yerinde.
const b1kare = bs2?.myPieces?.[0]?.[0];
const b2kare = bs2?.myPieces?.[3]?.[3];
check(b1kare?.name === "Bayrak" && b1kare?.owner === "2. Oyuncu", "P2'nin dizdigi Bayrak korundu", `(0,0 = ${b1kare?.name || "bos"})`);
check(b2kare?.name === "Er" && b2kare?.owner === "2. Oyuncu", "P2'nin dizdigi Er korundu", `(3,3 = ${b2kare?.name || "bos"})`);
// P1 yalnizca 2 tas bildirmisti; sunucu ONUN dizilimine dokunmamali.
check(tasSay(bs1?.myPieces) === RED.length, "P1'in kendi dizilimi korundu", `(${tasSay(bs1?.myPieces)} tas)`);

console.log("\n=== 3) GEC gelen setup_complete oyunu basa sarmamali ===");
p1.messages.length = 0; p2.messages.length = 0;
p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE_GEC }));
await sleep(1500);
const tekrar = p2.messages.find((m) => m.type === "both_setup_complete") || p1.messages.find((m) => m.type === "both_setup_complete");
check(!tekrar, "gec setup_complete both_setup_complete YAYINLAMADI", tekrar ? "<-- oyun basa sardi" : "");
// Oyun gercekten sürüyorsa P1 (sirasi onda) hamle yapabilmeli.
p1.messages.length = 0;
// Dikey hamle: goller yalnizca 4-6. sutunlarda uretiliyor, 7. sutun her zaman temiz.
p1.send(JSON.stringify({ type: "move", from: { row: 3, col: 7 }, to: { row: 4, col: 7 } }));
const hamle = await waitFor(p1, "move_executed", 3000);
const hata = p1.messages.find((m) => m.type === "move_error");
check(!!hamle, "oyun kaldigi yerden suruyor (P1 hamlesi kabul edildi)", hamle ? `nextPhase=${hamle.nextPhase}` : `<-- ${hata?.code || "yanit yok"}`);

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
p1.close(); p2.close();
await sleep(300);
process.exit(fails === 0 ? 0 : 1);
