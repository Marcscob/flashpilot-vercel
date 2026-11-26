import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/bulkdemo")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `/${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
      statusCode: 301,
    });
  },
  head: () =>
    pageHead(
      "FlashPilot — Study with flashcards",
      "FlashPilot’s study experience is now available on the homepage.",
    ),
});
