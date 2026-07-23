import { Ionicons } from '@expo/vector-icons';
import React, { PropsWithChildren } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  open: boolean;
  onToggle: () => void;
  requiredHint?: boolean;
}>;

export function FormSectionCard({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  requiredHint,
  children,
}: Props) {
  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.75}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color="#0D9488" />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {requiredHint ? <Text style={styles.requiredMark}>*</Text> : null}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardOpen: {
    borderColor: '#99F6E4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  requiredMark: {
    color: '#DC2626',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    gap: 2,
  },
});
