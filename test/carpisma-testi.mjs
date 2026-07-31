// Astact — CARPISMA kurallari ve bilgi sizintisi.
//
// resolveCombat (src/server.ts) oyunun kalbi ve bugune kadar otomatik testi yoktu:
// protokol-testi hamle kurallarinda duruyor, carpismaya hic girmiyor.
//
// Iki ayri sey olculuyor:
//   1) KIM KAZANIR  — rutbe siralamasi, Bomba (iki taraf da olur), Casus/Maresal, esit rutbe.
//   2) KIM NE OGRENIR — carpisma sonucu her iki oyuncu icin AYRI kurgulaniyor
//      (cP0/cP1, server.ts:409-410). Rutbe gizleme oyunun temeli; oradaki tek bir
//      yanlis kosul rakibin tasinin rutbesini sizdirir ve kimse fark etmez.
//
// Ormanda biten carpismalarda kareyi tutan tas GIZLI kalir. Bu yuzden her orman
// senaryosunun bir de acik alan kontrol grubu var: "null geldi" sonucu, kural
// isledigi icin mi yoksa alan hic dolmadigi icin mi bos, ayirt edilebilsin.
//
//   node test/carpisma-testi.mjs
//   ASTACT_WS=wss://astact.<hesap>.workers.dev/ws/game-room node test/carpisma-testi.mjs
//
// Sure: ~1 dakika. Tur saati 300sn'ye ayarlanip devre disi birakiliyor.

const BASE = process.env.ASTACT_WS || "ws://127.0.0.1:8787/ws/game-room";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tas(id, name, rank, owner, row, col, opts = {}) {
  return { id, name, rank, owner, special: opts.special ?? null, movable: opts.movable ?? true, position: { row, col } };
}
const kirmizi = (id, name, rank, row, col, opts) => tas(id, name, rank, "1. Oyuncu", row, col, opts);
const mavi = (id, name, rank, row, col, opts) => tas(id, name, rank, "2. Oyuncu", row, col, opts);
// Bayraklar olaydan uzakta ve hareketsiz; senaryoyu kazara bitirmesinler.
const KB = kirmizi("rb", "Bayrak", 0, 0, 10, { movable: false });
const MB = mavi("mb", "Bayrak", 0, 0, 0, { movable: false });

// ARAZI ARTIK SABIT DEGIL: her oyunda sunucuda uretiliyor. Bu yuzden hicbir
// orman/gol koordinati varsayilmiyor; kareler her odada arazinin kendisinden
// seciliyor. Kirmizi sola ilerler (dc<0), mavi saga.
const golMu = (a, r, c) => a.lakes.some((l) => l.row === r && l.col === c);
const ormanMu = (a, r, c) => a.forests.some((f) => f.row === r && f.col === c);
const acikMi = (a, r, c) => !golMu(a, r, c) && !ormanMu(a, r, c);

// Bayraklarin durdugu kareler secilemez, yoksa senaryo kazara bayrakla carpisir.
const YASAK = ["0,10", "0,0"];
const serbest = (r, c) => !YASAK.includes(`${r},${c}`);

// Yan yana iki ACIK kare (hedef, saldiranin solunda). Acik alan senaryolari ve
// orman senaryolarinin KONTROL GRUBU icin.
function acikCift(a) {
  for (let r = 0; r < 10; r++) for (let c = 1; c < 11; c++)
    if (acikMi(a, r, c) && acikMi(a, r, c - 1) && serbest(r, c) && serbest(r, c - 1))
      return { saldiran: { row: r, col: c }, hedef: { row: r, col: c - 1 } };
  throw new Error("acik cift bulunamadi");
}
// Hedefi ORMAN olan cift: saldiran hedefin sagindaki acik karede.
function ormanCift(a) {
  for (const f of a.forests) {
    const { row, col } = f;
    if (col + 1 > 10) continue;
    if (acikMi(a, row, col + 1) && serbest(row, col) && serbest(row, col + 1))
      return { saldiran: { row, col: col + 1 }, hedef: { row, col } };
  }
  throw new Error("orman cifti bulunamadi");
}

// Sabit tohum: butun odalar AYNI araziyi alsin. Arazi her oyunda uretildigi
// icin, tohum olmasaydi her senaryo baska bir tahtada calisir ve asagida bir
// kez secilen kareler gecersiz olurdu.
const SEED = 20260729;

