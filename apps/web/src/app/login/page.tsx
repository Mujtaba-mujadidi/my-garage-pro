"use client";

import { useSession } from "@/components/providers/session-provider";
import { loginRequest, ApiError } from "@/lib/api-client";
import { APP_NAME } from "@mygaragepro/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useSession();
  const [email, setEmail] = useState("owner@demo.garage");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const session = await loginRequest(email, password);
      setAuthSession(session);
      if (session.user.mustChangePassword) {
        router.push("/login/change-password");
        return;
      }
      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Could not sign in. Is the API running?");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          autoComplete="current-password"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-400 text-sm font-bold text-white">
            MGP
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in to your garage account
          </p>
        </div>

        <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Demo: <strong>owner@demo.garage</strong> / <strong>demo</strong>
          <br />
          Super Admin: <strong>admin@mygaragepro.app</strong> / <strong>ChangeMeAdmin1!</strong>
        </p>
      </div>
    </div>
  );
}
