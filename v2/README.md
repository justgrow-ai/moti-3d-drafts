# MOTI v2 · 매트 슬라임 몸 시안

- `index.html`: 모바일 우선 갤러리. 스와이프하거나 ‹ › 로 몸을 바꾸고, 칩으로 눈·입·눈썹·볼·색을 바꾸고, 하단 버튼으로 인사·만세·가리키기·고민을 시켜요.
- `src/shader.js`: SDF 레이마칭 셰이더 하나. 16가지 몸 SDF, 슬라임 팔을 smooth union으로 합치는 부분, 매트 라이팅(wrap diffuse, AO, 소프트 섀도, 스펙큘러 없음), 표면에 평면으로 그린 얼굴(눈 10 · 입 7 · 눈썹 5 · 볼, 표정 모핑)이 모두 들어 있어요.
- `src/app.js`: 스프링, 팔 제어, 터치 인터랙션, 표정 타이머, 적응형 해상도, 캡처용 API(`__shot`, `__step`, `__demo`).
- `src/bodies.js`: 몸 16종 데이터(실루엣 id, 색, 얼굴 위치, 성격 스프링, 팔 부착점).
- 결과물: `shots/board-bodies.png`, `shots/board-faces.png`, `shots/arm-grow-absorb.mp4`/`.gif`, `shots/mobile/*.png` (390×844 @2x)
- 내부 스크립트(배포 안 함): `qa.py`, `armqa.py`, `faces.py`, `bodies_board.py`, `cap.py`, `mshots.py`, `mtest*.py`
