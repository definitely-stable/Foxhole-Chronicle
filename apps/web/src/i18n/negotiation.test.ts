import {describe, expect, it} from "vitest";
import {negotiateLocale, parseAcceptLanguage} from "./negotiation";

describe("locale negotiation", () => {
  it("orders Accept-Language by quality", () => {
    expect(parseAcceptLanguage("fr-CA;q=0.8,ru-RU;q=1,en;q=0.5")).toEqual([
      "ru-RU",
      "fr-CA",
      "en"
    ]);
  });

  it.each([
    ["ru-RU,ru;q=0.9,en;q=0.8", "ru"],
    ["fr-CA,fr;q=0.9,en;q=0.8", "fr"],
    ["pt-BR,pt;q=0.9,en;q=0.8", "pt-BR"],
    ["zh-CN,zh-Hans;q=0.9,en;q=0.8", "zh-Hans"]
  ])("matches %s to %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });

  it.each([
    "zh-TW,zh;q=0.9,en;q=0.8",
    "zh-HK,zh;q=0.9,en;q=0.8",
    "zh-Hant,zh;q=0.9,en;q=0.8"
  ])("does not collapse Traditional Chinese to Simplified: %s", (header) => {
    expect(negotiateLocale(header)).toBe("en");
  });
});
