import { expect, test } from "bun:test";
import { installCopy, installPlatform, shouldOfferInstall } from "../src/lib/pwa-install";

test("offer on landing and login only", () => {
  expect(shouldOfferInstall("/", "android", false, false)).toBe(true);
  expect(shouldOfferInstall("/auth", "ios", false, false)).toBe(true);
  expect(shouldOfferInstall("/home", "android", false, false)).toBe(false);
});
test("device dismissal suppresses the next page offer", () => {
  expect(shouldOfferInstall("/auth", "android", false, true)).toBe(false);
});
test("installed standalone apps never receive the offer", () => {
  expect(shouldOfferInstall("/", "ios", true, false)).toBe(false);
  expect(shouldOfferInstall("/auth", "android", true, false)).toBe(false);
});
test("iOS instructions target Safari, including iPad desktop mode", () => {
  expect(installPlatform("iPhone AppleWebKit Version/18 Mobile Safari/604.1")).toBe("ios");
  expect(installPlatform("Macintosh AppleWebKit Version/18 Safari/604.1", 5)).toBe("ios");
  expect(installPlatform("iPhone CriOS/130 Mobile Safari/604.1")).toBe(null);
});
test("Android is offered installation, desktop is excluded", () => {
  expect(installPlatform("Linux; Android 14 Chrome/130 Mobile Safari/537.36")).toBe("android");
  expect(installPlatform("Windows NT Chrome/130 Safari/537.36")).toBe(null);
});
test("extra locale install copy overlays available strings and falls back to English", () => {
  const copy = installCopy("ja", { "pwa.title": "ホーム画面に追加", "pwa.close": "閉じる" });
  expect(copy.title).toBe("ホーム画面に追加");
  expect(copy.close).toBe("閉じる");
  expect(copy.install).toBe(installCopy("en").install);
});
import { isDismissalActive, INSTALL_DISMISS_TTL_MS } from "../src/lib/pwa-install";
test("ignores legacy permanent flag", () => {
  expect(isDismissalActive("1")).toBe(false);
});
test("respects a recent dismissal", () => {
  const now = Date.now();
  expect(isDismissalActive(String(now - 1000), now)).toBe(true);
});
test("offers again after 3 days", () => {
  const now = Date.now();
  expect(isDismissalActive(String(now - INSTALL_DISMISS_TTL_MS), now)).toBe(false);
});
