import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

const ensureDb = async (): Promise<SQLite.SQLiteDatabase> => {
    if (db) return db;
    if (!initPromise) {
        initPromise = (async () => {
            const database = await SQLite.openDatabaseAsync('prisoners.db');
            await database.execAsync(`
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA cache_size = -64000;
                CREATE TABLE IF NOT EXISTS prisoners (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    mother_name TEXT,
                    dob TEXT,
                    cpf TEXT,
                    photo_uri TEXT,
                    face_embedding TEXT,
                    social_name TEXT,
                    nationality TEXT,
                    marital_status TEXT,
                    profession TEXT,
                    education TEXT,
                    age TEXT,
                    birth_place TEXT,
                    filiation TEXT,
                    address TEXT,
                    phone TEXT,
                    email TEXT
                );
            `);
            db = database;
            await migrateAddFaceEmbedding(database);
            await migrateNewPrisonerFields(database);
        })();
    }
    await initPromise;
    return db!;
};

/** Linha da tabela prisoners (retorno de getPrisonerById, etc.) */
export interface PrisonerRow {
    id: number;
    name: string;
    mother_name: string | null;
    dob: string | null;
    cpf: string | null;
    photo_uri: string | null;
    face_embedding: string | null;
    social_name: string | null;
    nationality: string | null;
    marital_status: string | null;
    profession: string | null;
    education: string | null;
    age: string | null;
    birth_place: string | null;
    filiation: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
}

/** Migração: adiciona coluna face_embedding se a tabela já existia sem ela. */
async function migrateAddFaceEmbedding(database: SQLite.SQLiteDatabase): Promise<void> {
    try {
        await database.runAsync('ALTER TABLE prisoners ADD COLUMN face_embedding TEXT');
    } catch {
        // Coluna já existe ou tabela nova já tem a coluna
    }
}

const NEW_COLUMNS = [
    'social_name',
    'nationality',
    'marital_status',
    'profession',
    'education',
    'age',
    'birth_place',
    'filiation',
    'address',
    'phone',
    'email',
] as const;

async function migrateNewPrisonerFields(database: SQLite.SQLiteDatabase): Promise<void> {
    for (const col of NEW_COLUMNS) {
        try {
            await database.runAsync(`ALTER TABLE prisoners ADD COLUMN ${col} TEXT`);
        } catch {
            // Coluna já existe
        }
    }
}

export const initDatabase = async () => {
    await ensureDb();
};

export const addPrisoner = async (
    name: string,
    motherName: string,
    dob: string,
    cpf: string,
    photoUri: string,
    faceEmbeddingJson?: string,
    extra?: {
        socialName?: string;
        nationality?: string;
        maritalStatus?: string;
        profession?: string;
        education?: string;
        age?: string;
        birthPlace?: string;
        filiation?: string;
        address?: string;
        phone?: string;
        email?: string;
    }
) => {
    const database = await ensureDb();
    const result = await database.runAsync(
        `INSERT INTO prisoners (
            name, mother_name, dob, cpf, photo_uri, face_embedding,
            social_name, nationality, marital_status, profession, education,
            age, birth_place, filiation, address, phone, email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        name,
        motherName,
        dob,
        cpf,
        photoUri,
        faceEmbeddingJson ?? null,
        extra?.socialName ?? null,
        extra?.nationality ?? null,
        extra?.maritalStatus ?? null,
        extra?.profession ?? null,
        extra?.education ?? null,
        extra?.age ?? null,
        extra?.birthPlace ?? null,
        extra?.filiation ?? null,
        extra?.address ?? null,
        extra?.phone ?? null,
        extra?.email ?? null
    );
    return result.lastInsertRowId;
};

export const getPrisoners = async () => {
    const database = await ensureDb();
    return await database.getAllAsync('SELECT * FROM prisoners ORDER BY id DESC');
};

export const getLastPrisoner = async () => {
    const database = await ensureDb();
    return await database.getFirstAsync('SELECT * FROM prisoners ORDER BY id DESC LIMIT 1');
};

export const getPrisonerById = async (id: number | string): Promise<PrisonerRow | null> => {
    const database = await ensureDb();
    return await database.getFirstAsync<PrisonerRow>('SELECT * FROM prisoners WHERE id = ?', id);
};

export const clearDatabase = async () => {
    const database = await ensureDb();
    await database.runAsync('DELETE FROM prisoners');
    await database.runAsync('DELETE FROM sqlite_sequence WHERE name="prisoners"');
};

/** Resposta da identificação local (mesmo formato da API Java para trocar depois) */
export interface IdentifyResponse {
    match: boolean;
    preso_id?: string;
    /** Melhor distância encontrada (sempre preenchida quando há candidatos; use para calibrar o threshold) */
    distance?: number;
}

/** Distância euclidiana L2 entre dois vetores de mesmo tamanho */
function euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        sum += d * d;
    }
    return Math.sqrt(sum);
}

/**
 * Limite de distância L2 para considerar match.
 * Embeddings 512-d costumam ter distância L2 na faixa 5–25 para a mesma pessoa (depende do modelo Python).
 * Ajuste conforme o modelo: se nunca der match, aumente; se der match em pessoas diferentes, diminua.
 */
const IDENTIFY_THRESHOLD = 25;

/**
 * Identifica o preso comparando o embedding com os cadastros no banco local.
 * Retorna o mesmo formato da API Java (IdentifyResponse) para poder trocar depois.
 */
export const identifyByEmbeddingLocal = async (embedding: number[]): Promise<IdentifyResponse> => {
    const database = await ensureDb();
    const rows = await database.getAllAsync<{ id: number; face_embedding: string | null }>(
        'SELECT id, face_embedding FROM prisoners WHERE face_embedding IS NOT NULL AND face_embedding != ""'
    );

    let bestId: number | null = null;
    let bestDistance = Infinity;

    for (const row of rows) {
        const raw = row.face_embedding;
        if (raw == null || raw === '') continue;
        let stored: number[];
        try {
            const parsed = JSON.parse(raw);
            stored = Array.isArray(parsed) ? parsed : (typeof parsed === 'string' ? JSON.parse(parsed) : []);
        } catch {
            continue;
        }
        if (stored.length !== embedding.length) continue;
        const dist = euclideanDistance(embedding, stored);
        if (dist < bestDistance) {
            bestDistance = dist;
            bestId = row.id;
        }
    }

    const match = bestId !== null && bestDistance <= IDENTIFY_THRESHOLD;
    return {
        match,
        ...(match && bestId !== null && { preso_id: String(bestId) }),
        ...(bestId !== null && { distance: bestDistance }),
    };
};

