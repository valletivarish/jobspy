import { NextRequest, NextResponse } from 'next/server';

// Gemini models to try (in order of preference)
const GEMINI_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-pro',
];

async function callGemini(prompt: string, apiKey: string): Promise<string> {
    let lastError = '';

    for (const model of GEMINI_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                    }
                }),
            });

            if (response.ok) {
                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }

            // Check if rate limited
            if (response.status === 429) {
                console.log(`[AI] Model ${model} rate limited, trying next...`);
                lastError = 'Rate limited - please try again in a few seconds';
                continue;
            }

            const error = await response.text();
            lastError = `${response.status}: ${error.substring(0, 100)}`;
        } catch (err: any) {
            lastError = err.message;
        }
    }

    throw new Error(`All Gemini models failed. ${lastError}`);
}


export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Gemini API key not configured' }, { status: 500 });
        }

        const { action, resume, jobs, job } = await request.json();

        if (action === 'match') {
            // Resume matching
            const prompt = `You are a job matching expert. Analyze this resume and rank the jobs by match score.

RESUME:
${resume}

JOBS:
${jobs.map((j: { title: string; company: string; location: string }, i: number) => `${i + 1}. ${j.title} at ${j.company} (${j.location})`).join('\n')}

Return a JSON array with format: [{"index": 0, "score": 95, "reason": "brief reason"}]
Only return the JSON, no other text. Rank top 10 jobs by match score (0-100).`;

            const text = await callGemini(prompt, apiKey);
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const matches = JSON.parse(jsonMatch[0]);
                return NextResponse.json({ success: true, matches });
            }

            return NextResponse.json({ success: false, error: 'Failed to parse AI response' });
        }

        if (action === 'cover-letter') {
            // Cover letter generation
            const prompt = `Write a professional cover letter for this job application.

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

CANDIDATE RESUME:
${resume}

Write a compelling, personalized cover letter (3-4 paragraphs). Be professional but not generic. Highlight relevant experience and skills. Do not use placeholder text like [Your Name] - write it as a complete letter ready to send.`;

            const coverLetter = await callGemini(prompt, apiKey);
            return NextResponse.json({ success: true, coverLetter });
        }

        if (action === 'analyze') {
            // Skills analysis
            const prompt = `Analyze this resume against this job posting.

RESUME:
${resume}

JOB:
Title: ${job.title}
Company: ${job.company}

Provide a brief analysis in this JSON format:
{
  "matchScore": 85,
  "strengths": ["strength 1", "strength 2"],
  "gaps": ["gap 1", "gap 2"],
  "tips": ["tip 1", "tip 2"]
}

Only return the JSON, no other text.`;

            const text = await callGemini(prompt, apiKey);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                return NextResponse.json({ success: true, analysis });
            }

            return NextResponse.json({ success: false, error: 'Failed to parse AI response' });
        }

        if (action === 'message') {
            const prompt = `Write a short, professional LinkedIn message or email to a recruiter for this job.
            
JOB:
Title: ${job.title}
Company: ${job.company}

CANDIDATE:
${resume.substring(0, 1500)}

Write a short (max 150 words) message that is personalized, mentions the candidate's fit, and expresses interest. Use a professional and confident tone.`;

            const message = await callGemini(prompt, apiKey);
            return NextResponse.json({ success: true, message });
        }

        return NextResponse.json({ success: false, error: 'Unknown action' });

    } catch (error) {
        console.error('Gemini API error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
