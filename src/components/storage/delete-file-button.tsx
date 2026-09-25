"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";

export function DeleteFileButton({
  id,
  label = "Delete",
}: {
  id: string;
  label?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    setError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/storage/${id}`, { method: "DELETE" });
      if (res.ok) {
        setIsOpen(false);
        startTransition(() => router.refresh());
        return;
      }
      // Previously there was no `else` at all: a refused delete left the modal
      // open with the spinner off and no explanation, so the file looked like
      // it had simply failed to disappear.
      const body = await res.json().catch(() => null);
      setError(
        body?.error ??
          (res.status === 404
            ? "That file no longer exists, or you do not have access to it."
            : `Could not delete this file (${res.status}).`),
      );
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleClose() {
    setError(null);
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isPending || isDeleting}
        className="inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
        title="Delete attachment"
      >
        <Trash2 className="size-3" />
        <span>{label}</span>
      </button>

      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleDelete}
        title="Delete File Attachment"
        description={
          error ??
          "Are you sure you want to permanently delete this file attachment from the vault? This cannot be undone."
        }
        confirmLabel={error ? "Try again" : "Delete File"}
        isPending={isPending || isDeleting}
      />
    </>
  );
}
