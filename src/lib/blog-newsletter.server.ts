import { findBlogLang, matchBlogTag } from "./blog-langs";
import type { Database } from "@/integrations/supabase/types";

type Subscriber = Database["public"]["Tables"]["blog_subscribers"]["Row"];
type Delivery = Database["public"]["Tables"]["blog_newsletter_deliveries"]["Row"];
type PostTranslation = Pick<
  Database["public"]["Tables"]["blog_post_translations"]["Row"],
  "post_id" | "lang" | "title" | "excerpt"
>;

const ANNOUNCEMENT_BATCH_SIZE = 100;
const DELIVERY_BATCH_SIZE = 100;
const DATABASE_PAGE_SIZE = 1000;
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
];
const SITE_URL = "https://flashpilot.net";

function chunksOf<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function errorLabel(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code.slice(0, 100);
  }
  return error instanceof Error ? error.name : "UnknownError";
}

function plainExcerpt(value: string | null): string | null {
  if (!value) return null;
  const excerpt = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return excerpt ? excerpt.slice(0, 500) : null;
}

function postTranslationFor(
  translations: PostTranslation[],
  lang: string,
): PostTranslation | undefined {
  const preferred = matchBlogTag(lang) ?? "en";
  const base = findBlogLang(preferred)?.base;
  return (
    translations.find((translation) => translation.lang === preferred) ??
    (base ? translations.find((translation) => translation.lang === base) : undefined) ??
    translations.find((translation) => translation.lang === "en") ??
    translations[0]
  );
}

