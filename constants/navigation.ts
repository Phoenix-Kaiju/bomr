export const TAB_ROUTE_ORDER = ['bom', 'build', 'calendar', 'progress', 'settings'] as const;
export type TabRoute = (typeof TAB_ROUTE_ORDER)[number];
export const INITIAL_TAB_ROUTE: TabRoute = 'calendar';
export type TabHref = `/${TabRoute}`;

export function getTabHref(route: TabRoute): TabHref {
  return `/${route}`;
}

export const INITIAL_TAB_HREF = getTabHref(INITIAL_TAB_ROUTE);
