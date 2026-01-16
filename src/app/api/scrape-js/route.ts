import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';

const COMMON_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
};

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
];

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Helper to check if a job is relevant to the search term
function isRelevant(title: string, company: string, query: string): boolean {
    const q = query.toLowerCase();
    const t = title.toLowerCase();

    // Split query into keywords
    const keywords = q.split(/\s+/).filter(k => k.length > 2);
    if (keywords.length === 0) return true;

    // Technical keywords list to ensure strict matching for them
    const techKeywords = ['java', 'python', 'react', 'angular', 'node', 'javascript', 'typescript', 'aws', 'azure', 'devops', 'sql', 'cpp', 'golang', 'rust', 'flutter', 'android', 'ios'];
    const criticalKeywords = keywords.filter(k => techKeywords.includes(k));

    if (criticalKeywords.length > 0) {
        // Must contain all critical keywords (e.g., searching for "Java React" must have both)
        return criticalKeywords.every(k => t.includes(k));
    }

    // For non-tech queries, ensure at least one keyword (excluding common ones like "developer") is present
    const nonGenericKeywords = keywords.filter(k => !['developer', 'engineer', 'manager', 'lead', 'senior', 'junior'].includes(k));
    if (nonGenericKeywords.length > 0) {
        return nonGenericKeywords.some(k => t.includes(k));
    }

    return true;
}

