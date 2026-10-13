import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { STORAGE_BUCKET, SIGNED_URL_TTL_SECONDS, extensionForMime } from "@/lib/validations/storage";

/**
 * Read access is entirely delegated to RLS on file_attachments (own row or
 * STORAGE_VIEW_ALL) — if the row doesn't come back, the caller can't see
 * it, and we return 404 either way rather than distinguishing "doesn't
 * exist" from "not yours" (avoids leaking existence to unauthorized users).
 * Only once RLS has confirmed visibility does the service-role client
 * mint a short-lived signed URL — the bucket itself is unreachable any
 * other way.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("file_attachments")
    .select("bucket_path")
    .eq("id", id)
    .single();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(row.bucket_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to sign URL" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}

/**
 * Update metadata (original_filename, description) for an existing file attachment.
 * Restricted to the original uploader or a SUPER_ADMIN.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { original_filename, description } = body as {
    original_filename?: unknown;
    description?: unknown;
  };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("file_attachments")
    .select("id, original_filename, mime_type, uploaded_by, description")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "That file no longer exists, or you do not have access to it." },
      { status: 404 },
    );
  }

  const isOwner = existing.uploaded_by === user.id;
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  if (!isOwner && !isSuperAdmin) {
    return NextResponse.json(
      { error: "You do not have permission to edit this file." },
      { status: 403 },
    );
  }

  const updates: { original_filename?: string; description?: string | null } = {};

  if (typeof original_filename === "string") {
    const trimmed = original_filename.trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "Document name cannot be empty." },
        { status: 400 },
      );
    }

    const existingExtMatch = existing.original_filename.match(/\.([a-zA-Z0-9]+)$/);
    const existingExt = existingExtMatch ? existingExtMatch[1] : extensionForMime(existing.mime_type);

    let finalName = trimmed;
    if (existingExt) {
      const hasExt = new RegExp(`\\.${existingExt}$`, "i").test(trimmed);
      if (!hasExt) {
        finalName = `${trimmed}.${existingExt}`;
      }
    }

    if (finalName.length > 255) {
      return NextResponse.json(
        { error: "Document name is too long (maximum 255 characters)." },
        { status: 400 },
      );
    }
    updates.original_filename = finalName;
  }

  if (description !== undefined) {
    if (description === null || description === "") {
      updates.description = null;
    } else if (typeof description === "string") {
      const trimmedDesc = description.trim();
      if (trimmedDesc.length > 1000) {
        return NextResponse.json(
          { error: "Description is too long (maximum 1000 characters)." },
          { status: 400 },
        );
      }
      updates.description = trimmedDesc || null;
    } else {
      return NextResponse.json(
        { error: "Description must be a string or null." },
        { status: 400 },
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  // Attempt update via RLS-respecting client first
  let { data: updated, error: updateError } = await supabase
    .from("file_attachments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  // If RLS update policy is missing or blocked before migration is applied,
  // fallback to admin client since we verified user authorization above.
  if (updateError || !updated) {
    const admin = createAdminClient();
    const { data: adminUpdated, error: adminError } = await admin
      .from("file_attachments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (adminError || !adminUpdated) {
      return NextResponse.json(
        { error: adminError?.message ?? updateError?.message ?? "Failed to update file details." },
        { status: 500 },
      );
    }
    updated = adminUpdated;
  }

  return NextResponse.json({ ok: true, file: updated });
}

/**
 * Delete access mirrors RLS exactly: attempt the metadata delete through
 * the RLS-respecting client first. If RLS blocks it (not the uploader,
 * lacks STORAGE_DELETE), zero rows come back and the bucket object is
 * left untouched — the service-role removal only runs once RLS has
 * already confirmed the caller was allowed to delete this row.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deleted, error } = await supabase
    .from("file_attachments")
    .delete()
    .eq("id", id)
    .select("bucket_path")
    .single();

  if (error || !deleted) {
    // Deliberately one message for both "does not exist" and "not yours", so
    // the response cannot be used to probe which files exist.
    return NextResponse.json(
      { error: "That file no longer exists, or you do not have access to it." },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  await admin.storage.from(STORAGE_BUCKET).remove([deleted.bucket_path]);

  return NextResponse.json({ ok: true });
}

