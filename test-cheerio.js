// Test cheerio import
const cheerio = require('cheerio');
console.log('Cheerio loaded:', typeof cheerio.load);

const html = '<html><body><div class="test">Hello</div></body></html>';
const $ = cheerio.load(html);
console.log('Loaded HTML, test div:', $('.test').text());
