#!/usr/bin/env python3
"""배포 전에 실행: 모든 JS 모듈과 음원 주소에 새 버전을 붙여서 브라우저 캐시를 확실히 비워요.

index.html 의 import map 을 다시 만들고(js/**/*.js → ?v=버전), js/audio.js 의 VER 를 맞춰요.
사용법: python3 tools/bump-version.py
"""
import json, pathlib, re, time

root = pathlib.Path(__file__).resolve().parent.parent
ver = time.strftime("%Y%m%d%H%M%S")
imports = {f"./{p.relative_to(root).as_posix()}": f"./{p.relative_to(root).as_posix()}?v={ver}"
           for p in sorted(root.glob("js/**/*.js"))}
imports.update({f"./{p.relative_to(root).as_posix()}": f"./{p.relative_to(root).as_posix()}?v={ver}"
                for p in sorted(root.glob("lib/pixelfx/core/*.js"))})
block = '<script type="importmap" id="versions">\n' + json.dumps({"imports": imports}, indent=2, ensure_ascii=False) + "\n</script>"

html = (root / "index.html").read_text()
if 'id="versions"' in html:
    html = re.sub(r'<script type="importmap" id="versions">.*?</script>', lambda m: block, html, flags=re.S)
else:
    html = html.replace('  <script type="module" src="js/main.js', "  " + block + '\n  <script type="module" src="js/main.js', 1)
html = re.sub(r'src="js/main\.js(\?v=\d+)?"', f'src="js/main.js?v={ver}"', html)
html = re.sub(r'href="css/style\.css(\?v=\d+)?"', f'href="css/style.css?v={ver}"', html)
(root / "index.html").write_text(html)

audio = root / "js/audio.js"
audio.write_text(re.sub(r'const VER = "\?v=[^"]*";', f'const VER = "?v={ver}";', audio.read_text()))
print("version", ver, "modules", len(imports))
