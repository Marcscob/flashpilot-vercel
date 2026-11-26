import { supabase } from "@/integrations/supabase/client";

const BUCKET = "flashcard-mindmaps";
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mantém só caracteres seguros para um segmento de path de storage. */
function sanitizePathSegment(value: string, fallback: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return cleaned || fallback;
}

export async function uploadMindMapImage(
  file: File,
  categoryId: string | null,
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Formato de imagem não suportado. Use PNG, JPEG, WebP ou GIF.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("A imagem excede o limite de 8 MB.");
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const rand = crypto.randomUUID();
  const catSeg = sanitizePathSegment(categoryId ?? "", "uncategorized");
  const path = `${u.user.id}/${catSeg}/${rand}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  return path;
}

export async function getMindMapSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteMindMapImage(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
