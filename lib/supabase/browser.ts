import { authClient } from "@/lib/auth-client";

export function createSupabaseBrowserClient() {
  return {
    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const res = await authClient.login(email, password);
          return { data: res, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      async signUp({ email, password }: { email: string; password: string; options?: unknown }) {
        try {
          const res = await authClient.signup(email, password);
          return {
            data: { session: res.session ? { user: res.user } : null },
            error: null,
          };
        } catch (err) {
          return { data: { session: null }, error: err };
        }
      },
      async resetPasswordForEmail(email: string) {
        try {
          await authClient.forgotPassword(email);
          return { error: null };
        } catch (err) {
          return { error: err };
        }
      },
      async updateUser({ password }: { password?: string }) {
        try {
          if (password) await authClient.resetPassword(password);
          return { error: null };
        } catch (err) {
          return { error: err };
        }
      },
      async signOut() {
        await authClient.logout();
        return { error: null };
      },
      async getUser() {
        const res = await authClient.getSession();
        return { data: { user: res.user ?? null }, error: null };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {
                // noop
              },
            },
          },
        };
      },
    },
    storage: {
      from() {
        return {
          async upload(path: string) {
            return { data: { path }, error: null };
          },
          async remove() {
            return { data: null, error: null };
          },
          async createSignedUrls(paths: string[]) {
            return {
              data: paths.map((p) => ({ path: p, signedUrl: `/api/media/${p}` })),
              error: null,
            };
          },
        };
      },
    },
  };
}
