import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        return new Promise((resolve) => {
            const scriptPath = path.join(process.cwd(), 'scripts', 'scrape.py');

            const pythonProcess = spawn('python', [scriptPath], {
                cwd: process.cwd(),
                shell: true,
            });

            let stdout = '';
            let stderr = '';

            // Send input data to Python script
            pythonProcess.stdin.write(JSON.stringify(body));
            pythonProcess.stdin.end();

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    resolve(NextResponse.json(
                        { success: false, error: stderr || 'Python script failed', code },
                        { status: 500 }
                    ));
                    return;
                }

                try {
                    // Find the JSON in stdout (in case there are other prints)
                    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        resolve(NextResponse.json(result));
                    } else {
                        resolve(NextResponse.json(
                            { success: false, error: 'No valid JSON in output' },
                            { status: 500 }
                        ));
                    }
                } catch {
                    resolve(NextResponse.json(
                        { success: false, error: 'Failed to parse Python output: ' + stdout.substring(0, 200) },
                        { status: 500 }
                    ));
                }
            });

            pythonProcess.on('error', (err) => {
                resolve(NextResponse.json(
                    { success: false, error: 'Failed to start Python: ' + err.message },
                    { status: 500 }
                ));
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                pythonProcess.kill();
                resolve(NextResponse.json(
                    { success: false, error: 'Request timeout (5 minutes)' },
                    { status: 504 }
                ));
            }, 300000);
        });

    } catch (error) {
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
