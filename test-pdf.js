const pdfParse = require('pdf-parse');
const fs = require('fs');

async function test() {
    try {
        console.log('PDF Parse loaded:', typeof pdfParse);
        // If there's a pdf in the project, we could test it
    } catch (e) {
        console.error('Test error:', e);
    }
}
test();
