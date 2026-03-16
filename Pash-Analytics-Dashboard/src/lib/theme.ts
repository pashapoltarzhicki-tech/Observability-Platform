// Theme utility helpers

export type Theme = 'dark' | 'light';

export function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem('pw-dashboard-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

export function storeTheme(theme: Theme) {
  localStorage.setItem('pw-dashboard-theme', theme);
}

// Chart colors for dark/light mode
export const chartColors = {
  passed: '#22c55e',
  failed: '#ef4444',
  flaky: '#eab308',
  skipped: '#6b7280',
  primary: '#a855f7',
  blue: '#3b82f6',
  orange: '#f97316',
};

export function getChartTheme(isDark: boolean) {
  return {
    gridColor: isDark ? '#1f2937' : '#e5e7eb',
    textColor: isDark ? '#9ca3af' : '#6b7280',
    tooltipBg: isDark ? '#1f2937' : '#ffffff',
    tooltipBorder: isDark ? '#374151' : '#e5e7eb',
    tooltipText: isDark ? '#f9fafb' : '#111827',
  };
}
