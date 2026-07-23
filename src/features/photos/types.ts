export type BustPhotoKind = 'front' | 'right_profile' | 'left_profile';

export type MarkPhotoKind = 'mark' | 'tattoo';

export type BodySide = 'front' | 'back';

export type BodyRegionId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'abdomen'
  | 'left_arm'
  | 'right_arm'
  | 'left_hand'
  | 'right_hand'
  | 'left_leg'
  | 'right_leg'
  | 'back'
  | 'lower_back';

export const BODY_REGION_LABELS: Record<BodyRegionId, string> = {
  head: 'Cabeça',
  neck: 'Pescoço',
  chest: 'Tórax',
  abdomen: 'Abdômen',
  left_arm: 'Braço esquerdo',
  right_arm: 'Braço direito',
  left_hand: 'Mão esquerda',
  right_hand: 'Mão direita',
  left_leg: 'Perna esquerda',
  right_leg: 'Perna direita',
  back: 'Costas',
  lower_back: 'Lombar',
};

export const BUST_PHOTO_LABELS: Record<BustPhotoKind, string> = {
  front: 'Frente',
  right_profile: 'Perfil direito',
  left_profile: 'Perfil esquerdo',
};

export const BUST_PHOTO_HINTS: Record<BustPhotoKind, string> = {
  front: 'Enquadre cabeça e tórax de frente, com o banner ao fundo.',
  right_profile: 'Vire o perfil para a direita. Cabeça e tórax no quadro.',
  left_profile: 'Vire o perfil para a esquerda. Cabeça e tórax no quadro.',
};
