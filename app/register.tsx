import { ThemedText } from '@/components/themed-text';
import { usePendingBiometrics } from '@/src/context/PendingBiometricsContext';
import { addPrisoner } from '@/src/services/database';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Dimensions, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type RegisterStep = 'dados' | 'biometria';

function paramToString(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
}

const INPUT_PLACEHOLDER_COLOR = '#dddddd';

export default function RegisterScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { pending, clearPending } = usePendingBiometrics();
    const [name, setName] = useState('');
    const [motherName, setMotherName] = useState('');
    const [dob, setDob] = useState('');
    const [cpf, setCpf] = useState('');
    const [socialName, setSocialName] = useState('');
    const [nationality, setNationality] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('');
    const [profession, setProfession] = useState('');
    const [education, setEducation] = useState('');
    const [age, setAge] = useState('');
    const [birthPlace, setBirthPlace] = useState('');
    const [filiation, setFiliation] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [step, setStep] = useState<RegisterStep>('dados');

    useEffect(() => {
        if (params.photo) {
            setPhotoUri(params.photo as string);
            setStep('biometria');
        }
    }, [params.photo]);

    useEffect(() => {
        const prefillName = paramToString(params.prefillName as string | string[] | undefined);
        const prefillMotherName = paramToString(params.prefillMotherName as string | string[] | undefined);
        const prefillDob = paramToString(params.prefillDob as string | string[] | undefined);
        const prefillCpf = paramToString(params.prefillCpf as string | string[] | undefined);
        const prefillSource = paramToString(params.prefillSource as string | string[] | undefined);
        const prefillSocialName = paramToString(params.prefillSocialName as string | string[] | undefined);
        const prefillNationality = paramToString(params.prefillNationality as string | string[] | undefined);
        const prefillMaritalStatus = paramToString(params.prefillMaritalStatus as string | string[] | undefined);
        const prefillProfession = paramToString(params.prefillProfession as string | string[] | undefined);
        const prefillEducation = paramToString(params.prefillEducation as string | string[] | undefined);
        const prefillAge = paramToString(params.prefillAge as string | string[] | undefined);
        const prefillBirthPlace = paramToString(params.prefillBirthPlace as string | string[] | undefined);
        const prefillFiliation = paramToString(params.prefillFiliation as string | string[] | undefined);
        const prefillAddress = paramToString(params.prefillAddress as string | string[] | undefined);
        const prefillPhone = paramToString(params.prefillPhone as string | string[] | undefined);
        const prefillEmail = paramToString(params.prefillEmail as string | string[] | undefined);

        const hasAny = Boolean(prefillName || prefillMotherName || prefillDob || prefillCpf ||
            prefillSocialName || prefillNationality || prefillMaritalStatus || prefillProfession ||
            prefillEducation || prefillAge || prefillBirthPlace || prefillFiliation ||
            prefillAddress || prefillPhone || prefillEmail);

        if (!hasAny) return;

        if (prefillName) setName(prefillName);
        if (prefillMotherName) setMotherName(prefillMotherName);
        if (prefillDob) setDob(prefillDob);
        if (prefillCpf) setCpf(prefillCpf);
        if (prefillSocialName) setSocialName(prefillSocialName);
        if (prefillNationality) setNationality(prefillNationality);
        if (prefillMaritalStatus) setMaritalStatus(prefillMaritalStatus);
        if (prefillProfession) setProfession(prefillProfession);
        if (prefillEducation) setEducation(prefillEducation);
        if (prefillAge) setAge(prefillAge);
        if (prefillBirthPlace) setBirthPlace(prefillBirthPlace);
        if (prefillFiliation) setFiliation(prefillFiliation);
        if (prefillAddress) setAddress(prefillAddress);
        if (prefillPhone) setPhone(prefillPhone);
        if (prefillEmail) setEmail(prefillEmail);

        if (prefillSource === 'face') {
            Alert.alert('Dados preenchidos', 'Dados do detento preenchidos pela pesquisa facial.');
        } else if (prefillSource === 'document') {
            Alert.alert('Dados preenchidos', 'Dados encontrados no documento e preenchidos automaticamente.');
        }
    }, [
        params.prefillName, params.prefillMotherName, params.prefillDob, params.prefillCpf,
        params.prefillSource, params.prefillSocialName, params.prefillNationality,
        params.prefillMaritalStatus, params.prefillProfession, params.prefillEducation,
        params.prefillAge, params.prefillBirthPlace, params.prefillFiliation,
        params.prefillAddress, params.prefillPhone, params.prefillEmail,
    ]);

    /** Só pode salvar se a biometria facial foi validada (embedding gerado). */
    const canSave = Boolean(pending && pending.photoUri === photoUri && photoUri);
    const isPersonalDataComplete = Boolean(name.trim() && motherName.trim() && dob.trim() && cpf.trim());

    const goToBiometricsStep = () => {
        if (!isPersonalDataComplete) {
            Alert.alert('Campos obrigatórios', 'Preencha todos os dados pessoais para avançar.');
            return;
        }
        setStep('biometria');
    };

    const handleSave = async () => {
        if (isSubmitting) return;
        if (!canSave || !pending) {
            Alert.alert(
                'Biometria obrigatória',
                'É necessário tirar a foto do rosto e ter a face validada antes de salvar. Vá em "Tirar Foto" e aguarde a confirmação.'
            );
            return;
        }
        if (!name || !motherName || !dob || !cpf || !photoUri) {
            Alert.alert('Erro', 'Preencha todos os campos.');
            return;
        }

        setIsSubmitting(true);
        setStatusMessage('Salvando cadastro...');

        try {
            const embeddingJson = JSON.stringify(pending.embedding);
            await addPrisoner(name, motherName, dob, cpf, photoUri, embeddingJson, {
                socialName: socialName || undefined,
                nationality: nationality || undefined,
                maritalStatus: maritalStatus || undefined,
                profession: profession || undefined,
                education: education || undefined,
                age: age || undefined,
                birthPlace: birthPlace || undefined,
                filiation: filiation || undefined,
                address: address || undefined,
                phone: phone || undefined,
                email: email || undefined,
            });
            clearPending();
            Alert.alert('Sucesso', 'Preso cadastrado com biometria facial.', [
                { text: 'OK', onPress: () => router.replace('/(tabs)') }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao salvar cadastro.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const takePhoto = () => {
        router.push({
            pathname: '/capture',
            params: {
                mode: 'register',
                prefillName: name,
                prefillMotherName: motherName,
                prefillDob: dob,
                prefillCpf: cpf,
                prefillSocialName: socialName,
                prefillNationality: nationality,
                prefillMaritalStatus: maritalStatus,
                prefillProfession: profession,
                prefillEducation: education,
                prefillAge: age,
                prefillBirthPlace: birthPlace,
                prefillFiliation: filiation,
                prefillAddress: address,
                prefillPhone: phone,
                prefillEmail: email,
            },
        });
    };

    const handleFacePrefill = () => {
        router.push({ pathname: '/capture', params: { mode: 'prefill' } });
    };

    const handleDocumentScan = () => {
        router.push('/document-scan');
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, step === 'biometria' && styles.containerBiometry]}>
            {/* <ThemedText type="title" style={styles.title}>Novo Cadastro</ThemedText> */}

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tabButton, step === 'dados' && styles.tabButtonActive]}
                    onPress={() => setStep('dados')}
                >
                    <Text style={[styles.tabButtonText, step === 'dados' && styles.tabButtonTextActive]}>
                        1. Dados pessoais
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, step === 'biometria' && styles.tabButtonActive]}
                    onPress={goToBiometricsStep}
                >
                    <Text style={[styles.tabButtonText, step === 'biometria' && styles.tabButtonTextActive]}>
                        2. Biometria
                    </Text>
                </TouchableOpacity>
            </View>

            {step === 'dados' ? (
                <View style={styles.form}>
                    <View style={styles.topActions}>
                        <TouchableOpacity
                            style={[styles.topActionButton, styles.topActionButtonSecondary]}
                            onPress={handleFacePrefill}
                            accessibilityLabel="Pesquisar por biometria facial"
                        >
                            <Ionicons name="scan" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.topActionButton}
                            onPress={handleDocumentScan}
                            accessibilityLabel="Escanear documento"
                        >
                            <Ionicons name="document-text" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <ThemedText type="defaultSemiBold">Nome Completo</ThemedText>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome do Preso" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Nome da Mãe</ThemedText>
                    <TextInput style={styles.input} value={motherName} onChangeText={setMotherName} placeholder="Nome da Mãe" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Data de Nascimento</ThemedText>
                    <TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="DD/MM/AAAA" keyboardType="numeric" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">CPF</ThemedText>
                    <TextInput style={styles.input} value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" keyboardType="numeric" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Nome Social</ThemedText>
                    <TextInput style={styles.input} value={socialName} onChangeText={setSocialName} placeholder="Nome social (se houver)" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Nacionalidade</ThemedText>
                    <TextInput style={styles.input} value={nationality} onChangeText={setNationality} placeholder="Ex: Brasileira" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Estado Civil</ThemedText>
                    <TextInput style={styles.input} value={maritalStatus} onChangeText={setMaritalStatus} placeholder="Ex: Solteiro(a), Casado(a)" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Profissão</ThemedText>
                    <TextInput style={styles.input} value={profession} onChangeText={setProfession} placeholder="Profissão" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Escolaridade</ThemedText>
                    <TextInput style={styles.input} value={education} onChangeText={setEducation} placeholder="Ex: Ensino médio completo" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Idade</ThemedText>
                    <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Idade em anos" keyboardType="numeric" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Naturalidade</ThemedText>
                    <TextInput style={styles.input} value={birthPlace} onChangeText={setBirthPlace} placeholder="Cidade/UF de nascimento" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Filiação</ThemedText>
                    <TextInput style={styles.input} value={filiation} onChangeText={setFiliation} placeholder="Nome do pai / outros" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Endereço</ThemedText>
                    <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Logradouro, número, bairro, cidade" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">Telefone</ThemedText>
                    <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(00) 00000-0000" keyboardType="phone-pad" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <ThemedText type="defaultSemiBold">E-mail</ThemedText>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

                    <TouchableOpacity style={styles.primaryButton} onPress={goToBiometricsStep} activeOpacity={0.8}>
                        <Text style={styles.primaryButtonText}>Avançar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.biometryStepWrapper}>
                    <View style={styles.biometryCenter}>
                        <View style={styles.photoContainer}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.photo} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Ionicons name="person" size={50} color="#ccc" />
                                    <Text style={{ color: '#666' }}>Sem Foto</Text>
                                </View>
                            )}
                            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                                <Ionicons name="camera" size={24} color="#fff" />
                                <Text style={styles.photoBtnText}>Tirar Foto</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* {!canSave && photoUri && (
                        <View style={styles.biometryWarning}>
                            <Ionicons name="warning" size={20} color="#B45309" />
                            <Text style={styles.biometryWarningText}>
                                Foto ainda não validada. Tire a foto pela câmera para gerar a biometria.
                            </Text>
                        </View>
                    )} */}

                    {/* <Button title="Voltar para dados pessoais" onPress={() => setStep('dados')} /> */}

                    <View style={styles.biometryBottom}>
                        {isSubmitting ? (
                            <View style={{ alignItems: 'center', gap: 10 }}>
                                <ActivityIndicator size="large" color="#0D9488" />
                                <Text style={{ color: '#666' }}>{statusMessage}</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
                                onPress={handleSave}
                                disabled={!canSave}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.primaryButtonText, !canSave && styles.primaryButtonTextDisabled]}>
                                    Salvar Cadastro
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#F2F2F7',
        flexGrow: 1,
    },
    containerBiometry: {
        flexGrow: 1,
        minHeight: Dimensions.get('window').height - 120,
    },
    title: {
        marginBottom: 20,
        textAlign: 'center',
    },
    tabs: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    tabButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    },
    tabButtonActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    tabButtonText: {
        textAlign: 'center',
        color: '#111827',
        fontWeight: '600',
        fontSize: 13,
    },
    tabButtonTextActive: {
        color: '#fff',
    },
    photoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    biometryStepWrapper: {
        flex: 1,
    },
    biometryCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 280,
    },
    biometryBottom: {
        marginTop: 24,
        paddingBottom: 8,
    },
    photo: {
        width: 150,
        height: 150,
        borderRadius: 75,
        marginBottom: 10,
    },
    photoPlaceholder: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#e1e1e1',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    photoBtn: {
        flexDirection: 'row',
        backgroundColor: '#007AFF',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        gap: 8,
    },
    photoBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    form: {
        gap: 10,
    },
    topActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginBottom: 10,
    },
    topActionButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topActionButtonSecondary: {
        backgroundColor: '#7C3AED',
    },
    primaryButton: {
        backgroundColor: '#0D9488',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        alignSelf: 'stretch',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonTextDisabled: {
        color: 'rgba(255,255,255,0.6)',
    },
    input: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 10,
    },
    biometryWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    biometryWarningText: {
        flex: 1,
        color: '#92400E',
        fontSize: 14,
    },
});
