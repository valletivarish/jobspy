"""
Job Scraper Script - Called by Next.js API
"""
import json
import sys

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data) if input_data else {}
        
        sites = data.get('sites', ['linkedin', 'indeed', 'google'])
        search_term = data.get('search_term', 'software engineer')
        location = data.get('location', 'Hyderabad, India')
        country = data.get('country', 'India')
        job_type = data.get('job_type', '')
        hours_old = data.get('hours_old', 72)
        results_wanted = data.get('results_wanted', 50)
        is_remote = data.get('is_remote')

        from jobspy import scrape_jobs
        
        params = {
            "site_name": sites,
            "search_term": search_term,
            "location": location,
            "results_wanted": results_wanted,
            "hours_old": hours_old,
            "country_indeed": country,
            "linkedin_fetch_description": True,
        }
        
        if is_remote is not None:
            params["is_remote"] = is_remote
        
        if job_type:
            params["job_type"] = job_type
        
        if "google" in sites:
            params["google_search_term"] = f"{search_term} jobs near {location}"
        
        jobs_df = scrape_jobs(**params)
        
        jobs_list = []
        for _, row in jobs_df.iterrows():
            job = {
                "title": str(row.get("title", "")),
                "company": str(row.get("company", "")),
                "location": str(row.get("location", "")),
                "site": str(row.get("site", "")),
                "job_url": str(row.get("job_url", "")),
                "date_posted": str(row.get("date_posted", "")) if row.get("date_posted") else "",
            }
            jobs_list.append(job)
        
        print(json.dumps({"success": True, "count": len(jobs_list), "jobs": jobs_list}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
