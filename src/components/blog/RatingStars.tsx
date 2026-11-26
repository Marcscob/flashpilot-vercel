import { useState, useEffect } from "react";
import { useBlogUi } from "@/lib/blog-ui-i18n";
import { blogRatePost, blogGetMyRating } from "@/lib/blog.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

export function RatingStars({
  postId,
  avgRating,
  ratingCount,
  lang,
}: {
  postId: string;
  avgRating: number;
  ratingCount: number;
  lang: string;
}) {
  const { t } = useBlogUi(lang);
  const ratePost = useServerFn(blogRatePost);
  const getMyRating = useServerFn(blogGetMyRating);
  const [myRating, setMyRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setSignedIn(true);
        getMyRating({ data: { postId } }).then((res) => setMyRating(res.stars));
      }
    });
  }, [postId]);

  async function handleRate(stars: number) {
    if (!signedIn) return;
    setMyRating(stars);
    setSubmitted(true);
    try {
      await ratePost({ data: { postId, stars } });
    } catch {
      setSubmitted(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${star} ${t("Avaliar este post")}`}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-6 w-6 ${
                (hover || myRating) >= star
                  ? "fill-amber-400 text-amber-400"
                  : "text-stone-300 dark:text-stone-600"
              }`}
            />
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        {submitted
          ? t("Obrigado pela sua avaliação!")
          : ratingCount > 0
            ? `${avgRating.toFixed(1)} · ${t("{n} avaliações", { n: ratingCount })}`
            : t("Avaliar este post")}
      </p>
    </div>
  );
}
