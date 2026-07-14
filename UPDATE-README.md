# 업데이트 적용 방법 (v1.1)

## 1) 이 폴더 내용물을 프로젝트 루트에 그대로 덮어쓰기
폴더 구조가 프로젝트와 동일하게 되어 있어서, 압축 푼 내용물을
프로젝트 루트에 통째로 붙여넣으면 됩니다 (덮어쓰기 확인 → 예).

- package.json                          ← recharts 추가됨
- app/components/Chat.js                ← 12시간 임시기억 (새로고침 유지)
- app/components/Dashboard.js           ← 수기 입력 UI 제거 + 차트 추가
- app/components/NewsPanel.js           ← 뉴스 클릭 → 자동 스크랩 + 팝업
- app/components/PerformanceChart.js    ← 신규: 성과 비교 차트
- app/components/Portfolio.js           ← 안내 문구 수정
- app/api/chat/route.js                 ← 글자수 16000, GET(지난 대화), 요약 기억
- app/api/chart/route.js                ← 신규: 차트 데이터 (선물지수)
- app/api/analyst-brief/route.js        ← 글자수 4000

## 2) 삭제할 파일 (더 이상 안 씀)
- app/components/PortfolioModal.js

## 3) 커밋 & 푸시
git add -A
git commit -m "v1.1: 채팅 임시기억, 요약 기억, 성과차트(선물), 뉴스팝업"
git push

Vercel이 package.json 보고 recharts를 자동 설치하며 배포합니다.
로컬 테스트할 거면 npm install 한 번 실행.

## DB 변경 없음
Supabase는 그대로 두면 됩니다.
