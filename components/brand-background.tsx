import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

type Palette = typeof Colors.light;

export function BrandBackground({ palette = Colors.light }: { palette?: Palette }) {

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blobTop, { backgroundColor: palette.surfaceAlt }]} />
      <View style={[styles.blob, styles.blobMid, { backgroundColor: palette.accent }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: palette.tint }]} />
      <View style={[styles.glow, { backgroundColor: palette.tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  blob: {
    position: 'absolute',
    opacity: 0.18,
    borderRadius: 999,
  },
  blobTop: {
    width: 260,
    height: 260,
    right: -90,
    top: -80,
  },
  blobMid: {
    width: 220,
    height: 220,
    left: -120,
    top: 220,
  },
  blobBottom: {
    width: 300,
    height: 300,
    right: -140,
    bottom: -160,
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    left: 40,
    bottom: 140,
    opacity: 0.08,
    borderRadius: 999,
  },
});
