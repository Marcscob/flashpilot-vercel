# src/lib rules

- Document output batches use card-output-batches to cap per-call quantity and recover only complete truncated cards with smaller continuations, inside one existing billing reservation; why: output capacity must not require manual document splitting or multiply FlashCoin charges.

- E-book edits update the source row under owner-scoped RLS, with independent question/answer targets; why: expansion, narration and exports must read the same saved material, including nested microcontexts.

- Text-based study notes use an authenticated, bounded draft-only function with the existing note quota/provider; why: homepage and Bulk v2 share generation without saving unreviewed drafts or exposing anonymous paid calls.

- Flashcard generation source-order instructions live in the shared card-format prompt rules consumed by text, document and image generation; this keeps capture paths aligned without changing providers, output schemas or billing.

- Saved conversation narration uses account-private content-addressed Cloud WAVs, RLS checks before reads and existing billing on misses; browser RAM holds only a byte-bounded working set, because replays must not pay again or expose conversations.

- Repeat practice uses a single sliding producer and an account-private persistent audio key shared by automatic, manual and prefetched playback; misses retain chat-turn authorization or standalone quotas and bypass the global shared cache, because repeat audio must remain private without duplicate synthesis.

- Gemini and former Groq workloads call the Google AI Studio API directly with GEMINI_API_KEY via src/lib/gemini-api.server.ts (OpenAI-compatible chat endpoint; native generateContent for TTS/STT, PCM wrapped to WAV); why: billing by consumption on the project's own Google account instead of Lovable credits/Groq limits. Light utilities (card translation, STT normalization, UGC audit, mind-map outline) use fetchLightChat: Gemini Flash-Lite first, falling back to the original gateway body on failure or missing key. Blog cover images and the language-chat tutor use Gemini first (tutor: gemini-3-flash-preview, reasoning low so thinking does not exhaust max_tokens) with the original gateway request as fallback; scanned-PDF attachments go to native Gemini generateContent (inline_data application/pdf) first, falling back to the original gateway Responses call.
- Landing visitor tests are stored in service-role-only tables and reserved through the reserve_landing_test RPC; why: anonymous visitors need durable daily limits and rescuable cards without browser access to submissions.

- Model routing follows the scripts/eval measurements: Gemini 3.1 Flash-Lite for card generation (text, document, photo), prazos, notes formatting, light utilities, STT and blog; gemini-3-flash-preview only where it measured better (landing photo OCR, scanned PDFs, language tutor); gemini-3.1-pro-preview for ImagePilot; tests/ai-model-routing.test.ts pins this table. Every Gemini-to-gateway fallback writes a row to ai_fallback_log (feature, failed model) via src/lib/ai-fallback-log.server.ts, shown in the admin panel; why: flash-preview truncated card JSON at 3000 output tokens (thinking tokens) and cost about 2x per token, so it was reverted after the A/B; fallbacks must stay visible because gateway credits are spent on them.
- Model JSON goes through src/lib/json-repair.ts (parseJsonLenient) because models sometimes emit `\ b)` instead of `\nb)` in multiple-choice options. Speech is transcribed with a structured {has_speech, transcript} reply so silence or noise never becomes invented text; native generateContent calls send only x-goog-api-key (geminiHeaders adds Authorization and is rejected there).

- Card-generation guidelines (format, atomicity, relevance, subject/topic naming) live only in `card-guidelines.ts` (`sharedCardGuidelines`); landing, Bulk v2 and the eval harness must use it. Subject/topic names are always resolved server-side by `resolveDestinationNames` (never fixed defaults).

- YouTube sources use captions first; without captions `youtube-video-fallback.server.ts` has Gemini (flash-preview, near-literal, study-only) read the public link (max 60 min). Trial reads 30k chars; subscribers are warned above 100k (`youtube-limits.ts`); a language mismatch asks whether to translate.
- Legislation sources are split by src/lib/legal-hierarchy.ts before generation (subject = law title; assunto/tópico = the two headings nearest the articles, higher ones ignored) and saved via row destinations; why: law structure must drive subject/topic naming without extra provider calls.
