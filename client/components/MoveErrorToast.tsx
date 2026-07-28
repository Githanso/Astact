import React from 'react';
import { ShieldAlert } from 'lucide-react';

// Sunucunun reddettigi hamleyi bildiren kisa omurlu serit.
//
// NEDEN VAR: move_error eskiden yalnizca onlineErrorMessage'a yaziliyordu, o metin
// ise SADECE OnlineModal icinde basiliyor ve oyun sirasinda o modal kapali oluyor.
// Sunucu hamleyi reddediyor, ekranda hicbir sey degismiyordu; oyuncuya "tiklama
// calismiyor" gibi gorunuyordu. (Ayni tuzak Yeniden Baslat icin de yasanmisti,
// bkz. RestartNoticeModal.)
//
// NEDEN MODAL DEGIL: ConnectionBanner ile ayni gerekce — hata oyuncunun kendi
// tiklamasinin sonucu ve hemen tekrar denemesi gerekiyor; ekrani kilitlemek
// yanlis olurdu. Kendiliginden kayboluyor, kapatma dugmesi gerektirmiyor.
//
// Metin cevrilmis olarak GELIYOR (App.tsx TR_CODE, err<KOD> anahtarlari dort dilde
// tanimli), bu yuzden bilesen lang almiyor.
interface MoveErrorToastProps {
    mesaj: string | null;
    // Baglanti seridi aciktayken onun altina iniyor: ikisi ayni anda cikabiliyor
    // (rakip kopmusken hamle denemek gibi) ve ust uste binmemeleri gerekiyor.
    kaydir?: boolean;
}

const MoveErrorToast: React.FC<MoveErrorToastProps> = ({ mesaj, kaydir = false }) => {
    if (!mesaj) return null;

    return (
        <div
            className={`fixed left-1/2 -translate-x-1/2 z-[950] w-[92%] max-w-sm animate-fade-in ${kaydir ? 'top-24' : 'top-3'}`}
            role="alert"
            aria-live="assertive"
        >
            <div className="rounded-xl border-2 border-amber-500/50 bg-amber-950/90 shadow-2xl backdrop-blur-md px-4 py-2.5 flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
                <p className="text-sm font-bold leading-tight text-amber-100">{mesaj}</p>
            </div>
        </div>
    );
};

export default MoveErrorToast;