function connect(room, name, token, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${name}&token=${token}&seed=${SEED}`);
  ws.messages = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    ws.messages.push(m);
    if (m.type === "move_executed" && m.combatResult) {
      const c = m.combatResult;
      console.log(`  [${etiket}] <- ${c.outcome} saldiran=${c.attackerName ?? "GIZLI"} savunan=${c.defenderName ?? "GIZLI"}`);
    } else if (m.type === "move_error" || m.type === "game_over" || m.type === "error") {
      console.log(`  [${etiket}] <- ${m.type}${m.code ? " " + m.code : ""}${m.reason ? " reason=" + m.reason : ""}`);
    }
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
    await sleep(80);
  }
  return null;
};

let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  GECTI " : "  KALDI "} ${label} ${extra}`);
  if (!ok) fails++;
};

// Her senaryo AYNI seed ile oda kuruyor: arazi hepsinde ayni, dolayisiyla
// yukarida bir kez hesaplanan kareler butun senaryolarda gecerli. Seed olmasaydi
// her oda farkli arazi alir ve kareler senaryo basina yeniden hesaplanmasi
// gerekirdi.
async function kur(red, blue) {
  const room = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tok = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const p1 = await connect(room, "Oyuncu1", "t1-" + tok, "P1");
  const p2 = await connect(room, "Oyuncu2", "t2-" + tok, "P2");
  await sleep(700);
  // turnTime 300sn: tur saati senaryoya karismasin.
  p1.send(JSON.stringify({ type: "setup_complete", placedPieces: red, turnTime: 300 }));
  await sleep(250);
  p2.send(JSON.stringify({ type: "setup_complete", placedPieces: blue }));
  await sleep(1000);
  if (!(await waitFor(p1, "both_setup_complete"))) check(false, "kurulum tamamlanamadi");
  return { p1, p2 };
}

// Hamleyi yollar ve IKI oyuncunun gorduglerini birlikte dondurur. Sizinti
// kontrolu ancak iki tarafi karsilastirinca anlamli.
async function hamle(p1, p2, saldiran, from, to) {
  p1.messages.length = 0; p2.messages.length = 0;
  saldiran.send(JSON.stringify({ type: "move", from, to }));
  await sleep(900);
  return { m1: await waitFor(p1, "move_executed"), m2: await waitFor(p2, "move_executed") };
}

const kapat = (...s) => { s.forEach((x) => x.close()); return sleep(400); };
// buildBoardView bos kareye null, orman karesine "FOREST" koyuyor; ikisi de "tas yok".
const bos = (h) => h === null || h === "FOREST";

console.log(`Hedef: ${BASE}\n`);

// ─── Kareleri arazinin KENDISINDEN sec ─────────────────────────────────────
// Bir kesif odasi acilip arazi okunuyor. Sabit koordinat yazsaydik, uretici her
// degistiginde test sessizce yanlis seyi olcerdi (orn. "acik alan" sandigimiz
// kare orman cikar ve gizleme kontrolu anlamsizlasirdi).
let ACIK_SALDIRAN, ACIK_HEDEF, ORMAN_SALDIRAN, ORMAN_HEDEF;
{
  const kesifOda = "TAK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const k1 = await connect(kesifOda, "Kesif1", "k1-" + Date.now(), "kesif");
  const k2 = await connect(kesifOda, "Kesif2", "k2-" + Date.now(), "kesif");
  await sleep(800);
  const arazi = (await waitFor(k2, "room_joined"))?.roomState?.terrain;
  check(!!arazi, "arazi okundu (kesif odasi)");
  const ac = acikCift(arazi), or = ormanCift(arazi);
  ACIK_SALDIRAN = ac.saldiran; ACIK_HEDEF = ac.hedef;
  ORMAN_SALDIRAN = or.saldiran; ORMAN_HEDEF = or.hedef;
  console.log(`  acik: ${ACIK_SALDIRAN.row},${ACIK_SALDIRAN.col} -> ${ACIK_HEDEF.row},${ACIK_HEDEF.col}` +
              `   orman: ${ORMAN_SALDIRAN.row},${ORMAN_SALDIRAN.col} -> ${ORMAN_HEDEF.row},${ORMAN_HEDEF.col}`);
  check(ormanMu(arazi, ORMAN_HEDEF.row, ORMAN_HEDEF.col), "orman hedefi gercekten orman");
  check(acikMi(arazi, ACIK_HEDEF.row, ACIK_HEDEF.col), "acik hedef gercekten acik");
  k1.close(); k2.close(); await sleep(300);
}

