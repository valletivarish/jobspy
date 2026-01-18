import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Types for unified Job object
interface Job {
    title: string;
    company: string;
    location: string;
    job_url: string;
    site: string;
    date?: string;
}

interface ScrapeResult {
    jobs: Job[];
    error?: string;
}

// Robust HTTP client with retry logic for Vercel
async function fetchWithRetry(url: string, options: any = {}, retries = 2): Promise<string> {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    };

    for (let i = 0; i <= retries; i++) {
        try {
            const response = await axios.get(url, {
                timeout: 10000, // 10 second timeout for Vercel
                headers: { ...defaultHeaders, ...options.headers },
                ...options,
            });
            return response.data;
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, 500 * (i + 1))); // Backoff
        }
    }
    throw new Error('Max retries reached');
}

// Filter jobs by relevance to search query - Smart filtering
function filterByRelevance(jobs: Job[], query: string): Job[] {
    const queryLower = query.toLowerCase();

    // Remove common filler words from query
    const fillerWords = ['job', 'jobs', 'work', 'position', 'role', 'opening', 'vacancy', 'remote', 'hiring'];
    const queryWords = queryLower
        .split(/\s+/)
        .filter(w => w.length > 2 && !fillerWords.includes(w));

    // Expand synonyms for better matching
    const synonyms: Record<string, string[]> = {
        'backend': ['backend', 'back-end', 'back end', 'server-side', 'api'],
        'frontend': ['frontend', 'front-end', 'front end', 'ui', 'ux'],
        'fullstack': ['fullstack', 'full-stack', 'full stack'],
        'engineer': ['engineer', 'engineering', 'developer', 'dev'],
        'developer': ['developer', 'development', 'engineer', 'dev'],
        'software': ['software', 'swe', 'sde'],
        'devops': ['devops', 'dev-ops', 'sre', 'platform', 'infrastructure'],
        'data': ['data', 'analytics', 'ml', 'machine learning', 'ai'],
    };

    // Build expanded search terms
    const expandedTerms = new Set<string>();
    queryWords.forEach(word => {
        expandedTerms.add(word);
        if (synonyms[word]) {
            synonyms[word].forEach(syn => expandedTerms.add(syn));
        }
    });

    // Non-tech roles to exclude when searching for tech jobs
    const nonTechRoles = [
        'marketing', 'sales', 'hr', 'human resources', 'recruiter', 'recruiting',
        'account manager', 'business development', 'customer success',
        'content writer', 'copywriter', 'social media', 'seo specialist',
        'finance', 'accountant', 'legal', 'lawyer',
        'office manager', 'administrative', 'receptionist',
        'head of marketing', 'head of sales', 'vp of sales', 'vp of marketing'
    ];

    // Tech-related keywords
    const techKeywords = [
        'software', 'engineer', 'developer', 'frontend', 'backend', 'fullstack',
        'devops', 'data', 'python', 'java', 'javascript', 'react', 'node'
    ];

    const isSearchingTech = techKeywords.some(kw => queryLower.includes(kw));

    return jobs.filter(job => {
        const titleLower = job.title.toLowerCase();

        // Exclude non-tech roles when searching for tech
        if (isSearchingTech && nonTechRoles.some(role => titleLower.includes(role))) {
            return false;
        }

        // Check if title contains any expanded search term
        const hasMatch = Array.from(expandedTerms).some(term => titleLower.includes(term));

        // If no query words, include all (after exclusions)
        if (queryWords.length === 0) return true;

        return hasMatch;
    });
}


// ============================================================
// PURE CHEERIO SCRAPERS - No external APIs or libraries
// ============================================================

