import { parseDocumentLines, type ExtractedPrisonerDocumentData } from '@/src/services/documentOCR';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// A4 retrato: largura/altura = 210/297
const A4_RATIO = 210 / 297;
const H_PADDING = 24;
const V_PADDING = 120;
const MAX_FRAME_WIDTH = SCREEN_WIDTH - H_PADDING * 2;
const MAX_FRAME_HEIGHT = SCREEN_HEIGHT - V_PADDING;
// Garantir que a moldura caiba na tela (limitar pela largura)
const FRAME_WIDTH = Math.min(MAX_FRAME_WIDTH, MAX_FRAME_HEIGHT * A4_RATIO);
const FRAME_HEIGHT = FRAME_WIDTH / A4_RATIO;
const FRAME_TOP = (SCREEN_HEIGHT - FRAME_HEIGHT) / 2 - 70;
const FRAME_LEFT = (SCREEN_WIDTH - FRAME_WIDTH) / 2;
const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';

export default function DocumentScanScreen() {
    const router = useRouter();
    const camera = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        (async () => {
            if (permission && !permission.granted && permission.canAskAgain) {
                const result = await requestPermission();
                if (!result.granted) {
                    Alert.alert('Permissão negada', 'O app precisa da câmera para escanear documento.');
                    router.back();
                }
            } else if (permission && !permission.granted) {
                Alert.alert('Permissão negada', 'O app precisa da câmera para escanear documento.');
                router.back();
            }
        })();
    }, [permission, requestPermission, router]);

    const handleScanDocument = async () => {
        if (!camera.current || isScanning) return;
        setIsScanning(true);
        try {
            const photo = await camera.current.takePictureAsync({
                base64: false,
                skipProcessing: true,
                quality: 0.8,
            });

            const uri = photo?.uri;
            if (!uri) {
                throw new Error('Falha ao capturar a imagem do documento.');
            }

            let extracted: ExtractedPrisonerDocumentData;
            try {
                const { getTextFromFrame } = require('expo-text-recognition');
                const lines = await getTextFromFrame(uri, false);
                extracted = parseDocumentLines(lines ?? []);
            } catch (ocrError) {
                const msg = ocrError instanceof Error ? ocrError.message : String(ocrError);
                if (msg.includes('ExpoTextRecognition') || msg.includes('native module')) {
                    Alert.alert(
                        'Recurso não disponível no Expo Go',
                        'A leitura de documento por OCR funciona apenas em build de desenvolvimento. Rode: npx expo run:ios ou npx expo run:android.'
                    );
                    return;
                }
                throw ocrError;
            }

            const hasAnyField = Boolean(
                extracted.name || extracted.motherName || extracted.dob || extracted.cpf
            );

            if (!hasAnyField) {
                Alert.alert(
                    'Dados não encontrados',
                    'Não foi possível identificar nome, nome da mãe, data de nascimento ou CPF no documento.'
                );
                return;
            }

            router.replace({
                pathname: '/register',
                params: {
                    prefillName: extracted.name ?? '',
                    prefillMotherName: extracted.motherName ?? '',
                    prefillDob: extracted.dob ?? '',
                    prefillCpf: extracted.cpf ?? '',
                    prefillSocialName: extracted.socialName ?? '',
                    prefillNationality: extracted.nationality ?? '',
                    prefillMaritalStatus: extracted.maritalStatus ?? '',
                    prefillProfession: extracted.profession ?? '',
                    prefillEducation: extracted.education ?? '',
                    prefillAge: extracted.age ?? '',
                    prefillBirthPlace: extracted.birthPlace ?? '',
                    prefillFiliation: extracted.filiation ?? '',
                    prefillAddress: extracted.address ?? '',
                    prefillPhone: extracted.phone ?? '',
                    prefillEmail: extracted.email ?? '',
                    prefillSource: 'document',
                },
            });
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao escanear documento. Tente novamente.');
        } finally {
            setIsScanning(false);
        }
    };

    if (!permission) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.centered}>
                <Text>Sem permissão para usar a câmera.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView ref={camera} style={styles.camera} facing="back" />

            {/* Áreas escuras ao redor da moldura */}
            <View style={[styles.overlayBar, { top: 0, left: 0, right: 0, height: FRAME_TOP }]} />
            <View style={[styles.overlayBar, { top: FRAME_TOP + FRAME_HEIGHT, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.overlayBar, { top: FRAME_TOP, left: 0, width: FRAME_LEFT, height: FRAME_HEIGHT }]} />
            <View style={[styles.overlayBar, { top: FRAME_TOP, right: 0, width: FRAME_LEFT, height: FRAME_HEIGHT }]} />

            {/* Moldura (borda branca bem visível) */}
            <View
                style={[
                    styles.frame,
                    {
                        top: FRAME_TOP,
                        left: FRAME_LEFT,
                        width: FRAME_WIDTH,
                        height: FRAME_HEIGHT,
                    },
                ]}
                pointerEvents="none"
            />

            <Text style={styles.overlayText}>
                Posicione o documento dentro da moldura e toque para escanear.
            </Text>

            <View style={styles.controls}>
                <TouchableOpacity style={styles.button} onPress={handleScanDocument}>
                    {isScanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Escanear Documento</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        ...StyleSheet.absoluteFillObject,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayBox: {
        position: 'absolute',
        top: 80,
        left: 24,
        right: 24,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 16,
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    overlayBar: {
        position: 'absolute',
        backgroundColor: OVERLAY_COLOR,
    },
    frame: {
        position: 'absolute',
        borderWidth: 4,
        borderColor: '#fff',
        borderRadius: 8,
        backgroundColor: 'transparent',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 8,
    },
    overlayText: {
        position: 'absolute',
        top: 12,
        left: 16,
        right: 16,
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: 14,
    },
    controls: {
        position: 'absolute',
        bottom: 56,
        left: 24,
        right: 24,
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
    },
});
