import { Platform } from 'react-native';
import type { ThemePreset } from '@/data/app-settings';

const brandInk = '#E6E8EC';
const brandSand = '#0B0D10';
const brandClay = '#2FE6C8';
const brandMoss = '#29B38F';
const brandSteel = '#90A0B5';
const brandMist = '#171B22';

export const Colors = {
  light: {
    text: brandInk,
    background: brandSand,
    tint: brandClay,
    accent: brandMoss,
    muted: '#8D97A8',
    surface: '#131820',
    surfaceAlt: brandMist,
    border: '#1F2530',
    icon: brandSteel,
    tabIconDefault: '#657184',
    tabIconSelected: brandClay,
  },
  dark: {
    text: brandInk,
    background: brandSand,
    tint: brandClay,
    accent: brandMoss,
    muted: '#6E6A63',
    surface: '#FFFBF5',
    surfaceAlt: brandMist,
    border: '#DED5C6',
    icon: brandSteel,
    tabIconDefault: '#8C867C',
    tabIconSelected: brandClay,
  },
};

const THEME_OVERRIDES: Record<ThemePreset, Partial<typeof Colors.light>> = {
  NEON: {},
  SLATE: {
    background: '#10141B',
    surface: '#161C26',
    surfaceAlt: '#1B2431',
    border: '#263142',
    tint: '#A8B5C7',
    accent: '#8EA0B8',
    muted: '#97A3B2',
  },
  FOREST: {
    background: '#0D1310',
    surface: '#151E18',
    surfaceAlt: '#1B271F',
    border: '#233429',
    tint: '#58C58D',
    accent: '#3FB476',
    muted: '#8EA69A',
  },
  AMBER: {
    background: '#14100B',
    surface: '#1C1510',
    surfaceAlt: '#251C14',
    border: '#30231A',
    tint: '#F0A13A',
    accent: '#E48A20',
    muted: '#B99A73',
  },
  MONO: {
    background: '#0E1012',
    surface: '#171A1E',
    surfaceAlt: '#1C2026',
    border: '#252A33',
    tint: '#D0D4DA',
    accent: '#B8C0CA',
    muted: '#9DA5B0',
  },
};

export const getThemePalette = (preset: ThemePreset) => ({
  ...Colors.light,
  ...THEME_OVERRIDES[preset],
});

export const Fonts = Platform.select({
  ios: {
    display: 'Avenir Next',
    body: 'Avenir Next',
    mono: 'Menlo',
  },
  android: {
    display: 'serif',
    body: 'serif',
    mono: 'monospace',
  },
  default: {
    display: 'serif',
    body: 'serif',
    mono: 'monospace',
  },
  web: {
    display: "'Avenir Next', 'Avenir', 'Helvetica Neue', Helvetica, Arial, serif",
    body: "'Avenir Next', 'Avenir', 'Helvetica Neue', Helvetica, Arial, serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
