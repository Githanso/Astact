// Astact — IZCI gorevi: dusman hattindaki bir tasin kimligini acma.
//
// Kural (src/server.ts "scout"):
//   - Yalnizca Izci (special SCOUT), omrunde BIR kez.
//   - Hedef AYNI SATIRDA ve dusmanin dizilim sutunlarinda olmali.
//   - Izci ile hedef arasinda GOL varsa gorus kapali.
//   - Hedef ORMAN karesindeyse kimligi gorunmez.
//   - Kullanim TUR HARCAR (hamle yerine gecer).
//
// En kritik kontrol sondaki: acilan tasin KOORDINATI kurbana GITMEMELI. Giderse
// kurban hangi tasinin desifre oldugunu ogrenip onu geri ceker; istihbaratin
// butun degeri gizli kalmasinda.
//
//   node test/izci-testi.mjs
//
// Sure: ~20sn.

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tas(id, name, rank, owner, row, col, opts = {}) {
  return { id, name, rank, owner, special: opts.special ?? null, movable: opts.movable ?? true, position: { row, col } };
}

function connect(room, ad, token, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${ad}&token=${token}`);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    if (m.type === "move_error") console.log(`  [${etiket}] <- HATA ${m.code}`);
    else if (m.type === "scout_done") console.log(`  [${etiket}] <- scout_done hedef=${m.target ? m.target.row + "," + m.target.col : "YOK"} nextPhase=${m.nextPhase}`);
  });
  return new Promise((res, rej) => { ws.addEventListener("open", () => res(ws)); ws.addEventListener("error", rej); });
}
const waitFor = async (ws, type, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const m = ws.messages.find((x) => x.type === type); if (m) return m; await sleep(80); }
  return null;
};
const sonuncu = (ws, type) => ws.messages.filter((m) => m.type === type).pop() ?? null;
const temizle = (...s) => s.forEach((x) => { x.messages.length = 0; });

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

// src/server.ts SCOUT_COOLDOWN ile ayni olmali.
const SCOUT_COOLDOWN = 10;

// Tur harcamak icin taslari DIKEY oynatan yardimci (yatayda geri adim yasak,
// ileri geri gidilemezdi). Konumu GERCEKTEN takip ediyor ve yalnizca hamle
// kabul edilirse ilerletiyor — sabit bir yon dizisi kullansaydik, reddedilen
// tek bir hamle sonraki butun hamleleri bozar ve test sessizce yaniltirdi.
function oynatici(p1, p2) {
  let kRow = 7, mRow = 7;
  const git = async (ws, kaynak, col, satir, gonderen) => {
    const hedef = satir === 7 ? 6 : 7;
    temizle(p1, p2);
    ws.send(JSON.stringify({ type: "move", from: { row: satir, col }, to: { row: hedef, col } }));
    await sleep(450);
    const m = sonuncu(kaynak, "move_executed");
    return { m, yeni: m ? hedef : satir };
  };
  return {
    async kirmizi() { const r = await git(p1, p1, 7, kRow); kRow = r.yeni; return r.m; },
    async mavi()    { const r = await git(p2, p2, 0, mRow); mRow = r.yeni; return r.m; },
  };
}

// 5. satirda gol yok; 1. satirda 5-6. sutunlar gol (kirmizinin gorusunu keser).
// (3,6) ve (5,5) orman. Bunlar client/constants.ts ile ayni.
const KIRMIZI = [
  tas("r-bayrak", "Bayrak", 0, "1. Oyuncu", 9, 10, { movable: false }),
  tas("r-izci5", "İzci", 2, "1. Oyuncu", 5, 7, { special: "SCOUT" }),
  tas("r-izci1", "İzci", 2, "1. Oyuncu", 1, 7, { special: "SCOUT" }),
  tas("r-izci3", "İzci", 2, "1. Oyuncu", 3, 7, { special: "SCOUT" }),
  tas("r-er", "Er", 2, "1. Oyuncu", 7, 7),
];
const MAVI = [
  tas("m-bayrak", "Bayrak", 0, "2. Oyuncu", 9, 0, { movable: false }),
  tas("m-maresal", "Mareşal", 10, "2. Oyuncu", 5, 3),   // 5. satir, acik hedef
  // Bekleme suresi dolduktan sonraki IKINCI gorev icin 5. satirda ayri hedef.
  // (5,2) BOS birakiliyor: senaryo 3 orayi "bos hedef reddedilir" diye kullaniyor.
  tas("m-yuzbasi", "Yüzbaşı", 6, "2. Oyuncu", 5, 1),
  tas("m-general", "General", 9, "2. Oyuncu", 1, 3),    // 1. satir, arada gol var
  tas("m-albay", "Albay", 8, "2. Oyuncu", 4, 3),        // baska satir
  tas("m-er", "Er", 2, "2. Oyuncu", 7, 0),
];

async function kur() {
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "Kirmizi", "t1-" + tok, "P1");
  const p2 = await connect(room, "Mavi", "t2-" + tok, "P2");
  await sleep(800);
  p1.send(JSON.stringify({ type: "setup_complete", placedPieces: KIRMIZI, turnTime: 300 }));
  await sleep(300);
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: MAVI }));
  await sleep(1200);
  if (!(await waitFor(p1, "both_setup_complete"))) check(false, "oyun baslamadi");
  return { p1, p2 };
}

// Rakip tasinin gorunumu: acilmamissa ad/rutbe alanlari HIC olmamali.
// both_setup_complete alani "opponentPieces", move/scout mesajlarinda "opponentBoard".
const rakipKare = (mesaj, r, c) => (mesaj?.opponentBoard ?? mesaj?.opponentPieces)?.[r]?.[c] ?? null;

console.log(`Hedef: ${BASE}\n`);

// ─── 1) Gecerli gorev: ayni satir, acik yol ────────────────────────────────
console.log("=== 1) GECERLI GOREV (5. satir, arada gol yok) ===");
{
  const { p1, p2 } = await kur();
  const basla = sonuncu(p1, "both_setup_complete");
  const once = rakipKare(basla, 5, 3);
  check(!!once && once.name === undefined, "gorev ONCESI Maresal'in kimligi gizli", `(${JSON.stringify(once)})`);

  temizle(p1, p2);
  p1.send(JSON.stringify({ type: "scout", from: { row: 5, col: 7 }, target: { row: 5, col: 3 } }));
  await sleep(900);
  const sd = await waitFor(p1, "scout_done");
  check(!!sd, "gorev kabul edildi");
  const sonra = rakipKare(sd, 5, 3);
  check(sonra?.name === "Mareşal" && sonra?.rank === 10, "hedefin kimligi ACILDI", `(${sonra?.name}/${sonra?.rank})`);
  check(sd?.nextPhase === "PLAY_BLUE", "gorev TUR HARCADI, sira maviye gecti", `(${sd?.nextPhase})`);

  // ── Asil gizlilik kontrolu ──
  const sdMavi = await waitFor(p2, "scout_done");
  check(!!sdMavi, "rakip de turun gectigini ogrendi");
  check(sdMavi?.target === undefined && sdMavi?.scout === undefined,
        "rakip HANGI tasinin goruldugunu OGRENEMEDI",
        `(target=${JSON.stringify(sdMavi?.target)} scout=${JSON.stringify(sdMavi?.scout)})`);
  // Kurban kendi tasini zaten tam goruyor; "revealed" onun gorunumunu degistirmemeli.
  const kurbaninKendiTasi = sdMavi?.myBoard?.[5]?.[3];
  check(kurbaninKendiTasi?.name === "Mareşal", "kurban kendi tasini eskisi gibi goruyor");

  p1.close(); p2.close(); await sleep(400);
}

// ─── 2) Bekleme suresi: 10 turdan sonra hak yenileniyor ────────────────────
// Ilk kullanim bedava. Sonra sahibi 10 tur OYNAYINCA hak geri geliyor. Sayacin
// gercekten isledigini gormek icin turlar tek tek oynaniyor ve her turda kalan
// sure kontrol ediliyor.
console.log("\n=== 2) BEKLEME SURESI (10 tur) ===");
{
  const { p1, p2 } = await kur();
  p1.send(JSON.stringify({ type: "scout", from: { row: 5, col: 7 }, target: { row: 5, col: 3 } }));
  await sleep(900);
  const ilk = await waitFor(p1, "scout_done");
  check(!!ilk, "ilk kullanim gecti (bedava)");
  const izciKare = (m) => m?.myBoard?.[5]?.[7];
  check(izciKare(ilk)?.scoutIn === SCOUT_COOLDOWN, `kullanimdan sonra kalan ${SCOUT_COOLDOWN} tur`, `(${izciKare(ilk)?.scoutIn})`);

  // Gorevden sonra sira MAVIDE. Her donguda once mavi, sonra kirmizi oynuyor;
  // boylece kirmizinin tur sayaci turda bir artiyor.
  // Turlar tek tek olculuyor: sondan bir onceki turda hakkin HALA gelmedigini,
  // sonuncuda geldigini gormek istiyoruz. Yalnizca sona bakmak, sayacin dogru
  // HIZDA isledigini gostermezdi.
  const oyna = oynatici(p1, p2);
  let kalan = SCOUT_COOLDOWN;
  for (let i = 1; i <= SCOUT_COOLDOWN; i++) {
    await oyna.mavi();
    const m = await oyna.kirmizi();
    kalan = izciKare(m)?.scoutIn;
    if (i === SCOUT_COOLDOWN - 1) check(kalan === 1, `${i}. turdan sonra 1 tur kaldi`, `(${kalan})`);
  }
  check(kalan === 0, `${SCOUT_COOLDOWN} tur sonra hak YENILENDI`, `(scoutIn=${kalan})`);

  await oyna.mavi(); // sira kirmiziya donsun
  temizle(p1, p2);
  p1.send(JSON.stringify({ type: "scout", from: { row: 5, col: 7 }, target: { row: 5, col: 1 } }));
  await sleep(900);
  const ikinci = sonuncu(p1, "scout_done");
  check(!!ikinci, "ikinci gorev kabul edildi");
  check(rakipKare(ikinci, 5, 1)?.name === "Yüzbaşı", "ikinci hedefin kimligi acildi", `(${rakipKare(ikinci, 5, 1)?.name})`);
  check(rakipKare(ikinci, 5, 3)?.name === "Mareşal", "ilk acilan tas HALA acik (oyun bitene kadar)", `(${rakipKare(ikinci, 5, 3)?.name})`);
  p1.close(); p2.close(); await sleep(400);
}

// ─── 2b) Bekleme dolmadan denenirse reddediliyor ve KALAN bildiriliyor ──────
console.log("\n=== 2b) BEKLEME DOLMADAN RED ===");
{
  const { p1, p2 } = await kur();
  p1.send(JSON.stringify({ type: "scout", from: { row: 5, col: 7 }, target: { row: 5, col: 3 } }));
  await sleep(900);
  check(!!(await waitFor(p1, "scout_done")), "ilk kullanim gecti");

  // Gorevden sonra sira mavide: bir mavi + bir kirmizi tur oynatiyoruz, yani
  // kirmizi TEK tur oynamis oluyor.
  const oyna = oynatici(p1, p2);
  await oyna.mavi();
  await oyna.kirmizi();
  await oyna.mavi();
  temizle(p1, p2);
  p1.send(JSON.stringify({ type: "scout", from: { row: 5, col: 7 }, target: { row: 5, col: 1 } }));
  await sleep(900);
  const hata = sonuncu(p1, "move_error");
  check(hata?.code === "SCOUT_COOLDOWN", "bekleme dolmadan reddedildi", `(${hata?.code})`);
  check(hata?.n === SCOUT_COOLDOWN - 1, "kalan tur sayisi bildirildi", `(n=${hata?.n}, beklenen ${SCOUT_COOLDOWN - 1})`);
  check(!sonuncu(p1, "scout_done"), "gorev islenmedi");
  p1.close(); p2.close(); await sleep(400);
}

// ─── 3) Kural ihlalleri ────────────────────────────────────────────────────
console.log("\n=== 3) KURAL IHLALLERI ===");
{
  const { p1, p2 } = await kur();

  const dene = async (ad, govde, beklenen) => {
    temizle(p1, p2);
    p1.send(JSON.stringify({ type: "scout", ...govde }));
    await sleep(800);
    const h = sonuncu(p1, "move_error");
    const gecti = sonuncu(p1, "scout_done");
    check(h?.code === beklenen && !gecti, ad, `(${h?.code ?? (gecti ? "GOREV GECTI!" : "yanit yok")})`);
  };

  // 1. satirda Izci var, hedef de var ama arada 5-6. sutunlar GOL.
  await dene("arada gol varsa reddedildi", { from: { row: 1, col: 7 }, target: { row: 1, col: 3 } }, "SCOUT_LAKE");
  // Baska satirdaki tas secilemez.
  await dene("baska satirdaki hedef reddedildi", { from: { row: 5, col: 7 }, target: { row: 4, col: 3 } }, "SCOUT_RANGE");
  // Izci olmayan tas gorev yapamaz.
  await dene("Izci olmayan tas reddedildi", { from: { row: 7, col: 7 }, target: { row: 7, col: 0 } }, "SCOUT_NOT_SCOUT");
  // Bos kareye bakilamaz (dusman tasi yok).
  await dene("bos hedef reddedildi", { from: { row: 5, col: 7 }, target: { row: 5, col: 2 } }, "SCOUT_RANGE");

  // Hicbiri turu harcamamis olmali: hala kirmizinin sirasi.
  temizle(p1, p2);
  p1.send(JSON.stringify({ type: "scout", from: { row: 5, col: 7 }, target: { row: 5, col: 3 } }));
  await sleep(900);
  check(!!(await waitFor(p1, "scout_done")), "reddedilen denemeler TUR HARCAMADI (sira hala kirmizida)");

  p1.close(); p2.close(); await sleep(400);
}

// ─── 4) Ormandaki hedefin kimligi gorulemez ────────────────────────────────
// (3,6) orman ve kirmizi Izci (3,7)'de — bitisik, arada gol yok. Yani tek
// reddedilme sebebi ORMAN olabilir. Menzil sutunla sinirli olsaydi bu kural
// hic calismazdi: orman kareleri 4-6. sutunlarda, dizilim bolgeleri 0-3/7-10.
console.log("\n=== 4) ORMANDAKI HEDEF ===");
{
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = Date.now();
  const p1 = await connect(room, "Kirmizi", "t1-" + tok, "P1");
  const p2 = await connect(room, "Mavi", "t2-" + tok, "P2");
  await sleep(800);
  p1.send(JSON.stringify({ type: "setup_complete", placedPieces: KIRMIZI, turnTime: 300 }));
  await sleep(300);
  // Mavi tasi ORMAN karesine (3,6) koyuluyor — sunucu dizilim bolgesini
  // dogrulamadigi icin bu mumkun ve kurali sinamak icin en dogrudan yol.
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: [
    tas("m-bayrak", "Bayrak", 0, "2. Oyuncu", 9, 0, { movable: false }),
    tas("m-orman", "Albay", 8, "2. Oyuncu", 3, 6),
    tas("m-acik", "Yüzbaşı", 6, "2. Oyuncu", 3, 2),
  ] }));
  await sleep(1200);
  check(!!(await waitFor(p1, "both_setup_complete")), "oyun basladi");

  temizle(p1, p2);
  p1.send(JSON.stringify({ type: "scout", from: { row: 3, col: 7 }, target: { row: 3, col: 6 } }));
  await sleep(900);
  const h = sonuncu(p1, "move_error");
  check(h?.code === "SCOUT_FOREST", "ormandaki hedefin kimligi acilmadi", `(${h?.code})`);
  check(!sonuncu(p1, "scout_done"), "gorev islenmedi");

  // Ayni Izci, ORMANDA OLMAYAN bir hedefi hala acabilmeli — yukaridaki red
  // ormandan geliyor, Izci'nin gorevini tuketmis olmaktan degil.
  temizle(p1, p2);
  p1.send(JSON.stringify({ type: "scout", from: { row: 3, col: 7 }, target: { row: 3, col: 2 } }));
  await sleep(900);
  const sd = sonuncu(p1, "scout_done");
  check(!!sd, "ayni Izci ormansiz hedefi acabildi (gorev tukenmemis)");
  check(rakipKare(sd, 3, 2)?.name === "Yüzbaşı", "acilan tasin kimligi dogru", `(${rakipKare(sd, 3, 2)?.name})`);

  p1.close(); p2.close(); await sleep(400);
}

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
process.exit(fails === 0 ? 0 : 1);
