# 정베의 투자 브리핑 🤖📈

정베의 투자 분신 AI 대시보드. 미국장 실시간 뉴스 + 관심종목 주가 + AI 챗봇(정베 스타일로 분석).

## 준비물 (API 키 3개)

1. **Claude API 키** — https://console.anthropic.com → API Keys
2. **Finnhub API 키** — https://finnhub.io 이메일 가입하면 바로 나옴 (무료, 카드 X)
3. **Supabase** — 프로젝트 만들고 Settings → API 에서 URL + anon key 복사

## 설치 순서

### 1) Supabase 테이블 만들기
Supabase 대시보드 → SQL Editor → `supabase-setup.sql` 내용 붙여넣고 실행

### 2) 코드 준비
```bash
npm install
```

### 3) 환경변수 설정
`.env.local.example` 를 복사해서 `.env.local` 로 이름 바꾸고, 값 채워넣기

### 4) 로컬에서 실행 (테스트)
```bash
npm run dev
```
http://localhost:3000 접속 → 비밀번호 입력 → 성향 설문 채우기

### 5) 배포 (Vercel)
1. GitHub에 이 폴더 통째로 올리기
2. vercel.com → New Project → GitHub 저장소 연결
3. **Environment Variables** 에 `.env.local` 에 넣었던 값들 똑같이 입력
4. Deploy!

## 쓰는 법
- **성향 설정** 버튼으로 설문 → AI가 정베 스타일 학습
- 관심 종목에 티커(AAPL 등) 추가하면 실시간 주가
- 뉴스는 5분마다 자동 갱신, 🔖로 스크랩
- 챗봇에 물어보면 최신 정보 찾아서 정베 스타일로 분석
- **애널리스트 리포트 분석**: 종목 티커 넣으면 목표주가·투자의견·상향하향 데이터를
  가져와서 카드로 보여주고, 정베 스타일로 해석·조언까지 해줌
  (챗봇에 "NVDA 애널리스트 어때?" 물어봐도 됨)

### 애널리스트 데이터에 대해
증권사 원문 리포트(Goldman, Morgan Stanley 등의 PDF)는 유료/기관 전용이라
자동으로 못 가져와. 대신 그 리포트의 핵심 결론(목표주가, 매수/매도 의견,
상향/하향)은 Finnhub가 정식 API로 제공하고, 이걸 정베 스타일로 해석해줌.

## 구조
```
app/
  page.js              메인 (잠금 → 대시보드)
  layout.js            루트 레이아웃
  globals.css          다크모드 스타일
  components/          UI 조각들
  api/                 백엔드 (뉴스/주가/챗봇/설문/데이터/인증)
lib/
  supabase.js          DB 연결
  survey.js            설문 문항
```