// ─── 1) Rutbe siralamasi: yuksek olan kazanir ──────────────────────────────
// Ayni zamanda ORMAN testlerinin kontrol grubu: acik alanda kazanan saldiran
// ACIGA CIKAR. 8. senaryodaki "null" bunun tersi oldugu icin anlamli.
console.log("=== 1) YUKSEK RUTBE ALCAGI YENER (acik alan) ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Üsteğmen", 5, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col)],
    [MB, mavi("m1", "Er", 2, ACIK_HEDEF.row, ACIK_HEDEF.col)]);
  const { m1, m2 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "ATTACKER_WINS", "rutbe 5 > rutbe 2, saldiran kazandi", `(${m1?.combatResult?.outcome})`);
  check(m1?.combatResult?.defenderName === "Er", "saldiran, yendigi tasi ogrendi", `(${m1?.combatResult?.defenderName})`);
  check(m2?.combatResult?.attackerName === "Üsteğmen" && m2?.combatResult?.attackerRank === 5,
        "acik alanda kazanan saldiran ACIGA CIKTI", `(${m2?.combatResult?.attackerName}/${m2?.combatResult?.attackerRank})`);
  // Kimin oynadigi gizli bilgi degil (tahtada zaten gorunuyor); istemci carpisma
  // gecmisinde taslari buna gore renklendiriyor.
  check(m1?.attackerTeam === "1. Oyuncu" && m2?.attackerTeam === "1. Oyuncu",
        "saldiranin takimi iki tarafa da bildirildi", `(${m1?.attackerTeam}/${m2?.attackerTeam})`);
  const kare = m2?.opponentBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col];
  check(kare?.revealed === true && kare?.rank === 5, "tahtada da acik gorunuyor", `(revealed=${kare?.revealed} rank=${kare?.rank})`);
  check(bos(m2?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]), "yenilen tas tahtadan kalkti");
  await kapat(p1, p2);
}

// ─── 2) Zayif saldiran olur, savunan yerinde kalir ─────────────────────────
console.log("\n=== 2) ZAYIF SALDIRAN OLUR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Binbaşı", 7, ACIK_HEDEF.row, ACIK_HEDEF.col + 1), kirmizi("r2", "Er", 2, 9, 10)],
    [MB, mavi("m1", "Er", 2, ACIK_HEDEF.row, ACIK_HEDEF.col)]);
  // Sira once kirmizida; maviye gecmesi icin zararsiz bir hamle.
  await hamle(p1, p2, p1, { row: 9, col: 10 }, { row: 9, col: 9 });
  const { m1, m2 } = await hamle(p1, p2, p2, ACIK_HEDEF, ACIK_SALDIRAN);
  check(m2?.combatResult?.outcome === "DEFENDER_WINS", "rutbe 2 < rutbe 7, saldiran oldu", `(${m2?.combatResult?.outcome})`);
  check(m2?.attackerTeam === "2. Oyuncu", "saldiran takim mavi olarak bildirildi", `(${m2?.attackerTeam})`);
  check(m2?.combatResult?.defenderName === "Binbaşı", "olen saldiranin sahibi savunani ogrendi", `(${m2?.combatResult?.defenderName})`);
  check(m1?.myBoard?.[ACIK_SALDIRAN.row]?.[ACIK_SALDIRAN.col]?.name === "Binbaşı", "savunan yerinde kaldi");
  check(bos(m1?.opponentBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]) && bos(m1?.opponentBoard?.[ACIK_SALDIRAN.row]?.[ACIK_SALDIRAN.col]),
        "olen saldiran tahtadan tamamen kalkti");
  await kapat(p1, p2);
}

// ─── 3) Bomba: uzerine gelen tas OLR, bomba da yok olur ────────────────────
console.log("\n=== 3) BOMBA HER IKI TASI DA YOK EDER ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Er", 2, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col)],
    [MB, mavi("m1", "Bomba", 11, ACIK_HEDEF.row, ACIK_HEDEF.col, { movable: false })]);
  const { m1, m2 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "BOTH_LOSE", "bombaya basan tas oldu", `(${m1?.combatResult?.outcome})`);
  check(bos(m2?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]), "bomba da yok oldu (kare bosaldi)");
  check(bos(m2?.opponentBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]), "basan tas tahtadan kalkti");
  await kapat(p1, p2);
}

