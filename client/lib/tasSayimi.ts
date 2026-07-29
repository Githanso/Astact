// `import type`: bu dosya yalnizca TIP kullaniyor. Boyle yazilinca import derlemede
// tamamen siliniyor ve dosya calisma aninda types.ts'e bagimli kalmiyor — testi
// (test/tas-sayimi-testi.mjs) Node'un kendi tip ayiklayicisiyla, ayri bir derleme
// adimi olmadan dogrudan calistirabiliyoruz.
import type { BoardState, CombatResult, Player } from '../types';

// Tas sayimi. Iki soru cevaplaniyor:
//   1) benim su an hayatta kac X'im var,
//   2) rakip kac X kaybetti.
//
// Kaynak secimi onemli: App.tsx'teki redCaptured/blueCaptured dizileri YALNIZCA
// yerel carpisma dalinda dolduruluyor, online move_executed dalinda hic
// guncellenmiyor — online tek mod oldugu icin o diziler fiilen hep bos. Bu yuzden
// sayim tahtadan ve carpisma gecmisinden turetiliyor; ikisi de her iki modda dolu.

/** Tahtadaki kendi taslarim, tur adina gore. */
export const kalanTaslarim = (board: BoardState, benimTakim: Player | null): Record<string, number> => {
    const sayim: Record<string, number> = {};
    if (!benimTakim) return sayim;
    for (const satir of board) {
        for (const kare of satir) {
            if (!kare || typeof kare !== 'object') continue;
            if (kare.owner !== benimTakim || !kare.name) continue;
            sayim[kare.name] = (sayim[kare.name] ?? 0) + 1;
        }
    }
    return sayim;
};

/**
 * Rakibin kaybettigi taslar, tur adina gore.
 *
 * Carpisma gecmisinden turetiliyor ve bu GUVENLI: olen tas her zaman aciga
 * cikiyor. Orman kurali yalnizca KAZANANI gizliyor (server.ts:603-604), kaybedene
 * dokunmuyor. Yani gecmiste olen tasin adi hicbir zaman gizli kalmiyor, uydurma
 * sayim uretme riski yok. Adi yine de bilinmiyorsa ('???') o kayit atlaniyor.
 */
export const rakipKayiplari = (gecmis: CombatResult[], benimTakim: Player | null): Record<string, number> => {
    const sayim: Record<string, number> = {};
    if (!benimTakim) return sayim;

    const ekle = (ad?: string | null) => {
        if (!ad || ad === '???') return;
        sayim[ad] = (sayim[ad] ?? 0) + 1;
    };

    for (const c of gecmis) {
        // EQUAL_RANK'ta kimse olmuyor: iki tas da yasiyor, saldiran karesine donuyor.
        switch (c.outcome) {
            case 'ATTACKER_WINS':
                if (c.defender?.owner !== benimTakim) ekle(c.defender?.name);
                break;
            case 'DEFENDER_WINS':
                if (c.attacker?.owner !== benimTakim) ekle(c.attacker?.name);
                break;
            case 'GAME_OVER':
                // Savunan Bayrak dustu.
                if (c.defender?.owner !== benimTakim) ekle(c.defender?.name);
                break;
        }
    }
    return sayim;
};
