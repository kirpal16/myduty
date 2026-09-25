import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/validations/storage";

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
