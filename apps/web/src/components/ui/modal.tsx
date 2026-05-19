"use client";

import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
};

export function Modal({ title, open, onClose, children, size = "md" }: ModalProps) {
  if (!open) return null;

  const panelClass =
    size === "lg"
      ? "max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      : "max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl";

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
