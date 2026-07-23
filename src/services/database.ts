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
            await migratePrisonerPhotos(database);
            await migrateActivityLog(database);
            await runOneTimeWipeIfNeeded(database);
        })();
    }
    await initPromise;
    return db!;
};

/** Incrementar para forçar novo wipe local (ex.: pedido do usuário). */
const LOCAL_DB_WIPE_TOKEN = 'wipe-2026-07-22-4';

async function runOneTimeWipeIfNeeded(database: SQLite.SQLiteDatabase): Promise<void> {
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT
        );
    `);
    const row = await database.getFirstAsync<{ value: string }>(
        `SELECT value FROM app_meta WHERE key = 'db_wipe_token'`
    );
    if (row?.value === LOCAL_DB_WIPE_TOKEN) return;

    await database.runAsync('DELETE FROM prisoner_photos');
    await database.runAsync('DELETE FROM prisoners');
    await database.runAsync('DELETE FROM activity_log');
    try {
        await database.runAsync('DELETE FROM sqlite_sequence WHERE name="prisoners"');
        await database.runAsync('DELETE FROM sqlite_sequence WHERE name="prisoner_photos"');
        await database.runAsync('DELETE FROM sqlite_sequence WHERE name="activity_log"');
    } catch {
        // ignore
    }
    await database.runAsync(
        `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('db_wipe_token', ?)`,
        LOCAL_DB_WIPE_TOKEN
    );
    console.log('[DB] Base local zerada (wipe one-time).');
}

export type DetaineePhotoType = 'front' | 'right_profile' | 'left_profile' | 'mark' | 'tattoo';

export interface PrisonerPhotoRow {
    id: number;
    prisoner_id: number;
    photo_type: DetaineePhotoType;
    body_region: string | null;
    body_side: string | null;
    photo_uri: string;
    quality_ok: number;
    created_at: string;
}

async function migratePrisonerPhotos(database: SQLite.SQLiteDatabase): Promise<void> {
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS prisoner_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prisoner_id INTEGER NOT NULL,
            photo_type TEXT NOT NULL,
            body_region TEXT,
            body_side TEXT,
            photo_uri TEXT NOT NULL,
            quality_ok INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        );
    `);
}

export type ActivityType = 'register' | 'identify' | 'identify_fail';

export interface ActivityRow {
    id: number;
    activity_type: ActivityType;
    prisoner_id: number | null;
    prisoner_name: string | null;
    created_at: string;
}

async function migrateActivityLog(database: SQLite.SQLiteDatabase): Promise<void> {
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_type TEXT NOT NULL,
            prisoner_id INTEGER,
            prisoner_name TEXT,
            created_at TEXT NOT NULL
        );
    `);
}

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

export type PrisonerExtraFields = {
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
};

export const addPrisoner = async (
    name: string,
    motherName: string,
    dob: string,
    cpf: string,
    photoUri: string,
    faceEmbeddingJson?: string,
    extra?: PrisonerExtraFields
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

/** Atualiza campos de um preso já salvo localmente (cadastro em etapas). */
export const updatePrisoner = async (
    id: number,
    fields: {
        name?: string;
        motherName?: string;
        dob?: string;
        cpf?: string;
        photoUri?: string;
        faceEmbeddingJson?: string | null;
    } & PrisonerExtraFields
) => {
    const database = await ensureDb();
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    const map: Array<[string, string | number | null | undefined]> = [
        ['name', fields.name],
        ['mother_name', fields.motherName],
        ['dob', fields.dob],
        ['cpf', fields.cpf],
        ['photo_uri', fields.photoUri],
        ['face_embedding', fields.faceEmbeddingJson],
        ['social_name', fields.socialName],
        ['nationality', fields.nationality],
        ['marital_status', fields.maritalStatus],
        ['profession', fields.profession],
        ['education', fields.education],
        ['age', fields.age],
        ['birth_place', fields.birthPlace],
        ['filiation', fields.filiation],
        ['address', fields.address],
        ['phone', fields.phone],
        ['email', fields.email],
    ];

    for (const [column, value] of map) {
        if (value !== undefined) {
            sets.push(`${column} = ?`);
            values.push(value);
        }
    }

    if (sets.length === 0) return;

    values.push(id);
    await database.runAsync(`UPDATE prisoners SET ${sets.join(', ')} WHERE id = ?`, ...values);
};

export const getPrisoners = async (): Promise<PrisonerRow[]> => {
    const database = await ensureDb();
    return await database.getAllAsync<PrisonerRow>('SELECT * FROM prisoners ORDER BY id DESC');
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
    await database.runAsync('DELETE FROM prisoner_photos');
    await database.runAsync('DELETE FROM prisoners');
    await database.runAsync('DELETE FROM activity_log');
    await database.runAsync('DELETE FROM sqlite_sequence WHERE name="prisoners"');
    await database.runAsync('DELETE FROM sqlite_sequence WHERE name="prisoner_photos"');
    try {
        await database.runAsync('DELETE FROM sqlite_sequence WHERE name="activity_log"');
    } catch {
        // ignore
    }
};

export const addActivity = async (input: {
    type: ActivityType;
    prisonerId?: number | null;
    prisonerName?: string | null;
}): Promise<void> => {
    const database = await ensureDb();
    await database.runAsync(
        `INSERT INTO activity_log (activity_type, prisoner_id, prisoner_name, created_at)
         VALUES (?, ?, ?, ?)`,
        input.type,
        input.prisonerId ?? null,
        input.prisonerName?.trim() || null,
        new Date().toISOString()
    );
};

export const getRecentActivities = async (limit = 8): Promise<ActivityRow[]> => {
    const database = await ensureDb();
    return await database.getAllAsync<ActivityRow>(
        `SELECT * FROM activity_log ORDER BY id DESC LIMIT ?`,
        limit
    );
};

export const addPrisonerPhoto = async (input: {
    prisonerId: number;
    photoType: DetaineePhotoType;
    photoUri: string;
    bodyRegion?: string;
    bodySide?: string;
    qualityOk?: boolean;
}): Promise<number> => {
    const database = await ensureDb();
    // Frente/perfis: uma foto por tipo (substitui a anterior)
    if (input.photoType === 'front' || input.photoType === 'right_profile' || input.photoType === 'left_profile') {
        await database.runAsync(
            'DELETE FROM prisoner_photos WHERE prisoner_id = ? AND photo_type = ?',
            input.prisonerId,
            input.photoType
        );
    }
    const result = await database.runAsync(
        `INSERT INTO prisoner_photos (
            prisoner_id, photo_type, body_region, body_side, photo_uri, quality_ok, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        input.prisonerId,
        input.photoType,
        input.bodyRegion ?? null,
        input.bodySide ?? null,
        input.photoUri,
        input.qualityOk === false ? 0 : 1,
        new Date().toISOString()
    );
    return Number(result.lastInsertRowId);
};

export const getPrisonerPhotos = async (prisonerId: number): Promise<PrisonerPhotoRow[]> => {
    const database = await ensureDb();
    return await database.getAllAsync<PrisonerPhotoRow>(
        'SELECT * FROM prisoner_photos WHERE prisoner_id = ? ORDER BY id ASC',
        prisonerId
    );
};

export const deletePrisonerPhoto = async (photoId: number): Promise<void> => {
    const database = await ensureDb();
    await database.runAsync('DELETE FROM prisoner_photos WHERE id = ?', photoId);
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

