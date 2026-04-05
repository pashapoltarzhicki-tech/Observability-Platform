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
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PullRequestsPage } from './pages/PullRequestsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComparePage } from './pages/ComparePage';

export function App() {
  return (
    <ThemeProvider>
      <ReportsProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/test-runs" element={<TestRunsPage />} />
              <Route path="/test-runs/:runId" element={<TestRunDetailPage />} />
              <Route path="/test-cases" element={<TestCasesPage />} />
              <Route path="/tests" element={<TestsPage />} />
              <Route path="/flaky-tests" element={<FlakyTestsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/pull-requests" element={<PullRequestsPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/compare" element={<ComparePage />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </ReportsProvider>
    </ThemeProvider>
  );
}
