import { vi, describe, it, expect, beforeEach } from 'vitest';
import { shutdownManager, ShutdownPriority } from '../../src/main/utils/shutdown-manager';

interface ShutdownManagerWithPrivates {
  hooks: { priority: ShutdownPriority; callback: () => void | Promise<void>; name?: string }[];
  isShuttingDown: boolean;
}

describe('ShutdownManager', () => {
  let managerPriv: ShutdownManagerWithPrivates;

  beforeEach(() => {
    managerPriv = shutdownManager as unknown as ShutdownManagerWithPrivates;
    // Reset hooks before each test (accessing private for test)
    managerPriv.hooks = [];
    managerPriv.isShuttingDown = false;
  });

  it('should register hooks with default priority', () => {
    const hook = vi.fn();
    shutdownManager.registerHook(hook);

    expect(managerPriv.hooks.length).toBe(1);
    expect(managerPriv.hooks[0].priority).toBe(ShutdownPriority.NORMAL);
  });

  it('should execute hooks in priority order (Ascending)', async () => {
    const executionOrder: string[] = [];

    shutdownManager.registerHook(
      () => {
        executionOrder.push('CRITICAL');
      },
      ShutdownPriority.CRITICAL,
      'Crit'
    );
    shutdownManager.registerHook(
      () => {
        executionOrder.push('NORMAL');
      },
      ShutdownPriority.NORMAL,
      'Norm'
    );
    shutdownManager.registerHook(
      () => {
        executionOrder.push('HIGH');
      },
      ShutdownPriority.HIGH,
      'High'
    );

    await shutdownManager.shutdown();

    expect(executionOrder).toEqual(['NORMAL', 'HIGH', 'CRITICAL']);
  });

  it('should execute hooks of same priority in FIFO order', async () => {
    const executionOrder: string[] = [];

    shutdownManager.registerHook(
      () => {
        executionOrder.push('FIRST');
      },
      ShutdownPriority.NORMAL,
      '1'
    );
    shutdownManager.registerHook(
      () => {
        executionOrder.push('SECOND');
      },
      ShutdownPriority.NORMAL,
      '2'
    );

    await shutdownManager.shutdown();

    expect(executionOrder).toEqual(['FIRST', 'SECOND']);
  });

  it('should handle failing hooks and continue', async () => {
    const nextHook = vi.fn();

    shutdownManager.registerHook(
      () => {
        throw new Error('Fail');
      },
      ShutdownPriority.NORMAL,
      'Failing'
    );
    shutdownManager.registerHook(nextHook, ShutdownPriority.HIGH, 'Next');

    await shutdownManager.shutdown();

    expect(nextHook).toHaveBeenCalled();
  });

  it('should prevent duplicate shutdown calls', async () => {
    const hook = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    shutdownManager.registerHook(hook);

    const first = shutdownManager.shutdown();
    const second = shutdownManager.shutdown();

    await Promise.all([first, second]);

    expect(hook).toHaveBeenCalledTimes(1);
  });
});
