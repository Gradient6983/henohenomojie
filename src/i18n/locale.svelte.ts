import { dictionaries, type Locale, type Messages } from "./messages";

export const DEFAULT_LOCALE: Locale = "ja";

// Current locale. Changing it via setLocale automatically refreshes every
// component that reads through t().
let locale = $state<Locale>(DEFAULT_LOCALE);

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  locale = next;
}

/**
 * Returns the message bundle for the current locale.
 * Using it like `t().player.play` in templates keeps the value reactive,
 * so it updates whenever the locale changes.
 */
export function t(): Messages {
  return dictionaries[locale];
}
