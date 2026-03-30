import React, { createContext, useCallback, useContext, useState } from 'react';

export interface PendingBiometrics {
    photoUri: string;
    embedding: number[];
}

interface PendingBiometricsContextValue {
    /** Dados da biometria já validada pela API (foto + embedding). null = ainda não validado. */
    pending: PendingBiometrics | null;
    /** Define foto e embedding após sucesso do /generate-embedding. Permite seguir para o cadastro. */
    setPending: (photoUri: string, embedding: number[]) => void;
    /** Limpa após salvar o cadastro ou cancelar. */
    clearPending: () => void;
}

const PendingBiometricsContext = createContext<PendingBiometricsContextValue | null>(null);

export function PendingBiometricsProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPendingState] = useState<PendingBiometrics | null>(null);

    const setPending = useCallback((photoUri: string, embedding: number[]) => {
        setPendingState({ photoUri, embedding });
    }, []);

    const clearPending = useCallback(() => {
        setPendingState(null);
    }, []);

    return (
        <PendingBiometricsContext.Provider value={{ pending, setPending, clearPending }}>
            {children}
        </PendingBiometricsContext.Provider>
    );
}

export function usePendingBiometrics(): PendingBiometricsContextValue {
    const ctx = useContext(PendingBiometricsContext);
    if (!ctx) {
        throw new Error('usePendingBiometrics must be used within PendingBiometricsProvider');
    }
    return ctx;
}
