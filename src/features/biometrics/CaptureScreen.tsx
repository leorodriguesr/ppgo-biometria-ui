import FramedBiometricCapture, {
  type BiometricCaptureMode,
} from '@/src/features/biometrics/FramedBiometricCapture';
import { useLocalSearchParams } from 'expo-router';

function asCaptureMode(value: string | string[] | undefined): BiometricCaptureMode {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'register' || raw === 'prefill' || raw === 'identify') return raw;
  return 'identify';
}

export default function CaptureScreen() {
  const params = useLocalSearchParams();
  return <FramedBiometricCapture mode={asCaptureMode(params.mode)} />;
}
