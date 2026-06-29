import TAKEOVER from "../assets/img-TAKEOVER.png";
import ANSWER from "../assets/img-こたえて.png";
import AFTER_THE_CURTAIN from "../assets/img-アフター・ザ・カーテン.png";
import SHUTTER_CHANCE from "../assets/img-シャッターチャンス.png";
import TRICK_CROON from "../assets/img-トリツクロジー.png";
import LAST_MUSIC_TEAM from "../assets/img-世界最後の音楽隊.png";
import type { SongCatalogItem } from "../types/song";

// https://developer.textalive.jp/events/magicalmirai2026/

// Can be found here
const songCatalog: SongCatalogItem[] = [
  {
    id: "こたえて / imie",
    label: "こたえて / imie",
    songUrl: "https://piapro.jp/t/6W2N/20251215164617",
    imageId: "img-こたえて",
    imageUrl: ANSWER,
    video: {
      beatId: 4827293,
      chordId: 2963754,
      repetitiveSegmentId: 3086261,
      // 歌詞URL: https://piapro.jp/t/9o24
      // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2F6W2N%2F20251215164617
      lyricId: 126519,
      lyricDiffId: 28645,
    },
  },
  {
    id: "アフター・ザ・カーテン / Rulmry",
    label: "アフター・ザ・カーテン / Rulmry",
    songUrl: "https://piapro.jp/t/zoqO/20251214200738",
    imageId: "img-アフター・ザ・カーテン",
    imageUrl: AFTER_THE_CURTAIN,
    video: {
      beatId: 4827294,
      chordId: 2963755,
      repetitiveSegmentId: 3086262,
      // 歌詞URL: https://piapro.jp/t/EVO2
      // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FzoqO%2F20251214200738
      lyricId: 126591,
      lyricDiffId: 28627,
    },
  },
  {
    id: "シャッターチャンス / 夜未アガリ",
    label: "シャッターチャンス / 夜未アガリ",
    songUrl: "https://piapro.jp/t/PNpQ/20251209170719",
    imageId: "img-シャッターチャンス",
    imageUrl: SHUTTER_CHANCE,
    video: {
      beatId: 4827295,
      chordId: 2963756,
      repetitiveSegmentId: 3086263,
      // 歌詞URL: https://piapro.jp/t/wyWv
      // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FPNpQ%2F20251209170719
      lyricId: 126542,
      lyricDiffId: 28628,
    },
  },
  {
    id: "世界最後の音楽隊 / 夏山よつぎ×ど～ぱみん",
    label: "世界最後の音楽隊 / 夏山よつぎ×ど～ぱみん",
    songUrl: "https://piapro.jp/t/B3yJ/20251215061727",
    imageId: "img-世界最後の音楽隊",
    imageUrl: LAST_MUSIC_TEAM,
    video: {
      beatId: 4827296,
      chordId: 2963757,
      repetitiveSegmentId: 3086264,
      // 歌詞URL: https://piapro.jp/t/9U-6
      // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FB3yJ%2F20251215061727
      lyricId: 126594,
      lyricDiffId: 28629,
    },
  },
  {
    id: "トリツクロジー / 鶴三",
    label: "トリツクロジー / 鶴三",
    songUrl: "https://piapro.jp/t/QBdL/20251215094303",
    imageId: "img-トリツクロジー",
    imageUrl: TRICK_CROON,
    video: {
      beatId: 4827297,
      chordId: 2963758,
      repetitiveSegmentId: 3086265,
      // 歌詞URL: https://piapro.jp/t/Nixq
      // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FQBdL%2F20251215094303
      lyricId: 126593,
      lyricDiffId: 28630,
    },
  },
  {
    id: "TAKEOVER / Twinfield",
    label: "TAKEOVER / Twinfield",
    songUrl: "https://piapro.jp/t/E2i3/20251215092113",
    imageId: "img-TAKEOVER",
    imageUrl: TAKEOVER,
    video: {
      beatId: 4827298,
      chordId: 2963759,
      repetitiveSegmentId: 3086266,
      // 歌詞URL: https://piapro.jp/t/zxWP
      // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FE2i3%2F20251215092113
      lyricId: 126533,
      lyricDiffId: 28631,
    },
  },
];

export default songCatalog;
