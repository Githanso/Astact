import { DurableObject } from "cloudflare:workers";

interface Env {
  ASSETS: Fetcher;
  GAME_ROOM: DurableObjectNamespace;
}

// ─── Game Room Durable Object (per-room, Hibernation API) ─────────────────

type Player = "1. Oyuncu" | "2. Oyuncu";

interface PieceData {
  id: string; name: string; rank: number; owner: Player;
  special: string | null; movable: boolean; revealed: boolean; hasMoved: boolean;
  row: number; col: number;
  // Izci gorevini SON kullandiginda sahibinin kacinci turuydu (turnCount degeri).
  // null/undefined = hic kullanmadi, hazir. Bekleme suresi buradan olculuyor:
  // sahibi SCOUT_COOLDOWN tur daha oynayinca hak yenileniyor.
  scoutAt?: number | null;
}

interface StoredPlayer {
  id: string; name: string; team: Player; ready: boolean; pieces: PieceData[];
}

interface RoomData {
  code: string;
  players: [StoredPlayer | null, StoredPlayer | null];
  playerTokens: [string | null, string | null];
  disconnectedAt: [number | null, number | null];
  gamePhase: "LOBBY" | "SETUP" | "PLAY_RED" | "PLAY_BLUE" | "GAME_OVER";
  winner: string | null;
  // Oyun sonu gerekcesi saklanmali: kopan oyuncu geri dondugunde game_state_restored
  // ile "neden kaybettim" metnini alabilsin. Saklanmazsa varsayilan (bayrak) metni
  // cikiyordu — oysa kaybetme sebebi baglantinin donmemesiydi.
  gameOverReason: GameOverReason | null;
  restartRequested: [boolean, boolean];
  // Tur saati SUNUCUDA tutulur. Istemcideki geri sayim yalnizca gorseldir; sirayi
  // istemci cevirirse iki taraf ayrisir (istemci "sira bende" der, sunucu reddeder).
  // null = tur saati islemiyor (LOBBY/SETUP/GAME_OVER).
  turnStartedAt: number | null;
  turnTimeMs: number;
  // Suresi doldugu icin kacirilan tur sayisi (slot basina, oyun boyunca birikimli).
  // Iki oyuncu da sinira ulasirsa oyun berabere biter — kimse oynamiyorsa masa
  // sonsuza kadar acik kalmasin diye.
  missedTurns: [number, number];
  // Oyunun bittigi an. Biten odalar depoda suresiz durmasin diye ROOM_TTL_MS
  // sonra siliniyor; bu sure oyunculara sonucu gorup "yeniden baslat" demeleri
  // icin birakiliyor. Yeniden baslatilinca null'a doner.
  gameOverAt: number | null;
  // Her oyuncunun OYNADIGI tur sayisi (hamle veya Izci gorevi). Izci bekleme
  // suresi bununla olculuyor. Zaman asimiyla kacirilan tur SAYILMIYOR: oyuncu
  // bir sey yapmadi, bekleme suresini bosuna ilerletmemeli.
  turnCount: [number, number];
  // Bu odanin arazisi. Her oyunda yeniden uretiliyor (LOBBY->SETUP gecisinde ve
  // yeniden baslatmada). Tek dogruluk kaynagi burasi: istemci artik kendi
  // sabitinden degil bu listeden ciziyor.
  terrain: Arazi;
  seed: number;
}

// Oyunun neden bittigi. Istemci ekrandaki metni buna gore seciyor; "kazandin"
// ile "rakip ayrildigi icin kazandin" ayni sey degil.
type GameOverReason = "FLAG" | "TIMEOUT_DRAW" | "OPPONENT_LEFT";

const BOARD_ROWS = 10, BOARD_COLS = 11;
// Tarafsiz bant: 4-6. sutunlar. Dizilim bolgeleri mavi 0-3, kirmizi 7-10.
const BANT_BAS = 4, BANT_SON = 6;

interface Arazi {
  lakes: { row: number; col: number }[];
  forests: { row: number; col: number; density: number }[];
}

// Arazi ARTIK SABIT DEGIL: her oyunda uretiliyor (bkz. araziUret). Asagidaki
// liste yalnizca GERIYE DONUK uyum icin duruyor — arazisi olmayan eski odalara
// loadRoom migration'inda bu atanıyor.
const ESKI_SABIT_ARAZI: Arazi = {
  lakes: [
    { row: 1, col: 5 }, { row: 1, col: 6 },
    { row: 2, col: 5 }, { row: 2, col: 6 },
    { row: 7, col: 4 }, { row: 7, col: 5 },
    { row: 8, col: 4 }, { row: 8, col: 5 },
  ],
  forests: [
    { row: 0, col: 4, density: 3 }, { row: 1, col: 4, density: 2 }, { row: 2, col: 4, density: 3 },
    { row: 3, col: 4, density: 2 }, { row: 3, col: 6, density: 1 },
    { row: 4, col: 5, density: 3 },
    { row: 5, col: 5, density: 2 },
    { row: 6, col: 6, density: 2 },
    { row: 7, col: 6, density: 3 }, { row: 8, col: 6, density: 2 }, { row: 9, col: 6, density: 3 },
  ],
};

// Arazi sozlesmesi. Degistirilirse test/protokol-testi.mjs senaryo 3b de guncellenmeli.
const GOL_KARE = 8;          // toplam gol karesi (aynalanmis)
const BANT_ORMAN = 10;       // tarafsiz banttaki orman (aynalanmis)
const BOLGE_ORMAN = 10;      // HER oyuncunun bolgesindeki orman

// 180 derece donme: (r,c) -> (9-r, 10-c). Kirmizinin bolgesi maviye, bandin ust
// yarisi alt yarisina esleniyor. Ayna (sol-sag) yerine DONME secildi: ayna
// simetride bir oyuncu koridora yandan girerken digeri golleri dolasmak zorunda
// kalirdi (bkz. README, tarafsiz bant bolumu).
const dondur = (r: number, c: number) => ({ row: BOARD_ROWS - 1 - r, col: BOARD_COLS - 1 - c });

