// Astact — OYUN SONU sonrasi "Yeniden Baslat" akisi.
//
// Yeniden baslatma SUNUCU kararidir ve ancak IKI taraf da isteyince gerceklesir.
// Kritik nokta sadece fazin SETUP'a donmesi degil; oyuncularin ready bayragi,
// tahtalari ve KACIRILAN TUR SAYACI da sifirlanmali. missedTurns sifirlanmazsa
// beraberlikle biten bir oyundan sonra yeni oyun ilk zaman asiminda aninda
// tekrar berabere biter (3/3 zaten dolu olurdu).
//
//   node test/yeniden-baslat-testi.mjs
//   ASTACT_WS=wss://astact.<hesap>.workers.dev/ws/game-room node test/yeniden-baslat-testi.mjs
//
// Sure: ~10sn (bayrak) + ~50sn (beraberlik) + ~80sn (kopma) = ~2.5 dakika.
//
// NOT: gameOverAt sifirlanmasi BURADA olculmuyor — etkisi 10 dakikalik oda TTL'i
// oldugu icin makul surede gozlenemez. Yeniden baslatilan odanin yasamaya devam
// ettigi, yeni oyunun sonuna kadar oynanabilmesiyle dolayli olarak dogrulaniyor.

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function piece(id, name, rank, owner, row, col, opts = {}) {
  return { id, name, rank, owner, special: opts.special ?? null, movable: opts.movable ?? true, position: { row, col } };
}
// Kirmizi Er, mavi bayragin HEMEN yaninda: tek hamlede FLAG galibiyeti alinabiliyor.
// Kirmizi sola ilerler (dc<0), yani (0,1) -> (0,0) gecerli bir hamle.
const RED = [
  piece("r1", "Sancak", 0, "1. Oyuncu", 0, 10, { movable: false }),
  piece("r2", "Er", 2, "1. Oyuncu", 0, 1),
];
const BLUE = [
  piece("b1", "Sancak", 0, "2. Oyuncu", 0, 0, { movable: false }),
  piece("b2", "Er", 2, "2. Oyuncu", 3, 3),
];
const BAYRAK_HAMLESI = { type: "move", from: { row: 0, col: 1 }, to: { row: 0, col: 0 } };

