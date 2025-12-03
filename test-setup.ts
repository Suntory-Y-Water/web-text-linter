import { Window } from "happy-dom";

const window = new Window();
const document = window.document;

// グローバルオブジェクトに設定
Object.assign(global, {
  window,
  document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  MutationObserver: window.MutationObserver,
  ResizeObserver: window.ResizeObserver,
  IntersectionObserver: window.IntersectionObserver,
});
