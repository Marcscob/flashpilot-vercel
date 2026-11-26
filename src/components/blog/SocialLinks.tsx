import { VISIBLE_SOCIAL_LINKS } from "@/lib/social-links";
import { T } from "@/lib/i18n-ui";
import { useBlogUi } from "@/lib/blog-ui-i18n";
import { Instagram, Music2, Facebook, Image as ImageIcon, Linkedin, Youtube } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Instagram,
  Music2,
  Facebook,
  Image: ImageIcon,
  X: XIcon,
  Linkedin,
  Youtube,
};

export function SocialLinks({ className = "", lang }: { className?: string; lang?: string }) {
  const { t } = useBlogUi(lang ?? "en");
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {VISIBLE_SOCIAL_LINKS.map((link) => {
        const Icon = ICONS[link.icon] ?? Instagram;
        return (
          <a
            key={link.key}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={lang ? t(link.label) : T(link.label)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300/40 text-stone-600 transition-all hover:scale-110 hover:border-amber-400 hover:text-amber-600 dark:border-stone-600/40 dark:text-stone-300 dark:hover:border-amber-400 dark:hover:text-amber-400"
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}