function connect(room, name, token, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${name}&token=${token}`);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    const ek = [m.slot !== undefined && "slot=" + m.slot,
                m.reason && "reason=" + m.reason,
                m.gamePhase && "gamePhase=" + m.gamePhase,
                m.roomState?.gamePhase && "roomState.gamePhase=" + m.roomState.gamePhase,
                m.missedTurns && `missed=${m.missedTurns.red}/${m.missedTurns.blue}`].filter(Boolean).join(" ");
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
    await sleep(100);
  }
  return null;
};
const temizle = (...soketler) => soketler.forEach((s) => { s.messages.length = 0; });

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

// Iki taraf da isteyene kadar hicbir sey olmamali; tek istek yalnizca rakibe
// haber verir. Isteyen tarafa da geri yollaniyor (istemci "onay bekleniyor"
// kutusunu bununla aciyor, bkz. App.tsx restart_requested).
async function yenidenBaslat(p1, p2, { tekTarafiDogrula = true } = {}) {
  temizle(p1, p2);
  p1.send(JSON.stringify({ type: "request_restart" }));
  await sleep(800);
  const istekP1 = await waitFor(p1, "restart_requested", 3000);
  const istekP2 = await waitFor(p2, "restart_requested", 3000);
  if (tekTarafiDogrula) {
    check(istekP1?.slot === 0, "isteyen kendi istegini geri aldi (slot=0)", `(${istekP1?.slot})`);
    check(istekP2?.slot === 0, "rakip istegi ogrendi (slot=0)", `(${istekP2?.slot})`);
    check(!(await waitFor(p1, "game_restarted", 1500)), "TEK istekle oyun sifirlanmadi");
  }

  temizle(p1, p2);
  p2.send(JSON.stringify({ type: "request_restart" }));
  await sleep(1000);
  const y1 = await waitFor(p1, "game_restarted", 4000);
  const y2 = await waitFor(p2, "game_restarted", 4000);
  return { y1, y2 };
}

// Yeni oyunu bastan kurar. turnTime'i oda kurucusu (slot 0) bildiriyor.
async function dizil(p1, p2, turnTime) {
  p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED, turnTime }));
  await sleep(600);
  const erken = await waitFor(p2, "both_setup_complete", 800);
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
  await sleep(1200);
  return { erken };
}

console.log(`Hedef: ${BASE}\n`);

// ─── 1) Sancakla biten oyundan yeniden baslatma ────────────────────────────
console.log("=== 1) BAYRAK GALIBIYETI SONRASI YENIDEN BASLATMA ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
  const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
  await sleep(900);
  await dizil(p1, p2, 300);
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");

  temizle(p1, p2);
  p1.send(JSON.stringify(BAYRAK_HAMLESI));
  await sleep(900);
  const bitis = await waitFor(p1, "game_over", 4000);
  check(bitis?.reason === "FLAG" && bitis?.winner === "1. Oyuncu",
        "bayrak alindi, oyun bitti", `(${bitis?.reason}/${bitis?.winner})`);

  const { y1, y2 } = await yenidenBaslat(p1, p2);
  check(!!y1 && !!y2, "iki tarafa da game_restarted geldi",
        `(P1=${!!y1} P2=${!!y2})`);
  check(y1?.roomState?.gamePhase === "SETUP", "faz SETUP'a dondu", `(${y1?.roomState?.gamePhase})`);
  check(y1?.roomState?.redReady === false && y1?.roomState?.blueReady === false,
        "iki oyuncunun hazir bayragi da dustu",
        `(red=${y1?.roomState?.redReady} blue=${y1?.roomState?.blueReady})`);
  check(y1?.roomState?.roomCode === room, "ayni odada kalindi (yeni oda acilmadi)", `(${y1?.roomState?.roomCode})`);

  // ready sifirlanmasaydi: p1 setup_complete der demez sunucu "ikisi de hazir"
  // sanip oyunu ESKI tahtalarla baslatirdi.
  temizle(p1, p2);
  const { erken } = await dizil(p1, p2, 300);
  check(!erken, "tek tarafin dizilimi oyunu baslatmadi");
  const yeniBaslangic = await waitFor(p1, "both_setup_complete", 4000);
  check(!!yeniBaslangic, "ikinci oyun basladi");
  check(yeniBaslangic?.gamePhase === "PLAY_RED", "sira bastan kirmizida", `(${yeniBaslangic?.gamePhase})`);

  // Tahta gercekten sifirlandi mi: alinan mavi bayrak yerinde duruyor olmali.
  const p2Baslangic = await waitFor(p2, "both_setup_complete", 3000);
  const maviSancak = p2Baslangic?.myPieces?.[0]?.[0];
  check(maviSancak?.name === "Sancak", "alinan bayrak yeni oyunda geri geldi", `(${maviSancak?.name ?? "yok"})`);

  // Ve ikinci oyun da sonuna kadar oynanabiliyor (oda yasiyor).
  temizle(p1, p2);
  p1.send(JSON.stringify(BAYRAK_HAMLESI));
  await sleep(900);
  const ikinciBitis = await waitFor(p1, "game_over", 4000);
  check(ikinciBitis?.reason === "FLAG", "ikinci oyun da normal bitti", `(${ikinciBitis?.reason})`);

  p1.close(); p2.close();
  await sleep(500);
}

// ─── 2) Beraberlikten sonra kacirilan tur sayaci sifirlaniyor ──────────────
// Asil regresyon burada. missedTurns sifirlanmazsa yeni oyunun ILK zaman asimi
// kirmiziyi 4'e cikarir, mavi zaten 3'te oldugu icin oyun aninda berabere biter.
console.log("\n=== 2) BERABERLIK SONRASI missedTurns SIFIRLANIYOR (~50sn) ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
  const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
  await sleep(900);
  await dizil(p1, p2, 5); // 5sn = sunucunun alt siniri
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");

  console.log("  kimse oynamiyor, beraberlik bekleniyor (~30sn)...");
  const bitis = await waitFor(p1, "game_over", 45000);
  check(bitis?.reason === "TIMEOUT_DRAW", "oyun berabere bitti", `(${bitis?.reason})`);
  check(bitis?.missedTurns?.red >= 3 && bitis?.missedTurns?.blue >= 3,
        "sayaclar dolmus durumda", `(${bitis?.missedTurns?.red}/${bitis?.missedTurns?.blue})`);

  const { y1 } = await yenidenBaslat(p1, p2, { tekTarafiDogrula: false });
  check(!!y1, "game_restarted geldi");
  check(y1?.roomState?.gamePhase === "SETUP", "faz SETUP'a dondu", `(${y1?.roomState?.gamePhase})`);

  temizle(p1, p2);
  await dizil(p1, p2, 5);
  check(!!(await waitFor(p1, "both_setup_complete")), "yeni oyun basladi");

  console.log("  ilk turun zaman asimi bekleniyor (~5sn)...");
  temizle(p1, p2);
  const asim = await waitFor(p1, "turn_timeout", 12000);
  check(!!asim, "tur zaman asimina ugradi", asim ? "" : "<-- GELMEDI");
  check(asim?.missedTurns?.red === 1 && asim?.missedTurns?.blue === 0,
        "sayac SIFIRDAN basladi (1/0)", `(${asim?.missedTurns?.red}/${asim?.missedTurns?.blue})`);
  check(!(await waitFor(p1, "game_over", 1500)),
        "yeni oyun ilk zaman asiminda BERABERE BITMEDI");

  p1.close(); p2.close();
  await sleep(500);
}

// ─── 3) Hukmen galibiyetten sonra donen oyuncuyla yeniden baslatma ─────────
// Gercek hayatta en sik yol: baglanti kopar, oyun hukmen biter, kopan oyuncu
// geri doner ve iki taraf rovans ister. Kopma damgasi/oyuncu kaydi bozulmussa
// bu akis burada patlar.
console.log("\n=== 3) RAKIP KOPUP DONDUKTEN SONRA ROVANS (~80sn) ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
  const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
  await sleep(900);
  await dizil(p1, p2, 300); // tur saati senaryoya karismasin
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");

  console.log("  P2 kopuyor, 60sn kopma penceresi bekleniyor...");
  temizle(p1);
  p2.close();
  const bitis = await waitFor(p1, "game_over", 75000);
  check(bitis?.reason === "OPPONENT_LEFT", "hukmen galibiyetle bitti", `(${bitis?.reason})`);

  console.log("  kaybeden ayni token ile geri donuyor...");
  await sleep(2000);
  const p2b = await connect(room, "Oyuncu2", "t2-" + tok, "P2-donen");
  await sleep(1500);
  check(!!(await waitFor(p2b, "game_state_restored", 5000)), "kaybeden odaya geri girdi");

  const { y1, y2 } = await yenidenBaslat(p1, p2b, { tekTarafiDogrula: false });
  check(!!y1 && !!y2, "rovans kabul edildi", `(P1=${!!y1} P2=${!!y2})`);
  check(y1?.roomState?.gamePhase === "SETUP", "faz SETUP'a dondu", `(${y1?.roomState?.gamePhase})`);
  check(y1?.roomState?.redConnected === true && y1?.roomState?.blueConnected === true,
        "iki oyuncu da bagli gorunuyor",
        `(red=${y1?.roomState?.redConnected} blue=${y1?.roomState?.blueConnected})`);

  temizle(p1, p2b);
  await dizil(p1, p2b, 300);
  check(!!(await waitFor(p1, "both_setup_complete", 5000)), "rovans oyunu basladi");

  p1.close(); p2b.close();
  await sleep(500);
}

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
process.exit(fails === 0 ? 0 : 1);
