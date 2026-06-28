export type Locale = "ko" | "en";

export interface Messages {
  songSelect: {
    title: string;
    description: string;
    badgePreparing: string;
    available: string;
    unavailable: string;
  };
  player: {
    backToSelect: string;
    play: string;
    pause: string;
    restart: string;
    /** 윤곽선(Sobel edge) 오버레이 토글 버튼 */
    edges: string;
    /** 가사 줄별 글자 연결선(별자리) 토글 버튼 */
    constellation: string;
    /** 표시 중인 글자 수 뒤에 붙는 단위 (예: "12자", "12 chars") */
    charCountSuffix: string;
  };
}

export const ko: Messages = {
  songSelect: {
    title: "곡 선택",
    description: "재생할 곡을 선택하세요. 데이터가 준비된 곡만 재생할 수 있습니다.",
    badgePreparing: "준비 중",
    available: "재생 가능",
    unavailable: "데이터 없음",
  },
  player: {
    backToSelect: "곡 선택",
    play: "재생",
    pause: "정지",
    restart: "처음으로",
    edges: "윤곽선",
    constellation: "별자리",
    charCountSuffix: "자",
  },
};

export const en: Messages = {
  songSelect: {
    title: "Select a song",
    description:
      "Choose a song to play. Only songs with prepared data can be played.",
    badgePreparing: "Coming soon",
    available: "Playable",
    unavailable: "No data",
  },
  player: {
    backToSelect: "Songs",
    play: "Play",
    pause: "Pause",
    restart: "Restart",
    edges: "Outline",
    constellation: "Constellation",
    charCountSuffix: " chars",
  },
};

export const dictionaries: Record<Locale, Messages> = { ko, en };