// ─── 4) Istihkamci (MINER) bombayi imha eder ve kareye gecer ───────────────
// Sunucu bunu ISIMLE karsilastiriyor (name === "Bomba"), bu yuzden istemci taş
// adini asla cevirmiyor (client/constants.ts:50). Ad degisirse kural sessizce kirilir.
// Eski kural korunuyor: Istihkamci imha eder, DIGER taslar bombayla birlikte olur.
console.log("\n=== 4) ISTIHKAMCI BOMBAYI IMHA EDER ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "İstihkamcı", 1, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col, { special: "MINER" })],
    [MB, mavi("m1", "Bomba", 11, ACIK_HEDEF.row, ACIK_HEDEF.col, { movable: false })]);
  const { m1, m2 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "ATTACKER_WINS", "rutbe 1 olmasina ragmen bombayi aldi", `(${m1?.combatResult?.outcome})`);
  check(bos(m2?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]), "bomba tahtadan kalkti");
  check(m2?.opponentBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]?.name === "İstihkamcı", "istihkamci kareye gecti");
  // Istemci "Istihkamci Bombayi imha etti" metnini bu alana gore seciyor; gelmezse
  // yerine "rutbesi buyuk olan yendi" basiliyordu (1 > 11 diyen yanlis cumle).
  check(m1?.combatResult?.attackerSpecial === "MINER" && m2?.combatResult?.attackerSpecial === "MINER",
        "ozel yetenek iki tarafa da bildirildi", `(${m1?.combatResult?.attackerSpecial}/${m2?.combatResult?.attackerSpecial})`);
  await kapat(p1, p2);
}

// ─── 5) Casus Maresal'e SALDIRIRSA kazanir ────────────────────────────────
console.log("\n=== 5) CASUS MARESAL'I ALIR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Casus", 1, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col, { special: "SPY" })],
    [MB, mavi("m1", "Mareşal", 10, ACIK_HEDEF.row, ACIK_HEDEF.col)]);
  const { m1 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "ATTACKER_WINS", "casus maresali yendi", `(${m1?.combatResult?.outcome})`);
  check(m1?.combatResult?.defenderName === "Mareşal", "yenilen maresal oldugu bildirildi", `(${m1?.combatResult?.defenderName})`);
  check(m1?.combatResult?.attackerSpecial === "SPY", "casus yetenegi bildirildi", `(${m1?.combatResult?.attackerSpecial})`);
  await kapat(p1, p2);
}

// ─── 6) Maresal Casus'a saldirirsa da Casus kazanir (kural iki yonlu) ─────
console.log("\n=== 6) MARESAL SALDIRIRSA BILE CASUS KAZANIR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Mareşal", 10, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col)],
    [MB, mavi("m1", "Casus", 1, ACIK_HEDEF.row, ACIK_HEDEF.col, { special: "SPY" })]);
  const { m1, m2 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "DEFENDER_WINS", "savunan casus maresali yendi", `(${m1?.combatResult?.outcome})`);
  check(m2?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]?.name === "Casus", "casus tahtada kaldi");
  check(bos(m2?.myBoard?.[ACIK_SALDIRAN.row]?.[ACIK_SALDIRAN.col]), "maresal tahtadan kalkti");
  await kapat(p1, p2);
}

// ─── 7) Esit rutbe: ikisi de yasar, saldiran geri doner ───────────────────
// Istemcinin yerel modundaki davranisla ayni (App.tsx:503) — kasitli kural,
// klasik Stratego'daki "ikisi de olur" degil.
console.log("\n=== 7) ESIT RUTBE: IKISI DE YASAR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Teğmen", 4, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col)],
    [MB, mavi("m1", "Teğmen", 4, ACIK_HEDEF.row, ACIK_HEDEF.col)]);
  const { m1, m2 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "EQUAL_RANK", "esit rutbe bildirildi", `(${m1?.combatResult?.outcome})`);
  check(m1?.myBoard?.[ACIK_SALDIRAN.row]?.[ACIK_SALDIRAN.col]?.name === "Teğmen", "saldiran ESKI karesine dondu");
  check(bos(m1?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]), "hedef kareye gecmedi");
  check(m2?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]?.name === "Teğmen", "savunan da hayatta");
  check(m2?.opponentBoard?.[ACIK_SALDIRAN.row]?.[ACIK_SALDIRAN.col]?.rank === 4, "iki tas da aciga cikti", `(${m2?.opponentBoard?.[ACIK_SALDIRAN.row]?.[ACIK_SALDIRAN.col]?.rank})`);
  await kapat(p1, p2);
}

