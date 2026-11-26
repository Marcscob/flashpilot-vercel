import { expect, test } from "bun:test";
import { shouldOpenStudentHome } from "../src/lib/landing-session-rules";

test("a connected student opens home regardless of stored capture drafts", () => {
  expect(shouldOpenStudentHome(true)).toBe(true);
});
test("anonymous visitors keep the public landing", () => {
  expect(shouldOpenStudentHome(false)).toBe(false);
});
test("only the explicit email return can resume a visitor capture", () => {
  expect(shouldOpenStudentHome(true, "1")).toBe(false);
  expect(shouldOpenStudentHome(true, "0")).toBe(true);
});