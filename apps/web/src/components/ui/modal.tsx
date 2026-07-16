"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
  /** Fixed-height body; tab panels scroll inside instead of resizing the modal. */
  fixedHeight?: boolean;
  /** Max height in px when `fixedHeight` is set (default 640). */
  fixedHeightPx?: number;
  /** Panel height follows content (up to 90vh), then scrolls — for forms that expand. */
  autoHeight?: boolean;
  /** Show expand / restore control for near full-screen editing. */
  allowFullscreen?: boolean;
  /**
   * When true (default), header Close asks for confirmation before calling `onClose`.
   * Set false when the parent already handles discard confirmation.
   */
  confirmOnClose?: boolean;
  /** Title for the close confirmation dialog. */
  confirmCloseTitle?: string;
  /** Body text for the close confirmation dialog. */
  confirmCloseDescription?: string;
};

export function Modal({
  title,
  open,
  onClose,
  children,
  size = "md",
  fixedHeight = false,
  fixedHeightPx = 640,
  autoHeight = false,
  allowFullscreen = false,
  confirmOnClose = true,
  confirmCloseTitle = "Close this window?",
  confirmCloseDescription = "Any unsaved changes may be lost.",
}: ModalProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const fixedPanelHeight = `min(90vh, ${fixedHeightPx}px)`;

  useEffect(() => {
    if (!open) {
      setFullscreen(false);
      setConfirmCloseOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, fullscreen]);

  function requestClose() {
    if (confirmOnClose) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  }

  if (!open) return null;

  const overflowClass = fixedHeight
    ? fullscreen
      ? "flex min-h-0 flex-1 flex-col overflow-hidden"
      : "flex min-h-0 flex-col overflow-hidden"
    : autoHeight
      ? "max-h-[90vh] overflow-y-auto"
      : "max-h-[90vh] overflow-y-auto";

  const panelClass = fullscreen
    ? `flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-[var(--surface)] shadow-none ${overflowClass}`
    : size === "2xl"
      ? `w-full max-w-5xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl ${overflowClass}`
      : size === "xl"
        ? `w-full max-w-4xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl ${overflowClass}`
        : size === "lg"
        ? `w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl ${overflowClass}`
        : `w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl ${overflowClass}`;

  const backdropClass = fullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-[var(--surface)]"
    : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4";

  const paddingClass = fullscreen ? "flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6" : "";

  return (
    <>
      <div
        className={backdropClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className={`${panelClass} ${paddingClass}`}
          style={
            fixedHeight && !fullscreen
              ? { height: fixedPanelHeight, maxHeight: fixedPanelHeight }
              : undefined
          }
        >
          <div
            className={`mb-4 flex shrink-0 items-start justify-between gap-3 ${fullscreen ? "border-b border-[var(--border)] pb-3" : ""}`}
          >
            <h2 id="modal-title" className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              {allowFullscreen && (
                <button
                  type="button"
                  onClick={() => setFullscreen((v) => !v)}
                  className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
                  aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                >
                  {fullscreen ? "Exit full screen" : "Full screen"}
                </button>
              )}
              <button
                type="button"
                onClick={requestClose}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>
          {fixedHeight ? (
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          ) : (
            children
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCloseOpen}
        title={confirmCloseTitle}
        description={confirmCloseDescription}
        confirmLabel="Close"
        cancelLabel="Keep open"
        variant="danger"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onClose();
        }}
      />
    </>
  );
}
