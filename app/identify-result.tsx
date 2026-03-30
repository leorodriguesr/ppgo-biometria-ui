import { ThemedText } from '@/components/themed-text';
import { getPrisonerById, type PrisonerRow } from '@/src/services/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

function field(label: string, value: string | null | undefined): { label: string; value: string } {
    return { label, value: value?.trim() ? value : '—' };
}

export default function IdentifyResultScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ prisonerId: string; distance?: string }>();
    const [prisoner, setPrisoner] = useState<PrisonerRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const prisonerId = params.prisonerId;
    const distance = params.distance != null ? parseFloat(params.distance) : undefined;

    useEffect(() => {
        if (!prisonerId) {
            setError('ID do detento não informado.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const p = await getPrisonerById(prisonerId);
                setPrisoner(p ?? null);
                if (!p) setError('Detento não encontrado.');
            } catch (e) {
                setError('Erro ao carregar dados.');
            } finally {
                setLoading(false);
            }
        })();
    }, [prisonerId]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0D9488" />
                <ThemedText style={styles.loadingText}>Carregando dados...</ThemedText>
            </View>
        );
    }

    if (error || !prisoner) {
        return (
            <View style={styles.centered}>
                <ThemedText style={styles.errorText}>{error ?? 'Detento não encontrado.'}</ThemedText>
                <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
                    <ThemedText style={styles.primaryButtonText}>Voltar</ThemedText>
                </TouchableOpacity>
            </View>
        );
    }

    const rows = [
        field('Nome completo', prisoner.name),
        field('Nome da mãe', prisoner.mother_name),
        field('Data de nascimento', prisoner.dob),
        field('CPF', prisoner.cpf),
        field('Nome social', prisoner.social_name),
        field('Nacionalidade', prisoner.nationality),
        field('Estado civil', prisoner.marital_status),
        field('Profissão', prisoner.profession),
        field('Escolaridade', prisoner.education),
        field('Idade', prisoner.age),
        field('Naturalidade', prisoner.birth_place),
        field('Filiação', prisoner.filiation),
        field('Endereço', prisoner.address),
        field('Telefone', prisoner.phone),
        field('E-mail', prisoner.email),
    ];

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>PRESO IDENTIFICADO</ThemedText>
                {distance != null && (
                    <ThemedText style={styles.distanceText}>
                        Distância: {distance.toFixed(2)}
                    </ThemedText>
                )}
            </View> */}

            <View style={styles.card}>
                <View style={styles.cardPhotoSection}>
                    {prisoner.photo_uri ? (
                        <Image source={{ uri: prisoner.photo_uri }} style={styles.photo} />
                    ) : (
                        <View style={styles.photoPlaceholder}>
                            <ThemedText style={styles.photoPlaceholderText}>Sem foto</ThemedText>
                        </View>
                    )}
                </View>
                {rows.map(({ label, value }) => (
                    <View key={label} style={styles.row}>
                        <ThemedText type="defaultSemiBold" style={styles.label}>
                            {label}
                        </ThemedText>
                        <ThemedText style={styles.value} numberOfLines={3}>
                            {value}
                        </ThemedText>
                    </View>
                ))}
            </View>

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.back()}
                activeOpacity={0.8}
            >
                <ThemedText style={styles.primaryButtonText}>Voltar</ThemedText>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#F2F2F7',
        paddingBottom: 40,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    badge: {
        backgroundColor: '#0D9488',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    badgeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    distanceText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        marginTop: 4,
    },
    cardPhotoSection: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
        marginBottom: 4,
    },
    photo: {
        width: 160,
        height: 160,
        borderRadius: 80,
    },
    photoPlaceholder: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoPlaceholderText: {
        color: '#6b7280',
        fontSize: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    row: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
        paddingVertical: 12,
    },
    label: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 16,
        color: '#111827',
    },
    primaryButton: {
        backgroundColor: '#0D9488',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
});
