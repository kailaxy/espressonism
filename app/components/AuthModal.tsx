"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

type AuthStep = "email" | "otp";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

const EMAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 7.5C3 6.12 4.12 5 5.5 5h13C19.88 5 21 6.12 21 7.5v9c0 1.38-1.12 2.5-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="m4 8 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10V8a4 4 0 1 1 8 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="15" r="1.2" fill="currentColor" />
  </svg>
);

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<AuthStep>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = useCallback(() => {
    setStep("email");
    setOtp("");
    setError("");
    setLoading(false);
  }, []);

  const closeModal = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeModal, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (step === "email") {
      emailInputRef.current?.focus();
      return;
    }

    otpInputRef.current?.focus();
  }, [isOpen, step]);

  useEffect(() => {
    if (isOpen) return;
    resetState();
  }, [isOpen, resetState]);

  const sendOtpCode = useCallback(async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || loading) return;

    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail
    });

    if (signInError) {
      setError(signInError.message || "Unable to send verification code. Please try again.");
      setLoading(false);
      return;
    }

    setStep("otp");
    setOtp("");
    setLoading(false);
  }, [email, loading]);

  const verifyCode = useCallback(async () => {
    const normalizedOtp = otp.replace(/\D/g, "").slice(0, 8);
    const normalizedEmail = email.trim();
    if (normalizedOtp.length !== 8 || !normalizedEmail || loading) return;

    setLoading(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedOtp,
      type: "email"
    });

    if (verifyError) {
      setError(verifyError.message || "Invalid code. Please try again.");
      setLoading(false);
      return;
    }

    onAuthSuccess();
    closeModal();
  }, [closeModal, email, loading, onAuthSuccess, otp]);

  const handleResend = useCallback(async () => {
    await sendOtpCode();
  }, [sendOtpCode]);

  if (!isOpen) return null;

  return (
    <div
      className="auth-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <section className="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <header className="auth-modal-header">
          <div className="auth-modal-icon">{step === "email" ? EMAIL_ICON : LOCK_ICON}</div>
          <div>
            <h2 id="auth-modal-title">{step === "email" ? "Sign In with Email" : "Enter Verification Code"}</h2>
            <p>
              {step === "email"
                ? "We will send a 8-digit code to your inbox."
                : `Check ${email || "your email"} and enter the 8-digit code.`}
            </p>
          </div>
          <button type="button" className="auth-modal-close" onClick={closeModal} aria-label="Close authentication modal">
            {CLOSE_ICON}
          </button>
        </header>

        <div className="auth-modal-content">
          {error ? <div className="auth-modal-error">{error}</div> : null}

          {step === "email" ? (
            <>
              <label htmlFor="auth-email-input">Email address</label>
              <input
                id="auth-email-input"
                ref={emailInputRef}
                className="auth-modal-input"
                type="email"
                value={email}
                placeholder="name@example.com"
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />

              <button
                type="button"
                className="auth-modal-button"
                disabled={!email.trim() || loading}
                onClick={() => {
                  void sendOtpCode();
                }}
              >
                {loading ? "Sending..." : "Send Code"}
              </button>

              <button type="button" className="auth-modal-link" onClick={closeModal}>
                Continue as Guest
              </button>
            </>
          ) : (
            <>
              <label htmlFor="auth-otp-input">8-digit code</label>
              <input
                id="auth-otp-input"
                ref={otpInputRef}
                className="auth-modal-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
                maxLength={8}
                value={otp}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 8);
                  setOtp(digitsOnly);
                }}
              />

              <button
                type="button"
                className="auth-modal-button"
                disabled={otp.length !== 8 || loading}
                onClick={() => {
                  void verifyCode();
                }}
              >
                {loading ? "Verifying..." : "Verify"}
              </button>

              <button
                type="button"
                className="auth-modal-link"
                disabled={loading}
                onClick={() => {
                  void handleResend();
                }}
              >
                Didn&apos;t receive code? Resend
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
