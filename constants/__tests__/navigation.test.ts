import { describe, expect, test } from 'vitest';

import { INITIAL_TAB_ROUTE, TAB_ROUTE_ORDER } from '@/constants/navigation';

describe('navigation config', () => {
  test('keeps Calendar as the default tab route', () => {
    expect(INITIAL_TAB_ROUTE).toBe('calendar');
  });

  test('keeps Settings visible in the tab order', () => {
    expect(TAB_ROUTE_ORDER).toContain('settings');
    expect(TAB_ROUTE_ORDER[TAB_ROUTE_ORDER.length - 1]).toBe('settings');
  });
});
