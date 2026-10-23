import { ThemedText } from '@/components/themed-text';
import {
  BODY_REGION_LABELS,
  BUST_PHOTO_LABELS,
  type BodyRegionId,
  type BustPhotoKind,
} from '@/src/features/photos/types';
import type { PrisonerPhotoRow, PrisonerRow } from '@/src/services/database';
import { resolveLocalPhotoUri, toDisplayImageUri } from '@/src/services/localImageStorage';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

function Photo({
  uri,
  prisonerId,
  hint,
  style,
}: {
  uri: string | null | undefined;
  prisonerId?: number;
  hint?: string;
  style: StyleProp<ImageStyle>;
}) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setResolved(null);
    void resolveLocalPhotoUri(uri, prisonerId, hint).then((value) => {
      if (live) setResolved(value);
    });
    return () => {
      live = false;
    };
  }, [hint, prisonerId, uri]);

  if (!resolved) return <View style={style} />;
  return <ExpoImage source={{ uri: resolved }} style={style} contentFit="cover" />;
}

function field(label: string, value: string | null | undefined) {
  return { label, value: value?.trim() ? value : '—' };
}

const BUST_ORDER: BustPhotoKind[] = ['front', 'right_profile', 'left_profile'];

type Props = {
  prisoner: PrisonerRow;
  photos: PrisonerPhotoRow[];
  /** Ex.: resultado de identificação facial */
  badgeTitle?: string;
  badgeSubtitle?: string;
  /** `api`: busca GoiasPen. Sem card de biometria; foto de frente + dados + galeria. */
  variant?: 'local' | 'api';
  galleryUris?: string[];
};

function localDataRows(prisoner: PrisonerRow) {
  return [
    field('Nome completo', prisoner.name),
    field('Nome social', prisoner.social_name),
    field('Nome da mãe', prisoner.mother_name),
    field('Filiação (pai)', prisoner.filiation),
    field('Data de nascimento', prisoner.dob),
    field('CPF', prisoner.cpf),
    field('Nacionalidade', prisoner.nationality),
    field('Estado civil', prisoner.marital_status),
    field('Profissão', prisoner.profession),
    field('Escolaridade', prisoner.education),
    field('Idade', prisoner.age),
    field('Naturalidade', prisoner.birth_place),
    field('Endereço', prisoner.address),
    field('Telefone', prisoner.phone),
    field('E-mail', prisoner.email),
  ];
}

function apiDataRows(prisoner: PrisonerRow) {
  return [
    field('Nome completo', prisoner.name),
    field('Nome social', prisoner.social_name),
    field('Nome da mãe', prisoner.mother_name),
    field('Filiação (pai)', prisoner.filiation),
    field('Data de nascimento', prisoner.dob),
    field('CPF', prisoner.cpf),
    field('Sexo', prisoner.sexo),
    field('RG', prisoner.rg),
    field('Órgão emissor', prisoner.orgao_emissor),
    field('Nacionalidade', prisoner.nationality),
    field('Estado civil', prisoner.marital_status),
    field('Profissão', prisoner.profession),
    field('Escolaridade', prisoner.education),
    field('Naturalidade', prisoner.birth_place),
    field('Endereço', prisoner.address),
    field('Telefone', prisoner.phone),
    field('E-mail', prisoner.email),
  ];
}

