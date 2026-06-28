export type Locale = "ko" | "en";

export interface Messages {
  songSelect: {
    title: string;
    description: string;
    badgePreparing: string;
    available: string;
    unavailable: string;
    /** 직접 사진을 올려 훈련하는 페이지로 가는 진입 항목 */
    trainEntry: string;
    /** 훈련 결과를 원래 이미지로 되돌리는 버튼 레이블 */
    revert: string;
  };
  upload: {
    title: string;
    description: string;
    imageStep: string;
    pickImage: string;
    /** 예시 이미지 갤러리 안내 문구 */
    sampleHint: string;
    songStep: string;
    start: string;
    /** 훈련 시작 전 오른쪽 패널 안내 문구 */
    placeholder: string;
  };
  train: {
    preparingImage: string;
    extracting: string;
    training: string;
    finalizing: string;
    done: string;
    cancelled: string;
    error: string;
    noText: string;
    /** "n / m 글자"의 단위 */
    charUnit: string;
    computedSteps: string;
    renderableChars: string;
    /** 현재까지 경과한 훈련 시간 라벨 */
    elapsed: string;
    /** 예상 총 훈련 시간 라벨 */
    estimatedTotal: string;
    cancel: string;
    play: string;
    close: string;
    showDetails: string;
    hideDetails: string;
    detailEmpty: string;
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
    trainEntry: "직접 사진 올리고 훈련하기",
    revert: "원래 이미지로 되돌리기",
  },
  upload: {
    title: "직접 훈련하기",
    description: "사진을 올리고 곡을 선택하면 훈련 페이지로 이동합니다.",
    imageStep: "1. 사진 업로드",
    pickImage: "이미지 파일을 선택하세요.",
    sampleHint: "또는 아래 예시 이미지에서 선택하세요.",
    songStep: "2. 곡 선택",
    start: "훈련 시작",
    placeholder: "이미지와 곡을 선택하고 '훈련 시작'을 누르면 여기에 작업 화면이 나타납니다.",
  },
  train: {
    preparingImage: "이미지 준비 중...",
    extracting: "가사 추출 중...",
    training: "훈련 중...",
    finalizing: "결과 저장 중...",
    done: "훈련 완료! 재생할 수 있습니다.",
    cancelled: "훈련이 취소되었습니다.",
    error: "오류",
    noText: "렌더링할 글자가 없습니다.",
    charUnit: "자",
    computedSteps: "처리된 글자",
    renderableChars: "전체 글자",
    elapsed: "훈련 시간",
    estimatedTotal: "예상 총 시간",
    cancel: "훈련 취소",
    play: "재생하기",
    close: "닫기",
    showDetails: "자세한 글자 위치 정보 보기",
    hideDetails: "자세한 글자 위치 정보 숨기기",
    detailEmpty: "아직 확정된 글자 위치가 없습니다.",
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
    trainEntry: "Upload a photo & train",
    revert: "Revert to original image",
  },
  upload: {
    title: "Train your own",
    description: "Upload a photo and pick a song to move to the training page.",
    imageStep: "1. Upload a photo",
    pickImage: "Pick an image file.",
    sampleHint: "Or pick one of the sample images below.",
    songStep: "2. Pick a song",
    start: "Start training",
    placeholder:
      "Pick an image and a song, then press 'Start training' to show the workspace here.",
  },
  train: {
    preparingImage: "Preparing image...",
    extracting: "Extracting lyrics...",
    training: "Training...",
    finalizing: "Saving result...",
    done: "Training complete! Ready to play.",
    cancelled: "Training was cancelled.",
    error: "Error",
    noText: "No renderable characters.",
    charUnit: "chars",
    computedSteps: "Processed",
    renderableChars: "Total chars",
    elapsed: "Elapsed",
    estimatedTotal: "Est. total",
    cancel: "Cancel training",
    play: "Play",
    close: "Close",
    showDetails: "Show character placement details",
    hideDetails: "Hide character placement details",
    detailEmpty: "No character placement confirmed yet.",
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
