import React, { useState } from 'react';
import { Users, Copy, Check, LogOut, Shield, Wifi, WifiOff, Sparkles, Send } from 'lucide-react';
import { Language, RoomState } from '../types';
import { TRANSLATIONS } from '../constants';

interface OnlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string | null;
  playerTeam: '1. Oyuncu' | '2. Oyuncu' | null;
  // Sekli burada TEKRAR TANIMLAMA: types.ts'teki RoomState ile ayrisiyordu ve
  // sunucuya alan eklenince bu kopya sessizce eskiyordu.
  roomState: RoomState | null;
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (code: string, playerName: string) => void;
  onLeaveRoom: () => void;
  errorMessage: string | null;
  lang: Language;
}

export const OnlineModal: React.FC<OnlineModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  playerTeam,
  roomState,
  lang,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  errorMessage,
}) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [playerName, setPlayerName] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    if (!roomCode) return;
    // writeText reddedilebiliyor (belge odakta degil, izin yok). Yakalanmazsa
    // unhandled rejection olur ve "kopyalandi" yazisi yalan soyler.
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* kod ekranda okunabilir durumda kaliyor */ }
  };

  const handleCreate = () => {
    if (!playerName.trim()) return;
    onCreateRoom(playerName.trim());   // isim zorunlu; buton yalnizca doluysa aktif
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    onJoinRoom(inputCode.trim(), playerName.trim());
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                {t.onlineHeading}
              </h2>
              <p className="text-xs text-slate-400">{t.onlineSubtitle}</p>
            </div>
          </div>
          {!roomCode && activeTab === 'CREATE' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>
          )}
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/80 border border-rose-600/60 rounded-xl text-rose-200 text-xs font-bold text-center animate-shake">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* If Player is currently in a room lobby */}
        {roomCode ? (
          <div className="space-y-5">
            {/* Room Code Card */}
            <div className="bg-slate-800/90 border border-amber-500/40 rounded-xl p-4 text-center relative overflow-hidden">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.roomCode}</span>
              </div>
              <div className="text-3xl font-black font-mono tracking-wider text-amber-200 my-1">
                {roomCode}
              </div>
              <p className="text-[11px] text-slate-400 mb-3">{t.shareCodeHint}</p>
              
              <button
                onClick={handleCopyCode}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-all shadow-md active:scale-95"
              >
                {copied ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? t.codeCopied : t.copyCode}</span>
              </button>
            </div>

            {/* Players Status List */}
            <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>{t.playerStatuses}</span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                  <Wifi className="w-3 h-3" /> {t.liveLabel}
                </span>
              </div>

              {/* Player 1 (Red - Host) */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-red-900/40">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-red-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {roomState?.redPlayer || t.playerRed}
                      {playerTeam === '1. Oyuncu' && <span className="ml-1.5 text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">{t.youBadge}</span>}
                    </div>
                    <div className="text-[10px] text-slate-400">{t.teamRedUnit}</div>
                  </div>
                </div>
                {roomState?.redConnected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {t.onlineLabel}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    <WifiOff className="w-3 h-3" /> {t.offlineLabel}
                  </span>
                )}
              </div>

              {/* Player 2 (Blue - Guest) */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-blue-900/40">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {/* Ad bos olabilir (istege bagli); o zaman takim etiketi basiliyor.
                          "Bekleniyor" YALNIZCA slot gercekten bosken dogru. */}
                      {roomState?.bluePlayer || (roomState?.bluePresent ? t.playerBlue : t.statusWaiting)}
                      {playerTeam === '2. Oyuncu' && <span className="ml-1.5 text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">{t.youBadge}</span>}
                    </div>
                    <div className="text-[10px] text-slate-400">{t.teamBlueUnit}</div>
                  </div>
                </div>
                {roomState?.bluePresent ? (
                  roomState.blueConnected ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {t.onlineLabel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      <WifiOff className="w-3 h-3" /> {t.offlineLabel}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-800/40 animate-pulse">
                    {t.statusWaiting}
                  </span>
                )}
              </div>
            </div>

            {/* Waiting Notice */}
            {!roomState?.bluePresent ? (
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-center text-xs text-amber-300 animate-pulse">
                {t.waitingOpponentJoin}
              </div>
            ) : (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-center text-xs text-emerald-300 font-bold">
                {t.bothReadyGoSetup}
              </div>
            )}

            {/* Leave Room Button — yalnizca rakip ODAYA GIRDIKTEN sonra; bekleme
                ekraninda kodu gorup odadan kacilmasin diye gizli. */}
            {roomState?.bluePresent && (
              <button
                onClick={onLeaveRoom}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 hover:border-rose-700/60 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.leaveRoom}</span>
              </button>
            )}
          </div>
        ) : (
          /* Initial Forms */
          <div className="space-y-4">
            {activeTab === 'CREATE' ? (
              <>
                {/* Oyuncu adi EN USTTE ve zorunlu; bosken butonlar kilitli */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">{t.playerName}</label>
                  <input
                    type="text"
                    placeholder={t.phNameRed}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-sm text-slate-100 p-3 rounded-xl focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    onClick={handleCreate}
                    disabled={!playerName.trim()}
                    className={`py-2.5 px-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${
                      playerName.trim()
                        ? 'bg-amber-500 text-slate-950 shadow-md active:scale-95'
                        : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{t.createRoom}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('JOIN')}
                    disabled={!playerName.trim()}
                    className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      playerName.trim()
                        ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                        : 'text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>{t.joinRoom}</span>
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('CREATE')}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                >
                  ← {t.goBack}
                </button>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">{t.roomCode}</label>
                  <input
                    type="text"
                    placeholder={t.phRoomCode}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 text-sm font-mono tracking-widest text-amber-300 p-3 rounded-xl focus:outline-none focus:border-amber-400 uppercase"
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputCode.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-sky-500 disabled:hover:to-blue-600"
                >
                  <Send className="w-4 h-4" />
                  <span>{t.joinRoomButton}</span>
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default OnlineModal;
