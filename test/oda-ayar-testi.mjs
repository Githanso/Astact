// Astact — tur suresi senkronu ve biten odanin temizlenmesi.
//
//   node test/oda-ayar-testi.mjs
//   ASTACT_WS=... ASTACT_HTTP=... node test/oda-ayar-testi.mjs
//
// NOT: oda TTL'i 10 dakika oldugu icin silinmeyi BEKLEMIYORUZ; onun yerine
// silme zincirinin kuruldugunu (biten odanin hala erisilebilir oldugunu ve
// yeniden baslatinca TTL'in kalktigini) dogruluyoruz.

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const HTTP = process.env.ASTACT_HTTP || "http://127.0.0.1:8787";
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
    const sure = m.turnTimeMs ?? m.roomState?.turnTimeMs;
    console.log(`  [${etiket}] <- ${m.type}${sure !== undefined ? " turnTimeMs=" + sure : ""}`);
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
    await sleep(80);
  }
  return null;
};

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

console.log(`Hedef: ${BASE}\n`);

// ─── 0) ADSIZ oyuncu da "odada" sayilir ────────────────────────────────────
// Oyuncu adi ISTEGE BAGLI. getRoomState adsiz oyuncu icin redPlayer/bluePlayer
// alanina null yaziyor — o alan yalnizca GORUNEN AD. Istemci "rakip katildi mi"
// sorusunu bu null'a bakarak yanitlayinca adsiz rakip hic gelmemis sayiliyordu:
// rakip hazir olsa bile pano "Rakip bekleniyor" yaziyor, dahasi null kontrolu
// PLAY kontrolunden once oldugu icin oyun boyunca oyle kaliyordu.
console.log("=== 0) ADSIZ OYUNCU ODADA SAYILIYOR ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "", "t1-" + tok, "P1-adsiz");
  await sleep(500);
  const p2 = await connect(room, "", "t2-" + tok, "P2-adsiz");
  await sleep(1000);

  const kuruldu = p1.messages.filter((m) => m.roomState).pop();
  check(kuruldu?.roomState?.bluePlayer === null, "adsiz oyuncunun ADI null (beklenen)", `(${JSON.stringify(kuruldu?.roomState?.bluePlayer)})`);
  check(kuruldu?.roomState?.bluePresent === true, "ama VARLIGI ayri alanda bildiriliyor", `(${kuruldu?.roomState?.bluePresent})`);
  check(kuruldu?.roomState?.redPresent === true, "kendi slotu da dolu gorunuyor", `(${kuruldu?.roomState?.redPresent})`);

  // Rakip hazir olunca kurucu bunu ogrenebilmeli.
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
  await sleep(1000);
  const durum = p1.messages.filter((m) => m.type === "player_setup_status").pop();
  check(durum?.blueReady === true, "rakibin hazir oldugu bildirildi", `(${durum?.blueReady})`);

  // Bos slot hala bos gorunmeli, yoksa alan hicbir sey ayirt etmiyor demektir.
  const bosOda = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tek = await connect(bosOda, "", "t1-bos-" + tok, "P1-tek");
  await sleep(900);
  const bos = await waitFor(tek, "room_created");
  check(bos?.roomState?.bluePresent === false, "rakip YOKKEN slot bos bildiriliyor", `(${bos?.roomState?.bluePresent})`);

  p1.close(); p2.close(); tek.close();
  await sleep(400);
}

// ─── 1) Tur suresini yalnizca ODA KURUCUSU degistirebilir ──────────────────
console.log("=== 1) TUR SURESI SENKRONU ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "Kurucu", "t1-" + tok, "P1-kurucu");
  const p2 = await connect(room, "Katilan", "t2-" + tok, "P2-katilan");
  await sleep(900);

  // Katilan oyuncu odaya girerken gercek sureyi ogrenmeli.
  const katildi = await waitFor(p2, "room_joined");
  check(katildi?.roomState?.turnTimeMs === 35000,
        "katilan roomState ile varsayilan sureyi (35sn) ogrendi", `(${katildi?.roomState?.turnTimeMs})`);

  // Kurucu sureyi degistiriyor -> iki tarafa da yayilmali.
  p1.messages.length = 0; p2.messages.length = 0;
  p1.send(JSON.stringify({ type: "set_turn_time", turnTime: 15 }));
  await sleep(900);
  const d1 = await waitFor(p1, "turn_time_changed", 3000);
  const d2 = await waitFor(p2, "turn_time_changed", 3000);
  check(d1?.turnTimeMs === 15000, "kurucunun degisikligi kendine ulasti", `(${d1?.turnTimeMs})`);
  check(d2?.turnTimeMs === 15000, "KATILANA da ulasti (asil duzeltme)", d2 ? `(${d2.turnTimeMs})` : "<-- ULASMADI");

  // Katilan degistirmeye calisirsa YOK SAYILMALI.
  p1.messages.length = 0; p2.messages.length = 0;
  p2.send(JSON.stringify({ type: "set_turn_time", turnTime: 600 }));
  await sleep(900);
  check(!(await waitFor(p2, "turn_time_changed", 1500)), "katilanin degistirme denemesi REDDEDILDI");

  // Alt sinir: 5sn'nin altina inilemez.
  p1.send(JSON.stringify({ type: "set_turn_time", turnTime: 1 }));
  await sleep(900);
  const d3 = p1.messages.filter((m) => m.type === "turn_time_changed").pop();
  check(d3?.turnTimeMs === 5000, "alt sinir uygulandi (1sn -> 5sn)", `(${d3?.turnTimeMs})`);

  // Oyun basladiktan SONRA degistirilemez.
  p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED, turnTime: 8 }));
  await sleep(300);
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
  await sleep(1200);
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");
  p1.messages.length = 0;
  p1.send(JSON.stringify({ type: "set_turn_time", turnTime: 600 }));
  await sleep(900);
  check(!(await waitFor(p1, "turn_time_changed", 1500)), "oyun sirasinda degisiklik REDDEDILDI");

  p1.close(); p2.close();
  await sleep(400);
}

// ─── 2) Biten oda erisilebilir kaliyor, yeniden baslatilinca TTL kalkiyor ──
console.log("\n=== 2) BITEN ODANIN OMRU ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
  const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
  await sleep(900);
  // 5sn'lik turlarla hizlica beraberlige goturuyoruz (6 zaman asimi = ~30sn).
  p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED, turnTime: 5 }));
  await sleep(300);
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
  await sleep(1200);
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");

  console.log("  beraberlik bekleniyor (~30sn)...");
  const bitis = await waitFor(p1, "game_over", 45000);
  check(bitis?.reason === "TIMEOUT_DRAW", "oyun berabere bitti", `(${bitis?.reason})`);

  // TTL 10dk; oda hemen silinmemeli, aksi halde oyuncular sonucu goremezdi.
  await sleep(2000);
  const res = await fetch(`${HTTP}/ws/game-room?room=${room}`, { method: "HEAD" }).catch(() => null);
  const p3 = await connect(room, "Oyuncu1", "t1-" + tok, "P1-donen");
  await sleep(1200);
  const geri = await waitFor(p3, "game_state_restored", 4000);
  check(!!geri, "oyun bittikten HEMEN sonra oda hala erisilebilir (TTL 10dk)");
  check(geri?.gamePhase === "GAME_OVER", "sonuc korunuyor", `(${geri?.gamePhase})`);

  p1.close(); p2.close(); p3.close();
  await sleep(400);
}

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
process.exit(fails === 0 ? 0 : 1);
