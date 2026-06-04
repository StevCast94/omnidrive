// src/components/InstallBanner.tsx — Botón "Instalar app" para PWA (mobile)
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Detectar iOS (no soporta beforeinstallprompt)
    const iOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    // Detectar si ya está en standalone (instalado)
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;

    if (iOS) {
      // Mostrar instrucciones para iOS
      const dismissed = localStorage.getItem('pwa-ios-dismissed');
      if (!dismissed) {
        setIsIos(true);
        setShow(true);
      }
      return;
    }

    // Android/Desktop: usar beforeinstallprompt
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  if (!show) return null;

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setShow(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(isIos ? 'pwa-ios-dismissed' : 'pwa-install-dismissed', 'true');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl animate-slide-up flex items-center gap-3">
        <button onClick={dismiss} className="absolute top-3 right-3 text-slate-600 hover:text-white">
          <X size={16} />
        </button>

        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Download size={18} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            {isIos ? 'Agrega OmniDrive a tu inicio' : 'Instalar aplicación'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {isIos
              ? 'Toca Compartir → "Agregar a inicio"'
              : 'Accede más rápido, sin abrir el navegador'}
          </p>
        </div>

        {!isIos && (
          <button
            onClick={handleInstall}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-xl text-sm font-semibold text-white shrink-0 hover:brightness-110 transition"
          >
            Instalar
          </button>
        )}
      </div>
    </div>
  );
}
