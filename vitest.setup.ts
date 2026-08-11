import "@testing-library/jest-dom/vitest";

// jsdom은 pointer capture·scrollIntoView를 구현하지 않아 Radix UI(Select 등)가
// 이벤트 처리 중 던진다 — 테스트 환경에서만 no-op으로 채운다.
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
