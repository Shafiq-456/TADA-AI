"""
Capture Dashboard Previews with Playwright
"""
import asyncio
import json
import time
import os
from pathlib import Path
import requests
from playwright.async_api import async_playwright

API_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"
ARTIFACTS_DIR = "/Users/shafiq/.gemini/antigravity/brain/86f6c732-78af-44f5-9780-ed2dc70bf8a6"

async def main():
    session = requests.Session()
    email = "preview.user@tadaai.app"
    password = "previewpassword"
    
    # 1. Register/Login
    print("Obtaining JWT session...")
    r = session.post(f"{API_URL}/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Preview Administrator"
    })
    
    if r.status_code != 200:
        # Try login
        r = session.post(f"{API_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
    assert r.status_code == 200, f"Failed auth: {r.text}"
    auth_data = r.json()
    token = auth_data["access_token"]
    user_profile = auth_data["user"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    print("Logged in successfully!")

    # 2. Check if a dataset exists, otherwise create and upload
    r = session.get(f"{API_URL}/api/datasets/")
    datasets = r.json().get("datasets", [])
    
    dataset_id = ""
    if datasets:
        dataset_id = datasets[0]["id"]
        print(f"Using existing dataset ID: {dataset_id}")
    else:
        print("Uploading new preview dataset...")
        dummy_csv = (
            "Date,Region,Product,Sales,Quantity,Price\n"
            "2026-01-01,North,Widget,100,2,50\n"
            "2026-01-02,South,Gadget,150,3,50\n"
            "2026-01-03,East,Widget,120,2,60\n"
            "2026-01-04,West,Gadget,180,3,60\n"
            "2026-01-05,North,Widget,110,2,55\n"
            "2026-01-06,South,Gadget,160,3,53.3\n"
            "2026-01-07,East,Widget,130,2,65\n"
            "2026-01-08,West,Gadget,190,3,63.3\n"
            "2026-01-09,North,Widget,115,2,57.5\n"
            "2026-01-10,South,Gadget,170,3,56.6\n"
            "2026-01-11,East,Widget,140,2,70\n"
            "2026-01-12,West,Gadget,200,3,66.6\n"
        )
        csv_path = "preview_data.csv"
        with open(csv_path, "w") as f:
            f.write(dummy_csv)
            
        with open(csv_path, "rb") as f:
            r = session.post(f"{API_URL}/api/datasets/upload", files={"file": f})
        os.remove(csv_path)
        dataset_id = r.json()["id"]
        print(f"Uploaded dataset. ID: {dataset_id}")
        
        # Wait for processing
        for _ in range(10):
            r = session.get(f"{API_URL}/api/datasets/{dataset_id}")
            if r.json()["status"] == "ready":
                print("Dataset is ready!")
                break
            await asyncio.sleep(1)

    # 3. Trigger Analytics and SWOT so pages are populated
    session.post(f"{API_URL}/api/analytics/{dataset_id}/run")
    session.post(f"{API_URL}/api/insights/{dataset_id}/generate")

    # 4. Launch Playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create a browser context with custom viewport
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()
        
        # Go to landing/login first to register domain
        await page.goto(FRONTEND_URL)
        await page.wait_for_timeout(1000)
        
        # Inject LocalStorage session
        print("Injecting authentication session...")
        await page.evaluate(f"""
            localStorage.setItem('tada_jwt_token', '{token}');
            localStorage.setItem('tada_user_profile', JSON.stringify({json.dumps(user_profile)}));
            localStorage.setItem('tada-ui-storage', JSON.stringify({{
                "state": {{
                    "sidebarCollapsed": false,
                    "theme": "dark",
                    "activeDatasetId": "{dataset_id}"
                }},
                "version": 0
            }}));
        """)
        
        # Capture Dashboard
        print("Capturing Dashboard page...")
        await page.goto(f"{FRONTEND_URL}/dashboard")
        await page.wait_for_timeout(4000) # wait for animations/Recharts
        await page.screenshot(path=f"{ARTIFACTS_DIR}/dashboard_preview.png")
        print("Saved dashboard_preview.png")
        
        # Capture Auto Dashboard
        print("Capturing Auto Dashboard page...")
        await page.goto(f"{FRONTEND_URL}/auto-dashboard")
        await page.wait_for_timeout(4000)
        await page.screenshot(path=f"{ARTIFACTS_DIR}/auto_dashboard_preview.png")
        print("Saved auto_dashboard_preview.png")
        
        # Capture Executive Insights
        print("Capturing Executive Insights page...")
        await page.goto(f"{FRONTEND_URL}/insights")
        await page.wait_for_timeout(4000)
        await page.screenshot(path=f"{ARTIFACTS_DIR}/executive_insights_preview.png")
        print("Saved executive_insights_preview.png")
        
        # Capture Forecasting page
        print("Capturing Forecasting page...")
        await page.goto(f"{FRONTEND_URL}/forecasting")
        await page.wait_for_timeout(2000)
        # Click forecast model & target columns are preselected
        run_btn = page.locator("#run-forecast-btn")
        if await run_btn.is_visible():
            await run_btn.click()
            print("Modeling forecast...")
            await page.wait_for_timeout(6000) # wait for forecast to run
        await page.screenshot(path=f"{ARTIFACTS_DIR}/forecasting_preview.png")
        print("Saved forecasting_preview.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
