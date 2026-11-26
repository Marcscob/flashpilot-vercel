import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("named search crawlers allow public pages without losing private path restrictions", () => {
  const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current = { agents: [] as string[], allow: [] as string[], disallow: [] as string[] };
  for (const line of robots.split(/\r?\n/)) {
    const [directive, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (directive === "User-agent") {
      if (current.allow.length || current.disallow.length) {
        groups.push(current);
        current = { agents: [], allow: [], disallow: [] };
      }
      current.agents.push(value);
    } else if (directive === "Allow") current.allow.push(value);
    else if (directive === "Disallow") current.disallow.push(value);
  }
  groups.push(current);
  for (const agent of ["*", "Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot"]) {
    const group = groups.find((g) => g.agents.includes(agent));
    expect(group?.allow).toEqual(["/"]);
    expect(group?.disallow).toEqual(["/home", "/account", "/settings", "/admin", "/blog-admin", "/bulk", "/bulk-v2", "/bulkdemo", "/review"]);
  }
  expect(robots.match(/^Sitemap: (.+)$/m)?.[1]).toBe("https://flashpilot.net/sitemap.xml");
});