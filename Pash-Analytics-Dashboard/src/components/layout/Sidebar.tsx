import React, { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlayCircle,
  FlaskConical,
  AlertTriangle,
  History,
  BarChart3,
  GitPullRequest,
  Plug,
  Settings,
  Upload,
  RefreshCw,
  CloudOff,
  Cloud,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useReports } from '../../context/ReportsContext';
import { clsx } from '../../lib/clsx';
import { UploadModal } from '../UploadModal';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/test-runs', label: 'Test Runs', icon: PlayCircle },
  { path: '/test-cases', label: 'Test Cases', icon: FlaskConical },
  { path: '/flaky-tests', label: 'Flaky Tests', icon: AlertTriangle },
  { path: '/history', label: 'History', icon: History },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/pull-requests', label: 'Pull Requests', icon: GitPullRequest },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { isDark } = useTheme();
  const { gcsStatus, refreshGCS, runs } = useReports();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles(files);
      e.target.value = '';
    }
  };

  return (
    <>
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full w-60 z-30 flex flex-col',
          isDark
            ? 'bg-gray-900 border-r border-gray-800'
            : 'bg-white border-r border-gray-200'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-inherit flex-shrink-0">
          <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden">
            <svg viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
              <rect width="65" height="65" fill="white"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M12.9583 13H17.2778H21.5972V52H17.2778H12.9583V47.6667H17.2778V17.3333H12.9583V13Z" fill="black"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M38.875 47.6667C43.646 47.6667 47.5139 43.7864 47.5139 39C47.5139 34.2136 43.646 30.3333 38.875 30.3333C34.1039 30.3333 30.2361 34.2136 30.2361 39C30.2361 43.7864 34.1039 47.6667 38.875 47.6667ZM38.875 52C46.0317 52 51.8333 46.1797 51.8333 39C51.8333 31.8203 46.0317 26 38.875 26C31.7183 26 25.9167 31.8203 25.9167 39C25.9167 46.1797 31.7183 52 38.875 52Z" fill="black"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className={clsx('font-bold text-sm leading-tight tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>BlackOre</p>
            <p className={clsx('text-[11px] leading-tight', isDark ? 'text-gray-400' : 'text-gray-500')}>Automation Dashboard</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-purple-600 text-white'
                    : isDark
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* GCS status + upload */}
        <div className="px-3 pb-4 space-y-2 flex-shrink-0">
          {/* GCS sync card */}
          <div className={clsx('rounded-lg border px-3 py-2.5 space-y-1.5', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {gcsStatus.stage === 'scanning' || gcsStatus.stage === 'downloading' || gcsStatus.stage === 'loading-cache' ? (
                  <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                ) : gcsStatus.stage === 'error' ? (
                  <CloudOff className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Cloud className={clsx('w-3.5 h-3.5', gcsStatus.stage === 'ready' ? 'text-green-400' : 'text-gray-500')} />
                )}
                <span className={clsx('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>GCS Sync</span>
              </div>
              <button
                onClick={refreshGCS}
                disabled={gcsStatus.stage === 'scanning' || gcsStatus.stage === 'downloading'}
                title={gcsStatus.stage === 'error' ? 'Retry connection' : "Refresh today's reports"}
                className={clsx('p-1 rounded transition-colors disabled:opacity-40', isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}
              >
                <RefreshCw className={clsx('w-3 h-3', (gcsStatus.stage === 'scanning' || gcsStatus.stage === 'downloading') && 'animate-spin')} />
              </button>
            </div>
            <p className={clsx('text-[10px] leading-snug', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {gcsStatus.stage === 'idle' && 'Connecting…'}
              {gcsStatus.stage === 'loading-cache' && 'Loading cache…'}
              {gcsStatus.stage === 'scanning' && 'Scanning GCS…'}
              {gcsStatus.stage === 'downloading' && `Downloading ${gcsStatus.done}/${gcsStatus.total}…`}
              {gcsStatus.stage === 'ready' && (
                gcsStatus.newFiles > 0
                  ? `+${gcsStatus.newFiles} new · ${runs.length} total`
                  : `${runs.length} run${runs.length !== 1 ? 's' : ''} · up to date`
              )}
              {gcsStatus.stage === 'error' && (
                <span className="text-red-400" title={gcsStatus.message}>
                  {gcsStatus.message.includes('fetch') || gcsStatus.message.includes('connect') || gcsStatus.message.includes('ECONNREFUSED')
                    ? 'Server offline — run npm run dev'
                    : gcsStatus.message.slice(0, 50)}
                </span>
              )}
            </p>
            {gcsStatus.stage === 'downloading' && (
              <div className={clsx('h-1 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((gcsStatus.done / gcsStatus.total) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Manual upload */}
          <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 border',
              isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Upload className="w-4 h-4 flex-shrink-0" />
            Upload Local Report
          </button>
        </div>
      </aside>

      {/* Upload modal */}
      {pendingFiles.length > 0 && (
        <UploadModal
          files={pendingFiles}
          onClose={() => setPendingFiles([])}
        />
      )}
    </>
  );
}
