import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Clock, Upload as UploadIcon } from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { useDropzone } from 'react-dropzone';

function StatusBadge({ passed, failed }: { passed: number; failed: number; total: number }) {
  const status = failed === 0 ? 'passed' : passed === 0 ? 'failed' : 'partial';
  return (
    <span className={clsx(
      'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
      status === 'passed' ? 'bg-green-500/20 text-green-400' :
      status === 'failed' ? 'bg-red-500/20 text-red-400' :
      'bg-yellow-500/20 text-yellow-400'
    )}>
      {status}
    </span>
  );
}


export function TestRunsPage() {
  const { filteredRuns: runs, addFiles } = useReports();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summaries = getRunsSummary(runs).reverse();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) { addFiles(files); e.target.value = ''; }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/json': ['.json'] },
    onDrop: (files) => addFiles(files),
  });

  if (runs.length === 0) {
    return (
      <div
        {...getRootProps()}
        className={clsx(
          'flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed cursor-pointer transition-colors',
          isDragActive
            ? 'border-purple-500 bg-purple-500/10'
            : isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon className={clsx('w-12 h-12 mb-4', isDark ? 'text-gray-600' : 'text-gray-400')} />
        <p className={clsx('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
          {isDragActive ? 'Drop reports here' : 'Drop Playwright JSON reports here'}
        </p>
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
          or click to browse files
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {runs.length} run{runs.length !== 1 ? 's' : ''} loaded
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
        <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={handleFileChange} />
      </div>

      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                {['Workflow', 'Branch', 'Commit', 'Status', 'Duration', 'Passed', 'Failed', 'Flaky', 'Environment', 'Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((r, idx) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/test-runs/${r.id}`)}
                  className={clsx(
                    'border-t cursor-pointer transition-colors',
                    isDark ? 'border-gray-800 hover:bg-gray-800/60' : 'border-gray-100 hover:bg-gray-50',
                    idx % 2 === 1 ? isDark ? 'bg-gray-900/40' : 'bg-gray-50/60' : ''
                  )}
                >
                  <td className="px-4 py-3 max-w-[280px]">
                    <span className={clsx('text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                      {r.filename}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-300' : 'text-gray-600')}>{r.branch || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('font-mono text-xs', isDark ? 'text-purple-400' : 'text-purple-600')}>
                      {r.commit ? r.commit.slice(0, 7) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge passed={r.passed} failed={r.failed} total={r.total} />
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(r.duration)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-green-500 font-medium text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {r.passed}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-red-500 font-medium text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {r.failed}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-yellow-500 font-medium text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      {r.flaky}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {r.env || '—'}
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {format(r.startTime, 'MMM d, yyyy HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
