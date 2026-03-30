import { ThemedText } from '@/components/themed-text';
import { getPrisoners } from '@/src/services/database';
import { useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, View } from 'react-native';

export default function PrisonersScreen() {
    const [prisoners, setPrisoners] = useState<any[]>([]);

    useFocusEffect(
        React.useCallback(() => {
            loadPrisoners();
        }, [])
    );

    const loadPrisoners = async () => {
        try {
            const data = await getPrisoners();
            setPrisoners(data);
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível carregar os detentos.');
        }
    };
    console.log(prisoners, 'prisoners');
    return (
        <View style={styles.container}>
            <ThemedText type="title" style={styles.title}>Detentos Cadastrados</ThemedText>

            <FlatList
                data={prisoners}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<ThemedText style={styles.empty}>Nenhum detento encontrado.</ThemedText>}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        {item.photo_uri ? (
                            <Image source={{ uri: item.photo_uri }} style={styles.avatar} />
                        ) : (
                            <View style={styles.placeholder} />
                        )}
                        <View style={styles.info}>
                            <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                            <ThemedText>CPF: {item.cpf}</ThemedText>
                            <ThemedText>Mãe: {item.mother_name}</ThemedText>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F2F2F7',
    },
    title: {
        marginBottom: 20,
        textAlign: 'center',
    },
    list: {
        gap: 15,
    },
    card: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ddd',
    },
    placeholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ccc',
    },
    info: {
        flex: 1,
    },
    empty: {
        textAlign: 'center',
        marginTop: 50,
        opacity: 0.5,
    },
});
