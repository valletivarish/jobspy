import pdf from 'pdf-parse';
async function test() {
    try {
        console.log('pdf type:', typeof pdf);
        console.log('pdf keys:', Object.keys(pdf));
    } catch (e) {
        console.error('Test error:', e.message);
    }
}
test();
