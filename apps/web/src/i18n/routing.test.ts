import {describe, expect, it} from "vitest";
import {routing} from "./routing";

describe("locale routing", () => {
  it("keeps the five launch locales and English fallback", () => {
    expect(routing.locales).toEqual([
      "en",
      "ru",
      "zh-Hans",
      "fr",
      "pt-BR"
    ]);
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localePrefix).toBe("always");
  });
});
