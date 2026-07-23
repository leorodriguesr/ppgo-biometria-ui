import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function ToggleField({ label, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
});
