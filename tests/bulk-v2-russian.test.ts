import { expect, test } from "bun:test";
import { BULK_V2_RU } from "../src/lib/i18n-bulk-v2";

test("Russian Bulk v2 copy covers the form and review sections", () => {
  expect(BULK_V2_RU.stepScope).toBe("2. Что превратить во флеш-карточки?");
  expect(BULK_V2_RU.scopeAll).toBe("Весь материал");
  expect(BULK_V2_RU.quantity).toBe("Желаемое количество карточек");
  expect(BULK_V2_RU.instructions).toBe("Дополнительные инструкции (необязательно)");
  expect(BULK_V2_RU.stepDestination).toBe("3. Куда сохранить?");
  expect(BULK_V2_RU.subject).toBe("Предмет");
  expect(BULK_V2_RU.topic).toBe("Тема");
  expect(BULK_V2_RU.reviewEmpty).toBe("Пока нет карточек.");
  expect(BULK_V2_RU.reviewHint).not.toContain("Generated flashcards");
});

test("Russian Bulk v2 copy formats counts and busy-operation errors", () => {
  expect(BULK_V2_RU.question(2)).toBe("Вопрос №2");
  expect(BULK_V2_RU.createCards(1)).toBe("Создать 1 карточку");
  expect(BULK_V2_RU.createCards(3)).toBe("Создать 3 карточки");
  expect(BULK_V2_RU.createCards(5)).toBe("Создать 5 карточек");
  expect(BULK_V2_RU.busyError).toContain("Другая операция PilotAI");
});
