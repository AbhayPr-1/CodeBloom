"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Check, ExternalLink, Save, UserRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-state";
import { useAuth } from "@/components/auth-provider";
import type { ProfileRecord, ProfileUpdate } from "@/lib/validation/profiles";

type RequestState = "loading" | "ready" | "saving" | "saved" | "error";

export function ProfileSettingsForm({ hideHeading = false }: { hideHeading?: boolean } = {}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [state, setState] = useState<RequestState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { profile?: ProfileRecord; error?: string };
        if (!response.ok || !body.profile) throw new Error(body.error ?? "Unable to load your profile.");
        if (active) { setProfile(body.profile); setState("ready"); }
      })
      .catch((cause: unknown) => {
        if (active) { setError(cause instanceof Error ? cause.message : "Unable to load your profile."); setState("error"); }
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: ProfileUpdate = {
      username: String(data.get("username") ?? ""),
      displayName: String(data.get("displayName") ?? ""),
      bio: String(data.get("bio") ?? ""),
    };
    setState("saving");
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json() as { profile?: ProfileRecord; error?: string };
      if (!response.ok || !body.profile) throw new Error(body.error ?? "Unable to save your profile.");
      setProfile(body.profile);
      setState("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your profile.");
      setState("ready");
    }
  }

  return <section className="form-page profile-settings-page">
    {!hideHeading && <PageHeading eyebrow="YOUR ACCOUNT" title="Developer profile" description="Choose the name, handle, and short introduction people will see on your public developer profile." action={profile ? <Link className="button button-outline" href={`/u/${encodeURIComponent(profile.username)}`}><ExternalLink size={15} /> View profile</Link> : undefined} />}
    <div className="profile-account-note"><UserRound size={17} /><span>Signed in as <strong>{user?.email ?? "your CodeBloom account"}</strong></span></div>
    {state === "loading" && <p className="profile-form-state" role="status">Loading your profile…</p>}
    {state === "error" && <div className="error-banner" role="alert">{error} <p>If your account predates the profile trigger, review and apply the latest profile migration.</p></div>}
    {profile && <form key={`${profile.username}-${profile.updatedAt}`} className="publish-form" onSubmit={submit} aria-busy={state === "saving"}>
      <label>Display name<input name="displayName" required minLength={1} maxLength={80} defaultValue={profile.displayName} /></label>
      <label>Username<input name="username" required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9_-]{2,29}" autoCapitalize="none" autoCorrect="off" defaultValue={profile.username} /><span className="form-hint">Your public profile path is <Link href={`/u/${encodeURIComponent(profile.username)}`}>/u/{profile.username}</Link>.</span></label>
      <label>Short bio<textarea name="bio" maxLength={500} rows={5} defaultValue={profile.bio} placeholder="What are you exploring or building?" /><span className="form-hint">Up to 500 characters.</span></label>
      {error && state !== "error" && <p className="error-banner" role="alert">{error}</p>}
      {state === "saved" && <p className="success-banner" role="status"><Check size={16} /> Profile saved.</p>}
      <div className="form-actions"><Link className="button button-outline" href="/settings">Cancel</Link><button className="button button-primary" type="submit" disabled={state === "saving"}>{state === "saving" ? <span className="spinner" aria-hidden="true" /> : <Save size={15} />}{state === "saving" ? "Saving…" : "Save profile"}</button></div>
    </form>}
    <p className="profile-privacy-hint">Your display name, username, and bio are public. Email and authentication details are never shown on the public profile.</p>
  </section>;
}
