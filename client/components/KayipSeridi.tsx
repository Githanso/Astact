import React from 'react';
import { CombatResult, Language, Player } from '../types';
import { PLAYERS, PIECE_COUNTS, PIECE_DEFINITIONS, TRANSLATIONS, getPieceLabel, getPieceArt } from '../constants';
import { rakipKayiplari } from '../lib/tasSayimi';

// Tahtanin yanindaki kayip seridi: bir tarafin DUSEN taslari, tur tur.
//
// Taraflar SABIT (perspektif hesabi yok): tahta iki oyuncuda da ayni yonde duruyor
// — mavi 0-3, kirmizi 7-10. sutunlar. Boylece "dusen mavi taslar sagda, dusen
// kirmizi taslar solda" dendiginde her iki oyuncu icin de ganimet kendi tarafinda
// birikmis oluyor.
//
// Tek tek degil TUR BAZINDA yigiliyor: oyun boyunca 40 tas dusebilir, tek tek liste
// tahtanin uc kati uzunluga cikardi. Yigin hem sabit yukseklikte kaliyor (en fazla
// 14 satir) hem de asil sorulan soruya cevap veriyor: "rakibin kac albayi kaldi".
interface KayipSeridiProps {
    combatHistory: CombatResult[];
    // Kayiplari gosterilecek taraf. KIRMIZI verilirse dusen kirmizi taslar cizilir.
    taraf: Player;
    lang: Language;
}

/**
 * Bir tarafin dusen taslari, [ad, adet] ciftleri halinde ve SIRALI.
 *
 * tasSayimi.ts'e konulamadi: o dosya yalnizca TIP import ediyor (testi Node ile
 * dogrudan calisiyor), buradaki siralama ise PIECE_DEFINITIONS'a — yani bir
 * DEGERE — ihtiyac duyuyor.
 */
const kayipSatirlari = (combatHistory: CombatResult[], taraf: Player): [string, number][] => {
    // rakipKayiplari(gecmis, X) => X'in RAKIBININ kayiplari. Bu yuzden karsi taraf
    // veriliyor: kirmizinin kayiplarini almak icin maviyi soruyoruz.
    // Sayim carpisma gecmisinden turetiliyor ve guvenli — olen tas her zaman aciga
    // cikiyor, orman kurali yalnizca KAZANANI gizliyor (bkz. lib/tasSayimi.ts).
    const kayiplar = rakipKayiplari(combatHistory, taraf === PLAYERS.RED ? PLAYERS.BLUE : PLAYERS.RED);
    return (Object.entries(kayiplar) as [string, number][])
        .filter(([, adet]) => adet > 0)
        // En degerli kayip ustte. Mayın rank 11 ile en tepeye cikardi (savas degeri
        // degil, "gecilmez" isareti); Sancak 0 ile en alta. Ikisi de HAREKETSIZ, o
        // yuzden hareketli taslardan ayri, altta gruplaniyor.
        .sort(([a], [b]) => {
            const ta = PIECE_DEFINITIONS[a], tb = PIECE_DEFINITIONS[b];
            const ha = ta?.movable !== false ? 1 : 0, hb = tb?.movable !== false ? 1 : 0;
            if (ha !== hb) return hb - ha;
            return (tb?.rank ?? 0) - (ta?.rank ?? 0);
        });
};

const KayipSeridi: React.FC<KayipSeridiProps> = ({ combatHistory, taraf, lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    const isRed = taraf === PLAYERS.RED;

    const satirlar = kayipSatirlari(combatHistory, taraf);
    // Iki serit de AYNI basligi tasiyor; hangi tarafin oldugu kutunun renginden
    // (kirmizi/mavi kenarlik ve zemin) anlasiliyor. Ekran okuyucuda renk bilgisi
    // olmadigi icin aria-label'a takim adi ayrica ekleniyor.
    const baslik = t.capturedTitle;

    return (
        // hidden lg:flex — iki serit + tahta dar ekranda sikisiyor. Bilgi orada
        // tamamen kaybolmuyor: tasa tiklaninca tahtanin ustunde cikan
        // PieceCountChip ayni sayimi (o TUR icin) gostermeye devam ediyor.
        <aside
            className="hidden lg:flex flex-col gap-1 w-[92px] shrink-0 select-none"
            aria-label={`${baslik}: ${isRed ? t.playerRed : t.playerBlue}`}
        >
            <div className={`text-[10px] font-black uppercase tracking-wide text-center leading-tight px-1 py-1.5 rounded-lg border ${
                isRed ? 'text-red-300 border-red-800/50 bg-red-950/30' : 'text-blue-200 border-blue-800/50 bg-blue-950/30'
            }`}>
                {baslik}
            </div>

            {satirlar.length === 0 ? (
                <div className="text-[9px] text-slate-600 text-center pt-1">—</div>
            ) : (
                <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                    {satirlar.map(([ad, adet]) => {
                        const art = getPieceArt(ad);
                        const toplam = PIECE_COUNTS[ad] ?? 0;
                        // Tur tamamen tukendi: rakipte o rutbeden hic kalmadi. Oyun
                        // acisindan en degerli bilgi bu, o yuzden ayrica vurgulaniyor.
                        const tukendi = adet >= toplam;
                        return (
                            <div
                                key={ad}
                                title={`${getPieceLabel(ad, lang)} ${adet}/${toplam}`}
                                className={`flex flex-col items-center rounded-lg border px-1 py-1 bg-slate-900/95 ${
                                    tukendi ? 'border-slate-500/70' : 'border-slate-700'
                                }`}
                            >
                                {art && (
                                    // Dusmus tas: soluk ve renksiz. Tahtadaki canli
                                    // taslarla karismasin diye bilincli olarak matlastiriliyor.
                                    <img
                                        src={art}
                                        alt=""
                                        draggable={false}
                                        className="w-full h-11 object-contain opacity-50 saturate-0"
                                    />
                                )}
                                <span className="w-full truncate text-center text-[9px] font-bold leading-tight text-slate-400">
                                    {getPieceLabel(ad, lang)}
                                </span>
                                <span className={`font-mono text-[11px] font-black leading-none ${
                                    tukendi ? (isRed ? 'text-red-300' : 'text-blue-200') : 'text-slate-300'
                                }`}>
                                    {adet}<span className="text-slate-600">/{toplam}</span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </aside>
    );
};

export default KayipSeridi;
