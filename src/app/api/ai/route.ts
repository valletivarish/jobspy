import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { action, resume, jobs, job } = await request.json();

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        if (action === 'match') {
            // Resume matching
            const prompt = `You are a job matching expert. Analyze this resume and rank the jobs by match score.

RESUME:
${resume}

JOBS:
${jobs.map((j: { title: string; company: string; location: string }, i: number) => `${i + 1}. ${j.title} at ${j.company} (${j.location})`).join('\n')}

Return a JSON array with format: [{"index": 0, "score": 95, "reason": "brief reason"}]
Only return the JSON, no other text. Rank top 10 jobs by match score (0-100).`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Extract JSON from response
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

            const result = await model.generateContent(prompt);
            const coverLetter = result.response.text();

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

            const result = await model.generateContent(prompt);
            const text = result.response.text();

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
${resume.substring(0, 1500)} // truncate resume if too long

Write a short (max 150 words) message that is personalized, mentions the candidate's fit, and expresses interest. Use a professional and confident tone.`;

            const result = await model.generateContent(prompt);
            const message = result.response.text();

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
