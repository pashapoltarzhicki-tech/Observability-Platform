import { useTheme } from '../context/ThemeContext';
import { clsx } from '../lib/clsx';

const integrations = [
  {
    id: 'github',
    name: 'GitHub',
    letter: 'G',
    color: 'bg-gray-800',
    description: 'Connect your GitHub repository to track test results per PR and commit.',
  },
  {
    id: 'slack',
    name: 'Slack',
    letter: 'S',
    color: 'bg-green-700',
    description: 'Send test result notifications to your Slack channels.',
  },
  {
    id: 'jira',
    name: 'Jira',
    letter: 'J',
    color: 'bg-blue-700',
    description: 'Automatically create Jira issues for failing tests.',
  },
  {
    id: 'linear',
    name: 'Linear',
    letter: 'L',
    color: 'bg-purple-700',
    description: 'Create Linear issues for test failures and track them in your sprints.',
  },
];

export function IntegrationsPage() {
  const { isDark } = useTheme();

  return (
    <div className="space-y-5">
      <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
        Connect external services to extend your observability pipeline.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className={clsx(
              'rounded-xl border p-5 flex flex-col gap-4',
              isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            )}
          >
            <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold', integration.color)}>
              {integration.letter}
            </div>
            <div>
              <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                {integration.name}
              </h3>
              <p className={clsx('text-xs mt-1 leading-relaxed', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {integration.description}
              </p>
            </div>
            <button
              disabled
              className={clsx(
                'mt-auto py-2 rounded-lg text-sm font-medium transition-colors cursor-not-allowed',
                isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
              )}
            >
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
