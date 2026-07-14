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
