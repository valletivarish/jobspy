// Type declarations for indeed-scraper
// This module doesn't ship with TypeScript types

declare module 'indeed-scraper' {
    export interface IndeedQueryOptions {
        query: string;
        city?: string;
        radius?: string;
        level?: string;
        maxAge?: string;
        sort?: string;
        limit?: number;
    }

    export interface IndeedJob {
        title: string;
        company: string;
        location: string;
        url: string;
        postDate: string;
        salary?: string;
        summary?: string;
    }

    export function query(options: IndeedQueryOptions): Promise<IndeedJob[]>;
}
