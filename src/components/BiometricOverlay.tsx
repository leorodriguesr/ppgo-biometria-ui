import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BiometricOverlayProps {
    status: 'red' | 'yellow' | 'green';
}

export const BiometricOverlay: React.FC<BiometricOverlayProps> = ({ status }) => {
    const pulse = useSharedValue(1);

    useEffect(() => {
        if (status === 'green') {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        } else {
            pulse.value = 1;
        }
    }, [status]);

    const animatedProps = useAnimatedProps(() => ({
        r: (width * 0.35) * pulse.value,
        stroke: status === 'green' ? '#00E676' : status === 'yellow' ? '#FFD600' : '#FF1744',
        strokeWidth: status === 'green' ? 6 : 4,
    }));

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg height="100%" width="100%">
                <Defs>
                    <Mask id="mask" x="0" y="0" height="100%" width="100%">
                        <Rect height="100%" width="100%" fill="#fff" />
                        <AnimatedCircle cx={width / 2} cy={height * 0.4} animatedProps={animatedProps} fill="#000" />
                    </Mask>
                </Defs>
                <Rect height="100%" width="100%" fill="rgba(0,0,0,0.6)" mask="url(#mask)" />

                {/* Draw the ring again on top so it's visible */}
                <AnimatedCircle
                    cx={width / 2}
                    cy={height * 0.4}
                    fill="transparent"
                    animatedProps={animatedProps}
                />
            </Svg>
        </View>
    );
};
