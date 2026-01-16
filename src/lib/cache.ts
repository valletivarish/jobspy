import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function generateCacheKey(params: any): string {
    const str = JSON.stringify(params);
    return crypto.createHash('md5').update(str).digest('hex');
}

export function getCache(key: string): any | null {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Date.now() > data.expiry) {
            fs.unlinkSync(filePath);
            return null;
        }
        return data.value;
    } catch (e) {
        return null;
    }
}

export function setCache(key: string, value: any, ttl: number = DEFAULT_TTL): void {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    const data = {
        value,
        expiry: Date.now() + ttl
    };
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}
