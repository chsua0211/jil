'use client';

import { useState, useEffect } from 'react';
import Gate from './components/Gate';
import Dashboard from './components/Dashboard';

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);

  // 세션 동안만 잠금 해제 유지
  useEffect(() => {
    if (sessionStorage.getItem('jb_unlocked') === '1') setUnlocked(true);
  }, []);

  const handleUnlock = () => {
    sessionStorage.setItem('jb_unlocked', '1');
    setUnlocked(true);
  };

  if (!unlocked) return <Gate onUnlock={handleUnlock} />;
  return <Dashboard />;
}
