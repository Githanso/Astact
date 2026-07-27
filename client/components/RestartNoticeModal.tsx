import React from 'react';
import { Language, RestartNotice } from '../types';
import { TRANSLATIONS } from '../constants';
import { RotateCcw, Hourglass, X } from 'lucide-react';

// Yeniden baslatma bildirimi. Sunucu yeniden baslatmayi ancak IKI taraf da isteyince
// yapiyor; bu yuzden istegin gonderildigini/geldigini gormek sart. Onceden bu metin
// yalnizca baslik seridinde ufak bir yazi olarak duruyordu ve gozden kaciyordu.
//
// Rakip istediyse onay dugmesi de burada — "Yeniden Baslat butonuna bas" deyip kullaniciyi
// dugme aramaya gondermek yerine dugmeyi metnin yanina koyuyoruz.
interface RestartNoticeModalProps {
    notice: RestartNotice;
    onConfirm: () => void;
    onClose: () => void;
    lang: Language;
}

const RestartNoticeModal: React.FC<RestartNoticeModalProps> = ({ notice, onConfirm, onClose, lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.TR;
    if (!notice) return null;

    const rakipIstedi = notice === 'REQUESTED';

    return (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-100 transition-colors p-1 rounded-lg bg-slate-800 hover:bg-slate-700"
                    aria-label={t.close}
                >
                    <X className="w-4 h-4" />
                </button>

                <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    rakipIstedi ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                    {rakipIstedi ? <RotateCcw className="w-5 h-5" /> : <Hourglass className="w-5 h-5" />}
                </div>

                <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                    {rakipIstedi ? t.errRestartRequested : t.waitingRestartApproval}
                </p>

                {rakipIstedi ? (
                    <button
                        onClick={onConfirm}
                        className="mt-6 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-4 rounded-xl transition-all shadow-lg text-xs uppercase tracking-wider active:scale-95"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t.restartButton}</span>
                    </button>
                ) : (
                    <button
                        onClick={onClose}
                        className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-black py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider active:scale-95"
                    >
                        {t.close}
                    </button>
                )}
            </div>
        </div>
    );
};

export default RestartNoticeModal;
