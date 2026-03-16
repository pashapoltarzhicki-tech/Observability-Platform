import { GitPullRequest } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { clsx } from '../lib/clsx';

export function PullRequestsPage() {
  const { isDark } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center mb-6', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
        <GitPullRequest className="w-10 h-10 text-purple-500" />
      </div>
      <h2 className={clsx('text-2xl font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
        Pull Request Integration
      </h2>
      <p className={clsx('max-w-md mb-8 leading-relaxed text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
        Connect your GitHub repository to automatically track test results per pull request.
        Get pass/fail status directly in your PR comments.
      </p>
      <button
        disabled
        className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed"
      >
        <GitPullRequest className="w-4 h-4" />
        Connect GitHub — Coming Soon
      </button>
    </div>
  );
}
