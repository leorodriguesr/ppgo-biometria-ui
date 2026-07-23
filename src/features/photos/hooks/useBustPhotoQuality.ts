import { useCallback, useState } from 'react';

export interface BustPhotoQualityStatus {
  isCentered: boolean;
  isBright: boolean;
  isStill: boolean;
  framingOk: boolean;
  overallConfig: 'red' | 'yellow' | 'green';
  message: string;
}

/** Status estável para o overlay — sem timer/mensagens de progresso. */
export function useBustPhotoQuality(_hint?: string) {
  const [status] = useState<BustPhotoQualityStatus>({
    isCentered: true,
    isBright: true,
    isStill: true,
    framingOk: true,
    overallConfig: 'green',
    message: '',
  });

  const simulateDetection = useCallback(() => {
    return () => undefined;
  }, []);

  return { status, simulateDetection };
}
