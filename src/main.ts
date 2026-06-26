import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import PixiPreviewPage from "./PixiPreviewPage.svelte";

const pathname = window.location.pathname.replace(/\/+$/, "");
const Component = pathname.endsWith("/pixi-preview") ? PixiPreviewPage : App;

const app = mount(Component, {
  target: document.getElementById("app")!,
});

export default app;
