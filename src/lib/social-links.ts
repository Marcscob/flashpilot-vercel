/**
 * Links das redes sociais do FlashPilot.
 * Links vazios (string vazia) são ocultados automaticamente.
 */
export interface SocialLink {
  key: string;
  label: string; // pt-BR — traduzido via T()
  url: string;
  icon: string; // nome do ícone lucide
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    key: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/flashpilot.en/",
    icon: "Instagram",
  },
  {
    key: "tiktok",
    label: "TikTok",
    url: "https://www.tiktok.com/@flashpilot_admin",
    icon: "Music2",
  },
  {
    key: "facebook",
    label: "Facebook",
    url: "https://www.facebook.com/profile.php?id=61595862262691",
    icon: "Facebook",
  },
  { key: "pinterest", label: "Pinterest", url: "https://pin.it/6uzFp6mC5", icon: "Image" },
  { key: "x", label: "X", url: "https://x.com/flashpilot_en", icon: "X" },
  {
    key: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/flashpilot/",
    icon: "Linkedin",
  },
  {
    key: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/@flashpilot-e8k",
    icon: "Youtube",
  },
];

export const VISIBLE_SOCIAL_LINKS = SOCIAL_LINKS.filter((l) => l.url);
