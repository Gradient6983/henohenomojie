export type Locale = "ko" | "en";

export interface Messages {
  /** 메인(홈) 페이지 소개 섹션 */
  home: {
    /** 사이트 이름 (へのへのもへじ의 변형) */
    siteName: string;
    /** 사이트 이름의 로마자 표기 */
    siteNameSub: string;
    /** 짧은 한 줄 소개(태그라인) */
    tagline: string;
    /** 사이트 소개 본문 */
    introBody: string;
    /** 아래로 스크롤 유도 문구 */
    scrollHint: string;
    /** 사용 방법 섹션 제목 */
    howToTitle: string;
    /** 사용 방법 단계 목록 */
    howToSteps: string[];
    /** 주의 사항 섹션 제목 */
    noticeTitle: string;
    /** 주의 사항 본문 (WebGPU 미지원 브라우저 안내) */
    noticeBody: string;
    /** 곡 선택 섹션 제목 */
    songSectionTitle: string;
    /** 곡 선택 섹션 설명 */
    songSectionDesc: string;
    /** WebGPU 미지원 경고 모달 제목 */
    webgpuWarningTitle: string;
    /** WebGPU 미지원 경고 모달 본문 */
    webgpuWarningBody: string;
    /** WebGPU 미지원 경고 모달 닫기 버튼 */
    webgpuWarningClose: string;
  };
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
  /** 앱 전역 설정 패널 */
  settings: {
    /** 설정 패널을 여는 버튼 */
    open: string;
    /** "일반" 그룹 제목 */
    generalGroup: string;
    /** 언어 설정 라벨 */
    language: string;
    /** "사운드" 그룹 제목 */
    soundGroup: string;
    /** 음량 설정 라벨 */
    volume: string;
    /** 음량 설정 설명 */
    volumeDesc: string;
    /** "표시 효과" 그룹 제목 */
    displayGroup: string;
    /** 윤곽선 모드 라벨 */
    edges: string;
    /** 윤곽선 모드 설명 */
    edgesDesc: string;
    /** 윤곽선 투명도 라벨 */
    edgeOpacity: string;
    /** 윤곽선 투명도 설명 */
    edgeOpacityDesc: string;
    /** 별자리 모드 라벨 */
    constellation: string;
    /** 별자리 모드 설명 */
    constellationDesc: string;
  };
}

export const ko: Messages = {
  home: {
    siteName: "へのへのもじ絵",
    siteNameSub: "Heno Heno Moji-e",
    tagline: "가사 한 글자 한 글자로 그리는 그림",
    introBody:
      "노래의 가사로 나오는 글자를 하나하나 얹어, 한 장의 그림이 되도록 만들었어요. WebGPU를 통해 직접 이미지를 업로드하고, 진화 기반 알고리즘으로 글자 배치를 추론해볼 수도 있답니다. 부디 즐겁게 즐겨 주세요!",
    scrollHint: "아래로 스크롤해서 곡을 골라보세요",
    howToTitle: "이렇게 즐겨요",
    howToSteps: [
      "아래 곡 목록에서 마음에 드는 곡을 고르면, 가사 글자들이 모여 그림이 완성되는 영상을 감상할 수 있어요.",
      "재생 화면의 설정에서 음량, 윤곽선, 별자리 같은 표시 효과를 자유롭게 바꿔보세요.",
      "직접 사진을 올리고 싶다면 '직접 사진 올리고 훈련하기'를 눌러, WebGPU가 진화 기반 알고리즘으로 나만의 그림을 추론하는 과정을 지켜보세요.",
    ],
    noticeTitle: "잠깐, 알아두세요",
    noticeBody:
      "WebGPU를 지원하지 않는 이전 버전의 브라우저에서는 직접 이미지를 업로드해 훈련하는 기능을 사용할 수 없어요. 미리 준비된 곡 감상은 문제없이 가능하니, 직접 훈련은 최신 버전의 Chrome이나 Edge에서 즐겨 주세요.",
    songSectionTitle: "곡 고르기",
    songSectionDesc:
      "마음에 드는 곡을 선택해, 가사로 그려낸 그림을 감상해 보세요.",
    webgpuWarningTitle: "WebGPU를 사용할 수 없어요",
    webgpuWarningBody:
      "현재 브라우저에서 WebGPU를 사용할 수 없어, 직접 이미지를 올려 훈련하는 기능을 시작할 수 없어요. 최신 버전의 Chrome이나 Edge처럼 WebGPU를 지원하는 브라우저에서 다시 시도해 주세요.",
    webgpuWarningClose: "확인",
  },
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
  settings: {
    open: "설정",
    generalGroup: "일반",
    language: "언어",
    soundGroup: "사운드",
    volume: "음량",
    volumeDesc: "노래의 재생 음량을 조절합니다.",
    displayGroup: "표시 효과",
    edges: "윤곽선",
    edgesDesc: "원본 사진의 윤곽선을 글자 위에 옅게 겹쳐 표시합니다.",
    edgeOpacity: "윤곽선 투명도",
    edgeOpacityDesc: "겹쳐 보이는 윤곽선의 진하기를 조절합니다.",
    constellation: "별자리",
    constellationDesc:
      "지금 부르는 가사의 글자들을 선으로 이어 별자리처럼 강조합니다.",
  },
};

export const en: Messages = {
  home: {
    siteName: "へのへのもじ絵",
    siteNameSub: "Heno Heno Moji-e",
    tagline: "A picture drawn with every single lyric",
    introBody:
      "We stack the characters from a song's lyrics, one by one, until they form a single picture. With WebGPU you can even upload your own image and watch an evolution-based algorithm infer where each character belongs. We truly hope you enjoy it!",
    scrollHint: "Scroll down to pick a song",
    howToTitle: "How to enjoy it",
    howToSteps: [
      "Pick a song you like from the list below and watch a video where the lyric characters gather to complete a picture.",
      "In the player's settings, freely tweak the volume and display effects such as outlines and constellations.",
      "Want to use your own photo? Tap 'Upload a photo & train' and watch WebGPU infer your very own picture with an evolution-based algorithm.",
    ],
    noticeTitle: "Heads up",
    noticeBody:
      "On older browsers without WebGPU support, you can't upload your own image to train. Watching the prepared songs works just fine, so please enjoy your own training on a recent version of Chrome or Edge.",
    songSectionTitle: "Pick a song",
    songSectionDesc:
      "Choose a song you like and enjoy the picture drawn from its lyrics.",
    webgpuWarningTitle: "WebGPU is unavailable",
    webgpuWarningBody:
      "Your current browser can't use WebGPU, so the upload-and-train feature can't start. Please try again on a browser that supports WebGPU, such as a recent version of Chrome or Edge.",
    webgpuWarningClose: "Got it",
  },
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
  settings: {
    open: "Settings",
    generalGroup: "General",
    language: "Language",
    soundGroup: "Sound",
    volume: "Volume",
    volumeDesc: "Adjust the song playback volume.",
    displayGroup: "Display effects",
    edges: "Outline",
    edgesDesc: "Overlay the photo's outline faintly on top of the glyphs.",
    edgeOpacity: "Outline opacity",
    edgeOpacityDesc: "Control how strong the overlaid outline appears.",
    constellation: "Constellation",
    constellationDesc:
      "Connect the glyphs of the current lyric line like a constellation.",
  },
};

export const dictionaries: Record<Locale, Messages> = { ko, en };
