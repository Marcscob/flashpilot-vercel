import { useStudyT } from "@/lib/i18n-audit";
import { T } from "@/lib/i18n-ui";
import { useEffect, useRef, useState } from "react";

export function parseYouTubeId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* ignore */
  }
  const m = s.match(/([\w-]{11})/);
  return m ? m[1] : null;
}

const RATES = [1, 1.25, 2, 3, 4];

type YTPlayer = {
  setPlaybackRate: (r: number) => void;
  getPlaybackRate: () => number;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
    const poll = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(poll);
        resolve(window.YT);
      }
    }, 200);
  });
}

export function YouTubePlayer({ url, title }: { url: string; title?: string }) {
  const s0 = useStudyT();
  const videoId = parseYouTubeId(url);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [rate, setRate] = useState(1);
  const [realRate, setRealRate] = useState(1);

  useEffect(() => {
    if (!videoId || !hostRef.current) return;
    let destroyed = false;
    const host = hostRef.current;
    host.innerHTML = "";
    const mount = document.createElement("div");
    host.appendChild(mount);
    setReady(false);
    setRate(1);
    setRealRate(1);

    loadYouTubeApi().then((YT) => {
      if (destroyed) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!destroyed) setReady(true);
          },
        },
      });
    });

    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      host.innerHTML = "";
    };
  }, [videoId]);

  function applyRate(r: number) {
    setRate(r);
    const p = playerRef.current;
    if (!p) return;
    try {
      p.setPlaybackRate(r);
      window.setTimeout(() => {
        try {
          setRealRate(p.getPlaybackRate());
        } catch {
          /* ignore */
        }
      }, 250);
    } catch {
      /* ignore */
    }
  }

  if (!videoId) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {T("Link de vídeo inválido.")}
      </div>
    );
  }

  return (
    <div className="space-y-2 select-none">
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <div
          ref={hostRef}
          className="absolute inset-0 [&>*]:h-full [&>*]:w-full [&_iframe]:h-full [&_iframe]:w-full"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">{s0.speed}</span>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            disabled={!ready}
            onClick={() => applyRate(r)}
            className={`rounded-full px-2.5 py-1 text-xs border transition disabled:opacity-50 ${
              rate === r
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-secondary"
            }`}
          >
            {String(r).replace(".", ",")}x
          </button>
        ))}
        {rate !== realRate && realRate > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {T("O YouTube aplicou velocidade {rate}x", {
              rate: String(realRate).replace(".", ","),
            })}
          </span>
        )}
      </div>
      {title && <p className="text-xs text-muted-foreground truncate">{title}</p>}
    </div>
  );
}
