export interface AuthResponse {
  user?: {
    id: string;
    email?: string | null;
    username?: string;
    displayName?: string;
  } | null;
  session?: boolean;
  requiresEmailVerification?: boolean;
  message?: string;
  error?: string;
}

export const authClient = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as AuthResponse;
    if (!res.ok) throw new Error(data.error ?? "Invalid email or password.");
    return data;
  },

  async signup(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as AuthResponse;
    if (!res.ok) throw new Error(data.error ?? "Unable to create account.");
    return data;
  },

  async forgotPassword(email: string): Promise<AuthResponse> {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as AuthResponse;
    if (!res.ok) throw new Error(data.error ?? "Unable to request password recovery.");
    return data;
  },

  async resetPassword(password: string): Promise<AuthResponse> {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as AuthResponse;
    if (!res.ok) throw new Error(data.error ?? "Unable to update password.");
    return data;
  },

  async logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
  },

  async getSession(): Promise<AuthResponse> {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return { user: null };
    return (await res.json()) as AuthResponse;
  },
};

