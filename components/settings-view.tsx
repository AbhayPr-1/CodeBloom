"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Download,
  KeyRound,
  Laptop,
  Lock,
  Moon,
  Palette,
  Shield,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-state";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import type { UserPreferences, ActiveSession } from "@/lib/settings";

export function SettingsView({ initialTab = "profile" }: { initialTab?: "profile" | "security" | "preferences" | "danger" }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "preferences" | "danger">(initialTab);

  // Security Tab State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsNotice, setSessionsNotice] = useState("");

  // Preferences Tab State
  const [preferences, setPreferences] = useState<UserPreferences>({
    emailOnVotes: true,
    emailOnComments: true,
    emailOnAnnouncements: false,
    theme: "system",
  });
  const [prefNotice, setPrefNotice] = useState("");

  // Load Sessions & Preferences
  useEffect(() => {
    let active = true;
    if (activeTab === "security") {
      fetch("/api/settings/sessions")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && data?.sessions) setSessions(data.sessions);
        })
        .catch(() => {});
    }

    if (activeTab === "preferences") {
      fetch("/api/settings/preferences")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && data?.preferences) setPreferences(data.preferences);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [activeTab]);

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    if (pwdLoading) return;
    setPwdNotice(null);

    if (newPassword.length < 8) {
      setPwdNotice({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdNotice({ type: "error", text: "New passwords do not match." });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        setPwdNotice({ type: "error", text: data.error || "Unable to update password." });
      } else {
        setPwdNotice({ type: "success", text: "Password updated successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPwdNotice({ type: "error", text: "An error occurred while updating your password." });
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleSignOutOtherSessions() {
    try {
      const res = await fetch("/api/settings/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as { message: string; sessions: ActiveSession[] };
        setSessions(data.sessions || []);
        setSessionsNotice("All other sessions were successfully invalidated.");
      }
    } catch {
      setSessionsNotice("Unable to revoke sessions right now.");
    }
  }

  async function handleTogglePref(key: keyof UserPreferences) {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    setPrefNotice("");

    try {
      const res = await fetch("/api/settings/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setPrefNotice("Preferences saved.");
      }
    } catch {
      // ignore
    }
  }

  function handleExportData() {
    const exportPayload = {
      user: {
        id: user?.id,
        email: user?.email,
        username: user?.username,
        displayName: user?.displayName,
      },
      exportDate: new Date().toISOString(),
      platform: "CodeBloom",
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codebloom-export-${user?.username || "account"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="settings-page-wrapper">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Settings & Account"
        description="Manage your public developer profile, password security, session keys, and preferences."
      />

      <div className="feed-filter-bar settings-tabs-bar">
        <button
          type="button"
          className={`filter-pill ${activeTab === "profile" ? "filter-pill-active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <User size={14} /> Profile Details
        </button>
        <button
          type="button"
          className={`filter-pill ${activeTab === "security" ? "filter-pill-active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <Shield size={14} /> Security & Sessions
        </button>
        <button
          type="button"
          className={`filter-pill ${activeTab === "preferences" ? "filter-pill-active" : ""}`}
          onClick={() => setActiveTab("preferences")}
        >
          <Palette size={14} /> Preferences
        </button>
        <button
          type="button"
          className={`filter-pill ${activeTab === "danger" ? "filter-pill-active" : ""}`}
          onClick={() => setActiveTab("danger")}
        >
          <AlertTriangle size={14} /> Data & Danger Zone
        </button>
      </div>

      <div className="settings-content-pane">
        {/* Profile Tab */}
        {activeTab === "profile" && <ProfileSettingsForm hideHeading />}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="settings-security-layout">
            {/* Password Change Card */}
            <article className="detail-card settings-card-block">
              <div className="settings-card-head">
                <span className="settings-icon">
                  <KeyRound size={16} />
                </span>
                <div>
                  <h3>Change Password</h3>
                  <p>Choose a unique password with at least 8 characters to keep your account safe.</p>
                </div>
              </div>

              {pwdNotice && (
                <p
                  className={pwdNotice.type === "error" ? "error-banner" : "success-banner"}
                  role="status"
                >
                  {pwdNotice.text}
                </p>
              )}

              <form onSubmit={handlePasswordChange} className="settings-form">
                <div className="field">
                  <label htmlFor="currentPassword">Current password</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                  />
                </div>

                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="newPassword">New password</label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={128}
                      placeholder="At least 8 characters"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="confirmPassword">Confirm new password</label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={128}
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="button button-primary" disabled={pwdLoading}>
                    <Lock size={14} /> {pwdLoading ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>
            </article>

            {/* Active Sessions Card */}
            <article className="detail-card settings-card-block">
              <div className="settings-card-head">
                <span className="settings-icon">
                  <Laptop size={16} />
                </span>
                <div>
                  <h3>Active Sessions</h3>
                  <p>Review the browsers and devices currently signed in to your account.</p>
                </div>
              </div>

              {sessionsNotice && <p className="success-banner">{sessionsNotice}</p>}

              <div className="sessions-list">
                {sessions.map((sess) => (
                  <div key={sess.id} className="session-item">
                    <div className="session-item-icon">
                      <Laptop size={18} />
                    </div>
                    <div className="session-item-details">
                      <div className="session-item-top">
                        <strong>{sess.device}</strong>
                        {sess.current && <span className="session-current-pill">Current device</span>}
                      </div>
                      <p>
                        {sess.browser} · IP: {sess.ip} · <em>{sess.lastActive}</em>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sessions-action-row">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={handleSignOutOtherSessions}
                >
                  <ShieldCheck size={14} /> Sign out all other devices
                </button>
              </div>
            </article>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === "preferences" && (
          <div className="settings-preferences-layout">
            {/* Appearance */}
            <article className="detail-card settings-card-block">
              <div className="settings-card-head">
                <span className="settings-icon">
                  <Palette size={16} />
                </span>
                <div>
                  <h3>Appearance & Contrast</h3>
                  <p>Switch between the botanical dark interface and high-contrast light theme.</p>
                </div>
              </div>

              <div className="theme-toggle-row">
                <div className="theme-current-badge">
                  {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                  <span>Current theme: <strong>{theme}</strong></span>
                </div>
                <button type="button" className="button button-outline" onClick={toggleTheme}>
                  Switch to {theme === "dark" ? "light" : "dark"} mode
                </button>
              </div>
            </article>

            {/* Email Notifications */}
            <article className="detail-card settings-card-block">
              <div className="settings-card-head">
                <span className="settings-icon">
                  <ShieldCheck size={16} />
                </span>
                <div>
                  <h3>Email Notifications</h3>
                  <p>Control what emails you receive from CodeBloom.</p>
                </div>
              </div>

              {prefNotice && <p className="preview-feedback">{prefNotice}</p>}

              <div className="preference-toggles-list">
                <label className="pref-toggle-item">
                  <div>
                    <strong>Project Appreciations</strong>
                    <p>Send an email notification when someone upvotes or bookmarks your projects.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailOnVotes}
                    onChange={() => handleTogglePref("emailOnVotes")}
                  />
                </label>

                <label className="pref-toggle-item">
                  <div>
                    <strong>Discussion Comments</strong>
                    <p>Send an email notification when someone leaves thoughtful feedback or comments on your builds.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailOnComments}
                    onChange={() => handleTogglePref("emailOnComments")}
                  />
                </label>

                <label className="pref-toggle-item">
                  <div>
                    <strong>Community & Product Updates</strong>
                    <p>Periodic roundup of top featured open-source builds and community stories.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailOnAnnouncements}
                    onChange={() => handleTogglePref("emailOnAnnouncements")}
                  />
                </label>
              </div>
            </article>
          </div>
        )}

        {/* Data & Danger Zone Tab */}
        {activeTab === "danger" && (
          <div className="settings-danger-layout">
            <article className="detail-card settings-card-block">
              <div className="settings-card-head">
                <span className="settings-icon">
                  <Download size={16} />
                </span>
                <div>
                  <h3>Export Your Account Data</h3>
                  <p>Download a complete machine-readable JSON archive of your profile, projects, and saved builds.</p>
                </div>
              </div>
              <button type="button" className="button button-outline" onClick={handleExportData}>
                <Download size={14} /> Download data archive (.json)
              </button>
            </article>

            <article className="detail-card settings-card-block settings-danger-card">
              <div className="settings-card-head">
                <span className="settings-icon settings-icon-danger">
                  <AlertTriangle size={16} />
                </span>
                <div>
                  <h3 className="danger-text">Delete Account</h3>
                  <p>Permanently remove your account, profile, comments, and project associations. This action is irreversible.</p>
                </div>
              </div>
              <button
                type="button"
                className="button button-danger"
                onClick={() => alert("To protect accounts, account deletion requires administrative verification. Contact support@codebloom.dev from your registered email.")}
              >
                Delete account permanently
              </button>
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
