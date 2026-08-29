export type FaceGuide = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type FaceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FramingStatus = 'none' | 'multiple' | 'off' | 'too_far' | 'too_close' | 'ok';

/** Oval ~70% da largura da tela. */
export function getFaceGuide(width: number, height: number): FaceGuide {
  const rx = width * 0.35;
  const ry = Math.min(height * 0.32, rx * 1.35);
  return {
    cx: width / 2,
    cy: height * 0.4,
    rx,
    ry,
  };
}

export function evaluateFraming(
  facesCount: number,
  faceRect: FaceRect | undefined,
  guide: FaceGuide
): FramingStatus {
  if (facesCount <= 0 || !faceRect) return 'none';
  if (facesCount > 1) return 'multiple';

  const cx = faceRect.x + faceRect.width / 2;
  const cy = faceRect.y + faceRect.height / 2;
  const nx = (cx - guide.cx) / guide.rx;
  const ny = (cy - guide.cy) / guide.ry;
  if (nx * nx + ny * ny > 1) return 'off';

  const fillH = faceRect.height / (guide.ry * 2);
  if (fillH < 0.38) return 'too_far';
  if (fillH > 1.25) return 'too_close';
  return 'ok';
}

export function framingMessage(status: FramingStatus): string {
  switch (status) {
    case 'ok':
      return 'Mantenha o rosto na oval';
    case 'too_far':
      return 'Aproxime o rosto';
    case 'too_close':
      return 'Afaste um pouco o aparelho';
    case 'multiple':
      return 'Deixe apenas um rosto visível';
    case 'off':
      return 'Centralize o rosto na oval';
    default:
      return 'Enquadre o rosto na oval';
  }
}

export function overlayColor(status: FramingStatus): 'red' | 'yellow' | 'green' {
  if (status === 'ok') return 'green';
  if (status === 'none' || status === 'multiple') return 'red';
  return 'yellow';
}
