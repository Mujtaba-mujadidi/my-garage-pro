"use client";

import { Select } from "@/components/ui/select";
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
          autoComplete={props.mode === "create" ? "off" : "name"}
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
          autoComplete={props.mode === "create" ? "off" : "email"}
          className={inputClass}
        />
      </div>
      {isStaff && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Role</label>
            <Select
              value={props.garageRoleId}
              onChange={props.onGarageRoleIdChange}
              required
              placeholder="Select a role…"
              options={props.roles.map((r) => ({ value: r.id, label: r.name }))}
            />
          </div>
          {props.mode === "edit" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Status</label>
              <Select
                value={props.status}
                onChange={(v) => props.onStatusChange(v as "ACTIVE" | "DISABLED")}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "DISABLED", label: "Disabled" },
                ]}
              />
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
          name={props.mode === "create" ? "new-team-member-password" : undefined}
          value={props.password}
          onChange={(e) => props.onPasswordChange(e.target.value)}
          placeholder={
            props.mode === "edit" ? "Leave blank to keep current" : "Enter a password"
          }
          required={props.mode === "create"}
          autoComplete={props.mode === "create" ? "new-password" : "new-password"}
          className={inputClass}
        />
      </div>
    </div>
  );
}
