"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Compass, Eye, EyeOff,
  Sprout, User, X, CheckCircle2, AlertCircle
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { authSuccessDestination, safeAuthDestination } from "@/lib/auth-destination";
import { AuthAsciiRain } from "@/components/auth-ascii-rain";
import { sound } from "@/components/landing-sound";

export type AuthDialogMode = "login" | "signup" | "forgot";

interface AuthGlassDialogProps {
  open: boolean;
  onClose: () => void;
  initialMode?: AuthDialogMode;
  next?: string;
  actionMessage?: string;
}

export function AuthGlassDialog({
  open,
  onClose,
  initialMode = "login",
  next = "/dashboard",
  actionMessage,
}: AuthGlassDialogProps) {
  const router = useRouter();
  const { configured, refresh } = useAuth();
  const [mode, setMode] = useState<AuthDialogMode>(initialMode);
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialMode, setPrevInitialMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Sync state during render when dialog opens or initialMode changes
  if (open !== prevOpen || initialMode !== prevInitialMode) {
    setPrevOpen(open);
    setPrevInitialMode(initialMode);
    if (open) {
      setMode(initialMode);
      setError("");
      setMessage("");
      setPasswordValue("");
      setConfirmPasswordValue("");
      setIsPasswordFocused(false);
    }
  }

  const isPasswordActive =
    isPasswordFocused || passwordValue.length > 0 || confirmPasswordValue.length > 0;

  // Autofocus first field when open
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  const destination = safeAuthDestination(next);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!configured) {
      setError("Authentication is not configured yet. Add your database configuration to continue.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Those passwords do not match. Check both fields and try again.");
      return;
    }

    setBusy(true);
    const client = createSupabaseBrowserClient();

    try {
      if (mode === "login") {
        const { error: authError } = await client.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        await refresh();
        onClose();
        router.replace(authSuccessDestination(destination, "login"));
        router.refresh();
      } else if (mode === "signup") {
        const { data, error: authError } = await client.auth.signUp({ email, password });
        if (authError) throw authError;
        if (data?.session) {
          await refresh();
          onClose();
          router.replace(authSuccessDestination(destination, "signup"));
          router.refresh();
        } else {
          setMessage("Check your email for the confirmation link to complete your signup.");
        }
      } else if (mode === "forgot") {
        const { error: authError } = await client.auth.resetPasswordForEmail(email);
        if (authError) throw authError;
        setMessage("If an account exists for that email, a password recovery link has been sent.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please verify your details.");
    } finally {
      setBusy(false);
    }
  }

  function handleOAuthSignIn(provider: "github" | "google") {
    setError(`Direct ${provider === "github" ? "GitHub" : "Google"} single-sign-on is in preview. Please sign in or create an account with your email.`);
  }

  async function handleDemoSignIn() {
    setError("");
    setMessage("");
    setBusy(true);
    const client = createSupabaseBrowserClient();
    try {
      const { error: authError } = await client.auth.signInWithPassword({
        email: "demo@codebloom.dev",
        password: "demo",
      });
      if (authError) throw authError;
      await refresh();
      onClose();
      router.replace(authSuccessDestination(destination, "login"));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="auth-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="auth-modal-card">
        {/* Close Button */}
        <button
          className="auth-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* LEFT COLUMN: Visual Showcase Panel with Full-Window ASCII Rain */}
        <div className="auth-modal-showcase relative overflow-hidden">
          <div className="auth-showcase-bg-orb pointer-events-none" />

          {/* Seamless ASCII Rain covering the entire showcase window */}
          <AuthAsciiRain isPasswordActive={isPasswordActive} />

          {/* Ambient concentric blooming halos */}
          <div className="auth-art-halo halo-1 pointer-events-none" />
          <div className="auth-art-halo halo-2 pointer-events-none" />

          {/* Dotted grid markers */}
          <div className="auth-art-dots dots-tl pointer-events-none" aria-hidden="true">
            <span /><span /><span />
            <span /><span /><span />
            <span /><span /><span />
          </div>
          <div className="auth-art-dots dots-br pointer-events-none" aria-hidden="true">
            <span /><span /><span />
            <span /><span /><span />
            <span /><span /><span />
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Form Panel */}
        <div className="auth-modal-form-wrap">
          {/* Top Pill Switcher: Sign In | Sign Up (matching reference image) */}
          <div className="auth-modal-topbar">
            <div className="auth-pill-switch" role="tablist" aria-label="Sign in or Sign up">
              <div
                className={`auth-pill-glider ${mode === "signup" ? "is-signup" : "is-login"}`}
                aria-hidden="true"
              />
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`auth-pill-btn ${mode === "login" ? "is-active" : ""}`}
                onClick={() => {
                  sound.playClick();
                  setMode("login");
                  setError("");
                  setMessage("");
                  setPasswordValue("");
                  setConfirmPasswordValue("");
                  setIsPasswordFocused(false);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={`auth-pill-btn ${mode === "signup" ? "is-active" : ""}`}
                onClick={() => {
                  sound.playClick();
                  setMode("signup");
                  setError("");
                  setMessage("");
                  setPasswordValue("");
                  setConfirmPasswordValue("");
                  setIsPasswordFocused(false);
                }}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Action Callout if opened from gate */}
          {actionMessage && (
            <div className="auth-action-banner" role="status">
              <Sprout size={14} />
              <span>Sign in to {actionMessage}</span>
            </div>
          )}

          {/* Form Heading with smooth text swap */}
          <div className="auth-modal-heading" key={`heading-${mode}`}>
            <h2 id="auth-modal-title" className="auth-flow-text">
              {mode === "login"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Reset Password"}
            </h2>
            <p className="auth-flow-text">
              {mode === "login"
                ? "Welcome back! Enter your details to continue."
                : mode === "signup"
                ? "Join fellow builders and share what you create."
                : "Enter your email to receive recovery instructions."}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="auth-banner auth-banner-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {message && (
            <div className="auth-banner auth-banner-success" role="status">
              <CheckCircle2 size={15} />
              <span>{message}</span>
            </div>
          )}

          {/* Auth Form */}
          <form className="auth-modal-form" onSubmit={handleSubmit}>
            {/* Email / Username Input */}
            <div className="auth-input-group">
              <label htmlFor="auth-email">
                {mode === "signup" ? "Email address *" : "Username or Email *"}
              </label>
              <div className="auth-input-pill">
                <input
                  ref={emailInputRef}
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete={mode === "signup" ? "email" : "username"}
                  required
                  placeholder={mode === "signup" ? "you@example.com" : "you@example.com or username"}
                  disabled={busy}
                />
                <span className="auth-input-icon" aria-hidden="true">
                  <User size={16} />
                </span>
              </div>
            </div>

            {/* Password Input */}
            {mode !== "forgot" && (
              <div className="auth-input-group">
                <label htmlFor="auth-password">Password *</label>
                <div className="auth-input-pill">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    placeholder="••••••••••••"
                    disabled={busy}
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={(e) => {
                      if (e.relatedTarget?.id !== "auth-confirm-password") {
                        setIsPasswordFocused(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="auth-input-icon auth-eye-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (Sign Up Mode) with smooth accordion flow */}
            <div
              className={`auth-confirm-password-slot ${mode === "signup" ? "is-open" : ""}`}
              aria-hidden={mode !== "signup"}
            >
              <div className="auth-confirm-password-inner">
                <div className="auth-input-group">
                  <label htmlFor="auth-confirm-password">Confirm Password *</label>
                  <div className="auth-input-pill">
                    <input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required={mode === "signup"}
                      minLength={8}
                      placeholder="••••••••••••"
                      disabled={busy || mode !== "signup"}
                      value={confirmPasswordValue}
                      onChange={(e) => setConfirmPasswordValue(e.target.value)}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={(e) => {
                        if (e.relatedTarget?.id !== "auth-password") {
                          setIsPasswordFocused(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="auth-input-icon auth-eye-btn"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Forgot Password Link with smooth fluid collapse */}
            {mode !== "forgot" && (
              <div
                className={`auth-forgot-row ${mode === "login" ? "is-open" : "is-collapsed"}`}
                aria-hidden={mode !== "login"}
              >
                <button
                  type="button"
                  className="auth-forgot-link"
                  tabIndex={mode === "login" ? 0 : -1}
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setMessage("");
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {mode === "forgot" && (
              <div className="auth-forgot-row">
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                >
                  ← Back to Sign In
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              className="auth-submit-btn"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <span className="auth-spinner" aria-hidden="true" />
              ) : (
                <>
                  <span key={`btn-text-${mode}`} className="auth-flow-text">
                    {mode === "login"
                      ? "Sign In"
                      : mode === "signup"
                      ? "Create Account"
                      : "Send Recovery Link"}
                  </span>
                  <ArrowRight size={16} className="auth-submit-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Alternative Social Logins & Demo ID */}
          <div className="auth-social-section">
            <span className="auth-social-divider">
              <span>Or connect with</span>
            </span>

            <div className="auth-social-row">
              {/* Quick Demo ID Sign-in */}
              <button
                type="button"
                className="auth-demo-badge-btn"
                onClick={handleDemoSignIn}
                disabled={busy}
                title="1-Click Sign in with Demo ID"
              >
                <Sprout size={14} /> Demo ID
              </button>

              {/* GitHub */}
              <button
                type="button"
                className="auth-social-circle"
                onClick={() => handleOAuthSignIn("github")}
                title="Sign in with GitHub"
                aria-label="Sign in with GitHub"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </button>

              {/* Google */}
              <button
                type="button"
                className="auth-social-circle"
                onClick={() => handleOAuthSignIn("google")}
                title="Sign in with Google"
                aria-label="Sign in with Google"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
              </button>

              {/* Guest / Explore preview */}
              <Link
                href="/explore"
                className="auth-social-circle"
                onClick={onClose}
                title="Explore CodeBloom as Guest"
                aria-label="Explore as guest"
              >
                <Compass size={17} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
