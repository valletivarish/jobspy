const pdf = require('pdf-parse');
async function test() {
    console.log('PDF Module Keys:', Object.keys(pdf));
    console.log('PDF Module Type:', typeof pdf);
}
test();
