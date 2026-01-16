import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name.toLowerCase();
        let text = '';

        if (fileName.endsWith('.pdf')) {
            // Decisive fix for PDF parser initialization
            let pdfParse;
            try {
                // Primary import attempt (ESM)
                const pdfModule = await import('pdf-parse') as any;
                pdfParse = pdfModule.default || pdfModule;

                // If it's the class-based fork, handle it carefully
                if (typeof pdfParse !== 'function' && (pdfParse as any).PDFParse) {
                    const PDFClass = (pdfParse as any).PDFParse;
                    const parser = new PDFClass({ data: new Uint8Array(buffer) });
                    const result = await parser.getText();
                    text = result.text || '';
                    if (parser.destroy) await parser.destroy();
                } else if (typeof pdfParse === 'function') {
                    // Standard function-based fork
                    const data = await pdfParse(buffer);
                    text = data.text || '';
                } else {
                    throw new Error('PDF parser component not found in module');
                }
            } catch (err: any) {
                console.error('PDF Parser definitive error:', err);
                throw new Error(`PDF parser initialization failed: ${err.message}`);
            }
        } else if (fileName.endsWith('.docx')) {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } else if (fileName.endsWith('.doc')) {
            return NextResponse.json({
                success: false,
                error: 'Old .doc format not supported. Please save as .docx or .pdf'
            }, { status: 400 });
        } else if (fileName.endsWith('.txt')) {
            text = buffer.toString('utf-8');
        } else {
            return NextResponse.json({
                success: false,
                error: 'Unsupported file format. Please upload PDF, DOCX, or TXT'
            }, { status: 400 });
        }

        text = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

        return NextResponse.json({
            success: true,
            text,
            fileName: file.name,
            fileSize: file.size
        });

    } catch (error: any) {
        console.error('Resume parse error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to parse resume: ' + String(error.message || error) },
            { status: 500 }
        );
    }
}
