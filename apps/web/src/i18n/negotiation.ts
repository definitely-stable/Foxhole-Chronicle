import {match} from "@formatjs/intl-localematcher";
import {routing, type AppLocale} from "./routing";

type LanguagePreference = {
  locale: string;
  quality: number;
  order: number;
};

const traditionalChinese =
  /^zh-(?:Hant|TW|HK|MO)(?:-|$)/i;

const explicitSimplifiedChinese =
  /^zh-(?:Hans|CN|SG)(?:-|$)/i;

export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) {
    return [];
  }

  return header
    .split(",")
    .map((part, order): LanguagePreference | null => {
      const [rawLocale, ...parameters] = part.trim().split(";");
      if (!rawLocale || rawLocale === "*") {
        return null;
      }

      const qualityParameter = parameters.find((value) =>
        value.trim().startsWith("q=")
      );
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;

      if (!Number.isFinite(quality) || quality <= 0) {
        return null;
      }

      return {
        locale: rawLocale,
        quality,
        order
      };
    })
    .filter((value): value is LanguagePreference => value !== null)
    .sort((left, right) =>
      right.quality === left.quality
        ? left.order - right.order
        : right.quality - left.quality
    )
    .map(({locale}) => locale);
}

export function negotiateLocale(
  acceptLanguage: string | null
): AppLocale {
  const requested = parseAcceptLanguage(acceptLanguage);
  const hasTraditionalPreference = requested.some((locale) =>
    traditionalChinese.test(locale)
  );

  const guarded = requested.filter((locale) => {
    if (traditionalChinese.test(locale)) {
      return false;
    }

    if (
      hasTraditionalPreference &&
      /^zh$/i.test(locale) &&
      !explicitSimplifiedChinese.test(locale)
    ) {
      return false;
    }

    return true;
  });

  return match(
    guarded,
    [...routing.locales],
    routing.defaultLocale
  ) as AppLocale;
}

export function isSupportedLocale(value: string | undefined): value is AppLocale {
  return routing.locales.some((locale) => locale === value);
}
