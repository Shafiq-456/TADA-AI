"""
Verification Script for New BI Endpoints
"""
import requests
import json
import time

API_URL = "http://127.0.0.1:8000"

def run_tests():
    print("="*60)
    print("STARTING TADA AI NEW BI ENDPOINTS INTEGRATION TESTS")
    print("="*60)

    # 1. Authenticate via Register/Login
    print("\n[1] Obtaining Auth Token...")
    test_email = f"test.user.bi.{int(time.time())}@tadaai.app"
    register_payload = {
        "email": test_email,
        "password": "testpassword",
        "full_name": "BI Tester"
    }
    
    session = requests.Session()
    r = session.post(f"{API_URL}/api/auth/register", json=register_payload)
    assert r.status_code == 200, f"Authentication failed: {r.text}"
    token_data = r.json()
    access_token = token_data["access_token"]
    session.headers.update({"Authorization": f"Bearer {access_token}"})
    print("-> Logged in successfully!")

    # 2. Create and upload a dummy dataset
    print("\n[2] Uploading sample sales dataset...")
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
    csv_file = "test_bi_data.csv"
    with open(csv_file, "w") as f:
        f.write(dummy_csv)
        
    with open(csv_file, "rb") as f:
        r = session.post(f"{API_URL}/api/datasets/upload", files={"file": f})
    assert r.status_code == 200, f"Upload failed: {r.text}"
    dataset_id = r.json()["id"]
    print(f"-> Uploaded successfully! Dataset ID: {dataset_id}")

    # Wait for dataset processing
    print("\n[3] Waiting for dataset to become ready...")
    for _ in range(10):
        r = session.get(f"{API_URL}/api/datasets/{dataset_id}")
        meta = r.json()
        if meta["status"] == "ready":
            print(f"-> Dataset Ready! Quality Score: {meta['quality_score']}%")
            break
        time.sleep(1)

    # 4. GET /api/analytics/{id}/kpi
    print("\n[4] Calling GET /api/analytics/{id}/kpi...")
    r = session.get(f"{API_URL}/api/analytics/{dataset_id}/kpi")
    print(f"-> Status: {r.status_code}")
    print(f"-> Content Type: {r.headers.get('Content-Type')}")
    print(f"-> Raw Text: '{r.text}'")
    assert r.status_code == 200, f"KPI failed: {r.text}"
    kpi_res = r.json()
    print(f"-> KPI Count: {kpi_res['count']}")
    print(f"-> Sample KPI: {json.dumps(kpi_res['kpis'][0], indent=2) if kpi_res['kpis'] else 'None'}")

    # 5. GET /api/analytics/{id}/anomalies
    print("\n[5] Calling GET /api/analytics/{id}/anomalies...")
    r = session.get(f"{API_URL}/api/analytics/{dataset_id}/anomalies")
    assert r.status_code == 200, f"Anomalies failed: {r.text}"
    anom_res = r.json()
    print(f"-> Anomalies Count: {anom_res['anomaly_count']}")
    if anom_res['anomalies']:
        print(f"-> Sample Anomaly: {json.dumps(anom_res['anomalies'][0], indent=2)}")

    # 6. GET /api/analytics/{id}/smart-insights
    print("\n[6] Calling GET /api/analytics/{id}/smart-insights...")
    r = session.get(f"{API_URL}/api/analytics/{dataset_id}/smart-insights")
    assert r.status_code == 200, f"Smart Insights failed: {r.text}"
    insights_res = r.json()
    print(f"-> Findings Count: {len(insights_res['top_findings'])}")
    print(f"-> Risks Count: {len(insights_res['risks'])}")
    print(f"-> Opportunities Count: {len(insights_res['opportunities'])}")
    print(f"-> Summary: {insights_res['summary']}")

    # 7. GET /api/datasets/{id}/auto-dashboard
    print("\n[7] Calling GET /api/datasets/{id}/auto-dashboard...")
    r = session.get(f"{API_URL}/api/datasets/{dataset_id}/auto-dashboard")
    assert r.status_code == 200, f"Auto Dashboard failed: {r.text}"
    dash_res = r.json()
    print(f"-> Charts Count: {len(dash_res['charts'])}")
    print(f"-> KPIs Count: {len(dash_res['kpis'])}")
    print(f"-> Suggested Analyses: {dash_res['suggested_analysis']}")
    if dash_res['charts']:
        print(f"-> First Chart Info: Title='{dash_res['charts'][0]['title']}', Type='{dash_res['charts'][0]['type']}'")

    # 8. POST /api/insights/{id}/recommendations
    # Wait, let's verify if the route is POST or GET. Let's look at the executive_insights.py file.
    # In executive_insights.py, it's defined as `@router.post("/{dataset_id}/recommendations")` but the prefix is `/api/insights`
    # Let's verify the prefix. In main.py, how is executive_insights.py registered?
    # Let's write the test first using POST /api/insights/{id}/recommendations
    print("\n[8] Calling POST /api/insights/{id}/recommendations...")
    r = session.post(f"{API_URL}/api/insights/{dataset_id}/recommendations")
    assert r.status_code == 200, f"Recommendations failed: {r.text}"
    recs_res = r.json()
    print(f"-> Recommendations Count: {len(recs_res)}")
    if recs_res:
        print(f"-> First Recommendation: {json.dumps(recs_res[0], indent=2)}")

    # 9. GET /api/insights/{id}/export-pdf
    print("\n[9] Calling GET /api/insights/{id}/export-pdf...")
    r = session.get(f"{API_URL}/api/insights/{dataset_id}/export-pdf")
    assert r.status_code == 200, f"Export PDF failed: {r.text}"
    pdf_res = r.json()
    print(f"-> Download URL: {pdf_res['download_url']}")
    print(f"-> File Path: {pdf_res['file_path']}")
    print(f"-> File Size: {pdf_res['file_size_bytes']} bytes")

    # Clean up local file
    import os
    if os.path.exists(csv_file):
        os.remove(csv_file)
        
    print("\n" + "="*60)
    print("ALL NEW BI ENDPOINTS WORK PERFECTLY! 🚀")
    print("="*60)

if __name__ == "__main__":
    run_tests()
