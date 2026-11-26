import { RefundLink } from "@/components/MoneyBackGuarantee";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  Settings,
  LogOut,
  NotebookPen,
  List,
  Mail,
  Layers,
  Menu,
  BarChart3,
  RotateCcw,
  Loader2,
  BookMarked,
  Languages,
  ShoppingBag,
  UserRound,
  ShieldCheck,
  Newspaper,
  Coins,
  PanelsTopLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { resetAllReviews } from "@/lib/flashcards.functions";
import {
  UpgradeDialogProvider,
  CONTACT_EMAIL,
  CONTACT_WHATSAPP_DISPLAY,
  CONTACT_WHATSAPP_LINK,
  usePlanLimit,
} from "@/lib/plan-limit";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { BrandLogo } from "@/components/BrandLogo";
import { TrustBadges } from "@/components/TrustBadges";
import { AccountLangSync } from "@/components/AccountLangSync";
import { isAppManagerIdentity } from "@/lib/app-manager";
import { WelcomeKitBootstrap } from "@/components/WelcomeKitBootstrap";
import { WelcomeModal } from "@/components/WelcomeModal";
import { TrialEndedDialog } from "@/components/TrialEndedDialog";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import { T } from "@/lib/i18n-ui";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isEbook = useRouterState({ select: (st) => st.location.pathname.startsWith("/ebook/") });
  const qc = useQueryClient();
  const t = useT();
  const plan = usePlanLimit();
  const billing = useAiBillingInfo();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyAllowed, setCopyAllowed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const resetFn = useServerFn(resetAllReviews);

  const resetReviews = useMutation({
    mutationFn: () => resetFn({ data: undefined }),
    onSuccess: () => {
      try {
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith("study-progress:") || k.startsWith("study-order:"))
          .forEach((k) => window.localStorage.removeItem(k));
        Object.keys(window.sessionStorage)
          .filter((k) => k.startsWith("study-progress:") || k.startsWith("study-order:"))
          .forEach((k) => window.sessionStorage.removeItem(k));
      } catch (error) {
        console.warn("Failed to clear saved study progress.", error);
      }
      qc.invalidateQueries();
      setConfirmReset(false);
      setMenuOpen(false);
      toast.success(t.shell.resetDone, { description: t.shell.resetDoneDesc });
    },
    onError: (error: unknown) =>
      toast.error(t.shell.resetFail, {
        description: error instanceof Error ? error.message : t.shell.resetFailHint,
      }),
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setCopyAllowed(isAppManagerIdentity(data.user));
    });
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  // Ordem definida pelo usuário (numeração do PDF de auditoria):
  // 1 Início · 2 Pomodoro · 3 Flash Sessions · 4 Flashcards · 5 Anotações
  // 6 Criação de flashcards · 7 Relatórios · 8 Conversação · 9 Loja · 10 Conta · 11 Config · 12 Sair
  const homeNavItem = (
    <NavItem
      to="/home"
      icon={<Home className="h-5 w-5" />}
      label={t.nav.home}
      onNavigate={() => setMenuOpen(false)}
    />
  );

  const navItemsAfterPomodoro = (
    <>
      <NavItem
        to="/review"
        icon={<BookOpen className="h-5 w-5" />}
        label={t.homeHub.review}
        onNavigate={() => setMenuOpen(false)}
      />
      <NavItem
        to="/notebooks"
        icon={<BookMarked className="h-5 w-5" />}
        label={t.shell.flashSession}
        onNavigate={() => setMenuOpen(false)}
      />
      <NavItem
        to="/flashcards"
        icon={<List className="h-5 w-5" />}
        label={t.flashcardsList.title}
        onNavigate={() => setMenuOpen(false)}
      />
      <NavItem
        to="/notes"
        icon={<NotebookPen className="h-5 w-5" />}
        label={t.notes.title}
        onNavigate={() => setMenuOpen(false)}
      />
      {plan.canUseBulk && (
        <NavItem
          to="/bulk-v2"
          icon={<Layers className="h-5 w-5" />}
          label={t.nav.bulk}
          onNavigate={() => setMenuOpen(false)}
        />
      )}
      <NavItem
        to="/reports"
        icon={<BarChart3 className="h-5 w-5" />}
        label={t.nav.reports}
        onNavigate={() => setMenuOpen(false)}
      />
      <NavItem
        to="/language-chat"
        icon={<Languages className="h-5 w-5" />}
        label={t.shell.chat}
        onNavigate={() => setMenuOpen(false)}
      />
      <NavItem
        to="/store"
        icon={<ShoppingBag className="h-5 w-5" />}
        label={t.shell.store}
        onNavigate={() => setMenuOpen(false)}
      />
      <NavItem
        to="/blog"
        icon={<Newspaper className="h-5 w-5" />}
        label={t.shell.blog}
        onNavigate={() => setMenuOpen(false)}
      />
      <NavItem
        to="/account"
        icon={<UserRound className="h-5 w-5" />}
        label={t.shell.account}
        onNavigate={() => setMenuOpen(false)}
      />
      {plan.isAppManager && (
        <>
          <NavItem
            to="/bulkdemo"
            icon={<PanelsTopLeft className="h-5 w-5" />}
            label={T("Páginas de destino")}
            onNavigate={() => setMenuOpen(false)}
          />
          <NavItem
            to="/admin"
            icon={<ShieldCheck className="h-5 w-5" />}
            label={t.shell.admin}
            onNavigate={() => setMenuOpen(false)}
          />
        </>
      )}
    </>
  );

  return (
    <UpgradeDialogProvider>
      <AccountLangSync />
      <WelcomeKitBootstrap />
      <WelcomeModal />
      <TrialEndedDialog />
      <div
        className={"min-h-screen bg-background flex flex-col" + (copyAllowed ? "" : " select-none")}
        style={copyAllowed ? undefined : { WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
        onCopy={
          copyAllowed
            ? undefined
            : (e) => {
                const el = e.target as HTMLElement;
                if (el.closest('input, textarea, [contenteditable="true"]')) return;
                e.preventDefault();
              }
        }
        onCut={
          copyAllowed
            ? undefined
            : (e) => {
                const el = e.target as HTMLElement;
                if (el.closest('input, textarea, [contenteditable="true"]')) return;
                e.preventDefault();
              }
        }
        onContextMenu={
          copyAllowed
            ? undefined
            : (e) => {
                const el = e.target as HTMLElement;
                if (el.closest('input, textarea, [contenteditable="true"]')) return;
                e.preventDefault();
              }
        }
        onDragStart={
          copyAllowed
            ? undefined
            : (e) => {
                const el = e.target as HTMLElement;
                if (el.closest('input, textarea, [contenteditable="true"]')) return;
                e.preventDefault();
              }
        }
      >
        <PaymentTestModeBanner />
        <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto flex min-h-[88px] max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <Link to="/home" className="flex shrink-0 items-center" aria-label={t.shell.brandAria}>
              <BrandLogo priority />
            </Link>

            {/* Desktop / tablet nav */}
            <nav className="hidden md:flex items-center gap-1">
              {homeNavItem}
              <PomodoroTimer />
              {navItemsAfterPomodoro}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 rounded-lg hover:bg-secondary text-foreground/70 hover:text-foreground"
                    aria-label={t.shell.settingsMenu}
                    title={t.shell.settingsMenu}
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t.shell.settingsMenu}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" /> {t.nav.settings}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setConfirmReset(true)} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> {t.shell.resetReviews}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <LanguageSwitcher compact />
              <Link
                to="/store"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                aria-label={T("Saldo: {balance} FlashCoins", {
                  balance: billing.data?.balance ?? "…",
                })}
                title={T("Saldo: {balance} FlashCoins", { balance: billing.data?.balance ?? "…" })}
              >
                <Coins className="h-4 w-4" />
                {billing.data ? billing.data.balance.toLocaleString() : "…"}
              </Link>
              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-secondary text-foreground/70 hover:text-foreground"
                aria-label={t.nav.signOut}
                title={t.nav.signOut}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </nav>

            {/* Mobile: language + hamburger */}
            <div className="md:hidden flex items-center gap-1">
              <LanguageSwitcher compact />
              <Link
                to="/store"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                aria-label={T("Saldo: {balance} FlashCoins", {
                  balance: billing.data?.balance ?? "…",
                })}
                title={T("Saldo: {balance} FlashCoins", { balance: billing.data?.balance ?? "…" })}
              >
                <Coins className="h-4 w-4" />
                {billing.data ? billing.data.balance.toLocaleString() : "…"}
              </Link>
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="p-2 rounded-lg hover:bg-secondary text-foreground/80"
                    aria-label={t.shell.menu}
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle className="font-serif">{t.shell.menu}</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-1">
                    {homeNavItem}
                    <div className="flex items-center gap-3 p-3 text-foreground/80">
                      <PomodoroTimer />
                      <span>Pomodoro</span>
                    </div>
                    {navItemsAfterPomodoro}
                    <NavItem
                      to="/settings"
                      icon={<Settings className="h-5 w-5" />}
                      label={t.nav.settings}
                      onNavigate={() => setMenuOpen(false)}
                    />
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary text-foreground/80 hover:text-foreground text-left"
                    >
                      <RotateCcw className="h-5 w-5" />
                      <span>{t.shell.resetReviews}</span>
                    </button>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary text-foreground/80 hover:text-foreground text-left"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>{t.nav.signOut}</span>
                    </button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main className={isEbook ? "w-full flex-1 px-4 py-8 lg:px-6" : "mx-auto max-w-7xl px-4 lg:px-6 py-8 w-full flex-1"}>{children}</main>
        <footer className="border-t border-border bg-card/40 mt-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 text-sm lg:px-6">
            <p className="text-center text-muted-foreground">{t.shell.contact}</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground"
              >
                <Mail className="h-4 w-4 shrink-0" /> {CONTACT_EMAIL}
              </a>
              <Link to="/termos" className="text-foreground/80 hover:text-foreground">
                {t.shell.terms}
              </Link>
              <Link to="/privacidade" className="text-foreground/80 hover:text-foreground">
                {t.shell.privacy}
              </Link>
              <RefundLink className="text-foreground/80 hover:text-foreground" />
              <Link to="/blog" className="text-foreground/80 hover:text-foreground">
                {t.shell.blog}
              </Link>
            </div>
            <TrustBadges className="justify-center" />
          </div>
        </footer>

        <AlertDialog
          open={confirmReset}
          onOpenChange={(v) => {
            if (!resetReviews.isPending) setConfirmReset(v);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.shell.resetTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.shell.resetDesc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetReviews.isPending}>
                {t.common.cancel}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  resetReviews.mutate();
                }}
                disabled={resetReviews.isPending}
              >
                {resetReviews.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.shell.resetReviews}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </UpgradeDialogProvider>
  );
}

function NavItem({
  to,
  icon,
  label,
  onNavigate,
}: {
  to:
    | "/home"
    | "/review"
    | "/notebooks"
    | "/flashcards"
    | "/notes"
    | "/bulk"
    | "/bulk-v2"
    | "/reports"
    | "/language-chat"
    | "/store"
    | "/blog"
    | "/account"
    | "/admin"
    | "/settings"
    | "/bulkdemo";
  icon: ReactNode;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex md:inline-flex items-center gap-3 md:gap-0 p-3 md:p-2 rounded-lg hover:bg-secondary text-foreground/70 hover:text-foreground"
      activeProps={{
        className:
          "flex md:inline-flex items-center gap-3 md:gap-0 p-3 md:p-2 rounded-lg bg-secondary text-foreground",
      }}
      aria-label={label}
      title={label}
    >
      {icon}
      <span className="md:hidden">{label}</span>
    </Link>
  );
}
