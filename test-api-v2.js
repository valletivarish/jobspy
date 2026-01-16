async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/scrape-js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sites: ['naukri'],
                search_term: 'software engineer',
                location: 'Hyderabad, India',
                results_wanted: 10,
                page: 1,
                hours_old: 0
            })
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON Success');
        } catch (e) {
            console.log('JSON Parse Error:', e.message);
        }
    } catch (e) {
        console.log('Fetch Error:', e.message);
    }
}
test();
