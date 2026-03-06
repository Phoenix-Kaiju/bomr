import { Platform, type ViewStyle } from 'react-native';

type ShadowOptions = {
  color: string;
  opacity: number;
  radius: number;
  offsetX?: number;
  offsetY: number;
};

function toRgba(color: string, opacity: number) {
  const normalized = color.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => value + value)
          .join('')
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return color;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function createShadowStyle({
  color,
  opacity,
  radius,
  offsetX = 0,
  offsetY,
}: ShadowOptions): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${radius * 2}px ${toRgba(color, opacity)}`,
    };
  }

  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: offsetX, height: offsetY },
  };
}
