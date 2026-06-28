import { dictionaries, type Locale, type Messages } from "./messages";

export const DEFAULT_LOCALE: Locale = "ko";

// 현재 로케일. setLocale로 바꾸면 t()를 사용하는 모든 컴포넌트가 자동으로 갱신된다.
let locale = $state<Locale>(DEFAULT_LOCALE);

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  locale = next;
}

/**
 * 현재 로케일의 메시지 묶음을 반환한다.
 * 템플릿에서 `t().player.play` 처럼 사용하면 로케일 변경 시 반응형으로 갱신된다.
 */
export function t(): Messages {
  return dictionaries[locale];
}
