import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNative: vi.fn(() => false),
  addListener: vi.fn(),
  exitApp: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNative } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener, exitApp: mocks.exitApp } }));

import { renderHook } from '@testing-library/react';
import { useAndroidBackButton } from '@/platform/backButton';
import { isMobile, isNative } from '@/platform/native';
import { registerServiceWorker } from '@/platform/sw';

describe('platform misc', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isNative.mockReturnValue(false);
  });

  it('isNative / isMobile', () => {
    expect(isNative()).toBe(false);
    mocks.isNative.mockReturnValue(true);
    expect(isNative()).toBe(true);
    expect(isMobile()).toBe(false);
  });

  it('back button no-op on web', () => {
    renderHook(() => {
      useAndroidBackButton(vi.fn());
    });
    expect(mocks.addListener).not.toHaveBeenCalled();
  });

  it('back button navigates or exits, and cleans up', async () => {
    mocks.isNative.mockReturnValue(true);
    const remove = vi.fn().mockResolvedValue(undefined);
    let handler: () => void = () => undefined;
    mocks.addListener.mockImplementation((_e: string, h: () => void) => {
      handler = h;
      return Promise.resolve({ remove });
    });
    const navigate = vi.fn();
    const { unmount } = renderHook(() => {
      useAndroidBackButton(navigate);
    });
    await Promise.resolve();
    window.history.pushState({}, '', '/a');
    handler();
    expect(navigate).toHaveBeenCalledWith(-1);
    window.history.pushState({}, '', '/');
    handler();
    expect(mocks.exitApp).toHaveBeenCalled();
    unmount();
    await Promise.resolve();
    await Promise.resolve();
    expect(remove).toHaveBeenCalled();
  });

  it('sw unregisters on native', async () => {
    mocks.isNative.mockReturnValue(true);
    const unregister = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]), register: vi.fn() },
      configurable: true,
    });
    registerServiceWorker();
    await Promise.resolve();
    await Promise.resolve();
    expect(unregister).toHaveBeenCalled();
  });

  it('sw does not register outside production', () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn(), register },
      configurable: true,
    });
    registerServiceWorker();
    window.dispatchEvent(new Event('load'));
    expect(register).not.toHaveBeenCalled();
  });
});
