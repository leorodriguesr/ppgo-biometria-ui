import { usePendingBiometrics } from '@/src/context/PendingBiometricsContext';
import { generateEmbedding } from '@/src/services/api';
import { getPrisonerById, identifyByEmbeddingLocal } from '@/src/services/database';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BiometricOverlay } from '../../components/BiometricOverlay';
import { useFaceQuality } from './hooks/useFaceQuality';

const EMBEDDING_ERROR_MESSAGES: Record<string, string> = {
    NO_FACE_DETECTED: 'Nenhuma face detectada na imagem. Posicione o rosto no quadro e tire outra foto.',
    ENCODING_FAILED: 'Não foi possível processar a imagem. Tente novamente em melhor iluminação.',
    INVALID_IMAGE: 'Imagem inválida ou corrompida. Tire outra foto.',
    INVALID_FILE: 'Formato ou arquivo inválido. Use uma foto em JPG ou PNG.',
};

export default function CaptureScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const mode = (params.mode as 'register' | 'identify' | 'prefill') || 'identify';
    const [permission, requestPermission] = useCameraPermissions();
    const { status, validateFrame, simulateDetection } = useFaceQuality();
    const camera = useRef<CameraView>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const { setPending } = usePendingBiometrics();

    useEffect(() => {
        (async () => {
            if (permission && !permission.granted && permission.canAskAgain) {
                const result = await requestPermission();
                if (!result.granted) {
                    Alert.alert('Permissão negada', 'O app precisa da câmera para biometria.');
                    router.back();
                }
            } else if (permission && !permission.granted) {
                Alert.alert('Permissão negada', 'O app precisa da câmera para biometria.');
                router.back();
            }
        })();
    }, [permission]);

    // Simulate detection loop for demo
    useEffect(() => {
        simulateDetection();
    }, []);

    const takePhoto = async () => {
        // Allow photo even if not perfect green for easier testing, or check if camera exists
        if (camera.current) {
            setIsCapturing(true);
            try {
                const photo = await camera.current.takePictureAsync({
                    base64: false,
                    skipProcessing: true,
                    quality: 0.8, // Reduce quality for faster upload
                });

                if (mode === 'register') {
                    const uri = photo?.uri ?? '';
                    try {
                        const embedding = await generateEmbedding(uri);
                        setPending(uri, embedding);
                        router.replace({
                            pathname: '/register',
                            params: {
                                photo: uri,
                                prefillName: (params.prefillName as string) ?? '',
                                prefillMotherName: (params.prefillMotherName as string) ?? '',
                                prefillDob: (params.prefillDob as string) ?? '',
                                prefillCpf: (params.prefillCpf as string) ?? '',
                                prefillSocialName: (params.prefillSocialName as string) ?? '',
                                prefillNationality: (params.prefillNationality as string) ?? '',
                                prefillMaritalStatus: (params.prefillMaritalStatus as string) ?? '',
                                prefillProfession: (params.prefillProfession as string) ?? '',
                                prefillEducation: (params.prefillEducation as string) ?? '',
                                prefillAge: (params.prefillAge as string) ?? '',
                                prefillBirthPlace: (params.prefillBirthPlace as string) ?? '',
                                prefillFiliation: (params.prefillFiliation as string) ?? '',
                                prefillAddress: (params.prefillAddress as string) ?? '',
                                prefillPhone: (params.prefillPhone as string) ?? '',
                                prefillEmail: (params.prefillEmail as string) ?? '',
                            },
                        });
                    } catch (err) {
                        const message =
                            err instanceof Error && err.message in EMBEDDING_ERROR_MESSAGES
                                ? EMBEDDING_ERROR_MESSAGES[err.message]
                                : err instanceof Error
                                  ? err.message
                                  : 'Falha ao validar a foto. Tente outra.';
                        Alert.alert('Foto não validada', message, [{ text: 'OK' }]);
                    }
                    return;
                } else if (mode === 'prefill') {
                    try {
                        const embedding = await generateEmbedding(photo?.uri || '');
                        const result = await identifyByEmbeddingLocal(embedding);
                        const presoId = result.preso_id;

                        if (result.match && presoId) {
                            const prisoner = await getPrisonerById(presoId);
                            if (prisoner) {
                                router.replace({
                                    pathname: '/register',
                                    params: {
                                        prefillName: prisoner.name ?? '',
                                        prefillMotherName: prisoner.mother_name ?? '',
                                        prefillDob: prisoner.dob ?? '',
                                        prefillCpf: prisoner.cpf ?? '',
                                        prefillSocialName: prisoner.social_name ?? '',
                                        prefillNationality: prisoner.nationality ?? '',
                                        prefillMaritalStatus: prisoner.marital_status ?? '',
                                        prefillProfession: prisoner.profession ?? '',
                                        prefillEducation: prisoner.education ?? '',
                                        prefillAge: prisoner.age ?? '',
                                        prefillBirthPlace: prisoner.birth_place ?? '',
                                        prefillFiliation: prisoner.filiation ?? '',
                                        prefillAddress: prisoner.address ?? '',
                                        prefillPhone: prisoner.phone ?? '',
                                        prefillEmail: prisoner.email ?? '',
                                        prefillSource: 'face',
                                    },
                                });
                            } else {
                                Alert.alert('Atenção', `Face reconhecida (ID: ${presoId}), mas os dados não foram encontrados.`);
                            }
                        } else {
                            Alert.alert(
                                'Não identificado',
                                'Nenhuma correspondência facial encontrada para pré-preencher os dados.'
                            );
                        }
                    } catch (apiError) {
                        console.error(apiError);
                        Alert.alert('Erro', 'Falha ao pesquisar por biometria facial.');
                    }
                    return;
                } else {
                    try {
                        // 1. React → Python: gera embedding 512
                        const embedding = await generateEmbedding(photo?.uri || '');
                        console.log(embedding, 'embeddingg')
                        // 2. Comparação no banco local (depois trocar por React → Java)
                        const result = await identifyByEmbeddingLocal(embedding);
                        console.log(result, 'resulttttttttt')
                        const presoId = result.preso_id;
                        if (result.match && presoId) {
                            const prisoner = await getPrisonerById(presoId);

                            if (prisoner) {
                                router.replace({
                                    pathname: '/identify-result',
                                    params: {
                                        prisonerId: String(presoId),
                                        ...(result.distance != null && { distance: String(result.distance) }),
                                    },
                                });
                            } else {
                                Alert.alert('Atenção', `Face reconhecida (ID: ${presoId}), mas dados não encontrados no banco local.`);
                            }
                        } else {
                            const distMsg =
                                result.distance != null
                                    ? ` Melhor distância: ${result.distance.toFixed(2)} (abaixo do limite para dar match).`
                                    : ' Nenhum cadastro com biometria no banco.';
                            Alert.alert(
                                'Não Identificado',
                                `Nenhuma correspondência facial encontrada.${distMsg}`
                            );
                        }
                    } catch (apiError) {
                        console.error(apiError);
                        Alert.alert('Erro', 'Falha ao identificar. Verifique a conexão com o servidor de embedding (Python).');
                    }
                }
            } catch (e) {
                console.error(e);
                Alert.alert('Erro', 'Falha ao capturar foto.');
            } finally {
                setIsCapturing(false);
            }
        }
    };

    if (!permission) return <View style={styles.container}><ActivityIndicator /></View>;
    if (!permission.granted) return <View style={styles.container}><Text>No Camera Permission</Text></View>;

    return (
        <View style={styles.container}>
            <StatusBar hidden />
            <CameraView
                ref={camera}
                style={[StyleSheet.absoluteFill, { flex: 1 }]}
                facing="back"
                animateShutter={false}
            />

            <BiometricOverlay status={status.overallConfig} />

            <View style={styles.feedbackContainer}>
                <Text style={[styles.feedbackText, { color: status.overallConfig === 'green' ? '#00E676' : '#FFF' }]}>
                    {status.message.toUpperCase()}
                </Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.captureBtn, { borderColor: status.overallConfig === 'green' ? '#00E676' : '#fff' }]}
                    onPress={takePhoto}
                // disabled={status.overallConfig !== 'green'} // Removed to prevent "unclickable" feeling
                >
                    {isCapturing ? (
                        <ActivityIndicator color={status.overallConfig === 'green' ? '#00E676' : '#fff'} />
                    ) : (
                        <View style={[
                            styles.captureInner,
                            { backgroundColor: status.overallConfig === 'green' ? '#00E676' : '#fff' }
                        ]} />
                    )}
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
    feedbackContainer: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    feedbackText: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: '#fff',
        textAlign: 'center',
    },
    controls: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
});
