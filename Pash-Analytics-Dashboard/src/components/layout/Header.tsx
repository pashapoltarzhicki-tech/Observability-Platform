import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Sun, Moon, ChevronDown, User, LogOut, Settings, GitBranch } from 'lucide-react';
import { DateRangePicker } from '../DateRangePicker';
import { useTheme } from '../../context/ThemeContext';
import { useReports } from '../../context/ReportsContext';
import { clsx } from '../../lib/clsx';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/test-runs': 'Test Runs',
  '/test-cases': 'Test Cases',
  '/flaky-tests': 'Flaky Tests',
  '/history': 'History',
  '/analytics': 'Analytics',
  '/pull-requests': 'Pull Requests',
  '/integrations': 'Integrations',
  '/settings': 'Settings',
};

interface HeaderProps {
  onSearchOpen: () => void;
}

export function Header({ onSearchOpen }: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const { allBranches, dateFrom, setDateFrom, dateTo, setDateTo, sourceFilter, setSourceFilter, branchFilter, setBranchFilter, filteredRuns } = useReports();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifCount] = useState(3);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keep branchFilter in sync — reset to 'all' if selected branch disappears
  useEffect(() => {
    if (branchFilter !== 'all' && allBranches.length > 0 && !allBranches.includes(branchFilter)) {
      setBranchFilter('all');
    }
  }, [allBranches]);

  const pageTitle = (() => {
    const path = location.pathname;
    if (path.startsWith('/test-runs/')) return 'Test Run Detail';
    return routeTitles[path] ?? 'Dashboard';
  })();

  const selectClass = clsx(
    'text-xs rounded-lg px-2.5 py-1.5 border outline-none focus:ring-1 focus:ring-purple-500 appearance-none cursor-pointer',
    isDark
      ? 'bg-gray-800 border-gray-700 text-gray-200'
      : 'bg-white border-gray-200 text-gray-700'
  );

  // Latest commit from the currently filtered runs
  const latestCommit = [...filteredRuns]
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .find((r) => r.commit)?.commit;

  return (
    <header
      className={clsx(
        'sticky top-0 z-20 h-14 flex items-center gap-2 px-6 border-b',
        isDark
          ? 'bg-gray-900/80 backdrop-blur border-gray-800'
          : 'bg-white/80 backdrop-blur border-gray-200'
      )}
    >
      {/* Page title */}
      <h1 className={clsx('text-sm font-semibold min-w-0 flex-shrink-0 mr-1', isDark ? 'text-white' : 'text-gray-900')}>
        {pageTitle}
      </h1>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        {/* Search trigger */}
        <button
          onClick={onSearchOpen}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border transition-colors flex-shrink-0 w-52',
            isDark
              ? 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
          )}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className={clsx('text-[10px] px-1.5 py-0.5 rounded border font-mono', isDark ? 'border-gray-700 bg-gray-900 text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-400')}>
            ⌘K
          </kbd>
        </button>

        {/* Source filter */}
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as 'all' | 'gcs' | 'upload')} className={selectClass}>
          <option value="all">All sources</option>
          <option value="gcs">Argo</option>
          <option value="upload">Manual Upload</option>
        </select>

        {/* Branch filter — driven by actual runs */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <GitBranch className={clsx('w-3.5 h-3.5 flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={selectClass}>
            <option value="all">All branches</option>
            {allBranches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {/* Commit badge */}
          {latestCommit && (
            <span className={clsx(
              'text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
              isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-500'
            )}>
              {latestCommit.slice(0, 7)}
            </span>
          )}
        </div>

        {/* Date range picker */}
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />

      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notification bell */}
        <button className={clsx('relative p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}>
          <Bell className="w-4 h-4" />
          {notifCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-purple-600 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
              {notifCount}
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={clsx('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User avatar */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className={clsx('flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
          >
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
              PL
            </div>
            <ChevronDown className={clsx('w-3 h-3', isDark ? 'text-gray-400' : 'text-gray-500')} />
          </button>

          {userMenuOpen && (
            <div
              className={clsx(
                'absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-lg py-1 z-50',
                isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              {[
                { icon: User, label: 'Profile' },
                { icon: Settings, label: 'Settings' },
                { icon: LogOut, label: 'Logout' },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => setUserMenuOpen(false)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                    isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
