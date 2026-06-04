"use client";

import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
  /** Fixed-height body; tab panels scroll inside instead of resizing the modal. */
  fixedHeight?: boolean;
};

export function Modal({
  title,
  open,
  onClose,
  children,
  size = "md",
  fixedHeight = false,
}: ModalProps) {
  if (!open) return null;

  const panelClass =
    size === "lg"
      ? `max-h-[90vh] w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl ${
          fixedHeight ? "flex max-h-[min(90vh,640px)] flex-col overflow-hidden" : "overflow-y-auto"
        }`
      : `max-h-[90vh] w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl ${
          fixedHeight ? "flex max-h-[min(90vh,640px)] flex-col overflow-hidden" : "overflow-y-auto"
        }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={panelClass}>
        <h2 id="modal-title" className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