const ScraperEngine = {

    // 1. RemoteOK - Very scrape-friendly, has JSON embedded
    async remoteok(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const searchQuery = query.toLowerCase().replace(/\s+/g, '-');
            const url = `https://remoteok.com/remote-${searchQuery}-jobs`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('tr.job').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('h2[itemprop="title"]').text().trim() || $el.find('.company_and_position h2').text().trim();
                const company = $el.find('h3[itemprop="name"]').text().trim() || $el.find('.company h3').text().trim();
                const location = $el.find('.location').text().trim() || 'Remote';
                const href = $el.attr('data-href') || $el.find('a.preventLink').attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://remoteok.com${href}`;

                if (title && company) {
                    jobs.push({ title, company, location, job_url, site: 'remoteok' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[RemoteOK] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 2. We Work Remotely - Clean HTML structure
    async weworkremotely(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://weworkremotely.com/remote-jobs/search?term=${encodeURIComponent(query)}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('li.feature, li.new-feature, section.jobs article li').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('.title').text().trim();
                const company = $el.find('.company').text().trim();
                const location = $el.find('.region').text().trim() || 'Remote';
                const href = $el.find('a').first().attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://weworkremotely.com${href}`;

                if (title && company) {
                    jobs.push({ title, company, location, job_url, site: 'weworkremotely' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[WeWorkRemotely] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 3. Hacker News Jobs - Simple, no anti-bot
    async hackernews(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = 'https://news.ycombinator.com/jobs';
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];
            const queryLower = query.toLowerCase();

            $('tr.athing').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const titleLink = $el.find('.titleline > a').first();
                const title = titleLink.text().trim();
                const href = titleLink.attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://news.ycombinator.com/${href}`;

                if (title && (queryLower === '' || title.toLowerCase().includes(queryLower))) {
                    const companyMatch = title.match(/^([^(]+)/);
                    const company = companyMatch ? companyMatch[1].replace(/is hiring.*$/i, '').trim() : 'Y Combinator Startup';
                    jobs.push({ title, company, location: 'Remote / Various', job_url, site: 'hackernews' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[HackerNews] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 4. Indeed - Direct scraping
    async indeed(query: string, location: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&limit=${limit}`;
            const html = await fetchWithRetry(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            });
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('.job_seen_beacon, .jobsearch-ResultsList > li, .result').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('h2.jobTitle span, .jobTitle, a[data-jk]').first().text().trim();
                const company = $el.find('[data-testid="company-name"], .companyName, .company').first().text().trim();
                const loc = $el.find('[data-testid="text-location"], .companyLocation, .location').first().text().trim();
                const jobKey = $el.find('a[data-jk]').attr('data-jk') || $el.attr('data-jk') || '';
                const job_url = jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` : '';

                if (title && job_url) {
                    jobs.push({ title, company: company || 'Unknown', location: loc || location, job_url, site: 'indeed' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Indeed] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 5. Naukri - India-focused
    async naukri(query: string, location: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://www.naukri.com/${encodeURIComponent(query.replace(/\s+/g, '-'))}-jobs-in-${encodeURIComponent(location.replace(/\s+/g, '-'))}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('.jobTuple, .srp-jobtuple-wrapper, article.jobTuple').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('.title, .jobTitle, a.title').text().trim();
                const company = $el.find('.companyInfo a, .subTitle, .comp-name').first().text().trim();
                const loc = $el.find('.locWdth, .location, .loc-wrap').text().trim();
                const href = $el.find('a.title, .title').attr('href') || '';

                if (title && href) {
                    jobs.push({ title, company: company || 'Unknown', location: loc || location, job_url: href, site: 'naukri' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Naukri] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 6. Google Jobs - Via search results
    async google(query: string, location: string, limit: number): Promise<ScrapeResult> {
        try {
            const searchQuery = `${query} jobs in ${location}`;
            const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&ibp=htl;jobs`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('[data-hveid] [role="treeitem"], .PwjeAc, .iFjolb').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('.BjJfJf, .sH3zFd, [role="heading"]').first().text().trim();
                const company = $el.find('.vNEEBe, .nJlQNd').first().text().trim();
                const loc = $el.find('.Qk80Jf, .pwO9Dc').first().text().trim();

                if (title) {
                    jobs.push({
                        title,
                        company: company || 'Various',
                        location: loc || location,
                        job_url: `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + company + ' jobs')}&ibp=htl;jobs`,
                        site: 'google'
                    });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Google] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 7. SimplyHired - Job aggregator
    async simplyhired(query: string, location: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://www.simplyhired.com/search?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('[data-testid="searchSerpJob"], .SerpJob, article').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('h2 a, .jobTitle, [data-testid="searchSerpJobTitle"]').first().text().trim();
                const company = $el.find('[data-testid="companyName"], .companyName, .company').first().text().trim();
                const loc = $el.find('[data-testid="searchSerpJobLocation"], .location').first().text().trim();
                const href = $el.find('h2 a, a.jobTitle').attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://www.simplyhired.com${href}`;

                if (title) {
                    jobs.push({ title, company: company || 'Unknown', location: loc || location, job_url, site: 'simplyhired' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[SimplyHired] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 8. Dice - Tech jobs
    async dice(query: string, location: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://www.dice.com/jobs?q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&pageSize=${limit}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('dhi-search-card, .card, [data-cy="search-result-card"]').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('.card-title a, [data-cy="card-title"] a, a.cardTitle').first().text().trim();
                const company = $el.find('[data-cy="card-company"], .companyDisplay, .card-company').first().text().trim();
                const loc = $el.find('[data-cy="card-location"], .location, .card-location').first().text().trim();
                const href = $el.find('.card-title a, [data-cy="card-title"] a').attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://www.dice.com${href}`;

                if (title) {
                    jobs.push({ title, company: company || 'Unknown', location: loc || location, job_url, site: 'dice' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Dice] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 9. Jobspresso - Remote jobs
    async jobspresso(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://jobspresso.co/remote-work/?search_keywords=${encodeURIComponent(query)}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('.job_listing, article.job_listing').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('.job_listing-title, h3 a').text().trim();
                const company = $el.find('.job_listing-company, .company strong').text().trim();
                const location = $el.find('.job_listing-location, .location').text().trim() || 'Remote';
                const href = $el.find('a').first().attr('href') || '';

                if (title) {
                    jobs.push({ title, company: company || 'Unknown', location, job_url: href, site: 'jobspresso' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Jobspresso] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 10. Arbeitnow - EU/Remote jobs (has JSON API)
    async arbeitnow(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`;
            const response = await fetchWithRetry(url);
            const data = typeof response === 'string' ? JSON.parse(response) : response;
            const jobs: Job[] = [];

            (data.data || []).slice(0, limit).forEach((job: any) => {
                jobs.push({
                    title: job.title || '',
                    company: job.company_name || 'Unknown',
                    location: job.location || 'Remote',
                    job_url: job.url || '',
                    site: 'arbeitnow'
                });
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Arbeitnow] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 11. GitHub Jobs (via Google search)
    async github(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://www.google.com/search?q=site:github.com/about/careers+${encodeURIComponent(query)}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            // This is a fallback - GitHub careers doesn't have a public scrape-friendly page
            // Using this as a placeholder
            return { jobs: [], error: 'GitHub Jobs requires direct site access' };
        } catch (e: any) {
            return { jobs: [], error: e.message };
        }
    },

    // 12. Startup Jobs
    async startupjobs(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://startup.jobs/?q=${encodeURIComponent(query)}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('div[class*="job"], .job-listing, article').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('h2, h3, .job-title, [class*="title"]').first().text().trim();
                const company = $el.find('.company, [class*="company"]').first().text().trim();
                const location = $el.find('.location, [class*="location"]').first().text().trim() || 'Various';
                const href = $el.find('a').first().attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://startup.jobs${href}`;

                if (title && title.length > 5) {
                    jobs.push({ title, company: company || 'Startup', location, job_url, site: 'startupjobs' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[StartupJobs] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 13. AngelList / Wellfound (limited scraping)
    async wellfound(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://wellfound.com/role/${encodeURIComponent(query.replace(/\s+/g, '-'))}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('[class*="job"], [class*="startup-link"]').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('[class*="title"], h4').first().text().trim();
                const company = $el.find('[class*="company"], [class*="name"]').first().text().trim();
                const location = $el.find('[class*="location"]').first().text().trim() || 'Various';
                const href = $el.find('a').first().attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://wellfound.com${href}`;

                if (title && title.length > 5) {
                    jobs.push({ title, company: company || 'Startup', location, job_url, site: 'wellfound' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Wellfound] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 14. Himalayas - Remote jobs
    async himalayas(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://himalayas.app/jobs?q=${encodeURIComponent(query)}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('a[href*="/jobs/"]').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('h3, [class*="title"]').first().text().trim();
                const company = $el.find('[class*="company"]').first().text().trim();
                const location = 'Remote';
                const href = $el.attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://himalayas.app${href}`;

                if (title && title.length > 5) {
                    jobs.push({ title, company: company || 'Company', location, job_url, site: 'himalayas' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Himalayas] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },

    // 15. Remote.co
    async remoteco(query: string, limit: number): Promise<ScrapeResult> {
        try {
            const url = `https://remote.co/remote-jobs/search/?search_keywords=${encodeURIComponent(query)}`;
            const html = await fetchWithRetry(url);
            const $ = cheerio.load(html);
            const jobs: Job[] = [];

            $('.job_listing, .card').each((i, el) => {
                if (jobs.length >= limit) return false;
                const $el = $(el);
                const title = $el.find('.position, h3, .job-title').first().text().trim();
                const company = $el.find('.company, .company-name').first().text().trim();
                const location = 'Remote';
                const href = $el.find('a').first().attr('href') || '';
                const job_url = href.startsWith('http') ? href : `https://remote.co${href}`;

                if (title) {
                    jobs.push({ title, company: company || 'Company', location, job_url, site: 'remoteco' });
                }
            });

            return { jobs };
        } catch (e: any) {
            console.error('[Remote.co] Error:', e.message);
            return { jobs: [], error: e.message };
        }
    },
};

// ============================================================
// API ROUTE HANDLER
// ============================================================

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sites = [], search_term = '', location = '', results_wanted = 20 } = body;

        console.log(`[Scraper] Search: "${search_term}" | Location: "${location}" | Sites:`, sites);

        if (!sites.length) {
            return NextResponse.json({ success: false, error: 'No sites selected' }, { status: 400 });
        }

        const limitPerSite = Math.ceil(results_wanted / sites.length);
        const scrapePromises: Promise<ScrapeResult>[] = [];

        // Map site IDs to scraper functions
        for (const site of sites) {
            switch (site) {
                case 'remoteok':
                    scrapePromises.push(ScraperEngine.remoteok(search_term, limitPerSite));
                    break;
                case 'weworkremotely':
                    scrapePromises.push(ScraperEngine.weworkremotely(search_term, limitPerSite));
                    break;
                case 'hackernews':
                    scrapePromises.push(ScraperEngine.hackernews(search_term, limitPerSite));
                    break;
                case 'indeed':
                    scrapePromises.push(ScraperEngine.indeed(search_term, location, limitPerSite));
                    break;
                case 'naukri':
                    scrapePromises.push(ScraperEngine.naukri(search_term, location, limitPerSite));
                    break;
                case 'google':
                    scrapePromises.push(ScraperEngine.google(search_term, location, limitPerSite));
                    break;
                case 'simplyhired':
                    scrapePromises.push(ScraperEngine.simplyhired(search_term, location, limitPerSite));
                    break;
                case 'dice':
                    scrapePromises.push(ScraperEngine.dice(search_term, location, limitPerSite));
                    break;
                case 'jobspresso':
                    scrapePromises.push(ScraperEngine.jobspresso(search_term, limitPerSite));
                    break;
                case 'arbeitnow':
                    scrapePromises.push(ScraperEngine.arbeitnow(search_term, limitPerSite));
                    break;
                case 'startupjobs':
                    scrapePromises.push(ScraperEngine.startupjobs(search_term, limitPerSite));
                    break;
                case 'wellfound':
                    scrapePromises.push(ScraperEngine.wellfound(search_term, limitPerSite));
                    break;
                case 'himalayas':
                    scrapePromises.push(ScraperEngine.himalayas(search_term, limitPerSite));
                    break;
                case 'remoteco':
                    scrapePromises.push(ScraperEngine.remoteco(search_term, limitPerSite));
                    break;
                default:
                    console.warn(`[Scraper] Unknown site: ${site}`);
            }
        }

        // Execute all scrapers concurrently with error isolation
        const results = await Promise.allSettled(scrapePromises);

        let allJobs: Job[] = [];
        const sourceStatus: Record<string, { count: number; error?: string }> = {};

        results.forEach((result, index) => {
            const siteName = sites[index];
            if (result.status === 'fulfilled') {
                const { jobs, error } = result.value;
                allJobs.push(...jobs);
                sourceStatus[siteName] = { count: jobs.length, error };
            } else {
                sourceStatus[siteName] = { count: 0, error: result.reason?.message || 'Failed' };
            }
        });

        // Filter jobs to only show relevant results matching the query
        const filteredJobs = filterByRelevance(allJobs, search_term);

        // Deduplicate by title + company
        const uniqueJobs = Array.from(
            new Map(filteredJobs.map(j => [`${j.title.toLowerCase()}-${j.company.toLowerCase()}`, j])).values()
        );

        console.log(`[Scraper] Total: ${uniqueJobs.length} unique jobs (${allJobs.length} scraped, ${filteredJobs.length} after filter)`);

        return NextResponse.json({
            success: true,
            jobs: uniqueJobs,
            meta: {
                total_found: uniqueJobs.length,
                scraped: allJobs.length,
                sources: sourceStatus,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('[Scraper] Fatal Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Scraping failed' },
            { status: 500 }
        );
    }
}
