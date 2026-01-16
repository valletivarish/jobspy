// Simple test script for the scrape-js API
const http = require('http');

const data = JSON.stringify({
    sites: ['naukri'],
    search_term: 'developer',
    location: 'Mumbai',
    results_wanted: 3
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/scrape-js',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        // Extract error message from Next.js error page
        const errorMatch = body.match(/Error:([^<]+)/);
        const descMatch = body.match(/"description":"([^"]+)"/);
        if (errorMatch) console.log('Error:', errorMatch[1].trim());
        if (descMatch) console.log('Description:', descMatch[1]);
        // Also try to find NEXT_DATA for more details
        const nextDataMatch = body.match(/__NEXT_DATA__[^>]*>([^<]+)/);
        if (nextDataMatch) {
            try {
                const data = JSON.parse(nextDataMatch[1]);
                console.log('Next Error:', JSON.stringify(data, null, 2));
            } catch (e) { }
        }
        if (!errorMatch && !descMatch) {
            console.log('Full response (first 2000 chars):', body.substring(0, 2000));
        }
    });
});

req.on('error', error => {
    console.error('Error:', error);
});

req.write(data);
req.end();