export function PrisonerDetailView({
  prisoner,
  photos,
  badgeTitle,
  badgeSubtitle,
  variant = 'local',
  galleryUris = [],
}: Props) {
  const dataRows = variant === 'api' ? apiDataRows(prisoner) : localDataRows(prisoner);

  const bioUri = toDisplayImageUri(prisoner.photo_uri);

  const bustPhotos = BUST_ORDER.map((kind) => ({
    kind,
    photo: photos.find((p) => p.photo_type === kind) ?? null,
  }));

  const markPhotos = photos.filter((p) => p.photo_type === 'mark' || p.photo_type === 'tattoo');
  const prisonerId = Number(prisoner.id);

  return (
    <View style={styles.wrap}>
      {badgeTitle ? (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{badgeTitle}</ThemedText>
          {badgeSubtitle ? (
            <ThemedText style={styles.badgeSubtitle}>{badgeSubtitle}</ThemedText>
          ) : null}
        </View>
      ) : null}

      {variant === 'api' ? (
        <View style={styles.card}>
          {toDisplayImageUri(prisoner.photo_uri) ? (
            <Photo uri={prisoner.photo_uri} prisonerId={prisonerId} hint="front" style={styles.heroPhoto} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <ThemedText style={styles.placeholderText}>Sem foto</ThemedText>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Biometria facial
          </ThemedText>
          <View style={styles.bioPhotoSection}>
            {bioUri ? (
              <Photo uri={bioUri} prisonerId={prisonerId} hint="biometria" style={styles.bioPhoto} />
            ) : (
              <View style={styles.bioPlaceholder}>
                <ThemedText style={styles.placeholderText}>Sem foto biométrica</ThemedText>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          Dados cadastrais
        </ThemedText>
        {dataRows.map(({ label, value }) => (
          <View key={label} style={styles.row}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              {label}
            </ThemedText>
            <ThemedText style={styles.value} numberOfLines={4}>
              {value}
            </ThemedText>
          </View>
        ))}
      </View>

      {variant === 'api' ? (
        galleryUris.length > 0 ? (
          <View style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Outras fotos
            </ThemedText>
            {galleryUris.map((uri) => (
              <Photo key={uri} uri={uri} prisonerId={prisonerId} style={styles.galleryPhoto} />
            ))}
          </View>
        ) : null
      ) : (
        <>
          <View style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Fotos do detento
            </ThemedText>
            {bustPhotos.map(({ kind, photo }) => (
              <View key={kind} style={styles.photoBlock}>
                <ThemedText style={styles.photoLabel}>{BUST_PHOTO_LABELS[kind]}</ThemedText>
                {photo ? (
                  <Photo
                    uri={photo.photo_uri}
                    prisonerId={prisonerId}
                    hint={kind}
                    style={styles.detaineePhoto}
                  />
                ) : (
                  <View style={styles.detaineePlaceholder}>
                    <ThemedText style={styles.placeholderText}>Não capturada</ThemedText>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Marcas e tatuagens
            </ThemedText>
            {markPhotos.length === 0 ? (
              <ThemedText style={styles.emptyMarks}>Nenhuma marca/tatuagem cadastrada.</ThemedText>
            ) : (
              markPhotos.map((photo) => (
                <View key={photo.id} style={styles.markBlock}>
                  <Photo
                    uri={photo.photo_uri}
                    prisonerId={prisonerId}
                    hint="sinal"
                    style={styles.markPhoto}
                  />
                  <View style={styles.markInfo}>
                    <ThemedText type="defaultSemiBold">
                      {photo.photo_type === 'tattoo' ? 'Tatuagem' : 'Marca'}
                    </ThemedText>
                    <ThemedText style={styles.markMeta}>
                      {photo.body_side === 'back' ? 'Costas' : 'Frente'}
                      {photo.body_region
                        ? ` · ${BODY_REGION_LABELS[photo.body_region as BodyRegionId] ?? photo.body_region}`
                        : ''}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  badge: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  badgeSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#0F766E',
    marginBottom: 12,
  },
  heroPhoto: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  heroPlaceholder: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioPhotoSection: {
    alignItems: 'center',
    gap: 10,
  },
  bioPhoto: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#E5E7EB',
  },
  bioPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 10,
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 16,
    color: '#111827',
  },
  photoBlock: {
    marginBottom: 14,
    gap: 8,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  detaineePhoto: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  galleryPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#111827',
    marginBottom: 12,
  },
  detaineePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  emptyMarks: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  markBlock: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  markPhoto: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  markInfo: {
    flex: 1,
    gap: 2,
  },
  markMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
});
