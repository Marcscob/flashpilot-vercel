import { cn } from "@/lib/utils";
import logoAsset from "@/assets/flashpilot-logo-graphite.png.asset.json";
import iconAsset from "@/assets/flashpilot-icon-contrast.png.asset.json";
export function BrandLogo({
  className,
  priority = false,
  variant = "full",
  size = "standard",
}: {
  className?: string;
  priority?: boolean;
  variant?: "full" | "symbol";
  size?: "standard" | "homepage";
}) {
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? "high" : "auto";

  return (
    <img
      src={variant === "symbol" ? iconAsset.url : logoAsset.url}
      alt="FlashPilot"
      className={cn("block max-w-full object-contain shrink-0", className, size === "homepage" ? "h-[94px]! w-[94px]!" : "h-16! w-16!")}
      width={size === "homepage" ? 94 : 64}
      height={size === "homepage" ? 94 : 64}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      draggable={false}
    />
  );
}
