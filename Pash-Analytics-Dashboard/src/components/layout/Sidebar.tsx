import React, { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlayCircle,
  FlaskConical,
  TestTube2,
  AlertTriangle,
  GitCompare,
  ShieldCheck,
  Upload,
  RefreshCw,
  Trash2,
  CloudOff,
  Cloud,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useReports } from '../../context/ReportsContext';
import { clsx } from '../../lib/clsx';
import { UploadModal } from '../UploadModal';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/test-cases', label: 'Test Cases', icon: FlaskConical },
  { path: '/test-runs', label: 'Test Runs', icon: PlayCircle },
  { path: '/tests', label: 'Tests', icon: TestTube2 },
  { path: '/flaky-tests', label: 'Flaky Tests', icon: AlertTriangle },
  { path: '/compare',  label: 'Compare',  icon: GitCompare  },
  { path: '/coverage', label: 'Coverage', icon: ShieldCheck },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface TooltipState {
  label: string;
  y: number;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { isDark } = useTheme();
  const { gcsStatus, refreshGCS, runs, clearAll, loadedFrom, loadOlderRuns } = useReports();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles(files);
      e.target.value = '';
    }
  };

  const showTooltip = (e: React.MouseEvent, label: string) => {
    if (!collapsed) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ label, y: rect.top + rect.height / 2 });
  };

  const hideTooltip = () => setTooltip(null);

  const labelFade = clsx(
    'whitespace-nowrap overflow-hidden transition-opacity',
    collapsed ? 'opacity-0 duration-100 pointer-events-none' : 'opacity-100 duration-200 delay-150'
  );

  const gcsIcon = (big = false) => {
    const cls = big ? 'w-5 h-5' : 'w-4 h-4';
    if (gcsStatus.stage === 'scanning' || gcsStatus.stage === 'downloading' || gcsStatus.stage === 'loading-cache')
      return <Loader2 className={clsx(cls, 'text-purple-400 animate-spin')} />;
    if (gcsStatus.stage === 'error')
      return <CloudOff className={clsx(cls, 'text-red-400')} />;
    return <Cloud className={clsx(cls, gcsStatus.stage === 'ready' ? 'text-green-400' : 'text-gray-500')} />;
  };

  const isServerOffline = gcsStatus.stage === 'error' &&
    (gcsStatus.message.includes('ECONNREFUSED') || gcsStatus.message.includes('fetch') ||
     gcsStatus.message.includes('Failed to fetch') || gcsStatus.message.includes('not running'));

  const gcsLabel = gcsStatus.stage === 'idle' ? 'Connecting…'
    : gcsStatus.stage === 'loading-cache' ? 'Loading cache…'
    : gcsStatus.stage === 'scanning' ? 'Scanning GCS…'
    : gcsStatus.stage === 'downloading' ? `Downloading ${gcsStatus.done}/${gcsStatus.total}…`
    : gcsStatus.stage === 'ready'
      ? (gcsStatus.newFiles > 0 ? `+${gcsStatus.newFiles} new · ${runs.length} total` : `${runs.length} runs · up to date`)
        + (gcsStatus.skipped > 0 ? ` · ${gcsStatus.skipped} skipped >30MB` : '')
    : gcsStatus.stage === 'error'
      ? (isServerOffline ? 'Server offline' : 'Sync failed')
    : '';

  return (
    <>
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full z-30 flex flex-col',
          'transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
          isDark ? 'bg-gray-900 border-r border-gray-800' : 'bg-white border-r border-gray-200'
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
          <div className={clsx('min-w-0', labelFade)}>
            <p className={clsx('font-bold text-sm leading-tight tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>BlackOre</p>
            <p className={clsx('text-[11px] leading-tight', isDark ? 'text-gray-400' : 'text-gray-500')}>Automation Dashboard</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onMouseEnter={(e) => showTooltip(e, label)}
              onMouseLeave={hideTooltip}
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
              <span className={labelFade}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: GCS + Upload */}
        <div className="px-2 pb-4 space-y-1 flex-shrink-0">

          {/* GCS row */}
          <div
            className={clsx(
              'w-full flex items-center rounded-lg border transition-all duration-300',
              collapsed
                ? 'px-3 py-2 border-transparent cursor-pointer'
                : 'gap-1.5 px-3 py-2.5',
              !collapsed && (isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'),
              collapsed && (isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')
            )}
            onClick={collapsed ? refreshGCS : undefined}
            onMouseEnter={(e) => showTooltip(e, `GCS Sync · ${gcsLabel}`)}
            onMouseLeave={hideTooltip}
          >
            {collapsed ? (
              <div className="flex-shrink-0">{gcsIcon(true)}</div>
            ) : (
              <div className="flex-shrink-0">{gcsIcon(false)}</div>
            )}
            <div className={clsx('flex-1 min-w-0', labelFade)}>
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>GCS Sync</span>
                <div className="flex items-center gap-0.5">
                  {gcsStatus.stage === 'error' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setErrorModalOpen(true); }}
                      title="View error details"
                      className={clsx('p-1 rounded transition-colors', isDark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-500')}
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); refreshGCS(); }}
                    disabled={gcsStatus.stage === 'scanning' || gcsStatus.stage === 'downloading'}
                    title="Refresh"
                    className={clsx('p-1 rounded transition-colors disabled:opacity-40', isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}
                  >
                    <RefreshCw className={clsx('w-3 h-3', (gcsStatus.stage === 'scanning' || gcsStatus.stage === 'downloading') && 'animate-spin')} />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearAll(); }}
                      title="Clear site data & reload"
                      className={clsx('p-1 rounded transition-colors', isDark ? 'hover:bg-red-900/40 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className={clsx('text-[10px] leading-snug truncate',
                gcsStatus.stage === 'error' ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400'
              )}>
                {gcsLabel}
              </p>
              {gcsStatus.stage === 'ready' && loadedFrom && (
                <button
                  onClick={(e) => { e.stopPropagation(); loadOlderRuns(); }}
                  className={clsx('text-[10px] mt-0.5 text-left underline underline-offset-2 transition-colors', isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600')}
                >
                  Load older runs (from {loadedFrom})
                </button>
              )}
            </div>
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={(e) => showTooltip(e, 'Upload Local Report')}
            onMouseLeave={hideTooltip}
            className={clsx(
              'w-full flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
              collapsed ? 'px-3 py-2' : 'gap-2.5 px-3 py-2 border',
              isDark
                ? 'border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Upload className="w-4 h-4 flex-shrink-0" />
            <span className={labelFade}>Upload Local Report</span>
          </button>
        </div>
      </aside>

      {/* Fixed tooltip — rendered outside aside/nav so never clipped */}
      {collapsed && tooltip && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ left: '4.5rem', top: tooltip.y, transform: 'translateY(-50%)' }}
        >
          <div className="relative flex items-center">
            <div className="border-[5px] border-transparent border-r-purple-600" />
            <div className="bg-purple-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
              {tooltip.label}
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={clsx(
          'fixed top-16 z-50 -translate-x-1/2',
          'w-8 h-8 rounded-full flex items-center justify-center',
          'shadow-lg transition-all duration-300',
          'bg-purple-600 text-white hover:bg-purple-500 hover:scale-110 active:scale-95',
        )}
        style={{ left: collapsed ? '4rem' : '15rem' }}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <input ref={fileInputRef} type="file" multiple accept=".json,application/json" className="hidden" onChange={handleFileChange} />
      {pendingFiles.length > 0 && (
        <UploadModal files={pendingFiles} onClose={() => setPendingFiles([])} />
      )}

      {/* GCS error detail modal */}
      {errorModalOpen && gcsStatus.stage === 'error' && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={() => setErrorModalOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className={clsx('relative w-full max-w-md rounded-xl border shadow-2xl p-5 space-y-3', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>GCS Sync Error</span>
              </div>
              <button onClick={() => setErrorModalOpen(false)} className={clsx('p-1 rounded transition-colors', isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className={clsx('text-xs rounded-lg p-3 whitespace-pre-wrap break-all font-mono leading-relaxed', isDark ? 'bg-gray-800 text-red-300' : 'bg-red-50 text-red-700 border border-red-200')}>
              {gcsStatus.message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => { setErrorModalOpen(false); refreshGCS(); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                Retry sync
              </button>
              <button
                onClick={() => setErrorModalOpen(false)}
                className={clsx('flex-1 py-2 rounded-lg text-xs font-medium transition-colors', isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}