import {defineRouting} from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ru", "zh-Hans", "fr", "pt-BR"],
  defaultLocale: "en",
  localePrefix: "always",
  localeCookie: {
    name: "CHRONICLE_LOCALE",
    sameSite: "lax"
  }
});

export type AppLocale = (typeof routing.locales)[number];
