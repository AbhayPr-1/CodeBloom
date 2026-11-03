"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft, ArrowRight, Compass, Eye, EyeOff, GitFork, LockKeyhole,
  Mail, Moon, Sprout, Sun,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { authSuccessDestination, safeAuthDestination } from "@/lib/auth-destination";

type AuthMode = "login" | "signup" | "forgot" | "reset";
const descriptions: Record<AuthMode, { eyebrow: string; title: string; description: string }> = {
  login: { eyebrow: "WELCOME BACK", title: "Sign in to CodeBloom", description: "Pick up where your curiosity left off." },
  signup: { eyebrow: "COME GROW WITH US", title: "Create your account", description: "Find your people. Share what you are building." },
  forgot: { eyebrow: "ACCOUNT RECOVERY", title: "Reset your password", description: "We will send a secure recovery link to your email." },
  reset: { eyebrow: "SET A NEW PASSWORD", title: "Choose a new password", description: "Use at least 8 characters for your new password." },
};

export function AuthPage({ mode, next = "/dashboard", authError = false }: { mode: AuthMode; next?: string; authError?: boolean }) {
  const router = useRouter();
  const { configured, refresh } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(authError ? "That session could not be verified or has expired. Sign in again to continue." : "");
  const [message, setMessage] = useState("");
  const copy = descriptions[mode];
  const destination = safeAuthDestination(next);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!configured) {
      setError("Authentication is not configured yet. Add your MongoDB Atlas connection string to .env.local.");
      return;
    }

    const form = new FormData(event.currentTarget);
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
        router.replace(authSuccessDestination(destination, "login"));
        router.refresh();
      } else if (mode === "signup") {
        const { data, error: authError } = await client.auth.signUp({ email, password });
        if (authError) throw authError;
        if (data?.session) {
          await refresh();
          router.replace(authSuccessDestination(destination, "signup"));
          router.refresh();
        } else {
          setMessage("Check your email to confirm your account. Your secure link will bring you back to CodeBloom, where you can take your first steps.");
        }
      } else if (mode === "forgot") {
        const { error: authError } = await client.auth.resetPasswordForEmail(email);
        if (authError) throw authError;
        setMessage("If an account exists for that email, a password recovery link is on its way.");
      } else {
        const { error: authError } = await client.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Your password has been updated. You can continue to CodeBloom.");
        await refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not complete that request. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  const needsEmail = mode !== "reset";
  const needsPassword = mode === "login" || mode === "signup" || mode === "reset";
  return <main className="auth-public-page" data-auth-mode={mode}>
    <header className="auth-public-nav">
      <Link href="/" className="auth-brand" aria-label="CodeBloom home"><span className="brand-icon" aria-hidden="true"><i /><i /><i /><i /></span><span className="brand-name">code<span>bloom</span><small>DISCOVER · DISCUSS · BUILD UPON</small></span></Link>
      <div><button className="icon-button theme-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><Link href="/explore">Explore projects</Link></div>
    </header>

    <div className="auth-content">
      <aside className="auth-story" aria-label="Why join CodeBloom">
        <p className="auth-story-eyebrow"><span /> A COMMUNITY FOR BUILDERS</p>
        <h2>Make room for the work <em>behind the work.</em></h2>
        <p className="auth-story-intro">CodeBloom brings projects and the people who make them into one thoughtful place to learn, share, and build on each other&apos;s ideas.</p>
        <ul className="auth-story-list">
          <li><span className="auth-story-icon"><Compass size={17} /></span><span><strong>Find your next rabbit hole</strong><small>Explore software, experiments, and open-source work.</small></span></li>
          <li><span className="auth-story-icon"><Sprout size={17} /></span><span><strong>Make your profile yours</strong><small>Introduce yourself and what you are learning.</small></span></li>
          <li><span className="auth-story-icon"><GitFork size={17} /></span><span><strong>Share what you build</strong><small>Give others a starting point for their next idea.</small></span></li>
        </ul>
        <p className="auth-story-note"><LockKeyhole size={15} /> Your email stays private. Public profiles show your CodeBloom username, chosen display name, and bio—not your login email.</p>
      </aside>

      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="auth-back-link" href="/"><ArrowLeft size={14} /> Back to CodeBloom</Link>
        <span className="auth-panel-mark"><Sprout size={22} /></span>
        <p className="landing-kicker">{copy.eyebrow}</p>
        <h1 id="auth-title">{copy.title}</h1>
        <p className="auth-panel-description">{copy.description}</p>
        {!configured && <div className="auth-config-warning" role="status"><LockKeyhole size={17} /><span>MongoDB Atlas setup is required to use this form. Public project browsing remains available.</span></div>}
        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
          {needsEmail && <label>Email address<span className="auth-input-wrap"><Mail size={16} /><input required type="email" name="email" autoComplete="email" placeholder="you@example.com" /></span></label>}
          {needsPassword && <label>{mode === "reset" ? "New password" : "Password"}<span className="auth-input-wrap"><LockKeyhole size={16} /><input required type={showPassword ? "text" : "password"} name="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
          {mode === "signup" && <label>Confirm password<span className="auth-input-wrap"><LockKeyhole size={16} /><input required type={showConfirmPassword ? "text" : "password"} name="confirmPassword" minLength={8} autoComplete="new-password" placeholder="Re-enter your password" /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span><span className="auth-field-hint">Use at least 8 characters and enter the same password twice.</span></label>}
          {mode === "login" && <div className="auth-form-meta"><span>Use your email and password</span><Link href={`/forgot-password?next=${encodeURIComponent(destination)}`}>Forgot password?</Link></div>}
          {error && <p className="error-banner" role="alert">{error}</p>}
          {message && <p className="success-banner" role="status">{message}</p>}
          <button className="button button-primary button-wide auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? <>Create account <ArrowRight size={15} /></> : mode === "forgot" ? "Send recovery link" : "Update password"}</button>
        </form>
        <div className="auth-switch">{mode === "login" ? <>New to CodeBloom? <Link href={`/signup?next=${encodeURIComponent(destination)}`}>Create an account</Link></> : mode === "signup" ? <>Already growing with us? <Link href={`/login?next=${encodeURIComponent(destination)}`}>Sign in</Link></> : mode === "forgot" ? <>Remembered it? <Link href={`/login?next=${encodeURIComponent(destination)}`}>Back to sign in</Link></> : <>Password updated? <Link href="/login">Sign in</Link></>}</div>
        <p className="auth-privacy-note">By continuing, you agree to keep the garden welcoming. Your account is secured with MongoDB Atlas.</p>
      </section>
    </div>
    <footer className="auth-public-footer">CodeBloom · Great projects don&apos;t grow alone.</footer>
  </main>;
}