async function scrapeNaukri(query: string, location: string, results_wanted: number, hours_old: number = 0) {
    try {
        const url = `https://www.naukri.com/job-listings?keyword=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}${hours_old ? `&dayLimit=${Math.ceil(hours_old / 24)}` : ''}`;
        console.log(`[Naukri] Fetching: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                ...COMMON_HEADERS,
                'User-Agent': getRandomUA(),
                'Referer': 'https://www.naukri.com/',
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const jobs: any[] = [];
        $('.jobTuple').each((i, el) => {
            if (jobs.length >= results_wanted) return;
            const title = $(el).find('.title').text().trim();
            const company = $(el).find('.companyName').text().trim();
            const loc = $(el).find('.location').text().trim();
            const job_url = $(el).find('.title').attr('href') || '';
            if (title && isRelevant(title, company, query)) {
                jobs.push({ title, company, location: loc, job_url, site: 'naukri' });
            }
        });
        console.log(`[Naukri] Found ${jobs.length} jobs`);
        return jobs;
    } catch (e: any) {
        console.error(`[Naukri] Error: ${e.response?.status || e.message}`);
        return [];
    }
}

async function scrapeIndeed(query: string, location: string, results_wanted: number, hours_old: number = 0) {
    try {
        const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}${hours_old ? `&fromage=${Math.ceil(hours_old / 24)}` : ''}`;
        console.log(`[Indeed] Fetching: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                ...COMMON_HEADERS,
                'User-Agent': getRandomUA(),
                'Referer': 'https://www.indeed.com/',
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const jobs: any[] = [];
        $('.result').each((i, el) => {
            if (jobs.length >= results_wanted) return;
            const title = $(el).find('.jobTitle').text().trim();
            const company = $(el).find('.companyName').text().trim();
            const loc = $(el).find('.companyLocation').text().trim();
            const job_url = 'https://www.indeed.com' + $(el).find('.jcs-JobTitle').attr('href');
            if (title && isRelevant(title, company, query)) {
                jobs.push({ title, company, location: loc, job_url, site: 'indeed' });
            }
        });
        console.log(`[Indeed] Found ${jobs.length} jobs`);
        return jobs;
    } catch (e: any) {
        console.error(`[Indeed] Error: ${e.response?.status || e.message}`);
        return [];
    }
}

async function scrapeGoogle(query: string, location: string, results_wanted: number) {
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}+jobs+in+${encodeURIComponent(location)}&udm=8`;
        console.log(`[Google] Fetching: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                ...COMMON_HEADERS,
                'User-Agent': getRandomUA(),
                'Referer': 'https://www.google.com/',
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const jobs: any[] = [];
        $('.LC20lb').each((i, el) => {
            if (jobs.length >= results_wanted) return;
            const title = $(el).text().trim();
            const company = $(el).parent().parent().find('.VwiC3b').text().split('·')[0]?.trim() || 'View';
            if (title && isRelevant(title, company, query)) {
                jobs.push({ title, company, location, job_url: url, site: 'google' });
            }
        });
        console.log(`[Google] Found ${jobs.length} jobs`);
        return jobs;
    } catch (e: any) {
        console.error(`[Google] Error: ${e.response?.status || e.message}`);
        return [];
    }
}

async function scrapeMonster(query: string, location: string, results_wanted: number, hours_old: number = 0) {
    try {
        const url = `https://www.foundit.in/srp/results?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}${hours_old ? `&freshness=${Math.ceil(hours_old / 24)}` : ''}`;
        console.log(`[Monster] Fetching: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                ...COMMON_HEADERS,
                'User-Agent': getRandomUA(),
                'Referer': 'https://www.foundit.in/',
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const jobs: any[] = [];
        $('.card-container').each((i, el) => {
            if (jobs.length >= results_wanted) return;
            const title = $(el).find('.job-title').text().trim();
            const company = $(el).find('.company-name').text().trim();
            const loc = $(el).find('.location').text().trim();
            const job_url = $(el).find('a').attr('href') || '';
            if (title && isRelevant(title, company, query)) {
                jobs.push({ title, company, location: loc, job_url, site: 'monster' });
            }
        });
        console.log(`[Monster] Found ${jobs.length} jobs`);
        return jobs;
    } catch (e: any) {
        console.error(`[Monster] Error: ${e.response?.status || e.message}`);
        return [];
    }
}

async function scrapeSimplyHired(query: string, location: string, results_wanted: number, hours_old: number = 0) {
    try {
        const url = `https://www.simplyhired.com/search?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}${hours_old ? `&t=${Math.ceil(hours_old / 24)}` : ''}`;
        console.log(`[SimplyHired] Fetching: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                ...COMMON_HEADERS,
                'User-Agent': getRandomUA(),
                'Referer': 'https://www.simplyhired.com/',
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const jobs: any[] = [];
        $('.SerpJob-jobCard').each((i, el) => {
            if (jobs.length >= results_wanted) return;
            const title = $(el).find('.jobTitle').text().trim();
            const company = $(el).find('.companyName').text().trim();
            const loc = $(el).find('.jobLocation').text().trim();
            const job_url = 'https://www.simplyhired.com' + $(el).find('.jobTitle a').attr('href');
            if (title && isRelevant(title, company, query)) {
                jobs.push({ title, company, location: loc, job_url, site: 'simplyhired' });
            }
        });
        console.log(`[SimplyHired] Found ${jobs.length} jobs`);
        return jobs;
    } catch (e: any) {
        console.error(`[SimplyHired] Error: ${e.response?.status || e.message}`);
        return [];
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sites, search_term, location, results_wanted, hours_old } = body;

        console.log(`[API] Searching for "${search_term}" in "${location}" on:`, sites);

        const promises = [];
        if (sites.includes('naukri')) promises.push(scrapeNaukri(search_term, location, results_wanted, hours_old));
        if (sites.includes('indeed')) promises.push(scrapeIndeed(search_term, location, results_wanted, hours_old));
        if (sites.includes('google')) promises.push(scrapeGoogle(search_term, location, results_wanted));
        if (sites.includes('monster')) promises.push(scrapeMonster(search_term, location, results_wanted, hours_old));
        if (sites.includes('simplyhired')) promises.push(scrapeSimplyHired(search_term, location, results_wanted, hours_old));

        const results = await Promise.all(promises);
        const flattenedJobs = results.flat();
        const uniqueJobs = Array.from(new Map(flattenedJobs.map((j: any) => [`${j.title}-${j.company}`, j])).values());

        console.log(`[API] Returning ${uniqueJobs.length} unique jobs (Scraped: ${flattenedJobs.length})`);

        return NextResponse.json({
            success: true,
            jobs: uniqueJobs,
            debug: {
                scraped: flattenedJobs.length,
                unique: uniqueJobs.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error: any) {
        console.error('[API] Fatal Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
