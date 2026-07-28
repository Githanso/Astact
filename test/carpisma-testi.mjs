// Astact — CARPISMA kurallari ve bilgi sizintisi.
//
// resolveCombat (src/server.ts) oyunun kalbi ve bugune kadar otomatik testi yoktu:
// protokol-testi hamle kurallarinda duruyor, carpismaya hic girmiyor.
//
// Iki ayri sey olculuyor:
//   1) KIM KAZANIR  — rutbe siralamasi, Bomba/Istihkamci, Casus/Maresal, esit rutbe.
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

// (5,3) ve (5,2) acik alan; (5,5) ORMAN, (5,6) degil. 5. satirda gol yok
// (goller 1-2 ve 7-8. satirlarda). Kirmizi sola ilerler, mavi saga.
const ACIK_SALDIRAN = { row: 5, col: 3 }, ACIK_HEDEF = { row: 5, col: 2 };
const ORMAN_SALDIRAN = { row: 5, col: 6 }, ORMAN_HEDEF = { row: 5, col: 5 };

function connect(room, name, token, etiket) {
  const ws = new WebSocket(`${BASE}?room=${room}&name=${name}&token=${token}`);
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

// ─── 3) Bomba: uzerine gelen normal tasi yok eder, kendisi kalir ───────────
console.log("\n=== 3) BOMBA NORMAL TASI YOK EDER ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Er", 2, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col)],
    [MB, mavi("m1", "Bomba", 11, ACIK_HEDEF.row, ACIK_HEDEF.col, { movable: false })]);
  const { m1, m2 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "DEFENDER_WINS", "bombaya basan tas oldu", `(${m1?.combatResult?.outcome})`);
  check(m2?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]?.name === "Bomba", "bomba yerinde kaldi (sabit)");
  check(bos(m2?.opponentBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]), "basan tas tahtadan kalkti");
  await kapat(p1, p2);
}

// ─── 4) Istihkamci (MINER) bombayi imha eder ve kareye gecer ───────────────
// Sunucu bunu ISIMLE karsilastiriyor (name === "Bomba"), bu yuzden istemci taş
// adini asla cevirmiyor (client/constants.ts:50). Ad degisirse kural sessizce kirilir.
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

// ─── 6) Maresal Casus'a saldirirsa Casus olur (kural tek yonlu) ───────────
console.log("\n=== 6) MARESAL SALDIRIRSA CASUS OLUR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Mareşal", 10, ACIK_SALDIRAN.row, ACIK_SALDIRAN.col)],
    [MB, mavi("m1", "Casus", 1, ACIK_HEDEF.row, ACIK_HEDEF.col, { special: "SPY" })]);
  const { m1, m2 } = await hamle(p1, p2, p1, ACIK_SALDIRAN, ACIK_HEDEF);
  check(m1?.combatResult?.outcome === "ATTACKER_WINS", "casus avantaji yalnizca SALDIRIRKEN gecerli", `(${m1?.combatResult?.outcome})`);
  check(bos(m2?.myBoard?.[ACIK_HEDEF.row]?.[ACIK_HEDEF.col]), "casus tahtadan kalkti");
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

// ─── 9) ORMAN: kazanan SAVUNAN da gizli kalir ─────────────────────────────
// Saldiran "kaybettim" bilir ama neye kaybettigini bilmez. 3. senaryoda ayni
// carpisma acik alanda bombayi ele veriyordu.
console.log("\n=== 9) ORMANDA KAZANAN SAVUNAN GIZLI KALIR ===");
{
  const { p1, p2 } = await kur(
    [KB, kirmizi("r1", "Er", 2, ORMAN_SALDIRAN.row, ORMAN_SALDIRAN.col)],
    [MB, mavi("m1", "Bomba", 11, ORMAN_HEDEF.row, ORMAN_HEDEF.col, { movable: false })]);
  const { m1, m2 } = await hamle(p1, p2, p1, ORMAN_SALDIRAN, ORMAN_HEDEF);
  check(m1?.combatResult?.outcome === "DEFENDER_WINS", "saldiran oldu", `(${m1?.combatResult?.outcome})`);
  check(m1?.combatResult?.defenderName === null && m1?.combatResult?.defenderRank === null,
        "neye kaybettigini OGRENEMEDI", `(${m1?.combatResult?.defenderName}/${m1?.combatResult?.defenderRank})`);
  check(m1?.opponentBoard?.[ORMAN_HEDEF.row]?.[ORMAN_HEDEF.col]?.name === undefined, "tahtada da bomba gizli");
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
