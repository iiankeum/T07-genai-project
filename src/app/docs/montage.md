# 아맞다 화면 스타일

> AI 초안 · 돌린 사람: 배*결 · Codex · 2026-11-18

아맞다의 HTML, CSS, 브라우저 모듈에서 Wanted Montage의 밝은 테마를 사용한다. 공통 색과 크기는 `public/css/app.css`의 CSS 변수에서 관리한다. 새 화면도 같은 버튼, 입력창, 상태 표시를 사용한다.

| 용도 | 적용값 | Montage 기준 |
| --- | --- | --- |
| 주 버튼·활성 표시 | `#0066FF` | Light semantic brand primary, Blue 50 |
| 링크·선택된 문구 | `#0054D1` | 대비를 높인 Blue 40 |
| 본문·보조 텍스트 | `#171719`, `#5A5C63` | Cool neutral 10, Cool neutral 40 |
| 배경·구분선 | `#F7F7F8`, `#E1E2E4` | Light background neutral secondary, line neutral primary opaque |
| 성공·주의·오류 글씨 | `#006E25`, `#663A00`, `#B00C0C` | 밝은 배경에서 대비를 확보한 Green 30, Orange 20, Red 30 |
| 기본 글씨·조작 영역 | 17px, 최소 44px | Montage Headline 2 크기와 개발요청서 v1.6 접근성 기준 |
| 여백·모서리 | 8·12·16·20·24·32px, 10·12·16px | Montage spacing, radius |
| 서체 | Pretendard JP Variable v1.3.9의 한국어 자형 | CDN 제한 또는 접속 실패 시 시스템 한국어 글꼴 사용 |

- 넓은 통화 화면에서 최근 통화·대화·주문 카드를 함께 읽을 수 있다. 화면 폭을 줄이면 최근 통화를 접을 수 있고, 대화와 카드 사이를 이동하는 버튼이 나타난다.
- 주문 카드의 근거를 선택하면 대응하는 대화 대목을 강조한다. 대화와 카드가 나란히 보이고 양끝이 화면에 들어올 때만 연결선을 표시한다.
- 실시간 샘플의 대화가 한 줄씩 확정될 때 진행 수치를 갱신한다. 시스템의 동작 줄이기 설정을 켜면 글자 단위 타이핑과 파형 애니메이션을 줄인다.

공식 디자인 기준은 [Montage 색상](https://montage.wanted.co.kr/docs/foundations/base-material/colors/semantic), [타이포그래피](https://montage.wanted.co.kr/docs/foundations/base-material/typography), [버튼](https://montage.wanted.co.kr/docs/components/actions/button/design)을 확인한다. 토큰 원본은 [wanteddev/montage-web theme](https://github.com/wanteddev/montage-web/tree/main/packages/theme/src/theme), 글꼴은 [Pretendard](https://github.com/orioncactus/pretendard/tree/v1.3.9/packages/pretendard-jp)를 참조한다.

## Montage 라이선스

[원문](https://github.com/wanteddev/montage-web/blob/main/LICENSE.md)

```text
MIT License

Copyright (c) 2026 Wanted Lab, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
