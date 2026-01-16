import { PDFParse } from 'pdf-parse';
async function test() {
    try {
        console.log('PDFParse type:', typeof PDFParse);
        if (PDFParse) {
            console.log('PDFParse keys:', Object.keys(PDFParse));
        }
    } catch (e) {
        console.error('Test error:', e.message);
    }
}
test();
