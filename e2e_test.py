"""End-to-end test for ThreatSynth AI."""
import httpx
import time
import sys

BASE = "http://localhost:8000"

def main():
    c = httpx.Client(base_url=BASE, timeout=120)

    # Step 1: Health check
    print("=" * 60)
    print("STEP 1: Health Check")
    r = c.get("/api/health")
    print(f"  Status: {r.json()['status']}")
    assert r.status_code == 200

    # Step 2: Import infrastructure stack
    print("\n" + "=" * 60)
    print("STEP 2: Import Infrastructure Stack (7 assets)")
    yaml_content = """assets:
  - name: web-server
    type: service
    vendor: apache
    product: httpd
    version: "2.4.49"
    port: 443
  - name: app-server
    type: service
    vendor: nginx
    product: nginx
    version: "1.24.0"
    port: 80
  - name: database
    type: service
    vendor: postgresql
    product: postgresql
    version: "14.2"
    port: 5432
  - name: cache-server
    type: service
    vendor: redis
    product: redis
    version: "6.2.6"
    port: 6379
  - name: ssh-gateway
    type: service
    vendor: openssh
    product: openssh
    version: "8.9"
    port: 22
  - name: main-os
    type: os
    vendor: canonical
    product: ubuntu
    version: "22.04"
  - name: log4j-lib
    type: library
    vendor: apache
    product: log4j
    version: "2.14.1"
"""
    r = c.post("/api/assets/import-yaml", json={"yaml_content": yaml_content})
    print(f"  Response: {r.status_code}")
    data = r.json()
    print(f"  Message: {data.get('message', 'N/A')}")
    for a in data.get("assets", []):
        print(f"    - {a['name']}: {a['vendor']} {a['product']} {a['version']} (port {a.get('port', 'N/A')})")

    # Step 3: Verify assets
    print("\n" + "=" * 60)
    print("STEP 3: Verify Assets")
    r = c.get("/api/assets/")
    assets = r.json()
    print(f"  Total assets in DB: {len(assets)}")

    # Step 4: Ingest threats from all sources
    print("\n" + "=" * 60)
    print("STEP 4: Ingest Threats (all 6 sources)")
    print("  This may take a moment...")
    r = c.post("/api/threats/ingest")
    data = r.json()
    print(f"  Response: {r.status_code}")
    print(f"  Raw response keys: {list(data.keys()) if isinstance(data, dict) else 'list'}")
    if isinstance(data, dict):
        if "results" in data:
            results = data["results"]
            if isinstance(results, dict):
                for source, info in results.items():
                    count = info.get("new", info.get("count", "?"))
                    print(f"    - {source}: {count} new threats")
            elif isinstance(results, list):
                for item in results:
                    print(f"    - {item.get('source', '?')}: {item.get('new', item.get('count', '?'))} new threats")
        print(f"  Total new: {data.get('total_new', data.get('total', 'N/A'))}")
    else:
        print(f"  Response is a list with {len(data)} items")

    # Step 5: Check threats
    print("\n" + "=" * 60)
    print("STEP 5: Verify Threats")
    r = c.get("/api/threats/")
    resp = r.json()
    threats = resp.get("threats", resp) if isinstance(resp, dict) else resp
    print(f"  Total threats in DB: {len(threats)}")
    if threats:
        critical = sum(1 for t in threats if t.get("severity") == "critical")
        high = sum(1 for t in threats if t.get("severity") == "high")
        exploited = sum(1 for t in threats if t.get("actively_exploited"))
        print(f"  Critical: {critical} | High: {high} | Actively Exploited: {exploited}")
        print(f"  Sample threats:")
        for t in threats[:5]:
            print(f"    - [{t.get('severity','?').upper()}] {t.get('source_id','?')}: {t.get('title','?')[:60]}")

    # Step 6: Generate AI briefings
    print("\n" + "=" * 60)
    print("STEP 6: Generate AI Briefings (LLM correlation + synthesis)")
    print("  Correlating threats with your stack and generating briefings...")
    print("  (This calls Ollama/mistral for each match - may take a minute)")
    r = c.post("/api/briefings/generate")
    data = r.json()
    print(f"  Response: {r.status_code}")
    print(f"  Message: {data.get('message', 'N/A')}")
    print(f"  Briefings generated: {data.get('total_briefings', data.get('briefings_generated', 'N/A'))}")

    # Step 7: View briefings
    print("\n" + "=" * 60)
    print("STEP 7: View Generated Briefings")
    r = c.get("/api/briefings/")
    resp = r.json()
    briefings = resp.get("briefings", resp) if isinstance(resp, dict) else resp
    print(f"  Total briefings: {len(briefings)}")
    for b in briefings[:5]:
        print(f"\n  --- Priority: {b.get('priority_score', 0):.1f} ---")
        print(f"  Threat ID: {b.get('threat_id', 'N/A')}")
        print(f"  Asset ID: {b.get('asset_id', 'N/A')}")
        print(f"  Summary: {b.get('summary', 'N/A')[:150]}...")
        print(f"  Remediation: {b.get('remediation', 'N/A')[:150]}...")
        print(f"  Business Impact: {b.get('business_impact', 'N/A')[:150]}...")
        print(f"  Status: {b.get('status', 'N/A')}")

    # Step 8: Dashboard stats
    print("\n" + "=" * 60)
    print("STEP 8: Dashboard Stats")
    r = c.get("/api/dashboard/stats")
    stats = r.json()
    for k, v in stats.items():
        if isinstance(v, dict):
            print(f"  {k}:")
            for kk, vv in v.items():
                print(f"    {kk}: {vv}")
        else:
            print(f"  {k}: {v}")

    print("\n" + "=" * 60)
    print("END-TO-END TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
