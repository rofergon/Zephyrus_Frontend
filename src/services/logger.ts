export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private isProduction: boolean;

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private createLogEntry(level: LogLevel, context: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data
    };
  }

  private log(entry: LogEntry): void {
    this.logs.push(entry);
    
    if (!this.isProduction) {
      const logMethod = entry.level === 'error' ? console.error :
                       entry.level === 'warn' ? console.warn :
                       entry.level === 'info' ? console.info :
                       console.debug;

      logMethod(`[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`, 
                entry.data ? entry.data : '');
    }
  }

  public debug(context: string, message: string, data?: any): void {
    if (!this.isProduction) {
      this.log(this.createLogEntry('debug', context, message, data));
    }
  }

  public info(context: string, message: string, data?: any): void {
    this.log(this.createLogEntry('info', context, message, data));
  }

  public warn(context: string, message: string, data?: any): void {
    this.log(this.createLogEntry('warn', context, message, data));
  }

  public error(context: string, message: string, data?: any): void {
    this.log(this.createLogEntry('error', context, message, data));
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public getLogsByContext(context: string): LogEntry[] {
    return this.logs.filter(log => log.context === context);
  }

  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
}

export const logger = Logger.getInstance(); 