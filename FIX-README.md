# v1.2 수정 사항

## 포함된 파일 (프로젝트 루트에 덮어쓰기)
- app/api/chat/route.js       ← 평단가 원화(KRW) 자동 환산 + 이상치 감지
- app/api/portfolio/route.js  ← 환율(usdKrw) 응답에 포함
- app/components/Portfolio.js ← 달러·원화 병기 표시

## ⚠️ 배포 전에 먼저 할 것: 망가진 평단가 데이터 복구
Supabase → SQL Editor에서 실행:

  update portfolio
  set avg_cost = round(avg_cost / 1435.0, 2)
  where avg_cost >= 10000;

(1435는 대략 환율. 실제 매수 시 환율로 바꿔도 됨.
 실행 후 포트폴리오 탭에서 평단가가 정상적인 달러 값인지 확인.
 정확한 평단으로 맞추려면 채팅에 "MU 평단 XXX달러로 수정해줘")

## 커밋
git add -A && git commit -m "v1.2: 평단 원화 환산, 달러·원화 병기" && git push
