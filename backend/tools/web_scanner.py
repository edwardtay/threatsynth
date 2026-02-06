"""Python-based web security checks: headers, CORS, cookies, HTTP methods."""

import httpx


async def check_security_headers(url: str) -> list[dict]:
    """Check for missing security headers."""
    issues = []
    try:
        async with httpx.AsyncClient(verify=False, timeout=10) as client:
            resp = await client.get(url)
            headers = {k.lower(): v for k, v in resp.headers.items()}

            required_headers = {
                "x-content-type-options": {
                    "title": "Missing X-Content-Type-Options header",
                    "description": "X-Content-Type-Options header is not set. This allows browsers to MIME-sniff content types.",
                    "severity": "low",
                    "cwe_id": "CWE-16",
                    "remediation": "Add 'X-Content-Type-Options: nosniff' header.",
                },
                "x-frame-options": {
                    "title": "Missing X-Frame-Options header",
                    "description": "X-Frame-Options is not set. The application may be vulnerable to clickjacking.",
                    "severity": "medium",
                    "cwe_id": "CWE-1021",
                    "remediation": "Add 'X-Frame-Options: DENY' or 'SAMEORIGIN' header.",
                },
                "strict-transport-security": {
                    "title": "Missing Strict-Transport-Security header",
                    "description": "HSTS is not enabled. Users may be vulnerable to protocol downgrade attacks.",
                    "severity": "medium",
                    "cwe_id": "CWE-319",
                    "remediation": "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains' header.",
                },
                "content-security-policy": {
                    "title": "Missing Content-Security-Policy header",
                    "description": "CSP is not configured. This increases the risk of XSS attacks.",
                    "severity": "medium",
                    "cwe_id": "CWE-79",
                    "remediation": "Implement a Content-Security-Policy header with appropriate directives.",
                },
                "x-xss-protection": {
                    "title": "Missing X-XSS-Protection header",
                    "description": "X-XSS-Protection is not set. Browser XSS filter is not enabled.",
                    "severity": "low",
                    "cwe_id": "CWE-79",
                    "remediation": "Add 'X-XSS-Protection: 1; mode=block' header.",
                },
            }

            for header_name, info in required_headers.items():
                if header_name not in headers:
                    issues.append({
                        "type": "misconfig",
                        "evidence": f"Response headers: {dict(list(resp.headers.items())[:10])}",
                        **info,
                    })

            # Check for server version disclosure
            server = headers.get("server", "")
            if server and any(v in server.lower() for v in ["apache/", "nginx/", "iis/"]):
                issues.append({
                    "type": "info_disclosure",
                    "title": f"Server version disclosed: {server}",
                    "description": f"The server header reveals version information: {server}",
                    "severity": "low",
                    "evidence": f"Server: {server}",
                    "cwe_id": "CWE-200",
                    "remediation": "Remove or obfuscate the Server header to prevent version disclosure.",
                })

    except Exception:
        pass
    return issues


async def check_cors(url: str) -> list[dict]:
    """Check for CORS misconfiguration."""
    issues = []
    try:
        async with httpx.AsyncClient(verify=False, timeout=10) as client:
            resp = await client.get(url, headers={"Origin": "https://evil.com"})
            acao = resp.headers.get("Access-Control-Allow-Origin", "")
            if acao == "*" or "evil.com" in acao:
                issues.append({
                    "type": "misconfig",
                    "title": "CORS misconfiguration - wildcard or reflected origin",
                    "description": f"Access-Control-Allow-Origin is set to '{acao}'. This allows any origin to make authenticated requests.",
                    "severity": "medium",
                    "evidence": f"Access-Control-Allow-Origin: {acao}",
                    "cwe_id": "CWE-942",
                    "remediation": "Restrict Access-Control-Allow-Origin to specific trusted domains.",
                })
    except Exception:
        pass
    return issues


async def check_http_methods(url: str) -> list[dict]:
    """Check for dangerous HTTP methods."""
    issues = []
    try:
        async with httpx.AsyncClient(verify=False, timeout=10) as client:
            resp = await client.options(url)
            allow = resp.headers.get("Allow", "")
            dangerous = {"PUT", "DELETE", "TRACE", "CONNECT"}
            found = [m.strip() for m in allow.split(",") if m.strip().upper() in dangerous]
            if found:
                issues.append({
                    "type": "misconfig",
                    "title": f"Dangerous HTTP methods enabled: {', '.join(found)}",
                    "description": f"The server allows potentially dangerous HTTP methods: {', '.join(found)}",
                    "severity": "medium",
                    "evidence": f"Allow: {allow}",
                    "cwe_id": "CWE-749",
                    "remediation": "Disable unused HTTP methods. Only allow GET, POST, and HEAD as needed.",
                })
    except Exception:
        pass
    return issues


async def check_cookies(url: str) -> list[dict]:
    """Check for insecure cookie settings."""
    issues = []
    try:
        async with httpx.AsyncClient(verify=False, timeout=10) as client:
            resp = await client.get(url)
            set_cookies = resp.headers.get_list("set-cookie") if hasattr(resp.headers, "get_list") else []
            if not set_cookies:
                # Try alternate approach
                set_cookies = [v for k, v in resp.headers.multi_items() if k.lower() == "set-cookie"]

            for cookie_str in set_cookies:
                cookie_lower = cookie_str.lower()
                name = cookie_str.split("=")[0].strip()

                if "httponly" not in cookie_lower:
                    issues.append({
                        "type": "misconfig",
                        "title": f"Cookie '{name}' missing HttpOnly flag",
                        "description": f"Cookie '{name}' does not have the HttpOnly flag. It can be accessed via JavaScript (XSS risk).",
                        "severity": "medium",
                        "evidence": cookie_str,
                        "cwe_id": "CWE-1004",
                        "remediation": "Set the HttpOnly flag on all sensitive cookies.",
                    })

                if "secure" not in cookie_lower:
                    issues.append({
                        "type": "misconfig",
                        "title": f"Cookie '{name}' missing Secure flag",
                        "description": f"Cookie '{name}' does not have the Secure flag. It may be sent over unencrypted connections.",
                        "severity": "low",
                        "evidence": cookie_str,
                        "cwe_id": "CWE-614",
                        "remediation": "Set the Secure flag on all cookies.",
                    })
    except Exception:
        pass
    return issues
