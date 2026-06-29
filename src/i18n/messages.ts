export type Locale = "ja" | "ko" | "en";

export interface Messages {
  /** Main (home) page intro section */
  home: {
    /** Site name (a variation of へのへのもへじ) */
    siteName: string;
    /** Romanized site name */
    siteNameSub: string;
    /** Short one-line intro (tagline) */
    tagline: string;
    /** Site intro body text */
    introBody: string;
    /** Hint encouraging the user to scroll down */
    scrollHint: string;
    /** "How to use" section title */
    howToTitle: string;
    /** List of how-to steps */
    howToSteps: string[];
    /** Notice section title */
    noticeTitle: string;
    /** Notice body (guidance for browsers without WebGPU) */
    noticeBody: string;
    /** Song selection section title */
    songSectionTitle: string;
    /** Song selection section description */
    songSectionDesc: string;
    /** Title of the WebGPU-unsupported warning modal */
    webgpuWarningTitle: string;
    /** Body of the WebGPU-unsupported warning modal */
    webgpuWarningBody: string;
    /** Close button of the WebGPU-unsupported warning modal */
    webgpuWarningClose: string;
  };
  songSelect: {
    title: string;
    description: string;
    badgePreparing: string;
    available: string;
    unavailable: string;
    /** Entry item that navigates to the upload-and-train page */
    trainEntry: string;
    /** Label for the button that reverts the trained result to the original image */
    revert: string;
  };
  upload: {
    title: string;
    description: string;
    imageStep: string;
    pickImage: string;
    /** Hint for the sample image gallery */
    sampleHint: string;
    songStep: string;
    start: string;
    /** Hint shown in the right panel before training starts */
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
    /** Unit for "n / m chars" */
    charUnit: string;
    computedSteps: string;
    renderableChars: string;
    /** Label for the elapsed training time so far */
    elapsed: string;
    /** Label for the estimated total training time */
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
    /** Toggle button for the outline (Sobel edge) overlay */
    edges: string;
    /** Toggle button for the per-line glyph connecting lines (constellation) */
    constellation: string;
    /** Unit appended after the displayed character count (e.g. "12자", "12 chars") */
    charCountSuffix: string;
  };
  /** App-wide settings panel */
  settings: {
    /** Button that opens the settings panel */
    open: string;
    /** "General" group title */
    generalGroup: string;
    /** Language setting label */
    language: string;
    /** "Sound" group title */
    soundGroup: string;
    /** Volume setting label */
    volume: string;
    /** Volume setting description */
    volumeDesc: string;
    /** "Display effects" group title */
    displayGroup: string;
    /** Outline mode label */
    edges: string;
    /** Outline mode description */
    edgesDesc: string;
    /** Outline opacity label */
    edgeOpacity: string;
    /** Outline opacity description */
    edgeOpacityDesc: string;
    /** Constellation mode label */
    constellation: string;
    /** Constellation mode description */
    constellationDesc: string;
  };
}

export const ja: Messages = {
  home: {
    siteName: "へのへのもじ絵",
    siteNameSub: "Heno Heno Moji-e",
    tagline: "歌詞の一文字一文字で描く絵",
    introBody:
      "歌の歌詞に出てくる文字を一つひとつ重ねて、一枚の絵になるように作りました。WebGPU を使って自分で画像をアップロードし、進化ベースのアルゴリズムで文字の配置を推論することもできます。どうぞ楽しんでください！",
    scrollHint: "下にスクロールして曲を選んでください",
    howToTitle: "楽しみ方",
    howToSteps: [
      "下の曲リストからお好きな曲を選ぶと、歌詞の文字が集まって絵が完成する映像を楽しめます。",
      "再生画面の設定で、音量・輪郭線・星座などの表示効果を自由に変えてみてください。",
      "自分の写真を使いたいときは「写真をアップロードして学習」を押して、WebGPU が進化ベースのアルゴリズムであなただけの絵を推論する様子をご覧ください。",
    ],
    noticeTitle: "ご注意ください",
    noticeBody:
      "WebGPU に対応していない古いブラウザでは、自分で画像をアップロードして学習する機能は使えません。あらかじめ用意された曲の鑑賞は問題なくできますので、自分での学習は最新版の Chrome や Edge でお楽しみください。",
    songSectionTitle: "曲を選ぶ",
    songSectionDesc: "お好きな曲を選んで、歌詞で描いた絵をお楽しみください。",
    webgpuWarningTitle: "WebGPU を利用できません",
    webgpuWarningBody:
      "現在のブラウザでは WebGPU を利用できないため、画像をアップロードして学習する機能を開始できません。最新版の Chrome や Edge など、WebGPU に対応したブラウザで再度お試しください。",
    webgpuWarningClose: "OK",
  },
  songSelect: {
    title: "曲を選択",
    description: "再生する曲を選んでください。データが用意された曲のみ再生できます。",
    badgePreparing: "準備中",
    available: "再生可能",
    unavailable: "データなし",
    trainEntry: "写真をアップロードして学習",
    revert: "元の画像に戻す",
  },
  upload: {
    title: "自分で学習する",
    description: "写真をアップロードして曲を選ぶと、学習ページに移動します。",
    imageStep: "1. 写真をアップロード",
    pickImage: "画像ファイルを選んでください。",
    sampleHint: "または下のサンプル画像から選んでください。",
    songStep: "2. 曲を選択",
    start: "学習開始",
    placeholder:
      "画像と曲を選んで「学習開始」を押すと、ここに作業画面が表示されます。",
  },
  train: {
    preparingImage: "画像を準備中...",
    extracting: "歌詞を抽出中...",
    training: "学習中...",
    finalizing: "結果を保存中...",
    done: "学習完了！再生できます。",
    cancelled: "学習がキャンセルされました。",
    error: "エラー",
    noText: "レンダリングできる文字がありません。",
    charUnit: "文字",
    computedSteps: "処理済み",
    renderableChars: "全文字",
    elapsed: "学習時間",
    estimatedTotal: "予想合計時間",
    cancel: "学習をキャンセル",
    play: "再生する",
    close: "閉じる",
    showDetails: "文字の配置情報を表示",
    hideDetails: "文字の配置情報を隠す",
    detailEmpty: "まだ確定した文字の配置がありません。",
  },
  player: {
    backToSelect: "曲一覧",
    play: "再生",
    pause: "停止",
    restart: "最初から",
    edges: "輪郭線",
    constellation: "星座",
    charCountSuffix: " 文字",
  },
  settings: {
    open: "設定",
    generalGroup: "一般",
    language: "言語",
    soundGroup: "サウンド",
    volume: "音量",
    volumeDesc: "曲の再生音量を調整します。",
    displayGroup: "表示効果",
    edges: "輪郭線",
    edgesDesc: "元の写真の輪郭線を文字の上に薄く重ねて表示します。",
    edgeOpacity: "輪郭線の透明度",
    edgeOpacityDesc: "重ねて表示される輪郭線の濃さを調整します。",
    constellation: "星座",
    constellationDesc:
      "今歌っている歌詞の文字を線でつないで星座のように強調します。",
  },
};

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

export const dictionaries: Record<Locale, Messages> = { ja, ko, en };
