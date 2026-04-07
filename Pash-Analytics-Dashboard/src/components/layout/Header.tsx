import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Sun, Moon, ChevronDown, User, LogOut, Settings, GitBranch, GitCommit, Database, X } from 'lucide-react';
import { DateRangePicker } from '../DateRangePicker';
import { useTheme } from '../../context/ThemeContext';
import { useReports } from '../../context/ReportsContext';
import { clsx } from '../../lib/clsx';

interface HeaderProps {
  onSearchOpen: () => void;
}

// Reusable pill filter dropdown
interface FilterPillProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClear?: () => void;
  children: React.ReactNode;
  isDark: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

function FilterPill({ icon, label, active, open, onToggle, onClear, children, isDark, containerRef }: FilterPillProps) {
  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      <button
        onClick={onToggle}
        className={clsx(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-colors',
          active
            ? 'border-purple-500 bg-purple-600/10 text-purple-500'
            : isDark
              ? 'border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-600 hover:text-gray-200'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
        )}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className={clsx('font-medium', active ? '' : '')}>{label}</span>
        {active && onClear && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="flex-shrink-0 hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className={clsx('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className={clsx(
          'absolute left-0 top-full mt-1.5 min-w-[10rem] rounded-xl border shadow-xl z-50 py-1',
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        )}>
          {children}
        </div>
      )}
    </div>
  );
}

function FilterOption({ label, active, onClick, isDark, mono = false }: { label: string; active: boolean; onClick: () => void; isDark: boolean; mono?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
        active
          ? isDark ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-50 text-purple-700'
          : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'
      )}
    >
      <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors',
        active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300'
      )}>
        {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
      </span>
      <span className={mono ? 'font-mono' : ''}>{label}</span>
    </button>
  );
}

export function Header({ onSearchOpen }: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const { allBranches, allCommits, dateFrom, setDateFrom, dateTo, setDateTo, sourceFilter, setSourceFilter, branchFilter, setBranchFilter, commitFilter, setCommitFilter } = useReports();

  const [userMenuOpen, setUserMenuOpen]   = useState(false);
  const [sourceOpen, setSourceOpen]       = useState(false);
  const [branchOpen, setBranchOpen]       = useState(false);
  const [commitOpen, setCommitOpen]       = useState(false);
  const [notifCount]                      = useState(3);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const sourceRef   = useRef<HTMLDivElement>(null);
  const branchRef   = useRef<HTMLDivElement>(null);
  const commitRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (sourceRef.current   && !sourceRef.current.contains(e.target as Node))   setSourceOpen(false);
      if (branchRef.current   && !branchRef.current.contains(e.target as Node))   setBranchOpen(false);
      if (commitRef.current   && !commitRef.current.contains(e.target as Node))   setCommitOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset filters if selected value disappears from available options
  useEffect(() => {
    if (branchFilter !== 'all' && allBranches.length > 0 && !allBranches.includes(branchFilter)) setBranchFilter('all');
  }, [allBranches]);
  useEffect(() => {
    if (commitFilter !== 'all' && allCommits.length > 0 && !allCommits.includes(commitFilter)) setCommitFilter('all');
  }, [allCommits]);

  const sourceLabel = sourceFilter === 'gcs' ? 'Argo' : sourceFilter === 'upload' ? 'Manual' : 'Source';
  const branchLabel = branchFilter === 'all' ? 'Branch' : branchFilter;
  const commitLabel = commitFilter === 'all' ? 'Commit' : commitFilter.slice(0, 7);

  return (
    <header
      className={clsx(
        'sticky top-0 z-20 h-14 flex items-center gap-2 px-6 border-b',
        isDark
          ? 'bg-gray-900/80 backdrop-blur border-gray-800'
          : 'bg-white/80 backdrop-blur border-gray-200'
      )}
    >
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {/* Search trigger */}
        <button
          onClick={onSearchOpen}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border transition-colors flex-shrink-0 w-72',
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
        <FilterPill
          containerRef={sourceRef}
          icon={<Database className="w-3.5 h-3.5" />}
          label={sourceLabel}
          active={sourceFilter !== 'all'}
          open={sourceOpen}
          onToggle={() => setSourceOpen((v) => !v)}
          onClear={() => { setSourceFilter('all'); setSourceOpen(false); }}
          isDark={isDark}
        >
          {[{ value: 'all', label: 'All sources' }, { value: 'gcs', label: 'Argo' }, { value: 'upload', label: 'Manual Upload' }].map(({ value, label }) => (
            <FilterOption key={value} label={label} active={sourceFilter === value} isDark={isDark}
              onClick={() => { setSourceFilter(value as any); setSourceOpen(false); }} />
          ))}
        </FilterPill>

        {/* Branch filter */}
        <FilterPill
          containerRef={branchRef}
          icon={<GitBranch className="w-3.5 h-3.5" />}
          label={branchLabel}
          active={branchFilter !== 'all'}
          open={branchOpen}
          onToggle={() => setBranchOpen((v) => !v)}
          onClear={() => { setBranchFilter('all'); setCommitFilter('all'); setBranchOpen(false); }}
          isDark={isDark}
        >
          {[{ value: 'all', label: 'All branches' }, ...allBranches.map((b) => ({ value: b, label: b }))].map(({ value, label }) => (
            <FilterOption key={value} label={label} active={branchFilter === value} isDark={isDark}
              onClick={() => { setBranchFilter(value); setCommitFilter('all'); setBranchOpen(false); }} />
          ))}
        </FilterPill>

        {/* Commit filter */}
        {allCommits.length > 0 && (
          <FilterPill
            containerRef={commitRef}
            icon={<GitCommit className="w-3.5 h-3.5" />}
            label={commitLabel}
            active={commitFilter !== 'all'}
            open={commitOpen}
            onToggle={() => setCommitOpen((v) => !v)}
            onClear={() => { setCommitFilter('all'); setCommitOpen(false); }}
            isDark={isDark}
          >
            <FilterOption label="All commits" active={commitFilter === 'all'} isDark={isDark}
              onClick={() => { setCommitFilter('all'); setCommitOpen(false); }} />
            {allCommits.map((c) => (
              <FilterOption key={c} label={c.slice(0, 7)} active={commitFilter === c} isDark={isDark} mono
                onClick={() => { setCommitFilter(c); setCommitOpen(false); }} />
            ))}
          </FilterPill>
        )}

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
            <div className={clsx('absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-lg py-1 z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              {[{ icon: User, label: 'Profile' }, { icon: Settings, label: 'Settings' }, { icon: LogOut, label: 'Logout' }].map(({ icon: Icon, label }) => (
                <button key={label} onClick={() => setUserMenuOpen(false)}
                  className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors', isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50')}
                >
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
