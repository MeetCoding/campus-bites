import re

_E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")
_INDIAN_MOBILE_RE = re.compile(r"^\+91[6-9]\d{9}$")


def normalize_phone(raw: str) -> str:
    """Normalise a phone number to E.164, defaulting to India (+91).

    Accepts "9510709195", "09510709195", "919510709195", "+91 95107-09195", "(+91) 9510709195".
    Raises ValueError for anything that is not a valid number (Indian numbers must be mobiles).
    """
    cleaned = re.sub(r"[\s\-().]", "", raw.strip())
    if cleaned.startswith("+"):
        candidate = "+" + cleaned[1:]
    elif not cleaned.isdigit():
        raise ValueError("Phone number may only contain digits, spaces, dashes and a leading +.")
    elif len(cleaned) == 10:
        candidate = "+91" + cleaned
    elif len(cleaned) == 11 and cleaned.startswith("0"):
        candidate = "+91" + cleaned[1:]
    elif len(cleaned) == 12 and cleaned.startswith("91"):
        candidate = "+" + cleaned
    else:
        raise ValueError("Enter a 10-digit Indian mobile number or a full +<country code> number.")

    if not _E164_RE.match(candidate):
        raise ValueError("Not a valid phone number.")
    if candidate.startswith("+91") and not _INDIAN_MOBILE_RE.match(candidate):
        raise ValueError("Indian numbers must be 10-digit mobiles starting with 6-9.")
    return candidate
