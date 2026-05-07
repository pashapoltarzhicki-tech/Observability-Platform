import { Component, ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ReportsProvider } from './context/ReportsContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { TestRunDetailPage } from './pages/TestRunDetailPage';
import { TestCasesPage } from './pages/TestCasesPage';
import { TestsPage } from './pages/TestsPage';
import { FlakyTestsPage } from './pages/FlakyTestsPage';
import { HistoryPage } from './pages/HistoryPage';
import { PullRequestsPage } from './pages/PullRequestsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComparePage } from './pages/ComparePage';
import { CoveragePage } from './pages/CoveragePage';

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#f87171' }}>Something went wrong</h2>
          <pre style={{ color: '#9ca3af', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {(this.state.error as Error).message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <ThemeProvider>
      <ReportsProvider>
        <BrowserRouter>
          <AppLayout>
            <PageErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/test-runs" element={<TestRunsPage />} />
              <Route path="/test-runs/:runId" element={<TestRunDetailPage />} />
              <Route path="/test-cases" element={<TestCasesPage />} />
              <Route path="/tests" element={<TestsPage />} />
              <Route path="/flaky-tests" element={<FlakyTestsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/pull-requests" element={<PullRequestsPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/coverage" element={<CoveragePage />} />
            </Routes>
            </PageErrorBoundary>
          </AppLayout>
        </BrowserRouter>
      </ReportsProvider>
    </ThemeProvider>
  );
}
