from urllib.parse import urlsplit


def parse_cors_origins(value: str) -> list[str]:
    """Accept explicit browser origins only; credentialed CORS cannot use '*'."""
    origins = []
    for item in value.split(","):
        origin = item.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlsplit(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
            raise ValueError(f"Invalid CORS_ORIGINS origin: {origin!r}")
        if origin not in origins:
            origins.append(origin)
    return origins
