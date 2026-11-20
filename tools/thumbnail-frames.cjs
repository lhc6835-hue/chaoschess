// 썸네일 프레임 캡처: Playwright 가짜 시계로 시간을 정확히 1/FPS씩 넘기며 한 장씩 찍음
// usage: node thumb.cjs <outDir> [fps]
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const out = process.argv[2], FPS = +(process.argv[3] || 25), STEP = 1000 / FPS;
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  p.on("pageerror", (e) => console.log("error", e.message));
  await p.clock.install({ time: 0 });
  await p.goto("process.env.THUMB_URL || "http://localhost:8765/dev/thumbnail.html"");
  await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!window.__ready)); i++) await p.clock.runFor(50);
  await p.clock.runFor(1500); // 배경·기물이 자리 잡을 시간
  await p.evaluate(() => {
    window.__scene();
  });
  let n = 0;
  for (; n < 900; n++) {
    await p.screenshot({ path: `${out}/f${String(n).padStart(4, "0")}.png` });
    await p.clock.runFor(STEP);
    if (await p.evaluate(() => window.__phase === "done")) break;
  }
  console.log("frames", n + 1, "seconds", ((n + 1) / FPS).toFixed(2));
  await b.close();
})();
