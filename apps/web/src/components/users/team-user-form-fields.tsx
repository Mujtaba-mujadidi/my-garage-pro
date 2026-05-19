"use client";

import type { TeamUserDto } from "@mygaragepro/shared";

export type RoleOption = { id: string; name: string; slug: string };

type BaseProps = {
  displayName: string;
  email: string;
  password: string;
  garageRoleId: string;
  status: "ACTIVE" | "DISABLED";
  roles: RoleOption[];
  onDisplayNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onGarageRoleIdChange: (v: string) => void;
  onStatusChange: (v: "ACTIVE" | "DISABLED") => void;
};

type CreateProps = BaseProps & { mode: "create" };

type EditProps = BaseProps & {
  mode: "edit";
  user: TeamUserDto;
};

type Props = CreateProps | EditProps;

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

export function TeamUserFormFields(props: Props) {
  const isStaff = props.mode === "edit" ? props.user.role === "STAFF" : true;
  const isOwner = props.mode === "edit" && props.user.role === "OWNER";

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Display name</label>
        <input
          value={props.displayName}
          onChange={(e) => props.onDisplayNameChange(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
        <input
          type="email"
          value={props.email}
          onChange={(e) => props.onEmailChange(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      {isStaff && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Role</label>
            <select
              value={props.garageRoleId}
              onChange={(e) => props.onGarageRoleIdChange(e.target.value)}
              required
              className={inputClass}
            >
              {props.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {props.mode === "edit" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Status</label>
              <select
                value={props.status}
                onChange={(e) => props.onStatusChange(e.target.value as "ACTIVE" | "DISABLED")}
                className={inputClass}
              >
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
          )}
        </>
      )}
      {isOwner && (
        <p className="text-xs text-[var(--muted)]">
          Owner name and email can be updated. Role and status cannot be changed here.
        </p>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
          {props.mode === "create" ? "Password" : "New password (optional)"}
        </label>
        <input
          type="password"
          value={props.password}
          onChange={(e) => props.onPasswordChange(e.target.value)}
          placeholder={props.mode === "edit" ? "Leave blank to keep current" : undefined}
          required={props.mode === "create"}
          className={inputClass}
        />
      </div>
    </div>
  );
}
