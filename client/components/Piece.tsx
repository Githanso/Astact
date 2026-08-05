import React from 'react';
import { PlacedPiece, Language } from '../types';
import { PLAYERS, getPieceLabel, getPieceArt, TAS_STILI } from '../constants';
import { Shield } from 'lucide-react';

interface PieceProps {
    piece: PlacedPiece;
    isOpponent: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    lang?: Language;
    // Sirasi OLMAYAN oyuncunun taslari soluk (alfa) cizilir: oyuncu tek bakista
    // kimin oynadigini anlar. Bilgi sizintisi yok — gizli taslar yine gizli.
    dimmed?: boolean;
}

const Piece: React.FC<PieceProps> = ({ piece, isOpponent, onDragStart, lang = 'TR', dimmed = false }) => {
    const label = getPieceLabel(piece.name, lang);
    const art = getPieceArt(piece.name);
    const showBack = isOpponent && !piece.revealed;

    const dimStyle = `transition-opacity duration-300 ${dimmed ? 'opacity-40 saturate-50' : ''}`;

    const isRed = piece.owner === PLAYERS.RED;

    const canDrag = !isOpponent && !!onDragStart;

    // GIZLI rakip tasi: burada figur YOK, yalnizca kalkan var. Bu yuzden dolu arka
    // plan KORUNUYOR — arka plan da kalksa geriye kucuk bir simge ve ciplak zemin
    // kalirdi, rakip ordusunun tahtada nerede durdugu taranamazdi. Acik taslarin
    // aksine gizli tasin zemini gostermek gibi bir isi yok.
    if (showBack) {
        return (
            <div className={`relative w-full h-full flex items-center justify-center p-0.5 group z-10 hover:z-[999] ${dimStyle}`}>
                <div className={`w-full h-full rounded-md bg-slate-900 ${isRed ? 'border-red-700' : 'border-blue-700'} border-2 flex items-center justify-center shadow-md relative overflow-hidden transition-all duration-200 transform group-hover:scale-200 group-hover:shadow-2xl`}>
                    <Shield className={`w-5 h-5 ${isRed ? 'text-red-500' : 'text-blue-500'} opacity-80`} />
                </div>
            </div>
        );
    }

    // Karakterler gri tonlu (#939393, #d7d8d8), tahta zemini de koyu gri-mavi.
    // Arka plan olmadigi icin figuru zeminden ayiran tek sey bu golge.
    const figurGolgesi = 'drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]';

    // TARAF AYNALAMASI. Tek bir karakter seti var ve figurlerin hepsi SOLA bakiyor
    // (karakter brief'i: "hepsi ayni yone bakar, karsi taraf yatay aynalama ile
    // elde edilir — ikinci set uretilmez").
    //
    // Tahtada kirmizi SAG sutunlarda (7-10), mavi SOL sutunlarda (0-3) duruyor ve
    // ikisi karsi karsiya. Sola bakan figur kirmizida zaten dusmani gosteriyor;
    // aynalanmasi gereken MAVI, yoksa kendi kalesine bakiyor.
    //
    // Olcut owner, bakis acisi DEGIL: tahta perspektife gore donmuyor (Board.tsx),
    // mavi her iki oyuncunun ekraninda da solda duruyor.
    const figurYonu = isRed ? '' : ' -scale-x-100';

    // Taraf rengi HARFLERIN kendisinde: dolgu rozet kaldirildi, arka plan yok.
    //
    // Dolgu rozetin bir isi vardi — yazi dogrudan zemine dustugunde satranc
    // deseninin acik (bg-slate-800/35) ve koyu (/60) kareleri arasinda farkli
    // okunuyor, altina figur de girebiliyordu. Rozet gidince o isi .rutbe-yazisi
    // halesi ustleniyor (index.css): harfin dort yaninda koyuluk.
    //
    // Ton 300, 500/600 DEGIL: dolgunun uzerinde beyaz yaziyi tasiyan koyu tonlar
    // (red-700/blue-700) burada TERSINE calisirdi — koyu harf koyu tahtada
    // kaybolur. Acik tonlar koyu halenin uzerinde rahat okunuyor ve kirmizi/mavi
    // ayrimi uzaktan da tutuyor.
    const rozetRengi = isRed ? 'text-red-300' : 'text-sky-300';

    return (
        <div
            className={`relative w-full h-full flex items-center justify-center group z-10 hover:z-[999] ${dimStyle}`}
            draggable={canDrag}
            onDragStart={canDrag ? onDragStart : undefined}
        >
            <div className={`w-full h-full relative transition-transform duration-200 transform group-hover:scale-200 select-none ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                {TAS_STILI === 'disk' && (
                    <div className={`absolute bottom-[22%] left-1/2 -translate-x-1/2 w-[70%] h-[13%] rounded-[50%] pointer-events-none ${
                        isRed ? 'bg-red-600 shadow-[0_0_10px_2px_rgba(220,38,38,0.65)]' : 'bg-blue-500 shadow-[0_0_10px_2px_rgba(59,130,246,0.65)]'
                    }`} />
                )}

                {/* Izci hakki bekleme sayaci: scoutIn = hakkin yenilenmesine kalan tur.
                    Yalnizca KENDI Izcilerimizde gelir (server sadece isOwn+SCOUT'a
                    gonderiyor), hazir olunca (0) kaybolur. Figurle cakismasin diye
                    tasin sag ust kosesinde. */}
                {typeof piece.scoutIn === 'number' && piece.scoutIn > 0 && (
                    <span className="absolute top-0 right-0 z-20 text-sm font-black leading-none text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                        {piece.scoutIn}
                    </span>
                )}

                {/* Figur artik TUM kareyi kapliyor. Rozet ayri bir satir olsaydi
                    dikeyden 11 piksel yerdi (61x61 alan 61x50'ye duserdi); ustune
                    bindirilince figur %22 buyudu. object-contain orani koruyor. */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    {art
                        ? <img src={art} alt="" draggable={false} className={`max-h-full max-w-full object-contain ${figurGolgesi}${figurYonu}`} />
                        : <Shield className={`w-5 h-5 ${isRed ? 'text-red-400' : 'text-blue-400'} ${figurGolgesi}`} />}
                </div>

                {/* Rutbe yazisi: figurun alt kenarina BINIYOR. Ortulen yer omuz/gogus
                    hizasi — yuz, baslik ve rutbe isaretleri ustte kaliyor. Rutbe
                    tanima oyunun temeli, figur tek basina yeterli degil (ozellikle
                    birbirine benzeyen subay rutbelerinde).
                    z-10 sart: yoksa figurun altina duser.
                    Arka plan yok; rounded/px/ring/shadow ile birlikte kaldirildi —
                    hepsi rozetin kutusuna aitti. Okunurlugu .rutbe-yazisi tasiyor.
                    Kutu golgesi (shadow-*) ozellikle gitmeli: kutu olmayinca
                    gorunmez bir dikdortgene golge dusurmeye devam ediyordu. */}
                <span className={`rutbe-yazisi absolute bottom-0 left-1/2 -translate-x-1/2 z-10 max-w-full truncate text-[10px] font-black leading-[1.25] tracking-tight ${rozetRengi}`}>
                    {label}
                </span>
            </div>
        </div>
    );
};

export default Piece;