async function queueNewPublications(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  now: string,
): Promise<number> {
  const { data: duePosts, error: postError } = await supabaseAdmin
    .from("blog_posts")
    .select("id")
    .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${now})`)
    .limit(1000);
  if (postError) throw postError;
  const postIds = (duePosts ?? []).map((post) => post.id);
  if (!postIds.length) return 0;

  const { error: upsertError } = await supabaseAdmin.from("blog_newsletter_publications").upsert(
    postIds.map((post_id) => ({ post_id })),
    { onConflict: "post_id", ignoreDuplicates: true },
  );
  if (upsertError) throw upsertError;

  const { data: publications, error: publicationError } = await supabaseAdmin
    .from("blog_newsletter_publications")
    .select("post_id")
    .in("post_id", postIds)
    .is("queued_at", null)
    .limit(ANNOUNCEMENT_BATCH_SIZE);
  if (publicationError) throw publicationError;
  const unqueuedPostIds = (publications ?? []).map((publication) => publication.post_id);
  if (!unqueuedPostIds.length) return 0;

  let queued = 0;
  for (let offset = 0; ; offset += DATABASE_PAGE_SIZE) {
    const { data: subscribers, error: subscriberError } = await supabaseAdmin
      .from("blog_subscribers")
      .select("id")
      .not("confirmed_at", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + DATABASE_PAGE_SIZE - 1);
    if (subscriberError) throw subscriberError;
    if (!subscribers?.length) break;

    const records = unqueuedPostIds.flatMap((post_id) =>
      subscribers.map((subscriber) => ({ post_id, subscriber_id: subscriber.id })),
    );
    for (const batch of chunksOf(records, 500)) {
      const { error } = await supabaseAdmin
        .from("blog_newsletter_deliveries")
        .upsert(batch, { onConflict: "post_id,subscriber_id", ignoreDuplicates: true });
      if (error) throw error;
      queued += batch.length;
    }
    if (subscribers.length < DATABASE_PAGE_SIZE) break;
  }

  const { error: markQueuedError } = await supabaseAdmin
    .from("blog_newsletter_publications")
    .update({ queued_at: now })
    .in("post_id", unqueuedPostIds)
    .is("queued_at", null);
  if (markQueuedError) throw markQueuedError;
  return queued;
}

async function processPendingDeliveries(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  now: string,
): Promise<{ processed: number; sent: number; suppressed: number; failed: number }> {
  const { data: deliveries, error: deliveryError } = await supabaseAdmin
    .from("blog_newsletter_deliveries")
    .select("id, post_id, subscriber_id, attempt_count")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(DELIVERY_BATCH_SIZE);
  if (deliveryError) throw deliveryError;
  const rows = (deliveries ?? []) as Pick<
    Delivery,
    "id" | "post_id" | "subscriber_id" | "attempt_count"
  >[];
  if (!rows.length) return { processed: 0, sent: 0, suppressed: 0, failed: 0 };

  const postIds = [...new Set(rows.map((delivery) => delivery.post_id))];
  const subscriberIds = [...new Set(rows.map((delivery) => delivery.subscriber_id))];
  const [postsResult, subscribersResult, translationsResult] = await Promise.all([
    supabaseAdmin.from("blog_posts").select("id, slug, status, published_at").in("id", postIds),
    supabaseAdmin
      .from("blog_subscribers")
      .select("id, email, lang, unsubscribe_token, confirmed_at")
      .in("id", subscriberIds),
    supabaseAdmin
      .from("blog_post_translations")
      .select("post_id, lang, title, excerpt")
      .in("post_id", postIds),
  ]);
  if (postsResult.error) throw postsResult.error;
  if (subscribersResult.error) throw subscribersResult.error;
  if (translationsResult.error) throw translationsResult.error;

  const postsById = new Map((postsResult.data ?? []).map((post) => [post.id, post]));
  const subscribersById = new Map(
    (subscribersResult.data ?? []).map((subscriber) => [subscriber.id, subscriber]),
  );
  const translationsByPost = new Map<string, PostTranslation[]>();
  for (const translation of translationsResult.data ?? []) {
    const current = translationsByPost.get(translation.post_id) ?? [];
    current.push(translation);
    translationsByPost.set(translation.post_id, current);
  }

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  for (const delivery of rows) {
    const subscriber = subscribersById.get(delivery.subscriber_id);
    if (!subscriber || !subscriber.confirmed_at) {
      const { error } = await supabaseAdmin
        .from("blog_newsletter_deliveries")
        .update({ status: "cancelled", last_error: "subscriber_not_confirmed" })
        .eq("id", delivery.id);
      if (error) throw error;
      continue;
    }

    const post = postsById.get(delivery.post_id);
    const isPublic =
      post?.status === "published" ||
      (post?.status === "scheduled" && !!post.published_at && post.published_at <= now);
    if (!post || !isPublic) {
      const { error } = await supabaseAdmin
        .from("blog_newsletter_deliveries")
        .update({ status: "cancelled", last_error: "post_not_public" })
        .eq("id", delivery.id);
      if (error) throw error;
      continue;
    }

    const translation = postTranslationFor(translationsByPost.get(post.id) ?? [], subscriber.lang);
    if (!translation) {
      const { error } = await supabaseAdmin
        .from("blog_newsletter_deliveries")
        .update({ status: "failed", last_error: "post_translation_missing" })
        .eq("id", delivery.id);
      if (error) throw error;
      failed++;
      continue;
    }

    const lang = matchBlogTag(subscriber.lang) ?? "en";
    const postUrl = `${SITE_URL}/${encodeURIComponent(lang)}/blog/${encodeURIComponent(post.slug)}`;
    const unsubscribeUrl = new URL("/blog/unsubscribe", SITE_URL);
    unsubscribeUrl.searchParams.set("token", subscriber.unsubscribe_token);
    unsubscribeUrl.searchParams.set("lang", lang);

    try {
      const result = await sendTemplateEmail("blog-new-post", subscriber.email, {
        templateData: {
          lang,
          title: translation.title,
          excerpt: plainExcerpt(translation.excerpt),
          postUrl,
          unsubscribeUrl: unsubscribeUrl.toString(),
        },
        idempotencyKey: `blog-new-post-${delivery.post_id}-${delivery.subscriber_id}`,
      });
      const { error } = await supabaseAdmin
        .from("blog_newsletter_deliveries")
        .update({
          status: result.sent ? "sent" : "suppressed",
          sent_at: result.sent ? new Date().toISOString() : null,
          last_error: result.sent ? null : "recipient_suppressed",
        })
        .eq("id", delivery.id);
      if (error) throw error;
      if (result.sent) sent++;
      else suppressed++;
    } catch (sendError) {
      const attemptCount = delivery.attempt_count + 1;
      const terminal = attemptCount >= MAX_ATTEMPTS;
      const retryDelay = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)]!;
      const { error } = await supabaseAdmin
        .from("blog_newsletter_deliveries")
        .update({
          status: terminal ? "failed" : "pending",
          attempt_count: attemptCount,
          next_attempt_at: new Date(Date.now() + retryDelay).toISOString(),
          last_error: errorLabel(sendError),
        })
        .eq("id", delivery.id);
      if (error) throw error;
      console.error("Blog newsletter delivery failed", {
        postId: delivery.post_id,
        subscriberId: delivery.subscriber_id,
        attemptCount,
        errorType: errorLabel(sendError),
      });
      failed++;
    }
  }

  return { processed: rows.length, sent, suppressed, failed };
}

export async function processBlogNewsletter(): Promise<{
  queued: number;
  processed: number;
  sent: number;
  suppressed: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const queued = await queueNewPublications(supabaseAdmin, now);
  const result = await processPendingDeliveries(supabaseAdmin, now);
  return { queued, ...result };
}