// ─── 8) ORMAN: kazanan saldiran GIZLI kalir ───────────────────────────────
// Ayni carpisma acik alanda (1. senaryo) saldirani aciga cikariyordu. Buradaki
// null'lar bu yuzden "alan hic dolmuyor" degil, kuralin isledigi anlamina geliyor.
console.log("\n=== 8) ORMANDA KAZANAN SALDIRAN GIZLI KALIR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Üsteğmen", 5, ORMAN_SALDIRAN.row, ORMAN_SALDIRAN.col)],
    [MB, mavi("m1", "Er", 2, ORMAN_HEDEF.row, ORMAN_HEDEF.col)]);
  const { m1, m2 } = await hamle(p1, p2, p1, ORMAN_SALDIRAN, ORMAN_HEDEF);
  check(m1?.combatResult?.outcome === "ATTACKER_WINS", "saldiran kazandi", `(${m1?.combatResult?.outcome})`);
  check(m1?.combatResult?.attackerName === "Üsteğmen", "saldiran KENDI tasini gormeye devam ediyor", `(${m1?.combatResult?.attackerName})`);
  check(m2?.combatResult?.attackerName === null && m2?.combatResult?.attackerRank === null,
        "rakip saldiranin kim oldugunu OGRENEMEDI",
        `(${m2?.combatResult?.attackerName}/${m2?.combatResult?.attackerRank})`);
  // Ozel yetenek de kimlik: "MINER" sizsa rakip tasin Istihkamci oldugunu anlardi.
  check(m2?.combatResult?.attackerSpecial === null, "ozel yetenek de sizmiyor", `(${m2?.combatResult?.attackerSpecial})`);
  const kare = m2?.opponentBoard?.[ORMAN_HEDEF.row]?.[ORMAN_HEDEF.col];
  check(kare?.revealed === false && kare?.rank === undefined && kare?.name === undefined,
        "tahtada da rutbe/isim sizmiyor", `(${JSON.stringify(kare)})`);
  await kapat(p1, p2);
}

// ─── 9) ORMAN: bombaya basan da gizli kalir, bomba da yok olur ─────────────
// Saldiran "kaybettim" bilir ama neye kaybettigini bilmez; bomba ORMANDA
// oldugu icin kimligi acilmaz (3. senaryoda ayni carpisma acik alandaydi).
console.log("\n=== 9) ORMANDAKI BOMBA GIZLI KALIR VE YOK OLUR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Er", 2, ORMAN_SALDIRAN.row, ORMAN_SALDIRAN.col)],
    [MB, mavi("m1", "Bomba", 11, ORMAN_HEDEF.row, ORMAN_HEDEF.col, { movable: false })]);
  const { m1, m2 } = await hamle(p1, p2, p1, ORMAN_SALDIRAN, ORMAN_HEDEF);
  check(m1?.combatResult?.outcome === "BOTH_LOSE", "saldiran oldu", `(${m1?.combatResult?.outcome})`);
  check(m1?.combatResult?.defenderName === null && m1?.combatResult?.defenderRank === null,
        "neye kaybettigini OGRENEMEDI", `(${m1?.combatResult?.defenderName}/${m1?.combatResult?.defenderRank})`);
  check(bos(m1?.opponentBoard?.[ORMAN_HEDEF.row]?.[ORMAN_HEDEF.col]), "bomba da yok oldu (kare bosaldi)");
  check(m2?.combatResult?.attackerName === "Er", "olen saldiran ise aciga cikti", `(${m2?.combatResult?.attackerName})`);
  await kapat(p1, p2);
}

// ─── 10) Bayrak alinirsa oyun biter ───────────────────────────────────────
// NOT: sunucu bayragi ACIGA CIKARMIYOR (GAME_OVER dali targetPiece.revealed'i
// set etmiyor), yani ALAN oyuncuya defenderName null gidiyor. Istemci bunu
// outcome === "GAME_OVER" oldugu icin "Bayrak" diye turetiyor; carpisma
// gecmisinde "???" yazmasin diye. Burada bu alan bilerek olculmuyor.
console.log("\n=== 10) BAYRAK ALINIRSA OYUN BITER ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Er", 2, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col)],
    [mavi("m1", "Bayrak", 0, ACIK_HEDEF.row, ACIK_HEDEF.col, { movable: false })]);
  const { m1 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "GAME_OVER", "carpisma sonucu GAME_OVER", `(${m1?.combatResult?.outcome})`);
  check(m1?.nextPhase === "GAME_OVER" && m1?.winner === "1. Oyuncu", "faz ve kazanan dogru", `(${m1?.nextPhase}/${m1?.winner})`);
  const bitis = await waitFor(p2, "game_over");
  check(bitis?.reason === "FLAG" && bitis?.winner === "1. Oyuncu", "kaybedene de game_over ulasti", `(${bitis?.reason}/${bitis?.winner})`);
  await kapat(p1, p2);
}

console.log(`\n=== SONUC: ${fails === 0 ? "TUM KONTROLLER GECTI" : fails + " KONTROL KALDI"} ===`);
process.exit(fails === 0 ? 0 : 1);
