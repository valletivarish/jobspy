import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';
import indeed from 'indeed-scraper';

// Types for our unified Job object
interface Job {
    title: string;
    company: string;
    location: string;
    job_url: string;
    site: string;
    date?: string;
}

// Scraper Registry to manage different sources
const ScraperEngine = {
    // 1. Indeed via specialized library
    async indeed(query: string, location: string, limit: number): Promise<Job[]> {
        try {
            console.log(`[Engine] Indeed Library: ${query} in ${location}`);
            const results = await indeed.query({
                query: query,
                city: location,
                limit: limit,
            });
            return (results || []).map(j => ({
                title: j.title || '',
                company: j.company || '',
                location: j.location || '',
                job_url: j.url || '',
                site: 'indeed',
                date: j.postDate
            }));
        } catch (e: any) {
            console.error(`[Engine] Indeed Error: ${e.message}`);
            return [];
        }
    },

    // 2. Naukri via resilient scraping
    async naukri(query: string, location: string, limit: number, hours: number = 0): Promise<Job[]> {
        try {
            const days = hours > 0 ? Math.ceil(hours / 24) : 0;
            const url = `https://www.naukri.com/job-listings?keyword=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}${days ? `&dayLimit=${days}` : ''}`;
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36' }
            });
            const $ = cheerio.load(data);
            const jobs: Job[] = [];
            $('.jobTuple').each((i, el) => {
                if (jobs.length >= limit) return;
                const title = $(el).find('.title').text().trim();
                const company = $(el).find('.companyName').text().trim();
                const loc = $(el).find('.location').text().trim();
                const job_url = $(el).find('.title').attr('href') || '';
                if (title) jobs.push({ title, company, location: loc, job_url, site: 'naukri' });
            });
            return jobs;
        } catch (e: any) {
            console.error(`[Engine] Naukri Error: ${e.message}`);
            return [];
        }
    },

    // 3. Adzuna (Official API - Stable for Cloud Platforms)
    async adzuna(query: string, location: string, limit: number): Promise<Job[]> {
        try {
            const APP_ID = process.env.ADZUNA_APP_ID;
            const APP_KEY = process.env.ADZUNA_APP_KEY;
            if (!APP_ID || !APP_KEY) {
                console.warn('[Engine] Adzuna skipped: Missing credentials');
                return [];
            }

            const country = 'in'; // Search in India by default
            const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=${limit}&what=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}`;

            const { data } = await axios.get(url);
            return (data.results || []).map((j: any) => ({
                title: j.title || '',
                company: j.company?.display_name || '',
                location: j.location?.display_name || '',
                job_url: j.redirect_url || '',
                site: 'adzuna'
            }));
        } catch (e: any) {
            console.error(`[Engine] Adzuna Error: ${e.message}`);
            return [];
        }
    },

    // 4. Google Jobs via Resilient Scrape
    async google(query: string, location: string, limit: number): Promise<Job[]> {
        try {
            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}+jobs+in+${encodeURIComponent(location)}&udm=8`;
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36' }
            });
            const $ = cheerio.load(data);
            const jobs: Job[] = [];
            $('.LC20lb').each((i, el) => {
                if (jobs.length >= limit) return;
                const title = $(el).text().trim();
                const company = $(el).parent().parent().find('.VwiC3b').text().split('·')[0]?.trim() || 'View';
                if (title) jobs.push({ title, company, location, job_url: url, site: 'google' });
            });
            return jobs;
        } catch (e: any) {
            return [];
        }
    },

    // 5. Jooble (Official API)
    async jooble(query: string, location: string, limit: number): Promise<Job[]> {
        try {
            const API_KEY = process.env.JOOBLE_API_KEY;
            if (!API_KEY) {
                console.warn('[Engine] Jooble skipped: Missing API Key');
                return [];
            }
            const { data } = await axios.post(`https://jooble.org/api/${API_KEY}`, {
                keywords: query,
                location: location,
            });
            return (data.jobs || []).slice(0, limit).map((j: any) => ({
                title: j.title || '',
                company: j.company || '',
                location: j.location || '',
                job_url: j.link || '',
                site: 'jooble'
            }));
        } catch (e: any) {
            console.error(`[Engine] Jooble Error: ${e.message}`);
            return [];
        }
    }
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sites, search_term, location, results_wanted, hours_old } = body;

        console.log(`[API] Processing search: "${search_term}" on sites:`, sites);

        const limitPerSite = Math.ceil(results_wanted / (sites.length || 1));
        const promises = [];

        if (sites.includes('indeed')) promises.push(ScraperEngine.indeed(search_term, location, limitPerSite));
        if (sites.includes('naukri')) promises.push(ScraperEngine.naukri(search_term, location, limitPerSite, hours_old));
        if (sites.includes('google')) promises.push(ScraperEngine.google(search_term, location, limitPerSite));
        if (sites.includes('adzuna')) promises.push(ScraperEngine.adzuna(search_term, location, limitPerSite));
        if (sites.includes('jooble')) promises.push(ScraperEngine.jooble(search_term, location, limitPerSite));

        const results = await Promise.all(promises);
        const allJobs = results.flat();

        // Advanced deduplication
        const uniqueJobs = Array.from(new Map(allJobs.map(j => [`${j.title}-${j.company}`.toLowerCase(), j])).values());

        console.log(`[API] Returning ${uniqueJobs.length} unique results.`);

        return NextResponse.json({
            success: true,
            jobs: uniqueJobs,
            meta: {
                total_found: uniqueJobs.length,
                scraped: allJobs.length,
                sources: sites,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error: any) {
        console.error('[API] Fatal POST Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
