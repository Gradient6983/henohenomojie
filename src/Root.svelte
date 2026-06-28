<script lang="ts">
  import PixiPreviewPage from "./PixiPreviewPage.svelte";
  import UploadTrainPage from "./UploadTrainPage.svelte";

  type Route = "home" | "workspace";

  let route = $state<Route>("home");
  // 훈련 완료 후 재생 화면에서 자동으로 선택/재생할 곡 id
  let autoPlaySongId = $state<string | null>(null);
</script>

{#if route === "home"}
  <PixiPreviewPage
    onTrain={() => (route = "workspace")}
    {autoPlaySongId}
    onAutoPlayConsumed={() => (autoPlaySongId = null)}
  />
{:else}
  <UploadTrainPage
    onBack={() => (route = "home")}
    onPlay={(songId) => {
      autoPlaySongId = songId;
      route = "home";
    }}
  />
{/if}

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }
</style>
