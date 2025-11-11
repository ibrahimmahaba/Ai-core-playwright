
let sessionExpiredCallback: (() => void) | null = null;

export function setSessionExpiredCallback(callback: () => void) {
  sessionExpiredCallback = callback;
}

export function checkSessionExpired(pixelReturn: any[]): boolean {
  if (!pixelReturn || !Array.isArray(pixelReturn)) {
    return false;
  }

  for (const result of pixelReturn) {
    if (result.operationType && result.operationType.indexOf('ERROR') > -1) {
      const output = result.output;
      const outputString = typeof output === 'string' ? output : JSON.stringify(output);
      
      if (outputString.toLowerCase().includes('expired')) {
        // Call the callback first to disable UI
        if (sessionExpiredCallback) {
          sessionExpiredCallback();
        }
        
        // Show alert
        alert('Your session has expired. Please refresh the app');
        return true;
      }
    }
  }
  
  return false;
}