// Deterministik PRNG (mulberry32). Math.random KULLANILMIYOR: ayni seed ayni
// tahtayi vermeli, testler ve hata ayiklama buna dayaniyor.
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Araziyi uretir. Yalnizca UST yari / KIRMIZI bolge uretilip 180 derece
// dondurulerek eslenir; boylece iki oyuncu birebir ayni zorlukla oynar.
//
// BAGLANTI KONTROLU YOK, gerekmiyor: sol-sag gecisi tamamen kapatmak icin gol
// bariyerinin 0. satirdan 9. satira kadar HER SATIRA degmesi gerekir, yani en az
// BOARD_ROWS (10) kare. GOL_KARE 8 oldugu icin bu imkansiz. GOL_KARE 10 veya
// uzerine cikarilirsa bu gerekce duser ve gercek bir gecilebilirlik kontrolu
// eklenmelidir.
function araziUret(seed: number): Arazi {
  const rnd = prng(seed);
  const secim = <T,>(dizi: T[]): T => dizi[Math.floor(rnd() * dizi.length)];
  const dolu = new Set<string>();
  const anahtar = (r: number, c: number) => `${r},${c}`;

  const lakes: Arazi["lakes"] = [];
  const forests: Arazi["forests"] = [];
  // Her ekleme kareyi VE 180 derece esini birlikte isaretler; simetri boylece
  // sonradan dogrulanacak bir sey degil, insaat geregi garanti.
  const isaretle = (r: number, c: number) => {
    const e = dondur(r, c);
    dolu.add(anahtar(r, c)); dolu.add(anahtar(e.row, e.col));
    return e;
  };
  const golEkle = (r: number, c: number) => {
    const e = isaretle(r, c);
    lakes.push({ row: r, col: c }, { row: e.row, col: e.col });
  };
  const ormanEkle = (r: number, c: number) => {
    const e = isaretle(r, c);
    // Yogunluk yalnizca kac agac cizilecegini belirler; es kareler ayri yogunluk
    // alabilir, kural etkilenmiyor.
    forests.push({ row: r, col: c, density: 1 + Math.floor(rnd() * 3) },
                 { row: e.row, col: e.col, density: 1 + Math.floor(rnd() * 3) });
  };
  const bos = (r: number, c: number) => {
    const e = dondur(r, c);
    return !dolu.has(anahtar(r, c)) && !dolu.has(anahtar(e.row, e.col));
  };

  // ── Goller: ust yarida GOL_KARE/2 kare uretilip aynalaniyor ───────────────
  // Blok boyutlari {1,2,4}. Toplam iki esit yariya bolundugu icin kullanicinin
  // ornegindeki 4+2+2 gibi tek sayili bilesimler cikmaz; olasi bilesimler
  // 4+4, 2+2+2+2, (2+1+1)x2, (1+1+1+1)x2.
  let kalanGol = GOL_KARE / 2;
  let guvenlik = 0;
  while (kalanGol > 0 && guvenlik++ < 200) {
    const boy = secim([1, 2, 4].filter(b => b <= kalanGol));
    // 4 -> 2x2, 2 -> dikey ikili, 1 -> tek kare
    const yukseklik = boy === 4 ? 2 : boy === 2 ? 2 : 1;
    const genislik = boy === 4 ? 2 : 1;
    const r0 = Math.floor(rnd() * (5 - yukseklik + 1));               // ust yari: 0..4
    const c0 = BANT_BAS + Math.floor(rnd() * (BANT_SON - BANT_BAS + 1 - genislik + 1));
    let uygun = true;
    for (let r = r0; r < r0 + yukseklik && uygun; r++)
      for (let c = c0; c < c0 + genislik && uygun; c++)
        if (!bos(r, c)) uygun = false;
    if (!uygun) continue;
    for (let r = r0; r < r0 + yukseklik; r++)
      for (let c = c0; c < c0 + genislik; c++) golEkle(r, c);
    kalanGol -= boy;
  }

  // ── Tarafsiz bant ormani: ust yarida BANT_ORMAN/2 kare ────────────────────
  // Bant hucrelerinde donmenin sabit noktasi yok (r=4.5, c=5 tam sayi degil),
  // yani her hucre bir esle ciftlenir; sayi her zaman tam tutar.
  let kalanBant = BANT_ORMAN / 2;
  guvenlik = 0;
  while (kalanBant > 0 && guvenlik++ < 500) {
    const r = Math.floor(rnd() * 5);
    const c = BANT_BAS + Math.floor(rnd() * (BANT_SON - BANT_BAS + 1));
    if (!bos(r, c)) continue;
    ormanEkle(r, c);
    kalanBant--;
  }

  // ── Oyuncu bolgesi ormani: kirmizida BOLGE_ORMAN, aynasi maviye ───────────
  let kalanBolge = BOLGE_ORMAN;
  guvenlik = 0;
  while (kalanBolge > 0 && guvenlik++ < 500) {
    const r = Math.floor(rnd() * BOARD_ROWS);
    const c = 7 + Math.floor(rnd() * 4);
    if (!bos(r, c)) continue;
    ormanEkle(r, c);
    kalanBolge--;
  }

  return { lakes, forests };
}
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TAK-"; for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}
const DISCONNECT_TIMEOUT_MS = 60_000;
// Istemcideki TIMER_PRESETS.NORMAL.turnTime ile ayni. Oda kurucusu setup_complete
// icinde kendi presetini bildirir; bildirmezse bu deger kullanilir.
const DEFAULT_TURN_TIME_MS = 35_000;
const MIN_TURN_TIME_MS = 5_000, MAX_TURN_TIME_MS = 600_000;
// Istemcideki constants.ts MAX_MISSED_TURNS ile AYNI olmali.
const MAX_MISSED_TURNS = 3;
// Izci gorevini kullandiktan sonra hakkin yenilenmesi icin sahibinin oynamasi
// gereken tur sayisi. Ilk kullanim bedava; bekleme ondan SONRA basliyor.
// Istemcideki constants.ts SCOUT_COOLDOWN ile AYNI olmali.
const SCOUT_COOLDOWN = 10;
// Biten oyunun odasi bu sure sonra siliniyor. Oyunculara sonucu gorup yeniden
// baslatmalari icin makul bir pencere; sonrasinda oda depoda yer kaplamasin.
const ROOM_TTL_MS = 10 * 60_000;
function isPlayPhase(phase: RoomData["gamePhase"]): boolean {
  return phase === "PLAY_RED" || phase === "PLAY_BLUE";
}

