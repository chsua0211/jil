'use client';

import { useState, useEffect } from 'react';
import Gate from './components/Gate';
import Dashboard from './components/Dashboard';

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);

  // 자동 로그인 체크 시엔 기기에 계속 유지, 아니면 브라우저 세션 동안만 유지
  useEffect(() => {
    if (
      localStorage.getItem('jb_auto_login') === '1' ||
      sessionStorage.getItem('jb_unlocked') === '1'
    ) {
      setUnlocked(true);
    }
  }, []);

  const handleUnlock = (remember) => {
    sessionStorage.setItem('jb_unlocked', '1');
    if (remember) localStorage.setItem('jb_auto_login', '1');
    setUnlocked(true);
  };

  if (!unlocked) return <Gate onUnlock={handleUnlock} />;
  return <Dashboard />;
}
