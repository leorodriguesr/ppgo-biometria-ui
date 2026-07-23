import type { BodyRegionId, BodySide } from '@/src/features/photos/types';
import { BODY_REGION_LABELS } from '@/src/features/photos/types';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';

type Props = {
  side: BodySide;
  selected?: BodyRegionId | null;
  onSelect: (region: BodyRegionId) => void;
};

type Hotspot = {
  id: BodyRegionId;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: 'ellipse' | 'rect' | 'circle';
};

const FRONT_HOTSPOTS: Hotspot[] = [
  { id: 'head', x: 70, y: 8, w: 40, h: 42, shape: 'ellipse' },
  { id: 'neck', x: 78, y: 48, w: 24, h: 16, shape: 'rect' },
  { id: 'chest', x: 55, y: 64, w: 70, h: 55, shape: 'rect' },
  { id: 'abdomen', x: 60, y: 118, w: 60, h: 40, shape: 'rect' },
  { id: 'left_arm', x: 18, y: 68, w: 34, h: 70, shape: 'rect' },
  { id: 'right_arm', x: 128, y: 68, w: 34, h: 70, shape: 'rect' },
  { id: 'left_hand', x: 14, y: 138, w: 28, h: 22, shape: 'ellipse' },
  { id: 'right_hand', x: 138, y: 138, w: 28, h: 22, shape: 'ellipse' },
  { id: 'left_leg', x: 58, y: 158, w: 32, h: 85, shape: 'rect' },
  { id: 'right_leg', x: 90, y: 158, w: 32, h: 85, shape: 'rect' },
];

const BACK_HOTSPOTS: Hotspot[] = [
  { id: 'head', x: 70, y: 8, w: 40, h: 42, shape: 'ellipse' },
  { id: 'neck', x: 78, y: 48, w: 24, h: 16, shape: 'rect' },
  { id: 'back', x: 55, y: 64, w: 70, h: 55, shape: 'rect' },
  { id: 'lower_back', x: 60, y: 118, w: 60, h: 40, shape: 'rect' },
  { id: 'left_arm', x: 18, y: 68, w: 34, h: 70, shape: 'rect' },
  { id: 'right_arm', x: 128, y: 68, w: 34, h: 70, shape: 'rect' },
  { id: 'left_hand', x: 14, y: 138, w: 28, h: 22, shape: 'ellipse' },
  { id: 'right_hand', x: 138, y: 138, w: 28, h: 22, shape: 'ellipse' },
  { id: 'left_leg', x: 58, y: 158, w: 32, h: 85, shape: 'rect' },
  { id: 'right_leg', x: 90, y: 158, w: 32, h: 85, shape: 'rect' },
];

function HotspotShape({
  hotspot,
  selected,
  onSelect,
}: {
  hotspot: Hotspot;
  selected: boolean;
  onSelect: () => void;
}) {
  const fill = selected ? 'rgba(13,148,136,0.55)' : 'rgba(255,255,255,0.12)';
  const stroke = selected ? '#0D9488' : 'rgba(255,255,255,0.35)';

  if (hotspot.shape === 'ellipse' || hotspot.shape === 'circle') {
    return (
      <Ellipse
        cx={hotspot.x + hotspot.w / 2}
        cy={hotspot.y + hotspot.h / 2}
        rx={hotspot.w / 2}
        ry={hotspot.h / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        onPress={onSelect}
      />
    );
  }

  return (
    <Rect
      x={hotspot.x}
      y={hotspot.y}
      width={hotspot.w}
      height={hotspot.h}
      rx={8}
      ry={8}
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
      onPress={onSelect}
    />
  );
}

export function BodyMannequin({ side, selected, onSelect }: Props) {
  const hotspots = side === 'front' ? FRONT_HOTSPOTS : BACK_HOTSPOTS;

  return (
    <View style={styles.wrap}>
      <Svg width={180} height={260} viewBox="0 0 180 260">
        {/* Silhouette base */}
        <Ellipse cx={90} cy={30} rx={22} ry={24} fill="#CBD5E1" />
        <Rect x={82} y={52} width={16} height={14} rx={4} fill="#CBD5E1" />
        <Rect x={58} y={64} width={64} height={90} rx={16} fill="#94A3B8" />
        <Rect x={22} y={68} width={28} height={72} rx={12} fill="#94A3B8" />
        <Rect x={130} y={68} width={28} height={72} rx={12} fill="#94A3B8" />
        <Circle cx={28} cy={148} r={12} fill="#CBD5E1" />
        <Circle cx={152} cy={148} r={12} fill="#CBD5E1" />
        <Rect x={62} y={152} width={24} height={88} rx={10} fill="#94A3B8" />
        <Rect x={94} y={152} width={24} height={88} rx={10} fill="#94A3B8" />

        {hotspots.map((h) => (
          <HotspotShape
            key={h.id}
            hotspot={h}
            selected={selected === h.id}
            onSelect={() => onSelect(h.id)}
          />
        ))}
      </Svg>

      {selected ? (
        <Text style={styles.selectedLabel}>{BODY_REGION_LABELS[selected]}</Text>
      ) : (
        <Text style={styles.hint}>Toque na região da marca/tatuagem</Text>
      )}

      <View style={styles.legend}>
        {hotspots.map((h) => (
          <Pressable
            key={`chip-${h.id}`}
            style={[styles.chip, selected === h.id && styles.chipActive]}
            onPress={() => onSelect(h.id)}
          >
            <Text style={[styles.chipText, selected === h.id && styles.chipTextActive]}>
              {BODY_REGION_LABELS[h.id]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D9488',
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  chipText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0F766E',
  },
});
