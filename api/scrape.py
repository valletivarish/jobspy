"""
Vercel Python Serverless Function for Job Scraping
This API endpoint handles job scraping requests using python-jobspy
"""

from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}

            # Extract parameters
            sites = data.get('sites', ['linkedin', 'indeed', 'google'])
            search_term = data.get('search_term', 'software engineer')
            location = data.get('location', 'Hyderabad, India')
            country = data.get('country', 'India')
            job_type = data.get('job_type', '')
            hours_old = data.get('hours_old', 72)
            results_wanted = data.get('results_wanted', 50)
            is_remote = data.get('is_remote')

            # Import jobspy (installed via requirements.txt)
            from jobspy import scrape_jobs

            # Build scrape parameters
            params = {
                "site_name": sites,
                "search_term": search_term,
                "location": location,
                "results_wanted": results_wanted,
                "hours_old": hours_old,
                "country_indeed": country,
                "linkedin_fetch_description": True,
            }

            # Optional parameters
            if is_remote is not None:
                params["is_remote"] = is_remote

            if job_type:
                params["job_type"] = job_type

            if "google" in sites:
                params["google_search_term"] = f"{search_term} jobs near {location}"

            # Execute scraping
            jobs_df = scrape_jobs(**params)

            # Convert to list of dicts
            jobs_list = []
            for _, row in jobs_df.iterrows():
                job = {
                    "title": str(row.get("title", "")),
                    "company": str(row.get("company", "")),
                    "location": str(row.get("location", "")),
                    "site": str(row.get("site", "")),
                    "job_url": str(row.get("job_url", "")),
                    "date_posted": str(row.get("date_posted", "")) if row.get("date_posted") else "",
                    "description": str(row.get("description", ""))[:500] if row.get("description") else "",
                }
                jobs_list.append(job)

            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "success": True,
                "count": len(jobs_list),
                "jobs": jobs_list
            }
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            error_response = {
                "success": False,
                "error": str(e)
            }
            self.wfile.write(json.dumps(error_response).encode())

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
