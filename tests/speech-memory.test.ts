import { describe, expect, test as it, mock } from "bun:test";
import { createSpeechMemory } from "../src/lib/speech-memory";

describe("speech working set", () => {
  it("keeps RAM under the byte budget and never evicts the playing audio", () => {
    let n = 0;
    const revoke = mock(() => {});
    const create = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => `blob:${++n}`;
    URL.revokeObjectURL = revoke;
    const memory = createSpeechMemory(10, 8);
    memory.put("a", new Blob(["123456"]));
    memory.put("b", new Blob(["123456"]), "blob:1");
    expect(memory.get("a")).toBe("blob:1");
    memory.put("c", new Blob(["123456"]), "blob:2");
    expect(memory.get("a")).toBeUndefined();
    expect(memory.get("b")).toBe("blob:2");
    expect(revoke).toHaveBeenCalledWith("blob:1");
    URL.createObjectURL = create;
    URL.revokeObjectURL = originalRevoke;
  });
});