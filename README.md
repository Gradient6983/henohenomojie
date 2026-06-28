# 프로젝트의 의도

글자들을 순서대로 적당한 크기와 색깔로 배치하면서 최종적으로는 글자들로 그림을 그려내는게 목표

# 실행 과정

1. 적당한 개수의 글자들을 캔버스에 표시함
2. 처음 생성한 글자는 크게 그리고 그 후에 생성하는 글자들의 크기는 점점 줄여서 배경 > 디테일 순으로 글자들을 구현하는 게 목표임
3. 처음에 랜덤한 포지션으로 여러 후보를 생성, 그리고 그 후보를 빈 텍스처에 올린 다음, 그 텍스처를 이미지와 비교해서 점수를 기록함. 이때 글자의 색상은 글자가 겹쳐있는 이미지의 픽셀들의 평군 색상으로 자동으로 결정
4. 그 후 후보들에서 상위 n개의 후보를 추출, 거기에서 위치나 크기 등 여러 값들을 조금씩 variance를 줘서 변경
5. 그리고 또 상위 n개의 후보를 검출하는 과정을 여러번 반복, 결과적으로 최적의 위치와 크기의 글자를 선정
6. 해당 글자는 아까 생성했던 빈 텍스처에 그대로 저장. 그래서 다음 글자를 올릴 때는 그 글자가 올라간 캔버스에 새로운 글자를 올리면서 다시 이미지와 비교를 진행하게 함

# 기술 스택

- **Svelte 5** (runes 문법) + **Vite** 기반 SPA
- **TypeGPU / WebGPU**: 글자 위치 탐색 및 이미지 비교 연산
- **PixiJS 8**: 추출된 글자 배치를 캔버스에 렌더링
- **TextAlive App API**: 곡 가사 및 타이밍 데이터 추출, 실시간 재생 제어
- **자체 경량 i18n 모듈** (`src/i18n`): 다국어 UI 문자열 관리 (외부 라이브러리 없음)

# 페이지 구성

이 프로젝트는 진입 경로(`pathname`)에 따라 두 개의 페이지로 분기된다 (`src/main.ts`).

| 경로            | 컴포넌트                 | 역할                                         |
| --------------- | ------------------------ | -------------------------------------------- |
| `/` (기본)      | `App.svelte`             | WebGPU 글자 위치 추출 / JSONL 내보내기 도구  |
| `/pixi-preview` | `PixiPreviewPage.svelte` | 곡 선택 화면 → 선택한 곡의 JSONL을 음악에 맞춰 재생/미리보기 |

## 1. WebGPU 추출 페이지 (`App.svelte`)

곡 이미지 + TextAlive 가사 데이터를 입력받아, 위 "실행 과정"의 연산을 수행하고 각 글자의 최적 배치(`placement`)를 계산한다.

- 곡/이미지 선택 (진화 알고리즘은 항상 **전체 가사**에 대해 수행)
- `extract selected song lyrics` → TextAlive에서 가사·타이밍 추출
- `compute` 실행 → 글자별 위치/색상/diff 계산
- 결과를 `<songId>.jsonl` 파일로 내보내기 (`save processed jsonl`)

## 2. 재생/미리보기 페이지 (`PixiPreviewPage.svelte` → `GlyphPlayer.svelte`)

`/pixi-preview` 진입 시 먼저 **곡 선택 화면**(`PixiPreviewPage.svelte`)이 표시되고, 곡을 고르면 **재생 화면**(`GlyphPlayer.svelte`)으로 전환된다.

### 곡 선택 화면 (`PixiPreviewPage.svelte`)

- `src/assets/*.jsonl`을 `import.meta.glob`로 **모두 자동 로드**하고, 각 파일 첫 `song` 레코드의 `songId`로 매핑한다.
- `songSource`의 모든 곡을 카드 그리드로 표시하며, **JSONL 데이터가 있는 곡만 "재생 가능"** 으로 활성화된다(없으면 "준비 중" 배지).
- 새 곡을 추가하려면 `songId`가 일치하는 JSONL을 `src/assets`에 넣기만 하면 코드 수정 없이 자동 인식된다.

### 재생 화면 (`GlyphPlayer.svelte`)

