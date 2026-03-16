import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { clsx } from '../lib/clsx';

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

const today = new Date().toISOString().slice(0, 10);

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3600 * 1000).toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

const PRESETS = [
  { label: 'Last 15 minutes', from: () => minutesAgo(15), to: () => nowISO() },
  { label: 'Last 1 hour',     from: () => hoursAgo(1),    to: () => nowISO() },
  { label: 'Last 4 hours',    from: () => hoursAgo(4),    to: () => nowISO() },
  { label: 'Last 1 day',      from: () => daysAgo(0),     to: () => today },
  { label: 'Last 3 days',     from: () => daysAgo(2),     to: () => today },
  { label: 'Last 7 days',     from: () => daysAgo(6),     to: () => today },
  { label: 'Last 30 days',    from: () => daysAgo(29),    to: () => today },
];

function formatRange(from: string, to: string): string {
  if (!from && !to) return 'All time';
  try {
    const f = from ? new Date(from) : null;
    const t = to   ? new Date(to)   : null;
    const fromIsDatetime = from.includes('T');
    if (f && t) {
      if (fromIsDatetime) {
        const diffMs = t.getTime() - f.getTime();
        const diffMins = Math.round(diffMs / 60000);
        if (diffMins < 60) return `Last ${diffMins}m`;
        const diffHours = Math.round(diffMs / 3600000);
        if (diffHours < 24) return `Last ${diffHours}h`;
      }
      if (from === to) return format(f, 'd MMM yyyy');
      const sameYear = f.getFullYear() === t.getFullYear();
      if (sameYear) return `${format(f, 'd MMM')} – ${format(t, 'd MMM yyyy')}`;
      return `${format(f, 'd MMM yyyy')} – ${format(t, 'd MMM yyyy')}`;
    }
    if (f) return `From ${format(f, 'd MMM yyyy')}`;
    if (t) return `Until ${format(t, 'd MMM yyyy')}`;
  } catch { /* ignore */ }
  return 'Custom range';
}

function activePreset(from: string, to: string): string | null {
  const datePresets = PRESETS.filter((p) => !from.includes('T') && p.label !== 'Last 15 minutes' && !p.label.includes('hour'));
  for (const p of datePresets) {
    if (from === p.from() && to === p.to()) return p.label;
  }
  if (from.includes('T')) {
    for (const p of PRESETS.filter((p) => p.label.includes('minute') || p.label.includes('hour'))) {
      const expected = new Date(p.from()).getTime();
      const actual   = new Date(from).getTime();
      if (Math.abs(expected - actual) < 10000) return p.label;
    }
  }
  return null;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = formatRange(from, to);
  const active = activePreset(from, to);
  const isHourPreset = from.includes('T');
  const spanDays = from && to && !isHourPreset ? differenceInDays(new Date(to), new Date(from)) + 1 : null;

  const baseBtn = clsx(
    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-all duration-150 font-medium',
    open
      ? isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
      : isDark ? 'bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600 hover:bg-gray-750' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
  );

  const inputCls = clsx(
    'w-full rounded-lg px-2.5 py-1.5 text-xs border outline-none focus:ring-1 focus:ring-purple-500 transition-colors',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  const presetBtn = (isActive: boolean) => clsx(
    'w-full text-left px-3 py-2 text-xs rounded-lg transition-colors font-medium',
    isActive
      ? 'bg-purple-600 text-white'
      : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
  );

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className={baseBtn}>
        <CalendarDays className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
        <span className="whitespace-nowrap">{label}</span>
        {spanDays !== null && !active && (
          <span className={clsx('px-1.5 py-0.5 rounded-md text-[10px] font-semibold', isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')}>
            {spanDays}d
          </span>
        )}
        <ChevronDown className={clsx('w-3 h-3 transition-transform flex-shrink-0 text-gray-400', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={clsx(
          'absolute right-0 top-full mt-1.5 w-52 rounded-xl border shadow-2xl z-50 overflow-hidden',
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        )}>
          <div className="p-2 space-y-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { onFromChange(p.from()); onToChange(p.to()); setOpen(false); setCustomOpen(false); }}
                className={presetBtn(active === p.label)}
              >
                {p.label}
              </button>
            ))}

            <div className={clsx('h-px my-1', isDark ? 'bg-gray-800' : 'bg-gray-100')} />

            {/* Custom range — expandable */}
            <button
              onClick={() => setCustomOpen((v) => !v)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors font-medium',
                customOpen
                  ? isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'
                  : isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              )}
            >
              Custom range
              <ChevronRight className={clsx('w-3 h-3 transition-transform', customOpen && 'rotate-90')} />
            </button>

            {customOpen && (
              <div className="px-1 pb-1 space-y-2 pt-1">
                <div>
                  <label className={clsx('block text-[10px] mb-1 font-medium px-2', isDark ? 'text-gray-400' : 'text-gray-500')}>From</label>
                  <input
                    type="date"
                    value={from.includes('T') ? today : from}
                    max={to.includes('T') ? today : (to || today)}
                    onChange={(e) => onFromChange(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={clsx('block text-[10px] mb-1 font-medium px-2', isDark ? 'text-gray-400' : 'text-gray-500')}>To</label>
                  <input
                    type="date"
                    value={to.includes('T') ? today : to}
                    min={from.includes('T') ? undefined : (from || undefined)}
                    max={today}
                    onChange={(e) => { onToChange(e.target.value); }}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}