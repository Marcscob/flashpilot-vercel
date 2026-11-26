import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  completeLandingMaterialsFn,
  finalizeLandingHandoffFn,
} from "@/lib/landing-handoff.functions";
import { T } from "@/lib/i18n-ui";
import {
  HANDOFF_RETRY_DELAYS_MS,
  LANDING_REVIEW_OPENED_KEY,
  landingMaterialsAttemptDone,
  shouldOpenReview,
} from "@/lib/landing-handoff-rules";
import {
  LANDING_MATERIALS_KEY,
  clearLandingVisitorHandoff,
  runLandingMaterials,
} from "@/lib/landing-materials";

/**
 * Pulls the visitor's landing test into the account on the first login (any
 * device), opens /review and creates the attachments requested on the landing.
 */
export function LandingHandoffConsumer() {
  const router = useRouter();
  const qc = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function finalizeWithRetry() {
      let lastError: unknown;
      for (const delay of HANDOFF_RETRY_DELAYS_MS) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (cancelled) return null;
        try {
          return await finalizeLandingHandoffFn();
        } catch (error) {
          lastError = error;
          console.error("Landing handoff attempt failed", error);
        }
      }
      throw lastError;
    }

    async function run() {
      if (running.current) return;
      running.current = true;
      let materialToast: string | number | undefined;
      try {
        const result = await finalizeWithRetry();
        if (!result || cancelled) return;
        if (result.savedCards > 0) {
          localStorage.removeItem(LANDING_MATERIALS_KEY);
          clearLandingVisitorHandoff();
        }
        const pathname = router.state.location.pathname;
        const open = shouldOpenReview({
          savedCards: result.savedCards,
          recentlySaved: result.recentlySaved,
          alreadyOpened: localStorage.getItem(LANDING_REVIEW_OPENED_KEY) === "1",
          pathname,
        });
        if (result.recentlySaved) localStorage.setItem(LANDING_REVIEW_OPENED_KEY, "1");
        if (result.savedCards > 0 || open) {
          await qc.invalidateQueries();
          if (result.savedCards > 0) toast.success(T("Flashcards prontos para revisão."));
        }
        if (open) await router.navigate({ to: "/review", replace: true });
        const jobs = result.materials;
        if (!jobs.length) return;
        materialToast = toast.loading(
          T(
            "Salvando os flashcards e seus acessórios criados na tela de teste. Pode usar o app enquanto isso.",
          ),
        );
        let failures = 0;
        for (const job of jobs) {
          await completeLandingMaterialsFn({ data: { handoffId: job.handoffId, phase: "start" } });
          const kinds = (["note", "map", "video"] as const).filter((kind) => job[kind]);
          let jobFailures = 0;
          for (const kind of kinds) {
            try {
              await runLandingMaterials(
                {
                  text: job.text,
                  note: kind === "note",
                  map: kind === "map",
                  video: kind === "video",
                  at: Date.now(),
                },
                job.lang,
                job.topicId,
                job.generated,
              );
              void qc.invalidateQueries();
            } catch (error) {
              jobFailures += 1;
              console.error("Landing material failed", kind, error);
            }
          }
          failures += jobFailures;
          await completeLandingMaterialsFn({
            data: {
              handoffId: job.handoffId,
              phase: "finish",
              done: landingMaterialsAttemptDone(jobFailures),
            },
          });
        }
        if (failures === 0) {
          toast.success(T("Anexos criados e vinculados aos flashcards."), { id: materialToast });
        } else {
          toast.error(
            T("Alguns anexos não puderam ser criados. Tentaremos novamente no próximo acesso."),
            {
              id: materialToast,
            },
          );
        }
      } catch (error) {
        console.error("Landing handoff failed", error);
        toast.error(error instanceof Error ? error.message : T("Falha ao salvar"), {
          id: materialToast,
        });
      } finally {
        running.current = false;
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void run();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) void run();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router, qc]);

  return null;
}
