// Astact — OYUN SONU senaryolari: tur kacirma beraberligi ve hukmen galibiyet.
//
// Ikisi de SUNUCU kararidir; istemci yalnizca metni seciyor. Testler bu yuzden
// dogrudan protokolu olcuyor.
//
//   node test/oyun-sonu-testi.mjs
//   ASTACT_WS=wss://astact.<hesap>.workers.dev/ws/game-room node test/oyun-sonu-testi.mjs
//
// Sure: ~35sn (beraberlik) + ~70sn (kopma penceresi 60sn) = ~2 dakika.

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
    const ek = [m.reason && "reason=" + m.reason, m.nextPhase && "nextPhase=" + m.nextPhase,
                m.winner !== undefined && "winner=" + m.winner,
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

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

async function kur(room, tok, turnTime) {
  const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
  const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
  await sleep(800);
  p1.send(JSON.stringify({ type: "setup_complete", placedPieces: RED, turnTime }));
  await sleep(300);
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: BLUE }));
  await sleep(1200);
  return { p1, p2 };
}

console.log(`Hedef: ${BASE}\n`);

// ─── 1) Tur kacirma beraberligi ────────────────────────────────────────────
// MAX_MISSED_TURNS=3, iki taraf da doldurmali: 6 tur zaman asimi gerekir.
// turnTime=5sn (sunucunun alt siniri) -> ~30sn.
console.log("=== 1) TUR KACIRMA BERABERLIGI (kimse oynamiyor, ~30sn) ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const { p1, p2 } = await kur(room, Date.now(), 5);
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");

  const bitis = await waitFor(p1, "game_over", 45000);
  check(!!bitis, "game_over geldi", bitis ? `reason=${bitis.reason}` : "<-- GELMEDI");
  check(bitis?.reason === "TIMEOUT_DRAW", "gerekce TIMEOUT_DRAW", `(${bitis?.reason})`);
  check(bitis?.winner === null, "kazanan YOK (berabere)", `(winner=${JSON.stringify(bitis?.winner)})`);
  check(bitis?.missedTurns?.red >= 3 && bitis?.missedTurns?.blue >= 3,
        "iki taraf da 3 tur kacirdi", `(${bitis?.missedTurns?.red}/${bitis?.missedTurns?.blue})`);
  check(!!(await waitFor(p2, "game_over", 3000)), "P2 de game_over aldi");
  p1.close(); p2.close();
  await sleep(500);
}

// ─── 2) Rakip donmezse hukmen galibiyet ────────────────────────────────────
// turnTime uzun tutuluyor ki tur saati devreye girip senaryoyu bozmasin.
console.log("\n=== 2) RAKIP GERI DONMEDI -> HUKMEN GALIBIYET (~70sn) ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tokKopma = Date.now();
  const { p1, p2 } = await kur(room, tokKopma, 300);
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");

  console.log("  P2 baglantisi kesiliyor...");
  p1.messages.length = 0;
  p2.close();
  await sleep(1000);
  const kopma = await waitFor(p1, "player_connection_change", 5000);
  check(!!kopma, "P1 rakibin koptugunu ogrendi");
  const kalanMs = kopma?.roomState?.blueDisconnectMs;
  check(typeof kalanMs === "number" && kalanMs > 0,
        "roomState geri sayim icin blueDisconnectMs iceriyor", `(${kalanMs}ms)`);

  console.log("  60sn kopma penceresi bekleniyor...");
  const bitis = await waitFor(p1, "game_over", 75000);
  check(!!bitis, "game_over geldi", bitis ? `reason=${bitis.reason}` : "<-- GELMEDI");
  check(bitis?.reason === "OPPONENT_LEFT", "gerekce OPPONENT_LEFT", `(${bitis?.reason})`);
  check(bitis?.winner === "1. Oyuncu", "kalan oyuncu hukmen kazandi", `(winner=${bitis?.winner})`);

  // Kaybeden geri donup SONUCU gorebilmeli. Bir kez, hukmen galibiyetten sonra
  // kopma damgasi temizlenmedigi icin alarm yeniden tetikleniyor ve GAME_OVER
  // dalinda oyuncuyu siliyordu; token'i silinen oyuncu odaya hic giremiyordu.
  console.log("  kaybeden ayni token ile geri donuyor...");
  await sleep(3000);
  const p2b = await connect(room, "Oyuncu2", "t2-" + tokKopma, "P2-donen");
  await sleep(1500);
  const geri = await waitFor(p2b, "game_state_restored", 5000);
  const red = p2b.messages.find((m) => m.type === "room_error");
  check(!!geri, "kaybeden odaya geri girebildi", geri ? "" : `<-- ${red ? "room_error " + red.code : "yanit yok"}`);
  check(geri?.gamePhase === "GAME_OVER", "sonuc ekrani icin GAME_OVER geldi", `(${geri?.gamePhase})`);
  check(geri?.winner === "1. Oyuncu", "kazanan dogru bildirildi", `(${geri?.winner})`);
  check(geri?.reason === "OPPONENT_LEFT", "gerekce de tasindi (dogru metin icin sart)", `(${geri?.reason})`);
  p1.close(); p2b.close();
  await sleep(500);
}

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
process.exit(fails === 0 ? 0 : 1);
