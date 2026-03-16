import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SearchOverlay } from '../SearchOverlay';
import { useTheme } from '../../context/ThemeContext';
import { clsx } from '../../lib/clsx';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isDark } = useTheme();
  const [environment, setEnvironment] = useState('production');
  const [branch, setBranch] = useState('main');
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={clsx('min-h-screen flex', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Sidebar />
      <div className="flex-1 flex flex-col ml-60 min-w-0">
        <Header
          onSearchOpen={() => setSearchOpen(true)}
          environment={environment}
          onEnvironmentChange={setEnvironment}
          branch={branch}
          onBranchChange={setBranch}
        />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
