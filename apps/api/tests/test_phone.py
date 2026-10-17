import pytest

from app.services.phone import normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "9510709195",
        "09510709195",
        "919510709195",
        "+919510709195",
        "+91 95107 09195",
        "+91-95107-09195",
        "(+91) 9510709195",
        "  9510709195  ",
    ],
)
def test_indian_formats_normalise_to_e164(raw: str) -> None:
    assert normalize_phone(raw) == "+919510709195"


def test_foreign_e164_is_kept() -> None:
    assert normalize_phone("+14155550123") == "+14155550123"


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "12345",
        "951070919",  # 9 digits
        "5510709195",  # Indian mobiles start with 6-9
        "+91 12345 67890",
        "95107O9195",  # letter O
        "+0123456789",
        "+9195107091951234567",  # too long
    ],
)
def test_invalid_numbers_raise(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_phone(raw)
