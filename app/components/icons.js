// 내비게이션용 라인 아이콘 (stroke는 부모의 currentColor를 따라감)
// size 등은 props로 덮어쓸 수 있음: <IconHome width={30} height={30} />

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconHome = (p) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M3 11l9-8 9 8" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const IconChart = (p) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M4 5v14h16" />
    <path d="M7.5 14l3.5-4.5 3 2.5 4.5-6" />
  </svg>
);

export const IconChat = (p) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />
  </svg>
);

export const IconBriefcase = (p) => (
  <svg {...base} {...p} aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 13h18" />
  </svg>
);

export const IconStar = (p) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z" />
  </svg>
);

export const IconTune = (p) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M4 6h10M18 6h2" />
    <circle cx="16" cy="6" r="2" />
    <path d="M4 12h2M10 12h10" />
    <circle cx="8" cy="12" r="2" />
    <path d="M4 18h8M16 18h4" />
    <circle cx="14" cy="18" r="2" />
  </svg>
);
