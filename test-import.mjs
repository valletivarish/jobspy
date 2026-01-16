async function test() {
    try {
        const pdf = await import('pdf-parse');
        console.log('Keys:', Object.keys(pdf));
        console.log('Default type:', typeof pdf.default);
    } catch (e) {
        console.error('Import error:', e);
    }
}
test();
