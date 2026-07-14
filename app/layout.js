import './globals.css';

export const metadata = {
  title: '정일님 투자 브리핑',
  description: '정일님의 투자 분신 AI 대시보드',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
