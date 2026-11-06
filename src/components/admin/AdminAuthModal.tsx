/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, KeyRound, AlertTriangle, CheckCircle2, X, Clock, ShieldCheck } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onVerifyPin: (pin: string) => Promise<{ success: boolean; error?: string; locked?: boolean; remainingSeconds?: number; remainingAttempts?: number }>;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onVerifyPin,
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 0 || isVerifying || lockoutSeconds > 0) return;

    setIsVerifying(true);
    setError(null);

    const res = await onVerifyPin(pin);
    setIsVerifying(false);

    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || 'Code de sécurité incorrect.');
      setPin('');
      if (res.locked && res.remainingSeconds) {
        setLockoutSeconds(res.remainingSeconds);
      }
      if (res.remainingAttempts !== undefined) {
        setRemainingAttempts(res.remainingAttempts);
      }
      inputRef.current?.focus();
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (lockoutSeconds > 0 || isVerifying) return;
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border-t sm:border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header with Security Badge */}
        <div className="p-4 sm:p-6 bg-linear-to-b from-neutral-100 to-white dark:from-neutral-850 dark:to-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Lock className="w-3 h-3" />
                <span>Zone Haute Sécurité</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                Authentification Administrateur
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-10 h-10 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & PIN Entry */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed text-center">
            Cette section donne accès aux règles financières, aux clés API et aux fonds. Saisissez votre code PIN secret administrateur pour déverrouiller la console.
          </div>

          {/* Lockout Warning */}
          {lockoutSeconds > 0 ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <Clock className="w-5 h-5 text-rose-600 shrink-0 animate-spin" />
              <div>
                <span className="font-bold block">Accès verrouillé temporairement</span>
                <span className="text-[11px]">
                  Protection anti-piratage active. Réessayez dans {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s.
                </span>
              </div>
            </div>
          ) : error ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* PIN Display Boxes */}
            <div className="flex justify-center items-center gap-2 sm:gap-2.5 py-1 sm:py-2">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-10 h-12 sm:w-11 sm:h-13 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                      isFilled
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-neutral-900 dark:text-white shadow-2xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 text-neutral-400'
                    }`}
                  >
                    {isFilled ? '•' : ''}
                  </div>
                );
              })}
            </div>

            {/* Hidden Input for Keyboard input */}
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              disabled={lockoutSeconds > 0 || isVerifying}
              className="opacity-0 absolute pointer-events-none"
            />

            {/* Virtual Keypad for Mobile or Touch Security */}
            <div className="grid grid-cols-3 gap-2 pt-1 sm:pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  disabled={lockoutSeconds > 0 || isVerifying}
                  className="py-3 sm:py-3.5 text-base sm:text-lg font-bold font-mono bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-neutral-900 dark:text-white rounded-xl transition-colors cursor-pointer disabled:opacity-40 min-h-[48px] flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                disabled={lockoutSeconds > 0 || isVerifying || pin.length === 0}
                className="py-3 sm:py-3.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-white rounded-xl cursor-pointer disabled:opacity-30 min-h-[48px] flex items-center justify-center"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={lockoutSeconds > 0 || isVerifying}
                className="py-3 sm:py-3.5 text-base sm:text-lg font-bold font-mono bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-neutral-900 dark:text-white rounded-xl transition-colors cursor-pointer disabled:opacity-40 min-h-[48px] flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={lockoutSeconds > 0 || isVerifying || pin.length === 0}
                className="py-3 sm:py-3.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-white rounded-xl cursor-pointer disabled:opacity-30 min-h-[48px] flex items-center justify-center"
              >
                Retour
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={pin.length < 4 || isVerifying || lockoutSeconds > 0}
              className="w-full mt-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-3.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              {isVerifying ? (
                <span>Vérification cryptographique...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Déverrouiller la Console</span>
                </>
              )}
            </button>
          </form>

          {/* Security details footnote */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Anti-bruteforce (5 essais)
            </span>
            <span>Session sécurisée 1h</span>
          </div>
        </div>
      </div>
    </div>
  );
};
