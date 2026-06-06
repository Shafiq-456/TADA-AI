"""
End-to-End Integration Verification Test Script for TADA AI APIs
"""
import os
import time
import requests

API_URL = "http://127.0.0.1:8000"

def run_tests():
    print("="*60)
    print("STARTING TADA AI ARCHITECTURE INTEGRATION TESTS")
    print("="*60)

    # 1. Health check
    print("\n[1/10] Verifying Health Check...")
    r = requests.get(f"{API_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("-> Status: Healthy!")

    # 1.5. Authenticate via Register/Login
    print("\n[1.5/10] Obtaining Auth Token...")
    test_email = f"test.user.{int(time.time())}@tadaai.app"
    login_payload = {
        "email": test_email,
        "password": "testpassword"
    }
    register_payload = {
        "email": test_email,
        "password": "testpassword",
        "full_name": "Test User"
    }
    
    session = requests.Session()
    
    # Try registration first
    r = session.post(f"{API_URL}/api/auth/register", json=register_payload)
    if r.status_code == 400 and "already exists" in r.text:
        # User already exists, try logging in
        print("-> User already exists, logging in instead...")
        r = session.post(f"{API_URL}/api/auth/login", json=login_payload)
        
    assert r.status_code == 200, f"Authentication failed: {r.text}"
    token_data = r.json()
    access_token = token_data["access_token"]
    session.headers.update({"Authorization": f"Bearer {access_token}"})
    print("-> Logged in successfully! JWT token retrieved.")

    # 2. Get me (Auth syncing verification)
    print("\n[2/10] Verifying User Auth Synchronization...")
    r = session.get(f"{API_URL}/api/users/me")
    assert r.status_code == 200, f"User info failed: {r.text}"
    user_data = r.json()
    print(f"-> User logged in: {user_data['full_name']} ({user_data['email']})")
    print(f"-> Initial Stats: {user_data['stats']}")

    # 3. Create a dummy CSV dataset
    print("\n[3/10] Creating sample business sales CSV dataset...")
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
    csv_file = "test_sales_data.csv"
    with open(csv_file, "w") as f:
        f.write(dummy_csv)
    print(f"-> Created {csv_file}")

    # 4. Upload dataset
    print("\n[4/10] Uploading dataset to FastAPI server...")
    with open(csv_file, "rb") as f:
        r = session.post(f"{API_URL}/api/datasets/upload", files={"file": f})
    assert r.status_code == 200, f"Upload failed: {r.text}"
    upload_res = r.json()
    dataset_id = upload_res["id"]
    print(f"-> Uploaded successfully! Dataset ID: {dataset_id}")

    # 5. Poll for Ready Status
    print("\n[5/10] Polling backend processing engine status...")
    status = "processing"
    for _ in range(10):
        r = session.get(f"{API_URL}/api/datasets/{dataset_id}")
        assert r.status_code == 200, f"Fetch failed: {r.text}"
        meta = r.json()
        status = meta["status"]
        if status == "ready":
            print(f"-> Dataset Ready! Quality Score: {meta['quality_score']}%")
            break
        print("-> Processing dataset profiling...")
        time.sleep(1)
    assert status == "ready", "Dataset processing timeout"

    # 5.5. Clean Dataset
    print("\n[5.5/10] Verifying Data Cleaning Engine...")
    r = session.post(f"{API_URL}/api/datasets/{dataset_id}/clean")
    assert r.status_code == 200, f"Clean failed: {r.text}"
    clean_res = r.json()
    print(f"-> Quality score before: {clean_res['original_quality']}%, after: {clean_res['new_quality']}%")
    print(f"-> Issues fixed details: {clean_res['issues_fixed']}")

    # 6. Run Analytics
    print("\n[6/10] Running Pandas descriptive statistics & correlation matrix...")
    r = session.post(f"{API_URL}/api/analytics/{dataset_id}/run")
    assert r.status_code == 200, f"Analytics failed: {r.text}"
    analytics_res = r.json()
    print(f"-> Descriptive Stats calculated for: {analytics_res['numeric_columns']}")
    print(f"-> Correlation matrix generated successfully!")

    # 7. Run Visualizations Engine
    print("\n[7/10] Verifying Visualizations chart data extraction...")
    r = session.get(f"{API_URL}/api/visualizations/{dataset_id}")
    assert r.status_code == 200, f"Visualizations failed: {r.text}"
    viz_res = r.json()
    print(f"-> Available charts: {list(viz_res['charts'].keys())}")
    print(f"-> Bar Chart Title: {viz_res['charts']['bar']['title']}")
    print(f"-> Histogram Title: {viz_res['charts']['histogram']['title']}")

    # 8. Run ML Forecast
    print("\n[8/10] Running ML time series forecast (Model: Random Forest)...")
    payload = {
        "dataset_id": dataset_id,
        "target_column": "Sales",
        "horizon_days": 30,
        "model_type": "rf"
    }
    r = session.post(f"{API_URL}/api/forecasts/run", json=payload)
    assert r.status_code == 200, f"Forecast failed: {r.text}"
    forecast_res = r.json()
    print(f"-> Model R2 Score: {forecast_res['r2_score']}")
    print(f"-> Forecast points count: {len(forecast_res['forecast_points'])}")
    print(f"-> Forecast summary: {forecast_res['summary']}")

    # 9. Generate SWOT Insights
    print("\n[9/10] Running SWOT insights generation...")
    r = session.post(f"{API_URL}/api/insights/{dataset_id}/generate")
    assert r.status_code == 200, f"SWOT insights failed: {r.text}"
    insights_res = r.json()
    print(f"-> Executive summary: {insights_res['executive_summary']}")
    print(f"-> SWOT Strengths: {insights_res['swot']['strengths']}")

    # 9.5. AI Analyst Chat
    print("\n[9.5/10] Verifying AI Analyst chat interface...")
    payload_chat = {
        "message": "Analyze the sales numbers for this dataset",
        "dataset_id": dataset_id,
        "history": []
    }
    r = session.post(f"{API_URL}/api/ai/chat", json=payload_chat)
    assert r.status_code == 200, f"AI Chat failed: {r.text}"
    chat_res = r.json()
    print(f"-> AI Analyst response snippet: {chat_res['response'][:120].strip()}...")

    # 10. Generate PDF and Excel reports
    print("\n[10/10] Generating downloadable reports (PDF and Excel)...")
    
    # PDF
    payload_pdf = {
        "dataset_id": dataset_id,
        "title": "Quarterly Sales Audit",
        "format": "PDF"
    }
    r = session.post(f"{API_URL}/api/reports/generate", json=payload_pdf)
    assert r.status_code == 200, f"PDF report generation failed: {r.text}"
    pdf_res = r.json()
    print(f"-> PDF Report created at URL: {pdf_res['download_url']}")
    
    # Excel
    payload_excel = {
        "dataset_id": dataset_id,
        "title": "Quarterly Sales Audit Sheets",
        "format": "Excel"
    }
    r = session.post(f"{API_URL}/api/reports/generate", json=payload_excel)
    assert r.status_code == 200, f"Excel report generation failed: {r.text}"
    excel_res = r.json()
    print(f"-> Excel Report created at URL: {excel_res['download_url']}")

    # Cleanup local temp file
    if os.path.exists(csv_file):
        os.remove(csv_file)
        
    print("\n" + "="*60)
    print("ALL API INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀")
    print("="*60)

if __name__ == "__main__":
    run_tests()
