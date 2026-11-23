import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