export class GameRoom extends DurableObject {
  room: RoomData | null = null;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  private async loadRoom(): Promise<RoomData | null> {
    if (!this.room) {
      const stored = await this.ctx.storage.get<RoomData>("room");
      if (stored) {
        // Tur saati alanlari sonradan eklendi; once kaydedilmis odalarda yoklar.
        if (typeof stored.turnTimeMs !== "number") stored.turnTimeMs = DEFAULT_TURN_TIME_MS;
        if (stored.turnStartedAt === undefined) stored.turnStartedAt = isPlayPhase(stored.gamePhase) ? Date.now() : null;
        if (!Array.isArray(stored.missedTurns)) stored.missedTurns = [0, 0];
        if (stored.gameOverReason === undefined) stored.gameOverReason = stored.winner ? "FLAG" : null;
        if (stored.gameOverAt === undefined) stored.gameOverAt = stored.gamePhase === "GAME_OVER" ? Date.now() : null;
        // Izci bekleme sayaci sonradan eklendi. Eski odalarda tas basina
        // `scoutUsed: true` vardi; onu "0. turda kullanmis" sayiyoruz, boylece
        // bekleme suresi dogal olarak isliyor ve hak kaybolmuyor.
        if (!Array.isArray(stored.turnCount)) stored.turnCount = [0, 0];
        // Arazi sonradan uretilir hale geldi; oncesinde kaydedilmis odalar eski
        // SABIT araziyle devam etsin, yoksa oyun ortasinda tahta degisirdi.
        if (!stored.terrain || !Array.isArray(stored.terrain.lakes)) {
          stored.terrain = ESKI_SABIT_ARAZI;
          stored.seed = 0;
        }
        for (const p of stored.players) {
          if (!p) continue;
          for (const tas of p.pieces) {
            if (tas.scoutAt === undefined) tas.scoutAt = (tas as any).scoutUsed ? 0 : null;
          }
        }
        this.room = stored;
      }
    }
    return this.room;
  }

  private async saveRoom() {
    if (this.room) await this.ctx.storage.put("room", this.room);
  }

  private async deleteRoom() {
    this.room = null;
    await this.ctx.storage.delete("room");
  }

  // Istemci panosu takim adiyla gosteriyor; slot dizisi yerine adlandirilmis alan.
  private missedTurnsView(): { red: number; blue: number } {
    const r = this.room;
    return { red: r?.missedTurns[0] ?? 0, blue: r?.missedTurns[1] ?? 0 };
  }

  // Turun bitmesine kalan sure. Istemci geri sayimi bununla hizalar; mutlak zaman
  // damgasi gonderilmiyor cunku istemci saati sunucudan kaymis olabilir.
  private turnRemainingMs(): number | null {
    const r = this.room;
    if (!r || r.turnStartedAt === null || !isPlayPhase(r.gamePhase)) return null;
    return Math.max(0, r.turnStartedAt + r.turnTimeMs - Date.now());
  }

  // Durable Object'te TEK alarm slotu var; hem tur saati hem baglanti kopma
  // zaman asimi ayni slotu paylasiyor. Bu yuzden her degisiklikten sonra en yakin
  // son tarihe yeniden kuruluyor, alarm() icinde hangisinin zamani geldigine bakiliyor.
  private async scheduleAlarm() {
    const r = this.room;
    if (!r) { await this.ctx.storage.deleteAlarm(); return; }
    const deadlines: number[] = [];
    for (let i = 0; i < 2; i++) {
      if (r.disconnectedAt[i] !== null) deadlines.push(r.disconnectedAt[i]! + DISCONNECT_TIMEOUT_MS);
    }
    if (r.turnStartedAt !== null && isPlayPhase(r.gamePhase)) deadlines.push(r.turnStartedAt + r.turnTimeMs);
    if (r.gameOverAt !== null && r.gamePhase === "GAME_OVER") deadlines.push(r.gameOverAt + ROOM_TTL_MS);
    if (deadlines.length === 0) { await this.ctx.storage.deleteAlarm(); return; }
    await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }

