import * as pdf from 'pdf-parse';
console.log('PDF module keys:', Object.keys(pdf));
if (pdf.default) {
    console.log('Default type:', typeof pdf.default);
}
