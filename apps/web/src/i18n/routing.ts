import {defineRouting} from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ru", "zh-Hans", "fr", "pt-BR"],
  defaultLocale: "en",
  localePrefix: "always",
  localeCookie: {
    name: "CHRONICLE_LOCALE",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  }
});

export type AppLocale = (typeof routing.locales)[number];