  private getWsBySlot(slot: number): WebSocket | null {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as { slot: number } | null;
      if (att && att.slot === slot) return ws;
    }
    return null;
  }

  private getConnectedSlots(): Set<number> {
    const slots = new Set<number>();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as { slot: number } | null;
      if (att !== null) slots.add(att.slot);
    }
    return slots;
  }

  private getRoomState() {
    const r = this.room;
    if (!r) return null;
    const connected = this.getConnectedSlots();
    // Kopan oyuncunun donmesi icin kalan sure — istemci "N sn icinde donmezse"
    // geri sayimini bununla gosteriyor. Bagliysa null.
    const kalan = (slot: number) =>
      r.disconnectedAt[slot] === null ? null : Math.max(0, r.disconnectedAt[slot]! + DISCONNECT_TIMEOUT_MS - Date.now());
    return {
      roomCode: r.code, gamePhase: r.gamePhase,
      // redPresent/bluePresent = SLOT DOLU MU. Istemci bunu "rakip odaya girdi mi"
      // icin kullanmali; redPlayer/bluePlayer yalnizca GORUNEN AD ve oyuncu adi
      // istege bagli oldugu icin adsiz girende null kaliyor. Ad uzerinden varlik
      // cikarilinca adsiz rakip "hic katilmamis" sayiliyordu.
      redPresent: !!r.players[0], bluePresent: !!r.players[1],
      redPlayer: r.players[0]?.name || null, redConnected: connected.has(0) && r.disconnectedAt[0] === null, redReady: !!r.players[0]?.ready,
      bluePlayer: r.players[1]?.name || null, blueConnected: connected.has(1) && r.disconnectedAt[1] === null, blueReady: !!r.players[1]?.ready,
      redDisconnectMs: kalan(0), blueDisconnectMs: kalan(1),
      disconnectTimeoutMs: DISCONNECT_TIMEOUT_MS,
      // Tur suresini oda kurucusu belirliyor; katilan oyuncu daha odaya girerken
      // gercek degeri gormeli, yoksa kendi presetiyle yanlis geri sayim yapar.
      turnTimeMs: r.turnTimeMs,
      // Arazi her oyunda uretildigi icin istemci onu SUNUCUDAN almak zorunda;
      // eskiden kendi sabitinden ciziyordu. roomState tasiyan her mesajda gidiyor.
      terrain: r.terrain,
    };
  }

  // Yeni arazi uretip odaya yazar. Seed saklaniyor ki ayni tahta gerektiginde
  // (hata ayiklama, test) yeniden uretilebilsin.
  private araziYenile(seed?: number) {
    const r = this.room;
    if (!r) return;
    r.seed = seed !== undefined && Number.isFinite(seed) ? (seed >>> 0) : (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0);
    r.terrain = araziUret(r.seed);
  }

  // Arazi sorgulari ODA VERISINDEN okunuyor (eskiden modul sabitiydi). Oda yoksa
  // false donuyor; cagrildiklari her yerde room zaten yuklu.
  private isLake(r: number, c: number): boolean {
    return !!this.room?.terrain.lakes.some(l => l.row === r && l.col === c);
  }
  private isForest(r: number, c: number): boolean {
    return !!this.room?.terrain.forests.some(f => f.row === r && f.col === c);
  }

  // Izci gorevine kac tur kaldi. 0 = hazir. scoutAt null ise hic kullanilmamis.
  private scoutKalan(p: PieceData, oynananTur: number): number {
    if (p.special !== "SCOUT") return 0;
    if (p.scoutAt === null || p.scoutAt === undefined) return 0;
    return Math.max(0, SCOUT_COOLDOWN - (oynananTur - p.scoutAt));
  }

  // oynananTur: taslarin SAHIBININ oynadigi tur sayisi (room.turnCount[slot]).
  // Yalnizca isOwn=true iken anlamli; rakip taslarinda Izci durumu gonderilmiyor.
  private buildBoardView(pieces: PieceData[], isOwn: boolean, oynananTur = 0): any[] {
    const board: any[][] = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
    (this.room?.terrain.lakes ?? []).forEach(l => { board[l.row][l.col] = "LAKE"; });
    for (const p of pieces) {
      // Izci durumu YALNIZCA kendi taslarimizda gonderiliyor: rakibe sizarsa
      // hangi Izcinin hazir oldugu bilgisi ele verilirdi. scoutIn = hakkin
      // yenilenmesine kalan tur (0 = hazir).
      board[p.row][p.col] = isOwn || p.revealed
        ? { id: p.id, name: p.name, rank: p.rank, owner: p.owner, special: p.special, movable: p.movable, revealed: p.revealed, hasMoved: p.hasMoved, position: { row: p.row, col: p.col }, ...(isOwn && p.special === "SCOUT" ? { scoutIn: this.scoutKalan(p, oynananTur) } : {}) }
        : { owner: p.owner, revealed: false, position: { row: p.row, col: p.col } };
    }
    for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) if (board[r][c] === null && this.isForest(r, c)) board[r][c] = "FOREST";
    return board;
  }

  private resolveCombat(a: PieceData, d: PieceData): { outcome: string; attacker: PieceData; defender: PieceData } {
    if (d.name === "Bayrak") return { outcome: "GAME_OVER", attacker: a, defender: d };
    if (d.name === "Bomba") { if (a.special === "MINER") return { outcome: "ATTACKER_WINS", attacker: a, defender: d }; return { outcome: "DEFENDER_WINS", attacker: a, defender: d }; }
    if (a.special === "SPY" && d.rank === 10) return { outcome: "ATTACKER_WINS", attacker: a, defender: d };
    if (a.rank > d.rank) return { outcome: "ATTACKER_WINS", attacker: a, defender: d };
    if (a.rank < d.rank) return { outcome: "DEFENDER_WINS", attacker: a, defender: d };
    return { outcome: "EQUAL_RANK", attacker: a, defender: d };
  }

  private sendTo(slot: number, data: any) {
    const ws = this.getWsBySlot(slot);
    if (ws && ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify(data)); } catch (e) {} }
  }

  private broadcast(data: any, excludeWs?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify(data)); } catch (e) {} }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");

    if (upgradeHeader?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [server, client] = Object.values(pair);
      await this.loadRoom();
      // Bos isim korunur; getRoomState null dondurur ve istemci kendi dilindeki
      // etiketi (t.playerRed / t.playerBlue) gosterir.
      const playerName = url.searchParams.get("name") ?? "";
      const playerToken = url.searchParams.get("token") || "";

      // Try to reconnect by token
      let slot = -1;
      if (this.room) {
        if (this.room.playerTokens[0] === playerToken) slot = 0;
        else if (this.room.playerTokens[1] === playerToken) slot = 1;
      }

      // If no matching token, find available slot
      if (slot < 0) {
        if (!this.room || this.room.gamePhase === "LOBBY") {
          const connected = this.getConnectedSlots();
          if (!connected.has(0)) slot = 0;
          else if (!connected.has(1)) slot = 1;
        }
      }

      if (slot < 0) {
        // Kabul edilmemis bir sokete close()/send() cagrilamaz — eskiden burada
        // dogrudan close() cagriliyordu ve workerd "You must call accept() first"
        // diye patlayip 500 donuyordu (istemci sebebi hic ogrenemiyordu). Ayrica
        // WebSocket dondurulen yanit 101 olmali, 400 degil.
        this.ctx.acceptWebSocket(server);
        try { server.send(JSON.stringify({ type: "room_error", code: "ROOM_FULL", message: "Oda dolu veya oyun devam ediyor" })); } catch (e) {}
        try { server.close(4001, "Oda dolu veya oyun devam ediyor"); } catch (e) {}
        return new Response(null, { status: 101, webSocket: client });
      }

      // Close old WS if this slot had one
      const oldWs = this.getWsBySlot(slot);
      if (oldWs && oldWs !== server) {
        try { oldWs.close(1000, "Yeni bağlantı"); } catch (e) {}
      }

      // Attach slot info to the WS (Hibernation-safe).
      // DIKKAT: serializeAttachment, acceptWebSocket'TEN SONRA cagrilmali.
      // Ters sirada attachment kalici olmuyor; webSocketMessage icinde
      // deserializeAttachment() null donuyor ve gelen mesajlar sessizce dusuyor.
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ slot });

      // Create room if new
      if (!this.room) {
        const code = this.ctx.id.name ?? url.searchParams.get("room") ?? "";
        this.room = { code, players: [null, null], playerTokens: [null, null], disconnectedAt: [null, null], gamePhase: "LOBBY", winner: null, gameOverReason: null, restartRequested: [false, false], turnStartedAt: null, turnTimeMs: DEFAULT_TURN_TIME_MS, missedTurns: [0, 0], gameOverAt: null, turnCount: [0, 0], terrain: ESKI_SABIT_ARAZI, seed: 0 };
      }
      // Yerel bagli degisken: this.room uzerindeki daraltma ara fonksiyon
      // cagrilarinda kayboluyor, bu yuzden non-null referansi bir kez aliyoruz.
      const room = this.room;

      // Set player data
      const team: Player = slot === 0 ? "1. Oyuncu" : "2. Oyuncu";
      if (!room.players[slot]) {
        room.players[slot] = { id: crypto.randomUUID(), name: playerName, team, ready: false, pieces: [] };
        room.playerTokens[slot] = playerToken;
      } else {
        room.players[slot]!.name = playerName;
      }
      room.disconnectedAt[slot] = null;

      if (room.players[0] && room.players[1] && room.gamePhase === "LOBBY") {
        room.gamePhase = "SETUP";
        // Arazi tam BURADA uretiliyor: oyuncular dizilim yaparken tahtayi
        // gormeli. Daha erken uretmek (oda kurulurken) yanlis olmazdi ama daha
        // gec uretmek — orn. oyun baslarken — dizilimi ezberden yaptirirdi.
        // ?seed=... verilirse o tohumla uretilir. Arazi setup_complete'ten ONCE
        // uretildigi icin seed'i mesajla almak gec kalirdi; baglanti URL'i tek
        // makul yol. Pratikte yalnizca TESTLER kullaniyor: sabit tohum = sabit
        // tahta, boylece orman/gol koordinatina dayanan senaryolar yazilabiliyor.
        const seedParam = Number(url.searchParams.get("seed"));
        this.araziYenile(Number.isFinite(seedParam) && url.searchParams.get("seed") ? seedParam : undefined);
      }

      await this.saveRoom();

      if (room.gamePhase === "LOBBY" || (room.players[0] && !room.players[1])) {
        this.sendTo(slot, { type: "room_created", roomCode: room.code, playerTeam: team, roomState: this.getRoomState() });
      } else {
        this.sendTo(slot, { type: "room_joined", roomCode: room.code, playerTeam: team, roomState: this.getRoomState() });
        const otherSlot = slot === 0 ? 1 : 0;
        this.sendTo(otherSlot, { type: room.gamePhase === "SETUP" ? "room_started_setup" : "player_connection_change", roomState: this.getRoomState() });

        // If reconnecting during active game, send full board state
        // (bu dalda gamePhase zaten "LOBBY" olamaz)
        if (room.gamePhase !== "SETUP" && room.players[slot] && room.players[otherSlot]) {
          this.sendTo(slot, {
            type: "game_state_restored",
            gamePhase: room.gamePhase,
            terrain: room.terrain,
            turnTimeMs: room.turnTimeMs,
            // Yeniden baglanan oyuncu geri sayima turun KALAN suresinden devam etmeli.
            remainingMs: this.turnRemainingMs(),
            missedTurns: this.missedTurnsView(),
            myBoard: this.buildBoardView(room.players[slot]!.pieces, true, room.turnCount[slot]),
            opponentBoard: this.buildBoardView(room.players[otherSlot]!.pieces, false),
            winner: room.winner,
            // Geri donen oyuncu "neden kaybettim/kazandim" metnini de almali.
            reason: room.gameOverReason,
          });
        }
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    await this.loadRoom();
    return new Response(null, { status: this.room ? 200 : 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    try {
      const msg = JSON.parse(message);
      await this.loadRoom();
      const room = this.room;
      if (!room) return;

      const att = ws.deserializeAttachment() as { slot: number } | null;
      if (!att) return;
      const playerSlot = att.slot;

      switch (msg.type) {
        case "setup_complete": {
          room.players[playerSlot]!.ready = true;
          room.players[playerSlot]!.pieces = (msg.placedPieces || []).map((p: any) => ({
            id: p.id, name: p.name, rank: p.rank, owner: p.owner,
            special: p.special || null, movable: p.movable !== false, revealed: false, hasMoved: false, scoutAt: null,
            row: p.position.row, col: p.position.col,
          }));
          // Tur suresini oda kurucusu (slot 0) belirler; iki oyuncu farkli preset
          // secmis olabilir, tek bir degerde karar kilinmasi sart.
          if (playerSlot === 0 && typeof msg.turnTime === "number" && isFinite(msg.turnTime)) {
            room.turnTimeMs = Math.max(MIN_TURN_TIME_MS, Math.min(MAX_TURN_TIME_MS, Math.round(msg.turnTime * 1000)));
          }
          this.broadcast({ type: "player_setup_status", redReady: !!room.players[0]?.ready, blueReady: !!room.players[1]?.ready });
          if (room.players[0]?.ready && room.players[1]?.ready) {
            room.gamePhase = "PLAY_RED";
            room.turnStartedAt = Date.now();
            const p0 = room.players[0]!.pieces, p1 = room.players[1]!.pieces;
            const saat = { turnTimeMs: room.turnTimeMs, remainingMs: room.turnTimeMs, terrain: room.terrain };
            this.sendTo(0, { type: "both_setup_complete", gamePhase: "PLAY_RED", ...saat, myPieces: this.buildBoardView(p0, true, room.turnCount[0]), opponentPieces: this.buildBoardView(p1, false) });
            this.sendTo(1, { type: "both_setup_complete", gamePhase: "PLAY_RED", ...saat, myPieces: this.buildBoardView(p1, true, room.turnCount[1]), opponentPieces: this.buildBoardView(p0, false) });
          }
          await this.saveRoom();
          await this.scheduleAlarm();
          break;
        }
        case "move": {
          if (room.gamePhase === "PLAY_RED" && playerSlot !== 0) { ws.send(JSON.stringify({ type: "move_error", code: "NOT_YOUR_TURN", message: "Sıra 1. Oyuncu'da" })); return; }
          if (room.gamePhase === "PLAY_BLUE" && playerSlot !== 1) { ws.send(JSON.stringify({ type: "move_error", code: "NOT_YOUR_TURN", message: "Sıra 2. Oyuncu'da" })); return; }
          const { from, to } = msg;
          if (!from || !to) { ws.send(JSON.stringify({ type: "move_error", code: "INVALID_MOVE", message: "Geçersiz hamle" })); return; }
          const player = room.players[playerSlot]!;
          const movedPiece = player.pieces.find(p => p.row === from.row && p.col === from.col);
          if (!movedPiece) { ws.send(JSON.stringify({ type: "move_error", code: "PIECE_NOT_FOUND", message: "Taş bulunamadı" })); return; }
          if (!movedPiece.movable) { ws.send(JSON.stringify({ type: "move_error", code: "PIECE_IMMOBILE", message: "Bu taş hareket edemez" })); return; }
          const isRed = player.team === "1. Oyuncu";
          const dr = to.row - from.row, dc = to.col - from.col;
          // Tahta 10 satir x 11 sutun; oyuncular SAG-SOL karsi karsiya.
          // Kirmizi 7-10. sutunlarda, sola ilerler (dc<0). Mavi 0-3'te, saga (dc>0).
          if (isRed && dc > 0) { ws.send(JSON.stringify({ type: "move_error", code: "BACKWARD", message: "Geri adım yasak!" })); return; }
          if (!isRed && dc < 0) { ws.send(JSON.stringify({ type: "move_error", code: "BACKWARD", message: "Geri adım yasak!" })); return; }
          if (Math.abs(dc) > 1 || Math.abs(dr) > 1) { ws.send(JSON.stringify({ type: "move_error", code: "ONE_SQUARE", message: "Bir kare hareket" })); return; }
          if (Math.abs(dr) + Math.abs(dc) !== 1) { ws.send(JSON.stringify({ type: "move_error", code: "STRAIGHT_ONLY", message: "Sadece düz hareket" })); return; }
          if (to.row < 0 || to.row >= BOARD_ROWS || to.col < 0 || to.col >= BOARD_COLS) { ws.send(JSON.stringify({ type: "move_error", code: "OUT_OF_BOUNDS", message: "Sınır dışı" })); return; }
          if (this.isLake(to.row, to.col)) { ws.send(JSON.stringify({ type: "move_error", code: "LAKE", message: "Göl üzerine gidilemez" })); return; }
          const opponent = room.players[playerSlot === 0 ? 1 : 0]!;
          if (player.pieces.find(p => p.row === to.row && p.col === to.col)) { ws.send(JSON.stringify({ type: "move_error", code: "OWN_PIECE", message: "Kendi taşın var" })); return; }
          const targetPiece = opponent.pieces.find(p => p.row === to.row && p.col === to.col);
          const isForestTile = this.isForest(to.row, to.col);
          // Hamle bu noktadan sonra kesin gecerli: tur sayaci burada artiyor.
          // Izci bekleme suresi bu sayaci okuyor (bkz. scoutKalan).
          room.turnCount[playerSlot]++;
          movedPiece.row = to.row; movedPiece.col = to.col; movedPiece.hasMoved = true;
          let combatResult = null, newWinner: string | null = null;
          if (targetPiece) {
            combatResult = this.resolveCombat(movedPiece, targetPiece);
            switch (combatResult.outcome) {
              case "ATTACKER_WINS": opponent.pieces = opponent.pieces.filter(p => p.id !== targetPiece.id); if (!isForestTile) movedPiece.revealed = true; targetPiece.revealed = true; break;
              case "DEFENDER_WINS": player.pieces = player.pieces.filter(p => p.id !== movedPiece.id); if (!isForestTile) targetPiece.revealed = true; movedPiece.revealed = true; break;
              case "EQUAL_RANK": movedPiece.revealed = true; targetPiece.revealed = true; movedPiece.row = from.row; movedPiece.col = from.col; break;
              case "GAME_OVER": opponent.pieces = opponent.pieces.filter(p => p.id !== targetPiece.id); movedPiece.revealed = true; room.gamePhase = "GAME_OVER"; room.winner = player.team; room.gameOverReason = "FLAG"; room.gameOverAt = Date.now(); newWinner = player.team; break;
            }
          }
          if (room.gamePhase !== "GAME_OVER") room.gamePhase = room.gamePhase === "PLAY_RED" ? "PLAY_BLUE" : "PLAY_RED";
          // Yeni tur burada basliyor; oyun bittiyse saat duruyor.
          room.turnStartedAt = room.gamePhase === "GAME_OVER" ? null : Date.now();
          const p0 = room.players[0]!.pieces, p1 = room.players[1]!.pieces;
          // attackerTeam: istemci carpisma gecmisinde hangi tasin kime ait oldugunu
          // bundan turetiyor. Mesajdan cikarilamiyor: nextPhase oyun bittiginde
          // GAME_OVER oluyor ve sirayi kimin oynadigi kayboluyor.
          const base = { type: "move_executed", from, to, nextPhase: room.gamePhase, winner: newWinner, attackerTeam: player.team, turnTimeMs: room.turnTimeMs, remainingMs: this.turnRemainingMs() };
          const isP0 = playerSlot === 0;
          // Carpisma sonucu her oyuncu icin AYRI kurgulanir: kendi tasini her zaman
          // gorursun, rakibinkini yalnizca ACIGA CIKTIYSA (ormanda kalan gizli kalir).
          // Iki tarafi ayri ayri elle yazmak mirror hatasina davetiyeydi; tek yerden
          // uretiliyor ve "ben saldiran tarafta miyim" parametresiyle donuyor.
          const carpismaGorunumu = (benSaldiran: boolean) => combatResult ? {
            outcome: combatResult.outcome,
            attackerName: benSaldiran || movedPiece.revealed ? combatResult.attacker.name : null,
            attackerRank: benSaldiran || movedPiece.revealed ? combatResult.attacker.rank : null,
            // Ozel yetenek de kimlik bilgisidir: istemci "Istihkamci Bombayi imha etti"
            // metnini buna gore seciyor, o yuzden ad/rutbe ile AYNI kosula bagli.
            attackerSpecial: benSaldiran || movedPiece.revealed ? combatResult.attacker.special : null,
            defenderName: !benSaldiran || targetPiece?.revealed ? combatResult.defender.name : null,
            defenderRank: !benSaldiran || targetPiece?.revealed ? combatResult.defender.rank : null,
          } : null;
          this.sendTo(0, { ...base, combatResult: carpismaGorunumu(isP0), myBoard: this.buildBoardView(p0, true, room.turnCount[0]), opponentBoard: this.buildBoardView(p1, false) });
          this.sendTo(1, { ...base, combatResult: carpismaGorunumu(!isP0), myBoard: this.buildBoardView(p1, true, room.turnCount[1]), opponentBoard: this.buildBoardView(p0, false) });
          if (newWinner) { this.broadcast({ type: "game_over", winner: newWinner, reason: "FLAG" as GameOverReason }); }
          await this.saveRoom();
          await this.scheduleAlarm();
          break;
        }
        // ─── Izci gorevi: dusman hattindaki bir tasin kimligini ac ─────────────
        //
        // Kurallar:
        //   - Yalnizca Izci (special === "SCOUT") ve omrunde BIR kez.
        //   - Hedef, Izci ile AYNI SATIRDA ve dusmanin dizilim sutunlarinda olmali.
        //   - Izci ile hedef arasinda GOL varsa gorus kapali ("onunde gol varsa").
        //   - Hedef ORMAN karesindeyse kimligi gorunmez; orman zaten "ustunde
        //     duranin kimligini gizler" kuralina sahip, gorme yetenegi onu delmiyor.
        //   - Kullanim TURU HARCAR: hamle yerine gecer, sira karsiya doner.
        //
        // Acilan tas `revealed` ile isaretleniyor. Bu bayrak yalnizca RAKIBIN
        // gorunumunu etkiliyor (buildBoardView isOwn=true her seyi gosterir), yani
        // tasin sahibi tasinin desifre oldugunu FARK ETMEZ — istihbarat gizli kalir.
        // Tas yenilince zaten listeden dusuyor, "yenilene kadar gorunur" kendiliginden.
        case "scout": {
          // n: mesajdaki {n} yerine gecen sayi (bekleme suresi icin kalan tur).
          const yolla = (code: string, n?: number) => { try { ws.send(JSON.stringify({ type: "move_error", code, n })); } catch (e) {} };
          if (room.gamePhase === "PLAY_RED" && playerSlot !== 0) { yolla("NOT_YOUR_TURN"); return; }
          if (room.gamePhase === "PLAY_BLUE" && playerSlot !== 1) { yolla("NOT_YOUR_TURN"); return; }
          if (!isPlayPhase(room.gamePhase)) { yolla("NOT_YOUR_TURN"); return; }
          const { from, target } = msg;
          if (!from || !target) { yolla("INVALID_MOVE"); return; }
          const player = room.players[playerSlot]!;
          const opponent = room.players[playerSlot === 0 ? 1 : 0]!;
          const izci = player.pieces.find(p => p.row === from.row && p.col === from.col);
          if (!izci) { yolla("PIECE_NOT_FOUND"); return; }
          if (izci.special !== "SCOUT") { yolla("SCOUT_NOT_SCOUT"); return; }
          // Ilk kullanim bedava; sonraki her hak icin sahibinin SCOUT_COOLDOWN tur
          // daha OYNAMASI gerekiyor (zaman asimiyla kacirilan tur sayilmiyor).
          const kalanTur = this.scoutKalan(izci, room.turnCount[playerSlot]);
          if (kalanTur > 0) { yolla("SCOUT_COOLDOWN", kalanTur); return; }
          // Hedef: Izci ile AYNI SATIRDAKI herhangi bir dusman tasi. Sutun sinirlamasi
          // YOK — dusmanin dizilim sutunlariyla sinirlasaydik orman kurali olu kod
          // olurdu (orman kareleri yalnizca 4-6. sutunlarda, dizilim bolgeleri 0-3 ve
          // 7-10). Tarafsiz banda ilerlemis tasin kimligini acabilmek de yetenegin
          // asil degeri; menzili gol kesiyor, orman gizliyor.
          if (target.row !== izci.row) { yolla("SCOUT_RANGE"); return; }
          const hedef = opponent.pieces.find(p => p.row === target.row && p.col === target.col);
          if (!hedef) { yolla("SCOUT_RANGE"); return; }
          // Aradaki kareler: iki sutun arasinda kalanlar (uc noktalar haric).
          const adim = target.col > izci.col ? 1 : -1;
          for (let c = izci.col + adim; c !== target.col; c += adim) {
            if (this.isLake(izci.row, c)) { yolla("SCOUT_LAKE"); return; }
          }
          if (this.isForest(hedef.row, hedef.col)) { yolla("SCOUT_FOREST"); return; }

          hedef.revealed = true;
          // Once tur sayaci artiyor, SONRA damga vuruluyor: bekleme "bu turdan
          // itibaren SCOUT_COOLDOWN tur daha" anlamina geliyor.
          room.turnCount[playerSlot]++;
          izci.scoutAt = room.turnCount[playerSlot];
          room.gamePhase = room.gamePhase === "PLAY_RED" ? "PLAY_BLUE" : "PLAY_RED";
          room.turnStartedAt = Date.now();
          const sp0 = room.players[0]!.pieces, sp1 = room.players[1]!.pieces;
          // DIKKAT: hedefin koordinati YALNIZCA gorevi yapana gidiyor. Iki tarafa da
          // yollasaydik kurban hangi tasinin desifre oldugunu ogrenir ve onu geri
          // cekerdi — istihbaratin degeri gizli kalmasinda.
          // Rakip yine de turun gectigini gormeli, o yuzden faz/saat ona da gidiyor;
          // hamle yapilmadigini zaten tahtadan anlayacak, bu kacinilmaz.
          const sOrtak = { type: "scout_done", nextPhase: room.gamePhase, turnTimeMs: room.turnTimeMs, remainingMs: this.turnRemainingMs() };
          const sGizli = { scout: { row: izci.row, col: izci.col }, target: { row: hedef.row, col: hedef.col }, byTeam: player.team };
          const bakanSlot = playerSlot;
          this.sendTo(0, { ...sOrtak, ...(bakanSlot === 0 ? sGizli : {}), myBoard: this.buildBoardView(sp0, true, room.turnCount[0]), opponentBoard: this.buildBoardView(sp1, false) });
          this.sendTo(1, { ...sOrtak, ...(bakanSlot === 1 ? sGizli : {}), myBoard: this.buildBoardView(sp1, true, room.turnCount[1]), opponentBoard: this.buildBoardView(sp0, false) });
          await this.saveRoom();
          await this.scheduleAlarm();
          break;
        }
        // Tur suresini YALNIZCA oda kurucusu (slot 0) ve YALNIZCA oyun baslamadan
        // once degistirebilir. Oyun sirasinda degistirmek sirasi gelen oyuncuya
        // avantaj/dezavantaj yaratirdi. Degeri iki tarafa da yayinliyoruz: katilan
        // oyuncu kendi presetini secmis olabilir ve ekraninda YANLIS sure sayardi.
        case "set_turn_time": {
          if (playerSlot !== 0 || isPlayPhase(room.gamePhase) || room.gamePhase === "GAME_OVER") break;
          if (typeof msg.turnTime !== "number" || !isFinite(msg.turnTime)) break;
          room.turnTimeMs = Math.max(MIN_TURN_TIME_MS, Math.min(MAX_TURN_TIME_MS, Math.round(msg.turnTime * 1000)));
          await this.saveRoom();
          this.broadcast({ type: "turn_time_changed", turnTimeMs: room.turnTimeMs });
          break;
        }
        case "request_restart": {
          room.restartRequested[playerSlot] = true;
          this.broadcast({ type: "restart_requested", slot: playerSlot });
          if (room.restartRequested[0] && room.restartRequested[1]) {
            for (const p of room.players) if (p) { p.ready = false; p.pieces = []; }
            room.restartRequested = [false, false];
            room.gamePhase = "SETUP"; room.winner = null; room.gameOverReason = null;
            room.turnStartedAt = null; // dizilim asamasinda tur saati islemez
            room.gameOverAt = null;
            room.missedTurns = [0, 0];
            room.turnCount = [0, 0]; // Izci bekleme sayaci da bastan baslar
            this.araziYenile();      // "her oyunda arazi degissin" — rovans da yeni oyun
            this.broadcast({ type: "game_restarted", roomState: this.getRoomState() });
          }
          await this.saveRoom();
          await this.scheduleAlarm();
          break;
        }
      }
    } catch (e) { console.error("WS error:", e); try { ws.send(JSON.stringify({ type: "error", code: "SERVER_ERROR", message: "Sunucu hatası" })); } catch (e2) {} }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string) {
    await this.loadRoom();
    const room = this.room;
    if (!room) return;
    const att = ws.deserializeAttachment() as { slot: number } | null;
    if (!att) return;
    const slot = att.slot;
    room.disconnectedAt[slot] = Date.now();
    await this.saveRoom();
    this.broadcast({ type: "player_connection_change", roomState: this.getRoomState() });
    // Dogrudan setAlarm degil: tur saati de ayni slotu kullaniyor, en yakin
    // son tarih kazanmali (bkz. scheduleAlarm).
    await this.scheduleAlarm();
  }

  async alarm() {
    await this.loadRoom();
    const room = this.room;
    if (!room) return;
    const now = Date.now();

    // 0) Biten oyunun odasi yasama suresini doldurdu mu? Doldurduysa gerisini
    // isletmenin anlami yok — oda siliniyor ve alarm zinciri kapaniyor.
    if (room.gamePhase === "GAME_OVER" && room.gameOverAt !== null && (now - room.gameOverAt) >= ROOM_TTL_MS) {
      await this.deleteRoom();
      await this.ctx.storage.deleteAlarm();
      return;
    }

    // 1) Tur suresi doldu mu? Sirayi SUNUCU cevirir ve iki tarafa bildirir —
    // istemcinin kendi basina cevirmesi iki tarafi ayristiriyordu.
    if (room.turnStartedAt !== null && isPlayPhase(room.gamePhase) && (now - room.turnStartedAt) >= room.turnTimeMs) {
      const kacirenSlot = room.gamePhase === "PLAY_RED" ? 0 : 1;
      room.missedTurns[kacirenSlot]++;
      room.gamePhase = room.gamePhase === "PLAY_RED" ? "PLAY_BLUE" : "PLAY_RED";
      room.turnStartedAt = now;

      // Iki taraf da siniri doldurduysa kimse oynamiyor demektir: berabere bitir.
      if (room.missedTurns[0] >= MAX_MISSED_TURNS && room.missedTurns[1] >= MAX_MISSED_TURNS) {
        room.gamePhase = "GAME_OVER";
        room.winner = null;
        room.gameOverReason = "TIMEOUT_DRAW";
        room.gameOverAt = now;
        room.turnStartedAt = null;
        await this.saveRoom();
        this.broadcast({ type: "game_over", winner: null, reason: room.gameOverReason, missedTurns: this.missedTurnsView() });
        await this.scheduleAlarm();
        return;
      }

      await this.saveRoom();
      this.broadcast({ type: "turn_timeout", nextPhase: room.gamePhase, turnTimeMs: room.turnTimeMs, remainingMs: room.turnTimeMs, missedTurns: this.missedTurnsView() });
    }

    // 2) Kopan oyuncunun suresi doldu mu?
    let changed = false;
    for (let i = 0; i < 2; i++) {
      if (room.disconnectedAt[i] && (now - room.disconnectedAt[i]!) >= DISCONNECT_TIMEOUT_MS) {
        // Oyun surerken rakip donmediyse kalan oyuncu hukmen kazanir. Oyuncu
        // kaydini SILMIYORUZ: oyun sonu ekrani ve olasi yeniden baglanma icin duruyor.
        if (isPlayPhase(room.gamePhase)) {
          const kalanSlot = i === 0 ? 1 : 0;
          room.gamePhase = "GAME_OVER";
          room.winner = kalanSlot === 0 ? "1. Oyuncu" : "2. Oyuncu";
          room.gameOverReason = "OPPONENT_LEFT";
          room.gameOverAt = now;
          room.turnStartedAt = null;
          // Kopma damgasi TEMIZLENMELI: birakilsaydi son tarihi coktan gecmis
          // oldugu icin alarm hemen yeniden tetiklenir, bu kez faz GAME_OVER
          // oldugundan asagidaki temizlik dalina duser ve oyuncuyu silerdi.
          // Token'i silinen oyuncu geri donup sonucu goremiyordu.
          room.disconnectedAt[i] = null;
          await this.saveRoom();
          this.broadcast({ type: "game_over", winner: room.winner, reason: room.gameOverReason, leftSlot: i });
          await this.scheduleAlarm();
          return;
        }
        room.players[i] = null;
        room.playerTokens[i] = null;
        room.disconnectedAt[i] = null;
        room.restartRequested[i] = false;
        changed = true;
      }
    }
    if (changed) {
      if (!room.players[0] && !room.players[1]) {
        await this.deleteRoom();
        await this.ctx.storage.deleteAlarm();
        return;
      }
      await this.saveRoom();
      this.broadcast({ type: "player_connection_change", roomState: this.getRoomState() });
    }

    await this.scheduleAlarm();
  }
}

// ─── Worker entry ─────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Oda kodu uretme
    if (url.pathname === "/api/game-room/create" && request.method === "POST") {
      if (!env.GAME_ROOM) return new Response("Game room unavailable", { status: 503 });
      let code = generateRoomCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
        try {
          const res = await stub.fetch("https://do/check", { method: "HEAD" });
          if (res.status === 200) { code = generateRoomCode(); continue; }
        } catch (e) { /* kod musait */ }
        break;
      }
      return Response.json({ roomCode: code });
    }

    // WebSocket multiplayer
    if (url.pathname.startsWith("/ws/game-room")) {
      if (!env.GAME_ROOM) return new Response("Game room unavailable", { status: 503 });
      const roomCode = url.searchParams.get("room") || "";
      if (!roomCode) return new Response("Room code required", { status: 400 });
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomCode));
      return stub.fetch(request);
    }

    // Geri kalan her sey statik dosya
    return env.ASSETS.fetch(request);
  },
};
