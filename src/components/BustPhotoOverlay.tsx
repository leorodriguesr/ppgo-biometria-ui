import type { BustPhotoKind } from '@/src/features/photos/types';
import React, { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
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

const FRAME_W = width * 0.78;
const FRAME_H = height * 0.58;
const FRAME_X = (width - FRAME_W) / 2;
const FRAME_Y = height * 0.12;

const GUIDE_IMAGES: Record<BustPhotoKind, number> = {
  front: require('@/assets/images/guides/front-overlay.png'),
  left_profile: require('@/assets/images/guides/right_profile-overlay.png'),
  right_profile: require('@/assets/images/guides/left_profile-overlay.png'),
};

interface BustPhotoOverlayProps {
  status: 'red' | 'yellow' | 'green';
  kind?: BustPhotoKind | string;
  showMidGuide?: boolean;
}

function asBustKind(kind?: string): BustPhotoKind {
  if (kind === 'left_profile' || kind === 'right_profile' || kind === 'front') return kind;
  return 'front';
}

/** Moldura de busto com silhueta da pose (frente / perfil). */
export const BustPhotoOverlay: React.FC<BustPhotoOverlayProps> = ({
  status,
  kind = 'front',
  showMidGuide = true,
}) => {
  const pulse = useSharedValue(1);
  const pose = asBustKind(kind);

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
  }, [pulse, status]);

  const color = status === 'green' ? '#00E676' : status === 'yellow' ? '#FFD600' : '#FFFFFF';
  const isProfile = pose === 'left_profile' || pose === 'right_profile';

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
      </Svg>
      {showMidGuide ? (
        <View style={[styles.guideSlot, isProfile && styles.profileGuideSlot]}>
          <Image
            source={GUIDE_IMAGES[pose]}
            style={[styles.guideImage, { tintColor: color }, isProfile && styles.profileGuideImage]}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  guideSlot: {
    position: 'absolute',
    left: FRAME_X,
    top: FRAME_Y,
    width: FRAME_W,
    height: FRAME_H,
    paddingHorizontal: FRAME_W * 0.06,
    paddingVertical: FRAME_H * 0.04,
    overflow: 'hidden',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideImage: {
    width: '100%',
    height: '100%',
    opacity: 0.92,
  },
  profileGuideSlot: {
    justifyContent: 'center',
    paddingTop: FRAME_H * 0.08,
    paddingBottom: FRAME_H * 0.1,
  },
  profileGuideImage: {
    width: '92%',
    height: '92%',
    transform: [{ translateY: FRAME_H * 0.02 }],
  },
});
