import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  STORAGE_BUCKET,
  MAX_FILE_SIZE_BYTES,
  isAllowedMime,
  extensionForMime,
} from "@/lib/validations/storage";

export async function saveFormAttachment({
  file,
  relatedEntityType,
  relatedEntityId,
  userId,
  documentTitle,
  documentDate,
  description,
}: {
  file: File;
  relatedEntityType: string;
  relatedEntityId: string;
  userId: string;
  documentTitle?: string | null;
  documentDate?: string | null;
  description?: string | null;
}) {
  if (!file || !(file instanceof File) || file.size === 0) return null;

  if (!isAllowedMime(file.type)) {
    throw new Error("File format not supported. Please upload JPG, PNG, PDF, or DOCX.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB).`);
  }

  const ext = extensionForMime(file.type);
  const storageKey = `${relatedEntityType}/${relatedEntityId}/${randomUUID()}.${ext}`;

  const cleanTitle = documentTitle?.trim();
  const filename = cleanTitle
    ? (cleanTitle.toLowerCase().endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`)
    : file.name;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, await file.arrayBuffer(), { contentType: file.type });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  let insertCreatedAt: string | undefined = undefined;
  if (documentDate) {
    const parsedDate = new Date(documentDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      insertCreatedAt = parsedDate.toISOString();
    }
  }

  const supabase = await createClient();
  const { data: attachment, error: insertError } = await supabase
    .from("file_attachments")
    .insert({
      bucket_path: storageKey,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      uploaded_by: userId,
      original_filename: filename,
      mime_type: file.type,
      size_bytes: file.size,
      description: description?.trim() || null,
      ...(insertCreatedAt ? { created_at: insertCreatedAt } : {}),
    })
    .select()
    .single();

  if (insertError || !attachment) {
    await admin.storage.from(STORAGE_BUCKET).remove([storageKey]);
    throw new Error(insertError?.message ?? "Failed to register attachment record.");
  }

  return attachment;
}
