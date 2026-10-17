"""IST date/time helpers shared by services. Campus Bites runs on Asia/Kolkata (no DST)."""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def today_ist() -> date:
    return datetime.now(IST).date()


def format_time(value: time) -> str:
    """12-hour clock as printed on IIT Roorkee notices: '7:30 AM'."""
    hour = value.hour % 12 or 12
    return f"{hour}:{value.minute:02d} {'AM' if value.hour < 12 else 'PM'}"


def format_dates(start: date, end: date) -> str:
    """'on Sun 18 Oct', '18–21 Oct', '30 Oct – 2 Nov'."""
    if start == end:
        return f"on {start.strftime('%a')} {start.day} {start.strftime('%b')}"
    if start.month == end.month and start.year == end.year:
        return f"{start.day}–{end.day} {end.strftime('%b')}"
    return f"{start.day} {start.strftime('%b')} – {end.day} {end.strftime('%b')}"
