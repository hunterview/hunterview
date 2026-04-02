import './globals.css';

export const metadata = {
  title: '헌터뷰 — 체험단 통합 검색',
  description: '리뷰노트, 아싸뷰, 체험단닷컴 체험단을 한 곳에서 검색하세요',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
