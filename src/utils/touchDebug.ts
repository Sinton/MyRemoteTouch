/**
 * 触控调试工具
 * 用于排查点击无响应问题
 */

export class TouchDebugger {
  private static logs: string[] = [];
  private static maxLogs = 50;

  static log(message: string, data?: any) {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(logMessage, data || '');
    
    this.logs.push(logMessage + (data ? ` ${JSON.stringify(data)}` : ''));
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  static error(message: string, error?: any) {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    const logMessage = `[${timestamp}] [ERROR] ${message}`;
    
    console.error(logMessage, error || '');
    
    this.logs.push(logMessage + (error ? ` ${JSON.stringify(error)}` : ''));
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  static getLogs() {
    return [...this.logs];
  }

  static clear() {
    this.logs = [];
  }

  static downloadLogs() {
    const content = this.logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `touch-debug-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
