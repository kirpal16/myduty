import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_ATTACHMENTS_PER_ENTITY,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
  extensionForMime,
  isAllowedMime,
} from "@/lib/validations/storage";

/**
 * The bucket has no client-facing RLS policy at all (see 0015_storage.sql),
 * so this Route Handler — using the service-role client, only after the
 * checks below pass against the caller's own session — is the only way
 * to actually reach it.
 *
 * Uploading your own file needs no permission grant in the log-book model:
 * the metadata insert goes through the RLS-respecting client, where
 * `attachments_insert` requires uploaded_by = auth.uid().
 */
/**
 * Server-side timing for the upload path.
 *
 * "Compiling /api/storage/upload …" and a slow upload are two different
 * numbers: the first is Next building the route once per dev boot, the second
 * is the request itself. Only the second is measured here, broken into the
 * segments that could actually be slow, so an optimisation targets whichever
 * one dominates rather than whichever one is easiest to guess at.
 *
 * Logs only outside production — this is diagnostic, not telemetry.
 */
function makeTimer() {
  const t0 = performance.now();
  let last = t0;
  const marks: [string, number][] = [];

  return {
    mark(label: string) {
      const now = performance.now();
      marks.push([label, now - last]);
      last = now;
    },
    report(extra: Record<string, unknown> = {}) {
      if (process.env.NODE_ENV === "production") return;
      const total = performance.now() - t0;
      const parts = marks.map(([l, ms]) => `${l}=${ms.toFixed(0)}ms`).join(" ");
      console.log(
        `[upload] total=${total.toFixed(0)}ms ${parts}`,
        Object.keys(extra).length ? extra : "",
      );
    },
  };
}

export async function POST(request: NextRequest) {
  const timer = makeTimer();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  timer.mark("auth");
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Next.js truncates (not rejects) a request body over its own default
  // cap, which corrupts the multipart parse into a raw, unhandled error —
  // check Content-Length upfront so an oversized upload gets our clean
  // message instead of a bare 500.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_SIZE_BYTES + 1024 * 1024) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)` },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)` },
      { status: 400 },
    );
  }
  const file = formData.get("file");
  const relatedEntityType = formData.get("relatedEntityType");
  const relatedEntityId = formData.get("relatedEntityId") || null;

  if (!(file instanceof File) || typeof relatedEntityType !== "string") {
    return NextResponse.json(
      { error: "Missing file or relatedEntityType" },
      { status: 400 },
    );
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)` },
      { status: 400 },
    );
  }

  let countQuery = supabase
    .from("file_attachments")
    .select("id", { count: "exact", head: true })
    .eq("related_entity_type", relatedEntityType);
  countQuery =
    relatedEntityId === null
      ? countQuery.is("related_entity_id", null)
      : countQuery.eq("related_entity_id", relatedEntityId as string);
  const { count } = await countQuery;
  timer.mark("checks");
  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_ENTITY) {
    return NextResponse.json(
      { error: `Attachment limit (${MAX_ATTACHMENTS_PER_ENTITY}) reached for this item` },
      { status: 400 },
    );
  }

  // Storage key is always server-generated — the client-supplied filename
  // is stored only in original_filename for display, never used to build
  // a path (closes path-traversal/collision risk).
  const ext = extensionForMime(file.type);
  const storageKey = `${relatedEntityType}/${relatedEntityId ?? "unfiled"}/${randomUUID()}.${ext}`;

  const admin = createAdminClient();
  // The whole file is buffered before the request starts. Acceptable at the
  // current size cap; the timing below is what says whether it matters.
  const bytes = await file.arrayBuffer();
  timer.mark("buffer");

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, bytes, { contentType: file.type });
  timer.mark("storage");
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: row, error: insertError } = await supabase
    .from("file_attachments")
    .insert({
      bucket_path: storageKey,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId as string | null,
      uploaded_by: auth.user.id,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (insertError || !row) {
    await admin.storage.from(STORAGE_BUCKET).remove([storageKey]);
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to record upload" },
      { status: 500 },
    );
  }

  timer.mark("metadata");
  timer.report({ bytes: file.size, mime: file.type });

  return NextResponse.json(row, { status: 201 });
}
