"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientClearToken, clientGetToken, clientSetToken } from "@/lib/auth";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const checked = useRef(false);

  // If a token cookie exists, prove it's still valid. Valid -> go home.
  // Dead -> wipe it so the form is usable (this is what breaks the old loop).
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const token = clientGetToken();
    if (!token) return;
    api.auth
      .me(token)
      .then(() => {
        router.replace("/");
        router.refresh();
      })
      .catch(() => {
        clientClearToken();
      });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "login"
          ? await api.auth.login(email, password)
          : await api.auth.register(email, password);
      clientSetToken(res.accessToken);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-2xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-primary-300 via-primary-500 to-success bg-clip-text text-transparent">
            tradeJournaling
          </span>
        </p>

        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <h1 className="text-sm font-bold">
            {mode === "login" ? "Sign in to your journal" : "Create your journal"}
          </h1>
          <p className="mt-1 text-[11px] text-ink-mute">
            {mode === "login"
              ? "Demo account: demo@tradejournaling.app / password123"
              : "A private, isolated workspace will be created for you."}
          </p>

          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
            <Input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              minLength={8}
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] text-ink-soft">
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-bold text-primary-600 underline"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}