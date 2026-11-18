# 아차 화면 스타일

> AI 초안 · 돌린 사람: 배*결 · Codex · 2026-11-18

아차는 Wanted Montage의 공식 색·서체·컴포넌트 원칙을 참고한 독립 HTML/CSS 구현이다. 공식 React 컴포넌트 패키지를 설치해 사용하는 것은 아니다. 브랜드 색은 사용자가 제공한 아차 로고에서 가져오며, 원티드의 공식 브랜드 토큰과 구분한다. 공통 색과 크기는 `public/css/app.css`의 CSS 변수에서 관리한다. 새 화면도 같은 버튼, 입력창, 상태 표시를 사용한다.

| 용도 | 적용값 | Montage 기준 |
| --- | --- | --- |
| 주 버튼·활성 표시 | `#49738C` | 아차 로고 대표 sRGB 픽셀. 흰 글자 대비 5.10:1 |
| 링크·선택된 문구 | `#263F4E` | 로고에서 파생한 짙은 색. 흰 배경 대비 10:1 이상 |
| 본문·보조 텍스트 | `#171719`, `#5A5C63` | Cool neutral 10, Cool neutral 40 |
| 배경·구분선 | `#F7F7F8`, `#E1E2E4` | Light background neutral secondary, line neutral primary opaque |
| 성공·주의·오류 글씨 | `#006E25`, `#663A00`, `#B00C0C` | 밝은 배경에서 대비를 확보한 Green 30, Orange 20, Red 30 |
| 기본 글씨·조작 영역 | 17px, 최소 44px | Montage Headline 2 크기와 개발요청서 v1.6 접근성 기준 |
| 여백·모서리 | 8·12·16·20·24·32px, 10·12·16px | Montage spacing, radius |
| 서체 | Pretendard JP Variable v1.3.9의 한국어 자형 | OFL과 함께 로컬 번들. 인터넷 없이도 로드하며 시스템 글꼴은 최종 폴백 |

- 넓은 통화 화면에서 최근 통화·대화·주문 카드를 함께 읽을 수 있다. 화면 폭을 줄이면 최근 통화를 접을 수 있고, 대화와 카드 사이를 이동하는 버튼이 나타난다.
- 주문 카드의 근거를 선택하면 대응하는 대화 대목을 강조한다. 대화와 카드가 나란히 보이고 양끝이 화면에 들어올 때만 연결선을 표시한다.
- 실시간 샘플의 대화가 한 줄씩 확정될 때 진행 수치를 갱신한다. 시스템의 동작 줄이기 설정을 켜면 글자 단위 타이핑과 파형 애니메이션을 줄인다.

공식 디자인 기준은 [Montage 색상](https://montage.wanted.co.kr/docs/foundations/base-material/colors/semantic), [타이포그래피](https://montage.wanted.co.kr/docs/foundations/base-material/typography), [버튼](https://montage.wanted.co.kr/docs/components/actions/button/design)을 확인한다. 토큰 원본은 [wanteddev/montage-web theme](https://github.com/wanteddev/montage-web/tree/main/packages/theme/src/theme), 글꼴은 [Pretendard](https://github.com/orioncactus/pretendard/tree/v1.3.9/packages/pretendard-jp)를 참조한다.

## 사용자 로고와 의미별 색상

로고는 JPEG이므로 위치마다 색이 조금 다르다. 대표 sRGB 픽셀은 짙은 청회색 `#49738C`, 하늘색 `#DBEBF9`, 산호색 `#EBA48E`, 크림색 `#FBF8F5`다. 선택 배경은 가독성을 위해 파생색 `#EAF3F8`을 쓴다. 산호색에 흰 글자는 대비가 약 2.05:1이므로 버튼 텍스트 조합으로 쓰지 않는다. 성공·주의·오류 토큰은 브랜드색으로 덮지 않으며 상태 문구도 유지한다. 대비 계산은 코드 회귀로 보호하지만 전 화면 접근성 인증을 뜻하지 않는다.

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
