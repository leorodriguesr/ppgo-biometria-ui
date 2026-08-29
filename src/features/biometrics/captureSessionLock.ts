let active = false;

export function tryAcquireCaptureSession(): boolean {
  if (active) return false;
  active = true;
  return true;
}

export function releaseCaptureSession(): void {
  active = false;
}
