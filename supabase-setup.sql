-- ─────────────────────────────────────────────
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
-- ─────────────────────────────────────────────

-- 1) 정베의 투자 스타일 (설문 결과 저장, 한 줄만 유지)
create table if not exists investor_profile (
  id int primary key default 1,
  answers jsonb not null default '{}',      -- 설문 답변 전체
  summary text default '',                  -- AI가 요약한 "정베 스타일" 한 문단
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

-- 2) 관심 종목
create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,                     -- 예: AAPL, NVDA
  created_at timestamptz default now()
);

-- 3) 스크랩한 뉴스
create table if not exists saved_news (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  url text,
  source text,
  symbol text,
  created_at timestamptz default now()
);

-- 4) 챗봇 대화 기록
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null,                       -- 'user' 또는 'assistant'
  content text not null,
  created_at timestamptz default now()
);

-- 기본 프로필 한 줄 미리 넣어두기
insert into investor_profile (id, answers, summary)
values (1, '{}', '')
on conflict (id) do nothing;

-- 5) 포트폴리오 (보유 종목)
create table if not exists portfolio (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,                     -- 예: NVDA
  shares numeric not null,                  -- 보유 수량
  avg_cost numeric not null,                -- 평단가 (USD)
  created_at timestamptz default now()
);

-- 6) AI 기억 저장소 (정일님이 기억시킨 정보)
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz default now()
);

-- 7) 포트폴리오 일별 기록 (성과 차트용)
--    value: 그날 마지막으로 확인한 평가액 (USD)
--    flow:  그날 매매로 들어오고(+매수) 나간(-매도) 돈의 합계 (USD)
create table if not exists portfolio_history (
  date date primary key,
  value numeric,
  flow numeric not null default 0,
  created_at timestamptz default now()
);

-- 8) 캘린더 일정 (AI가 뉴스에서 추출한 일정 + 실적 발표일 자동 수집)
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  description text default '',
  source text default 'ai',                 -- 'ai'(뉴스 추출) | 'earnings'(실적)
  created_at timestamptz default now()
);
create unique index if not exists calendar_events_date_title_idx
  on calendar_events (date, title);

-- RLS 해제 (개인용 앱, 비밀번호 게이트로 보호)
alter table investor_profile disable row level security;
alter table portfolio disable row level security;
alter table watchlist disable row level security;
alter table saved_news disable row level security;
alter table chat_messages disable row level security;
alter table memories disable row level security;
alter table portfolio_history disable row level security;
alter table calendar_events disable row level security;
