"use client";

import { PermissionGate } from "@/components/layout/permission-gate";
import { apiFetch, ApiError } from "@/lib/api-client";
import { USER_ROLES, type UserRole } from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: string;
};

const GARAGE_ROLES = USER_ROLES.filter((r) => r !== "SUPER_ADMIN");

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("demo");
  const [role, setRole] = useState<UserRole>("MECHANIC");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setUsers(await apiFetch<UserRow[]>("/users"));
  }, []);

  useEffect(() => {
    void load().catch(() => setError("Could not load users"));
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({ email, displayName, password, role }),
      });
      setEmail("");
      setDisplayName("");
      setMessage("User created.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  return (
    <PermissionGate permission="users.read">
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Team users</h1>
      {message && <p className="mb-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <ul className="mb-8 space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
          >
            <span className="font-medium">{u.displayName}</span>
            <span className="text-[var(--muted)]">{u.email}</span>
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs">{u.role}</span>
          </li>
        ))}
      </ul>

      <PermissionGate permission="users.write">
        <form onSubmit={onSubmit} className="max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold">Add user</h2>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            {GARAGE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
            Create user
          </button>
        </form>
      </PermissionGate>
    </PermissionGate>
  );
}
