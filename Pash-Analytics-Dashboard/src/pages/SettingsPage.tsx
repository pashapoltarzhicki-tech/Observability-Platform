import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useReports } from '../context/ReportsContext';
import { clsx } from '../lib/clsx';

export function SettingsPage() {
  const { isDark, theme, setTheme } = useTheme();
  const { clearAll, runs } = useReports();
  const [appName, setAppName] = useState('BlackOre Automation Dashboard');
  const [defaultEnv, setDefaultEnv] = useState('production');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('MMM d, yyyy');

  const inputClass = clsx(
    'w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-purple-500',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  const selectClass = clsx(
    'w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-purple-500 appearance-none',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  const sectionClass = clsx(
    'rounded-xl border p-5 space-y-4',
    isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  );

  const labelClass = clsx('block text-xs font-medium mb-1.5', isDark ? 'text-gray-400' : 'text-gray-600');

  return (
    <div className="max-w-2xl space-y-5">
      {/* General */}
      <div className={sectionClass}>
        <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>General</h3>
        <div>
          <label className={labelClass}>App Name</label>
          <input value={appName} onChange={(e) => setAppName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Default Environment</label>
          <select value={defaultEnv} onChange={(e) => setDefaultEnv(e.target.value)} className={selectClass}>
            <option value="production">production</option>
            <option value="staging">staging</option>
            <option value="development">development</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Default Branch</label>
          <select value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} className={selectClass}>
            <option value="main">main</option>
            <option value="develop">develop</option>
            <option value="feature/*">feature/*</option>
          </select>
        </div>
      </div>

      {/* Display */}
      <div className={sectionClass}>
        <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Display</h3>
        <div>
          <label className={labelClass}>Theme</label>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                  theme === t
                    ? 'bg-purple-600 text-white'
                    : isDark ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Timezone</label>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Date Format</label>
          <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={selectClass}>
            <option value="MMM d, yyyy">MMM d, yyyy</option>
            <option value="yyyy-MM-dd">yyyy-MM-dd</option>
            <option value="dd/MM/yyyy">dd/MM/yyyy</option>
            <option value="MM/dd/yyyy">MM/dd/yyyy</option>
          </select>
        </div>
      </div>

      {/* Data */}
      <div className={sectionClass}>
        <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Data</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className={clsx('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>Reports loaded</p>
            <p className={clsx('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{runs.length} report{runs.length !== 1 ? 's' : ''} in memory</p>
          </div>
          <button
            onClick={clearAll}
            disabled={runs.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear All Reports
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className={clsx('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>Export Data</p>
            <p className={clsx('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Download all report data as JSON</p>
          </div>
          <button
            disabled={runs.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
}
