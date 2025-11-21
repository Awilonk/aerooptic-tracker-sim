// Simple file logger for debugging
class FileLogger {
  private logs: string[] = [];
  
  log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    this.logs.push(logEntry);
    console.log(message, data);
  }
  
  error(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR: ${message}${error ? '\n' + JSON.stringify(error, null, 2) : ''}`;
    this.logs.push(logEntry);
    console.error(message, error);
  }
  
  downloadLogs() {
    const blob = new Blob([this.logs.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  getLogs() {
    return this.logs.join('\n\n');
  }
}

export const logger = new FileLogger();

// Add global function to download logs
if (typeof window !== 'undefined') {
  (window as any).downloadLogs = () => logger.downloadLogs();
  (window as any).getLogs = () => logger.getLogs();
}
