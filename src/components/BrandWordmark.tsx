import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
  iconColor?: string;
};

/** Wordmark Identifica com o "a" final substituído pelo ícone de biometria. */
export function BrandWordmark({
  size = 28,
  color = '#111827',
  iconColor = '#0D9488',
}: Props) {
  const iconSize = Math.round(size * 0.92);

  return (
    <View style={styles.row} accessibilityLabel="Identifica">
      <Text style={[styles.text, { fontSize: size, lineHeight: size * 1.2, color }]}>
        Identific
      </Text>
      <Ionicons
        name="finger-print"
        size={iconSize}
        color={iconColor}
        style={[styles.icon, { marginLeft: size * 0.04 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
  },
  icon: {
    marginTop: 1,
  },
});
