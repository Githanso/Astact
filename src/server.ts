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
}

// Oyunun neden bittigi. Istemci ekrandaki metni buna gore seciyor; "kazandin"
// ile "rakip ayrildigi icin kazandin" ayni sey degil.
type GameOverReason = "FLAG" | "TIMEOUT_DRAW" | "OPPONENT_LEFT";

const BOARD_ROWS = 10, BOARD_COLS = 11;
const LAKE_COORDS = [
  // Tarafsiz bant: 4-6. sutunlar (istemcideki constants.ts ile AYNI olmali)
  { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 1, col: 6 },
  { row: 2, col: 4 }, { row: 2, col: 5 }, { row: 2, col: 6 },
  { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 6 },
  { row: 8, col: 4 }, { row: 8, col: 5 }, { row: 8, col: 6 },
];
const FOREST_COORDS = [
  { row: 0, col: 4 }, { row: 0, col: 5 }, { row: 0, col: 6 },
  { row: 3, col: 4 }, { row: 3, col: 6 },
  { row: 4, col: 5 },
  { row: 5, col: 5 },
  { row: 6, col: 4 }, { row: 6, col: 6 },
  { row: 9, col: 4 }, { row: 9, col: 5 }, { row: 9, col: 6 },
];
function isLake(r: number, c: number) { return LAKE_COORDS.some(l => l.row === r && l.col === c); }
function isForest(r: number, c: number) { return FOREST_COORDS.some(f => f.row === r && f.col === c); }
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
      redPlayer: r.players[0]?.name || null, redConnected: connected.has(0) && r.disconnectedAt[0] === null, redReady: !!r.players[0]?.ready,
      bluePlayer: r.players[1]?.name || null, blueConnected: connected.has(1) && r.disconnectedAt[1] === null, blueReady: !!r.players[1]?.ready,
      redDisconnectMs: kalan(0), blueDisconnectMs: kalan(1),
      disconnectTimeoutMs: DISCONNECT_TIMEOUT_MS,
      // Tur suresini oda kurucusu belirliyor; katilan oyuncu daha odaya girerken
      // gercek degeri gormeli, yoksa kendi presetiyle yanlis geri sayim yapar.
      turnTimeMs: r.turnTimeMs,
    };
  }

  private buildBoardView(pieces: PieceData[], isOwn: boolean): any[] {
    const board: any[][] = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
    LAKE_COORDS.forEach(l => { board[l.row][l.col] = "LAKE"; });
    for (const p of pieces) {
      board[p.row][p.col] = isOwn || p.revealed
        ? { id: p.id, name: p.name, rank: p.rank, owner: p.owner, special: p.special, movable: p.movable, revealed: p.revealed, hasMoved: p.hasMoved, position: { row: p.row, col: p.col } }
        : { owner: p.owner, revealed: false, position: { row: p.row, col: p.col } };
    }
    for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) if (board[r][c] === null && isForest(r, c)) board[r][c] = "FOREST";
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
        this.room = { code, players: [null, null], playerTokens: [null, null], disconnectedAt: [null, null], gamePhase: "LOBBY", winner: null, gameOverReason: null, restartRequested: [false, false], turnStartedAt: null, turnTimeMs: DEFAULT_TURN_TIME_MS, missedTurns: [0, 0], gameOverAt: null };
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
            turnTimeMs: room.turnTimeMs,
            // Yeniden baglanan oyuncu geri sayima turun KALAN suresinden devam etmeli.
            remainingMs: this.turnRemainingMs(),
            missedTurns: this.missedTurnsView(),
            myBoard: this.buildBoardView(room.players[slot]!.pieces, true),
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
            special: p.special || null, movable: p.movable !== false, revealed: false, hasMoved: false,
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
            const saat = { turnTimeMs: room.turnTimeMs, remainingMs: room.turnTimeMs };
            this.sendTo(0, { type: "both_setup_complete", gamePhase: "PLAY_RED", ...saat, myPieces: this.buildBoardView(p0, true), opponentPieces: this.buildBoardView(p1, false) });
            this.sendTo(1, { type: "both_setup_complete", gamePhase: "PLAY_RED", ...saat, myPieces: this.buildBoardView(p1, true), opponentPieces: this.buildBoardView(p0, false) });
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
          if (isLake(to.row, to.col)) { ws.send(JSON.stringify({ type: "move_error", code: "LAKE", message: "Göl üzerine gidilemez" })); return; }
          const opponent = room.players[playerSlot === 0 ? 1 : 0]!;
          if (player.pieces.find(p => p.row === to.row && p.col === to.col)) { ws.send(JSON.stringify({ type: "move_error", code: "OWN_PIECE", message: "Kendi taşın var" })); return; }
          const targetPiece = opponent.pieces.find(p => p.row === to.row && p.col === to.col);
          const isForestTile = isForest(to.row, to.col);
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
          const base = { type: "move_executed", from, to, nextPhase: room.gamePhase, winner: newWinner, turnTimeMs: room.turnTimeMs, remainingMs: this.turnRemainingMs() };
          const isP0 = playerSlot === 0;
          const cP0 = combatResult ? { outcome: combatResult.outcome, attackerName: isP0 ? combatResult.attacker.name : (movedPiece.revealed ? combatResult.attacker.name : null), attackerRank: isP0 ? combatResult.attacker.rank : (movedPiece.revealed ? combatResult.attacker.rank : null), defenderName: !isP0 ? combatResult.defender.name : (targetPiece?.revealed ? combatResult.defender.name : null), defenderRank: !isP0 ? combatResult.defender.rank : (targetPiece?.revealed ? combatResult.defender.rank : null) } : null;
          const cP1 = combatResult ? { outcome: combatResult.outcome, attackerName: !isP0 ? combatResult.attacker.name : (movedPiece.revealed ? combatResult.attacker.name : null), attackerRank: !isP0 ? combatResult.attacker.rank : (movedPiece.revealed ? combatResult.attacker.rank : null), defenderName: isP0 ? combatResult.defender.name : (targetPiece?.revealed ? combatResult.defender.name : null), defenderRank: isP0 ? combatResult.defender.rank : (targetPiece?.revealed ? combatResult.defender.rank : null) } : null;
          this.sendTo(0, { ...base, combatResult: cP0, myBoard: this.buildBoardView(p0, true), opponentBoard: this.buildBoardView(p1, false) });
          this.sendTo(1, { ...base, combatResult: cP1, myBoard: this.buildBoardView(p1, true), opponentBoard: this.buildBoardView(p0, false) });
          if (newWinner) { this.broadcast({ type: "game_over", winner: newWinner, reason: "FLAG" as GameOverReason }); }
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
