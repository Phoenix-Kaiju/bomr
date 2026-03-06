export const TAB_ROUTE_ORDER = ['bom', 'build', 'calendar', 'progress', 'settings'] as const;
export type TabRoute = (typeof TAB_ROUTE_ORDER)[number];
export const INITIAL_TAB_ROUTE: TabRoute = 'calendar';