- **음악 동기화 재생**: TextAlive Player로 실제 곡을 재생하며, `onTimeUpdate`의 현재 재생 위치에 맞춰 정렬된 `placement`를 추가/제거한다.
- **재생 컨트롤**: `재생` / `정지` / `처음으로`(stop) 버튼.
- **재생바(seek)**: 하단 슬라이더로 임의 위치로 이동. 드래그 중에는 화면(글자·시간)만 미리 갱신하고, 놓는 순간 `requestMediaSeek`로 실제 오디오 위치를 이동한다. 탐색 도중 옛 위치 업데이트로 인한 깜빡임을 막는 가드(`isSeeking` + 자동 해제 타이머)를 둔다.
- **등장 애니메이션**: 글자는 `startTime - appearAnimMs` 시점부터 크기 0 → 목표 크기로 `Ease.quadOut` 애니메이션되며, 정확히 `startTime`에 목표 크기에 도달한다.
- **좌표계 일치**: 월드 크기를 고정값이 아니라 **곡 이미지 실제 크기 × dpr**(소스 추출 시의 `canvasWidth/Height`와 동일)로 맞춰, 추출 단계와 글자 위치·크기·종횡비가 정확히 일치한다.
- **팬 / 줌**: 캔버스 위에서 드래그로 이동, 휠로 (포인터 기준) 확대·축소.
- **글자 텍스처 재사용**: `textCanvas.ts`의 `createCharCanvasLayout` / `drawCenteredChar`로 글자를 흰색으로 그린 뒤, `placement.color`를 PixiJS `tint`(곱셈 합성)로 입힌다. 같은 글자는 `Map` 캐시로 재사용.
- **정리**: 곡 선택 화면으로 돌아가면 PixiJS 리소스와 TextAlive Player(`dispose`)를 정리한다.

## 3. 다국어 UI (`src/i18n`)

UI 문자열을 컴포넌트에서 분리해 다국어 확장에 대비한다.

- `messages.ts`: `Locale`/`Messages` 타입과 `ko`/`en` 사전.
- `locale.svelte.ts`: 반응형 현재 로케일(`$state`)과 `t()` / `getLocale()` / `setLocale()`. `t()`로 읽으므로 로케일 변경 시 자동 갱신.
- `index.ts`: 한 곳에서 re-export (`import { t, setLocale } from "./i18n"`).
- 사용 예: `{t().player.play}`, 전환: `setLocale("en")`.

# 디렉터리 구조

```
src/
├─ main.ts                     # 진입점, 경로별 페이지 분기 (App / PixiPreviewPage)
├─ App.svelte                  # WebGPU 글자 추출 도구 페이지
├─ PixiPreviewPage.svelte      # 곡 선택 화면 (JSONL 자동 탐색 + 곡 카드 그리드)
├─ GlyphPlayer.svelte          # 선택한 곡의 음악 동기화 재생/미리보기 화면
├─ manager.ts                  # WebGPU/TypeGPU 리소스·텍스처·설정 관리 (Manager 클래스)
├─ type.ts                     # CharPos, Color 등 공용 타입
├─ util.ts                     # 후보 생성·variance·평균색 캔버스 등 유틸
├─ util/                       # 세분화된 유틸 모음 (charPos, canvas, difference)
├─ assets/                     # 곡 이미지(png) 및 추출된 가사 데이터(jsonl)
├─ i18n/                       # 다국어 UI 문자열 (messages.ts / locale.svelte.ts / index.ts)
└─ webgpu/
   ├─ computeChar.ts           # 글자를 텍스처에 합성 + 캔버스 렌더 (compute/render 파이프라인)
   ├─ computeColor.ts          # 후보 위치의 평균 색상 계산
   ├─ debugDifference.ts       # 후보와 원본 이미지의 차이(diff) 계산
   ├─ gpuUtils.ts              # GPU 구조체/후보 변환 유틸
   └─ glyph/
      ├─ glyphComputeWorkflow.ts  # 후보 생성 → 비교 → 상위 선별 반복 워크플로
      ├─ textCanvas.ts            # 글자 그리기 레이아웃 및 중앙 정렬 렌더
      ├─ replayIO.ts              # TextAlive 가사 추출 / JSONL 직렬화·역직렬화
      └─ songSource.ts            # 곡 카탈로그(곡 URL, 이미지, 비디오 ID)
```

# JSONL 데이터 포맷

한 줄당 하나의 JSON 레코드이며, `type` 필드로 구분된다.

- `song`: 곡 메타데이터(제목, 아티스트, duration, 전체 가사 등)
- `phrase`: 가사 구(phrase) 단위 텍스트와 시작/종료 시간
- `word`: 단어 단위 텍스트와 시간
- `char`: 글자 단위 텍스트, 시간, 렌더링 가능 여부
- `placement`: 추출된 글자의 배치 정보
  - `step`: 표시 순서
  - `char`: 글자
  - `pos`: `{ x, y, scale, opacity, rotation }` (x/y는 0~1 정규화 좌표)
  - `color`: `[r, g, b]` (각 0~1)
  - `diff`: 해당 배치의 차이 점수

PixiJS 미리보기 페이지는 이 중 `placement` 레코드만 사용하여 `step` 순으로 렌더링한다.

# 개발 / 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버
pnpm dev
#   기본 추출 도구:   http://localhost:5173/
#   Pixi 미리보기:    http://localhost:5173/pixi-preview

# 타입 / Svelte 검사
pnpm check

# 프로덕션 빌드 / 미리보기
pnpm build
pnpm preview
```

> WebGPU를 지원하는 브라우저(예: 최신 Chrome, Firefox)에서 실행해야 추출 페이지가 정상 동작한다.
