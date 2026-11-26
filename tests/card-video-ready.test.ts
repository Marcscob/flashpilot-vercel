import { expect, it } from "vitest";
import { completeCardVideo } from "../src/lib/card-video-ready";

it("refreshes saved materials immediately without an Assistir click", () => {
  const events: string[] = [];
  completeCardVideo("saved-video", () => events.push("refresh"), id => events.push(id));
  expect(events).toEqual(["refresh", "saved-video"]);
});