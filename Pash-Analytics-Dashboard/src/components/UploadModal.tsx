import { useState, useRef } from 'react';
import { X, Upload, GitBranch, GitCommit, FileJson, Loader2, CheckCircle, AlertCircle, Tag, Plus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useReports } from '../context/ReportsContext';
import { clsx } from '../lib/clsx';
import { parseReport } from '../lib/parseReport';
import { PlaywrightReport } from '../types/playwright';

interface UploadModalProps {
  files: File[];
  onClose: () => void;
}

type FileState = 'idle' | 'uploading' | 'done' | 'error';

interface FileStatus {
  state: FileState;
  error?: string;
}

export function UploadModal({ files: initialFiles, onClose }: UploadModalProps) {
  const { isDark } = useTheme();
  const { addRuns, allBranches, setDateFrom, setDateTo, setSourceFilter } = useReports();

  const [files, setFiles] = useState<File[]>(initialFiles);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialFiles.map((f) => [f.name, '']))
  );
  const [branch, setBranch] = useState('main');
  const [commit, setCommit] = useState('');
  const [isCustomBranch, setIsCustomBranch] = useState(false);
  const [customBranch, setCustomBranch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({});
  const [allDone, setAllDone] = useState(false);

  const effectiveBranch = isCustomBranch ? customBranch.trim() || 'main' : branch;
  const branches = Array.from(new Set(['main', 'develop', ...allBranches]));

  const anyNameEmpty = files.some((f) => !names[f.name]?.trim());

  const removeFile = (name: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.name !== name);
      if (next.length === 0) onClose();
      return next;
    });
    setNames((prev) => { const n = { ...prev }; delete n[name]; return n; });
    setStatuses((prev) => { const s = { ...prev }; delete s[name]; return s; });
  };

  const addMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(e.target.files ?? []);
    if (!added.length) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...added.filter((f) => !existing.has(f.name))];
    });
    setNames((prev) => ({
      ...prev,
      ...Object.fromEntries(added.filter((f) => !(f.name in prev)).map((f) => [f.name, ''])),
    }));
    e.target.value = '';
  };

  const handleUpload = async () => {
    setUploading(true);
    const initial: Record<string, FileStatus> = {};
    files.forEach((f) => { initial[f.name] = { state: 'uploading' }; });
    setStatuses(initial);

    const newRuns = [];
    const results: Record<string, FileStatus> = {};

    for (const file of files) {
      const name = names[file.name]?.trim();
      if (!name) {
        results[file.name] = { state: 'error', error: 'Name is required' };
        continue;
      }

      try {
        const text = await file.text();
        let json: PlaywrightReport;
        try {
          json = JSON.parse(text) as PlaywrightReport;
        } catch {
          throw new Error('Not a valid JSON file. Please upload a Playwright JSON report.');
        }
        if (!json.stats || !json.suites) {
          throw new Error('Invalid Playwright report — missing stats or suites.');
        }

        // Inject branch/commit so they survive the round-trip through GCS
        (json as any)._meta = {
          ...((json as any)._meta ?? {}),
          branch: effectiveBranch,
          ...(commit.trim() ? { commit: commit.trim() } : {}),
        };

        const res = await fetch('/api/gcs/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: json, name }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || res.statusText);
        }

        const { folderName } = await res.json();

        // Parse with folderName so the ID matches when GCS scan picks it up later,
        // then override filename to show just the user-given name in the UI
        const run = parseReport(json, folderName, effectiveBranch, commit.trim());
        run.filename = `manually-${name}`;
        run.source = 'upload';
        newRuns.push(run);
        results[file.name] = { state: 'done' };
      } catch (err) {
        results[file.name] = { state: 'error', error: (err as Error).message };
      }
    }

    setStatuses(results);

    if (newRuns.length > 0) {
      addRuns(newRuns);
      setSourceFilter('all');
      // Expand date range so the uploaded run is visible regardless of its date
      for (const run of newRuns) {
        const t = run.startTime.toISOString();
        setDateFrom((prev) => (t < prev ? t : prev));
        setDateTo((prev) => (t > prev ? t : prev));
      }
    }

    const hasErrors = Object.values(results).some((s) => s.state === 'error');
    setUploading(false);

    if (!hasErrors) {
      setAllDone(true);
      setTimeout(onClose, 1200);
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={uploading ? undefined : onClose} />

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
                Upload Report{files.length !== 1 ? 's' : ''}
              </h2>
              <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Saved to GCS · date read from report
              </p>
            </div>
          </div>
          <button
            onClick={uploading ? undefined : onClose}
            disabled={uploading}
            className={clsx('p-1.5 rounded-lg transition-colors disabled:opacity-40', isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* File list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={clsx('flex items-center gap-1.5 text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
                <Tag className="w-3.5 h-3.5" /> Files
              </span>
              {!uploading && (
                <button
                  onClick={() => addFileInputRef.current?.click()}
                  className={clsx('flex items-center gap-1 text-xs transition-colors', isDark ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-600')}
                >
                  <Plus className="w-3.5 h-3.5" /> Add file
                </button>
              )}
              <input ref={addFileInputRef} type="file" multiple accept=".json,application/json" className="hidden" onChange={addMoreFiles} />
            </div>

            {files.map((f) => {
              const status = statuses[f.name];
              return (
                <div key={f.name} className={clsx('rounded-xl px-3 py-2.5', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                  {/* File info row: icon + filename on left, size + X on right */}
                  <div className="flex items-center gap-2 mb-2">
                    <FileJson className={clsx('w-3.5 h-3.5 flex-shrink-0', isDark ? 'text-purple-400' : 'text-purple-600')} />
                    <span className={clsx('text-xs truncate flex-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{f.name}</span>
                    <span className={clsx('text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded', isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')}>
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    {status?.state === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin flex-shrink-0" />}
                    {status?.state === 'done' && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                    {status?.state === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    {!uploading && !status && (
                      <button onClick={() => removeFile(f.name)} className={clsx('flex-shrink-0 transition-colors', isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-300 hover:text-red-500')}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Run name input — directly below filename */}
                  <input
                    type="text"
                    value={names[f.name] ?? ''}
                    onChange={(e) => setNames((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    placeholder="Run name (required)"
                    disabled={uploading}
                    className={clsx(inputClass, 'text-xs py-1.5 disabled:opacity-60')}
                  />
                  {status?.state === 'error' && (
                    <p className="mt-1.5 text-xs text-red-400">{status.error}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Branch */}
          <div className="space-y-1.5">
            <label className={clsx('flex items-center gap-1.5 text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
              <GitBranch className="w-3.5 h-3.5" />
              Branch
            </label>
            {!isCustomBranch ? (
              <div className="flex gap-2">
                <select value={branch} onChange={(e) => setBranch(e.target.value)} disabled={uploading} className={selectClass}>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsCustomBranch(true)}
                  disabled={uploading}
                  className={clsx(
                    'flex-shrink-0 px-3 py-2 rounded-lg text-xs border transition-colors disabled:opacity-40',
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
                  disabled={uploading}
                  className={clsx(inputClass, 'disabled:opacity-60')}
                  autoFocus
                />
                <button
                  onClick={() => { setIsCustomBranch(false); setCustomBranch(''); }}
                  disabled={uploading}
                  className={clsx(
                    'flex-shrink-0 px-3 py-2 rounded-lg text-xs border transition-colors disabled:opacity-40',
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
              disabled={uploading}
              className={clsx(inputClass, 'disabled:opacity-60')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={clsx('flex items-center justify-end gap-2 px-5 py-4 border-t', isDark ? 'border-gray-800' : 'border-gray-100')}>
          <button
            onClick={onClose}
            disabled={uploading}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors border disabled:opacity-40',
              isDark
                ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || anyNameEmpty || allDone}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
          >
            {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {allDone ? 'Done!' : uploading ? 'Uploading…' : `Upload ${files.length > 1 ? `${files.length} Reports` : 'Report'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
