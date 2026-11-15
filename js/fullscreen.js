// 전체화면: 처음 클릭(또는 키 입력)하면 자동으로 전체화면, 버튼으로 켜고 끄기.
// 브라우저는 사용자 입력 순간에만 전체화면을 허락해서, 클릭/키 이벤트 안에서 요청해요.

const doc = document;
const el = doc.documentElement;

export const isFullscreen = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
const supported = () => !!(el.requestFullscreen || el.webkitRequestFullscreen);

export function enterFullscreen() {
  if (isFullscreen() || !supported()) return;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen();
    p?.catch?.(() => {});
  } catch {
    /* 거부되면 그냥 창 모드로 계속 */
  }
}

export function exitFullscreen() {
  if (!isFullscreen()) return;
  (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc)?.catch?.(() => {});
}

export function bindFullscreen(button) {
  // 첫 입력 한 번만 자동 전체화면 (터치는 손을 뗄 때가 '사용자 입력'으로 인정돼요)
  const first = () => {
    window.removeEventListener("click", first, true);
    window.removeEventListener("keydown", first, true);
    enterFullscreen();
  };
  window.addEventListener("click", first, true);
  window.addEventListener("keydown", first, true);

  if (!supported()) {
    button.hidden = true; // 아이폰 사파리처럼 지원하지 않는 곳에선 버튼 숨김
    return;
  }
  const sync = () => {
    const on = isFullscreen();
    button.classList.toggle("on", on);
    button.setAttribute("aria-label", on ? "전체화면 끄기" : "전체화면");
    button.title = on ? "전체화면 끄기" : "전체화면";
  };
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isFullscreen()) exitFullscreen();
    else enterFullscreen();
  });
  doc.addEventListener("fullscreenchange", sync);
  doc.addEventListener("webkitfullscreenchange", sync);
  sync();
}
