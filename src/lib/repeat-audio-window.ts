/** The current phrase is separate: keep three upcoming phrases, not the entire bank. */
export const REPEAT_AUDIO_AHEAD = 3;

export function repeatAudioCandidates<T extends { id: string; lang: string; level: string | null; topic: string | null; times_practiced: number; created_at: string }>(
  phrases: T[], lang: string, level: string, topic: string, excluded: ReadonlySet<string>,
): T[] {
  return phrases.filter(p => p.lang === lang && (!level || p.level === level) && (!topic || p.topic === topic) && p.times_practiced === 0 && !excluded.has(p.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, REPEAT_AUDIO_AHEAD);
}