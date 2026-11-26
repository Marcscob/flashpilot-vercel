import { describe, it, expect } from "vitest";
import { decodeTextBytes } from "../src/lib/decode-text";
describe("decodeTextBytes", () => {
  it("keeps accents from Windows-1252 bytes", () => {
    expect(decodeTextBytes(new Uint8Array([0x53, 0x65, 0xe7, 0xe3, 0x6f]))).toBe("Seção");
  });
  it("decodes UTF-8 and strips BOM", () => {
    expect(decodeTextBytes(new TextEncoder().encode("\uFEFFSeção"))).toBe("Seção");
  });
});
