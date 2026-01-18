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
            // PDF parsing - use require for CommonJS module
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const pdfParse = require('pdf-parse');
                const data = await pdfParse(buffer);
                text = data.text || '';
            } catch (pdfErr: unknown) {
                console.error('PDF parse error:', pdfErr);
                // Return success but prompt user to paste text
                return NextResponse.json({
                    success: true,
                    text: '',
                    fileName: file.name,
                    fileSize: file.size,
                    warning: 'Could not extract text from PDF. Please paste your resume text manually in the text box.'
                });
            }
        } else if (fileName.endsWith('.docx')) {
            try {
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ buffer });
                text = result.value;
            } catch {
                return NextResponse.json({
                    success: true,
                    text: '',
                    fileName: file.name,
                    warning: 'Could not extract text from DOCX. Please paste your resume text manually.'
                });
            }
        } else if (fileName.endsWith('.doc')) {
            return NextResponse.json({
                success: true,
                text: '',
                fileName: file.name,
                warning: 'Old .doc format not fully supported. Please paste your resume text manually or save as .docx'
            });
        } else if (fileName.endsWith('.txt')) {
            text = buffer.toString('utf-8');
        } else {
            return NextResponse.json({
                success: false,
                error: 'Unsupported file format. Please upload PDF, DOCX, TXT, or paste text directly.'
            }, { status: 400 });
        }

        // Clean up extracted text
        text = text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();

        return NextResponse.json({
            success: true,
            text,
            fileName: file.name,
            fileSize: file.size
        });

    } catch (error: unknown) {
        console.error('Resume parse error:', error);
        return NextResponse.json({
            success: true,
            text: '',
            warning: 'Failed to parse file. Please paste your resume text manually in the text box.',
            error: String(error)
        });
    }
}
