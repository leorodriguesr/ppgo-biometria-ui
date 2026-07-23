import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const FRAME_W = width * 0.72;
const FRAME_H = height * 0.52;
const FRAME_X = (width - FRAME_W) / 2;
const FRAME_Y = height * 0.14;

interface BustPhotoOverlayProps {
  status: 'red' | 'yellow' | 'green';
  /** Linha guia cabeça/tronco — desligar em marcas/tatuagens. */
  showMidGuide?: boolean;
}

/** Moldura de busto (cabeça + tórax) — maior que o círculo da biometria. */
export const BustPhotoOverlay: React.FC<BustPhotoOverlayProps> = ({
  status,
  showMidGuide = true,
}) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (status === 'green') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.015, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [status, pulse]);

  const color = status === 'green' ? '#00E676' : status === 'yellow' ? '#FFD600' : '#FF1744';

  const animatedProps = useAnimatedProps(() => {
    const scale = pulse.value;
    const w = FRAME_W * scale;
    const h = FRAME_H * scale;
    return {
      x: FRAME_X - (w - FRAME_W) / 2,
      y: FRAME_Y - (h - FRAME_H) / 2,
      width: w,
      height: h,
      stroke: color,
      strokeWidth: status === 'green' ? 5 : 3,
      rx: 18,
      ry: 18,
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg height="100%" width="100%">
        <Defs>
          <Mask id="bustMask" x="0" y="0" height="100%" width="100%">
            <Rect height="100%" width="100%" fill="#fff" />
            <Rect
              x={FRAME_X}
              y={FRAME_Y}
              width={FRAME_W}
              height={FRAME_H}
              rx={18}
              ry={18}
              fill="#000"
            />
          </Mask>
        </Defs>
        <Rect height="100%" width="100%" fill="rgba(0,0,0,0.55)" mask="url(#bustMask)" />
        <AnimatedRect fill="transparent" animatedProps={animatedProps} />
        {showMidGuide ? (
          <Rect
            x={FRAME_X + FRAME_W * 0.12}
            y={FRAME_Y + FRAME_H * 0.5}
            width={FRAME_W * 0.76}
            height={1.5}
            fill={color}
            opacity={0.45}
          />
        ) : null}
      </Svg>
    </View>
  );
};
