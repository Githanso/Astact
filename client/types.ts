export type Player = '1. Oyuncu' | '2. Oyuncu';

export enum SpecialAbility {
  MINER = 'MINER',
  SCOUT = 'SCOUT',
  SPY = 'SPY',
}

export type Language = 'TR' | 'EN' | 'JA' | 'KO';

export type TimerPreset = 'FAST' | 'NORMAL' | 'LONG';

export interface TimerConfig {
  turnTime: number;      // seconds per turn
  setupTime: number;     // seconds for setup
  disconnectTime: number; // seconds for disconnect timeout
}

export interface PieceDefinition {
  name: string;
  rank: number;
  count: number;
  special: SpecialAbility | null;
  movable: boolean;
}

export interface PlacedPiece {
  id: string;
  name: string;
  rank: number;
  owner: Player;
  special: SpecialAbility | null;
  movable: boolean;
  position: Coords;
  revealed: boolean;
  hasMoved: boolean;
}

export interface Coords {
  row: number;
  col: number;
}

export type GamePhase = 'SETUP_RED' | 'SETUP_BLUE' | 'PLAY_RED' | 'PLAY_BLUE' | 'GAME_OVER';

// Yeniden baslatma bildirimi. METIN degil DURUM saklaniyor: metni render aninda
// cevirmek, dil degisirse bildirimin eski dilde donmasini engelliyor; ayrica popup
// "rakip istedi" durumunda onay dugmesi gosterebiliyor.
export type RestartNotice = 'WAITING' | 'REQUESTED' | null;

// Online oyunda durum satirinin RAKIBE gore hali. Yerel modda null olur ve
// oyun bilgisi panosu eski gamePhase tabanli metinlerine doner.
export type OnlineStatus =
  | 'OPPONENT_WAITING'      // rakip odaya henuz katilmadi
  | 'OPPONENT_OFFLINE'      // rakibin baglantisi koptu
  | 'OPPONENT_SETTING_UP'   // dizilim suruyor, rakip henuz onaylamadi
  | 'OPPONENT_READY'        // rakip dizilimini onayladi, seni bekliyor
  | 'YOUR_TURN'
  | 'OPPONENT_TURN'
  | null;

export type TerrainType = 'LAKE' | 'FOREST' | null;

export type SquareState = PlacedPiece | 'LAKE' | 'FOREST' | null;

export type BoardState = SquareState[][];

export interface ForestTile {
  row: number;
  col: number;
  density: number; // 1 to 3
}

export interface CombatResult {
  outcome: 'ATTACKER_WINS' | 'DEFENDER_WINS' | 'BOTH_LOSE' | 'EQUAL_RANK' | 'GAME_OVER';
  attacker?: PlacedPiece;
  defender?: PlacedPiece;
  timestamp?: number;
}

export interface GameStats {
  gamesPlayed: number;
  redWins: number;
  blueWins: number;
  totalBattles: number;
  totalTurns: number;
}
