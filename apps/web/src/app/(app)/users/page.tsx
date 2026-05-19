"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/layout/permission-gate";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { TeamUserDto } from "@mygaragepro/shared";

type RoleOption = { id: string; name: string; slug: string };

export default function UsersPage() {
  const [users, setUsers] = useState<TeamUserDto[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("demo");
  const [garageRoleId, setGarageRoleId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [userRows, roleList] = await Promise.all([
      apiFetch<TeamUserDto[]>("/users"),
      apiFetch<RoleOption[]>("/users/roles"),
    ]);
    setUsers(userRows);
    setRoles(roleList);
    setGarageRoleId((current) => {
      if (current) return current;
      const mechanic = roleList.find((r) => r.slug === "mechanic");
      return mechanic?.id ?? roleList[0]?.id ?? "";
    });
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
        body: JSON.stringify({ email, displayName, password, garageRoleId }),
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
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs">
              {u.role === "OWNER" ? "Owner" : (u.garageRoleName ?? u.role)}
            </span>
          </li>
        ))}
      </ul>

      <PermissionGate permission="users.write">
        <form
          onSubmit={onSubmit}
          className="max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
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
            value={garageRoleId}
            onChange={(e) => setGarageRoleId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
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
