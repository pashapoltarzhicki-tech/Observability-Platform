import { useState } from 'react';
import { X, Upload, GitBranch, GitCommit, FileJson } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useReports } from '../context/ReportsContext';
import { clsx } from '../lib/clsx';

interface UploadModalProps {
  files: File[];
  onClose: () => void;
}

export function UploadModal({ files, onClose }: UploadModalProps) {
  const { isDark } = useTheme();
  const { addFiles, allBranches } = useReports();
  const [branch, setBranch] = useState('main');
  const [commit, setCommit] = useState('');
  const [customBranch, setCustomBranch] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const effectiveBranch = isCustom ? customBranch : branch;

  const handleUpload = async () => {
    await addFiles(files, { branch: effectiveBranch || 'main', commit: commit.trim() });
    onClose();
  };

  const inputClass = clsx(
    'w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-purple-500 transition-colors',
    isDark
      ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  );

  const selectClass = clsx(
    'w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer transition-colors',
    isDark
      ? 'bg-gray-800 border-gray-700 text-gray-100'
      : 'bg-white border-gray-200 text-gray-900'
  );

  const branches = Array.from(new Set(['main', 'develop', ...allBranches]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className={clsx(
          'relative w-full max-w-md rounded-2xl shadow-2xl border',
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        )}
      >
        {/* Header */}
        <div className={clsx('flex items-center justify-between px-5 py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <Upload className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <h2 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                Upload Report{files.length > 1 ? 's' : ''}
              </h2>
              <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Files list */}
          <div className={clsx('rounded-xl p-3 space-y-1.5', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
            {files.map((f) => (
              <div key={f.name} className="flex items-center gap-2">
                <FileJson className={clsx('w-3.5 h-3.5 flex-shrink-0', isDark ? 'text-purple-400' : 'text-purple-600')} />
                <span className={clsx('text-xs truncate', isDark ? 'text-gray-300' : 'text-gray-600')}>{f.name}</span>
                <span className={clsx('text-xs ml-auto flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
            ))}
          </div>

          {/* Branch */}
          <div className="space-y-1.5">
            <label className={clsx('flex items-center gap-1.5 text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
              <GitBranch className="w-3.5 h-3.5" />
              Branch
            </label>
            {!isCustom ? (
              <div className="flex gap-2">
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className={selectClass}>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsCustom(true)}
                  className={clsx(
                    'flex-shrink-0 px-3 py-2 rounded-lg text-xs border transition-colors',
                    isDark
                      ? 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  )}
                >
                  Custom
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customBranch}
                  onChange={(e) => setCustomBranch(e.target.value)}
                  placeholder="feature/my-branch"
                  className={inputClass}
                  autoFocus
                />
                <button
                  onClick={() => { setIsCustom(false); setCustomBranch(''); }}
                  className={clsx(
                    'flex-shrink-0 px-3 py-2 rounded-lg text-xs border transition-colors',
                    isDark
                      ? 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  )}
                >
                  List
                </button>
              </div>
            )}
          </div>

          {/* Commit */}
          <div className="space-y-1.5">
            <label className={clsx('flex items-center gap-1.5 text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
              <GitCommit className="w-3.5 h-3.5" />
              Commit SHA <span className={clsx('font-normal', isDark ? 'text-gray-500' : 'text-gray-400')}>(optional)</span>
            </label>
            <input
              type="text"
              value={commit}
              onChange={(e) => setCommit(e.target.value)}
              placeholder="e.g. a3f5c9d"
              maxLength={40}
              className={inputClass}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={clsx('flex items-center justify-end gap-2 px-5 py-4 border-t', isDark ? 'border-gray-800' : 'border-gray-100')}>
          <button
            onClick={onClose}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
              isDark
                ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            Upload {files.length > 1 ? `${files.length} Reports` : 'Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
