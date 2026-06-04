"use client";

import {
  detailsEqual,
  GarageDetailsForm,
  garageToDetailsDraft,
} from "@/components/admin/garage-details-form";
import { ModuleSaveConfirmBody } from "@/components/admin/module-save-confirm-body";
import { ModuleToggleList } from "@/components/admin/module-toggle-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiError } from "@/lib/api-client";
import { modulesEqual, toggleModuleList } from "@/lib/module-utils";
import type { GarageAccountDto, ModuleKey, UpdateGarageRequestDto } from "@mygaragepro/shared";
import { FormEvent, useEffect, useState } from "react";

type EditTab = "details" | "modules" | "security";

type Props = {
  garage: GarageAccountDto | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onMessage: (message: string) => void;
};

const TABS: { id: EditTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "modules", label: "Enabled modules" },
  { id: "security", label: "Security" },
];

const TAB_PANEL_CLASS = "min-h-0 flex-1 overflow-y-auto pr-1";
const DETAILS_FORM_ID = "garage-edit-details-form";

function TabBar({
  active,
  onChange,
  detailsDirty,
  modulesDirty,
}: {
  active: EditTab;
  onChange: (tab: EditTab) => void;
  detailsDirty: boolean;
  modulesDirty: boolean;
}) {
  return (
    <div
      className="-mx-1 mb-4 flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] pb-0"
      role="tablist"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            active === tab.id
              ? "border border-b-0 border-[var(--border)] bg-[var(--surface)] text-accent"
              : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          }`}
        >
          {tab.label}
          {tab.id === "details" && detailsDirty && (
            <span
              className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
              title="Unsaved changes"
            />
          )}
          {tab.id === "modules" && modulesDirty && (
            <span
              className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
              title="Unsaved changes"
            />
          )}
        </button>
      ))}
    </div>
  );
}

export function GarageEditModal({ garage, open, onClose, onUpdated, onMessage }: Props) {
  const [activeTab, setActiveTab] = useState<EditTab>("details");
  const [baselineModules, setBaselineModules] = useState<ModuleKey[]>([]);
  const [draftModules, setDraftModules] = useState<ModuleKey[]>([]);
  const [baselineDetails, setBaselineDetails] = useState<UpdateGarageRequestDto | null>(null);
  const [draftDetails, setDraftDetails] = useState<UpdateGarageRequestDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveModulesConfirm, setShowSaveModulesConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [tempPassword, setTempPassword] = useState("");
  const [lastSetPassword, setLastSetPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!garage || !open) return;
    const snap = [...garage.enabledModules];
    setBaselineModules(snap);
    setDraftModules(snap);
    const details = garageToDetailsDraft(garage);
    setBaselineDetails(details);
    setDraftDetails(details);
    setActiveTab("details");
    setError("");
    setTempPassword("");
    setLastSetPassword(null);
    setShowDiscardConfirm(false);
    setShowSaveModulesConfirm(false);
    setShowSuspendConfirm(false);
    setShowActivateConfirm(false);
    setShowResetConfirm(false);
  }, [garage?.id, open]);

  const modulesDirty =
    garage !== null && !modulesEqual(draftModules, baselineModules);
  const detailsDirty =
    garage !== null &&
    baselineDetails !== null &&
    draftDetails !== null &&
    !detailsEqual(draftDetails, baselineDetails);
  const hasUnsavedChanges = modulesDirty || detailsDirty;

  function requestClose() {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }

  async function saveDetails(e?: FormEvent) {
    e?.preventDefault();
    if (!garage || !draftDetails || !detailsDirty) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch<GarageAccountDto>(`/platform/garages/${garage.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...draftDetails,
          vatNumber: draftDetails.vatNumber?.trim() || undefined,
          ownerEmail: draftDetails.ownerEmail?.trim() || undefined,
        }),
      });
      setBaselineDetails({ ...draftDetails });
      onMessage(`Details saved for ${garage.name}.`);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save details");
    } finally {
      setSaving(false);
    }
  }

  async function saveModules() {
    if (!garage) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/platform/garages/${garage.id}/modules`, {
        method: "PATCH",
        body: JSON.stringify({ enabledModules: draftModules }),
      });
      setBaselineModules([...draftModules]);
      onMessage(`Modules saved for ${garage.name}.`);
      setShowSaveModulesConfirm(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Module update failed");
    } finally {
      setSaving(false);
    }
  }

  async function setGarageStatus(action: "suspend" | "activate") {
    if (!garage) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/platform/garages/${garage.id}/${action}`, { method: "PATCH" });
      onMessage(action === "suspend" ? `${garage.name} suspended.` : `${garage.name} activated.`);
      setShowSuspendConfirm(false);
      setShowActivateConfirm(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmResetPassword() {
    if (!garage || !tempPassword.trim()) return;
    const pwd = tempPassword;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch<{ ok: boolean; ownerEmail: string }>(
        `/platform/garages/${garage.id}/reset-owner-password`,
        { method: "PATCH", body: JSON.stringify({ tempPassword: pwd }) },
      );
      setLastSetPassword(pwd);
      setTempPassword("");
      setShowResetConfirm(false);
      onMessage(`Owner password reset for ${res.ownerEmail}. They must change it on next login.`);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Password reset failed");
    } finally {
      setSaving(false);
    }
  }

  function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tempPassword.trim() || !garage?.ownerEmail) return;
    setShowResetConfirm(true);
  }

  if (!garage || !draftDetails) return null;

  return (
    <>
      <Modal
        title={`Edit: ${garage.name}`}
        open={open}
        onClose={requestClose}
        size="lg"
        fixedHeight
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <TabBar
            active={activeTab}
            onChange={setActiveTab}
            detailsDirty={detailsDirty}
            modulesDirty={modulesDirty}
          />

          <div className={TAB_PANEL_CLASS} role="tabpanel">
            {activeTab === "details" && (
              <form
                id={DETAILS_FORM_ID}
                onSubmit={(e) => void saveDetails(e)}
                className="space-y-3"
              >
                <GarageDetailsForm
                  key={garage.id}
                  value={draftDetails}
                  onChange={(next) => {
                    setDraftDetails(next);
                    setError("");
                  }}
                  garage={garage}
                  disabled={saving}
                />
              </form>
            )}

            {activeTab === "modules" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--muted)]">
                  Turn modules on or off, then save. Staff only see enabled modules their role
                  allows.
                </p>
                <ModuleToggleList
                  enabledModules={draftModules}
                  onToggle={(key, enabled) => {
                    setDraftModules((c) => toggleModuleList(c, key, enabled));
                    setError("");
                  }}
                  disabled={saving}
                />
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <section className="rounded-lg border border-[var(--border)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Garage access</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Suspended garages cannot sign in. All owner and staff accounts are blocked
                    while suspended.
                  </p>
                  <p className="mt-2 text-sm">
                    Current status:{" "}
                    <span className="font-medium">{garage.status}</span>
                  </p>
                  <div className="mt-4">
                    {garage.status === "ACTIVE" ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setShowSuspendConfirm(true)}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Suspend garage
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setShowActivateConfirm(true)}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Activate garage
                      </button>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    Reset owner password
                  </h3>
                  {!garage.ownerEmail ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">No owner login email on record.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Set a temporary password for{" "}
                        <span className="font-mono text-accent">{garage.ownerEmail}</span>. They
                        must choose a new password on next login.
                      </p>
                      {lastSetPassword && (
                        <p className="mt-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
                          Temporary password (share securely):
                          <span className="mt-1 block font-mono font-semibold">
                            {lastSetPassword}
                          </span>
                        </p>
                      )}
                      <form
                        onSubmit={handleResetSubmit}
                        className="mt-3 flex flex-wrap items-end gap-2"
                      >
                        <div className="min-w-[200px] flex-1">
                          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                            Temporary password
                          </label>
                          <input
                            type="text"
                            value={tempPassword}
                            onChange={(e) => {
                              setLastSetPassword(null);
                              setTempPassword(e.target.value);
                            }}
                            placeholder="New temp password"
                            autoComplete="new-password"
                            minLength={4}
                            required
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={saving || !tempPassword.trim()}
                          className="rounded-lg border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-200 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                        >
                          Reset password
                        </button>
                      </form>
                    </>
                  )}
                </section>
              </div>
            )}
          </div>

          {error && <p className="mt-3 shrink-0 text-sm text-red-600">{error}</p>}

          <div className="mt-4 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.25)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-xs text-[var(--muted)]">
                {activeTab === "details" && detailsDirty && (
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Unsaved detail changes
                  </span>
                )}
                {activeTab === "modules" && modulesDirty && (
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Unsaved module changes
                  </span>
                )}
                {activeTab === "security" && "Security actions apply immediately after you confirm."}
                {activeTab === "details" && !detailsDirty && "Edit garage details, then save."}
                {activeTab === "modules" && !modulesDirty && "Toggle modules, then save."}
              </p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={saving}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium hover:bg-[var(--background)] disabled:opacity-50"
                >
                  Close
                </button>
                {activeTab === "details" && (
                  <button
                    type="submit"
                    form={DETAILS_FORM_ID}
                    disabled={saving || !detailsDirty}
                    className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save details"}
                  </button>
                )}
                {activeTab === "modules" && (
                  <button
                    type="button"
                    disabled={saving || !modulesDirty}
                    onClick={() => setShowSaveModulesConfirm(true)}
                    className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                  >
                    Save modules
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDiscardConfirm}
        title="Discard unsaved changes?"
        variant="danger"
        icon="⚠"
        description="You have unsaved changes. Close anyway?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      <ConfirmDialog
        open={showSaveModulesConfirm}
        title="Save module changes?"
        icon="💾"
        description={
          <ModuleSaveConfirmBody
            garageName={garage.name}
            before={baselineModules}
            after={draftModules}
          />
        }
        confirmLabel="Save changes"
        cancelLabel="Keep editing"
        loading={saving}
        onConfirm={() => void saveModules()}
        onCancel={() => setShowSaveModulesConfirm(false)}
      />

      <ConfirmDialog
        open={showSuspendConfirm}
        title="Suspend garage?"
        variant="danger"
        icon="⛔"
        loading={saving}
        description={
          <span>
            Suspend <strong className="text-[var(--foreground)]">{garage.name}</strong>? Owner and
            staff will not be able to sign in until the garage is activated again.
          </span>
        }
        confirmLabel="Suspend garage"
        onConfirm={() => void setGarageStatus("suspend")}
        onCancel={() => setShowSuspendConfirm(false)}
      />

      <ConfirmDialog
        open={showActivateConfirm}
        title="Activate garage?"
        icon="✓"
        loading={saving}
        description={
          <span>
            Activate <strong className="text-[var(--foreground)]">{garage.name}</strong>? Users can
            sign in again according to their roles and permissions.
          </span>
        }
        confirmLabel="Activate garage"
        onConfirm={() => void setGarageStatus("activate")}
        onCancel={() => setShowActivateConfirm(false)}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset owner password?"
        variant="danger"
        icon="🔑"
        loading={saving}
        description={
          <span>
            Set a new temporary password for{" "}
            <strong className="text-[var(--foreground)]">{garage.ownerEmail}</strong>? They will be
            required to choose a new password when they sign in.
          </span>
        }
        confirmLabel="Reset password"
        onConfirm={() => void confirmResetPassword()}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  );
}
