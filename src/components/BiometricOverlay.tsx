import { getFaceGuide, type FaceGuide } from '@/src/features/biometrics/faceGuide';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface BiometricOverlayProps {
  status: 'red' | 'yellow' | 'green';
  instruction?: string;
  guide?: FaceGuide;
}

export const BiometricOverlay: React.FC<BiometricOverlayProps> = ({
  status,
  instruction,
  guide,
}) => {
  const { width, height } = useWindowDimensions();
  const resolved = useMemo(() => guide ?? getFaceGuide(width, height), [guide, height, width]);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (status === 'green') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [pulse, status]);

  const animatedProps = useAnimatedProps(() => ({
    rx: resolved.rx * pulse.value,
    ry: resolved.ry * pulse.value,
    stroke: status === 'green' ? '#00E676' : status === 'yellow' ? '#FFD600' : '#FF1744',
    strokeWidth: status === 'green' ? 6 : 4,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg height="100%" width="100%">
        <Defs>
          <Mask id="mask" x="0" y="0" height="100%" width="100%">
            <Rect height="100%" width="100%" fill="#fff" />
            <AnimatedEllipse cx={resolved.cx} cy={resolved.cy} animatedProps={animatedProps} fill="#000" />
          </Mask>
        </Defs>
        <Rect height="100%" width="100%" fill="rgba(0,0,0,0.6)" mask="url(#mask)" />
        <AnimatedEllipse
          cx={resolved.cx}
          cy={resolved.cy}
          fill="transparent"
          animatedProps={animatedProps}
        />
      </Svg>

      {instruction ? (
        <View style={styles.instructionWrap}>
          <Text style={[styles.instruction, { color: status === 'green' ? '#00E676' : '#FFF' }]}>
            {instruction.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  instructionWrap: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '88%',
  },
  instruction: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
