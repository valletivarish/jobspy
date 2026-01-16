# JobSpy - AI-Powered Job Scraper

A professional web application for scraping jobs from multiple platforms with AI-powered features.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Gemini AI](https://img.shields.io/badge/Gemini-AI-red)

## Features

### Job Scraping
- **Multi-Site Support**: LinkedIn, Indeed, Glassdoor, Google Jobs, ZipRecruiter
- **Advanced Filters**: Job type, remote/on-site, posting date, location
- **Export Options**: Download as Excel or CSV

### AI Features (Powered by Gemini)
- **Resume Matcher**: Paste your resume, AI matches you with the best jobs
- **Cover Letter Generator**: AI writes personalized cover letters for each job
- **Job Analysis**: See your strengths, gaps, and tips for each position

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+ with `python-jobspy` installed

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/jobspy-web.git
cd jobspy-web

# Install Node dependencies
npm install

# Install Python dependencies (in parent directory venv)
pip install python-jobspy pandas

# Create environment file for Gemini API
echo "GEMINI_API_KEY=your_api_key_here" > .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/jobspy-web)

### Manual Deploy
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variable: `GEMINI_API_KEY`
4. Deploy!

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey)) |

## Project Structure

```
jobspy-web/
├── src/app/
│   ├── page.tsx          # Main UI
│   ├── globals.css       # Netflix-style theme
│   ├── api/
│   │   ├── scrape/       # Job scraping endpoint
│   │   └── ai/           # Gemini AI endpoint
├── scripts/
│   └── scrape.py         # Python scraping script
├── api/
│   └── scrape.py         # Vercel Python function
├── .env.local            # API keys (not committed)
└── vercel.json           # Vercel config
```

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes + Python
- **AI**: Google Gemini 1.5 Flash
- **Scraping**: python-jobspy
- **Hosting**: Vercel

## License

MIT License
