// ─── French Toes — Persistent Auth Logger ─────────────────────────────────────
// Logs are stored in sessionStorage so they survive page refreshes.
// Access logs via: JSON.parse(sessionStorage.getItem('auth_logs') || '[]')

const STORAGE_KEY = 'auth_logs';
const MAX_LOGS = 200; // Prevent storage overflow

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class AuthLogger {
  private logs: LogEntry[] = [];

  constructor() {
    // Load existing logs from sessionStorage
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[AuthLogger] Failed to load existing logs:', e);
    }
  }

  private add(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    this.logs.push(entry);

    // Trim old logs if exceeding max
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Persist to sessionStorage
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      // Storage full - clear oldest entries
      this.logs = this.logs.slice(-50);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
      } catch {
        // Give up silently
      }
    }

    // Also log to console for live debugging
    const prefix = `[Auth ${level.toUpperCase()}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        break;
      case 'debug':
        console.debug(prefix, message, data ?? '');
        break;
      default:
        console.log(prefix, message, data ?? '');
    }
  }

  info(message: string, data?: unknown) {
    this.add('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.add('warn', message, data);
  }

  error(message: string, data?: unknown) {
    this.add('error', message, data);
  }

  debug(message: string, data?: unknown) {
    this.add('debug', message, data);
  }

  // Get all logs (for debugging via console)
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clear() {
    this.logs = [];
    sessionStorage.removeItem(STORAGE_KEY);
    console.log('[AuthLogger] Logs cleared');
  }

  // Get logs as formatted string for easy copying
  getFormattedLogs(): string {
    return this.logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${l.data ? '\n  ' + JSON.stringify(l.data, null, 2) : ''}`)
      .join('\n\n');
  }
}

export const authLogger = new AuthLogger();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).authLogger = authLogger;
}