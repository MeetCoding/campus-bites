import re
from enum import StrEnum


class AppRole(StrEnum):
    """Mirrors the `public.app_role` Postgres enum."""

    STUDENT = "student"
    MESS_SECRETARY = "mess_secretary"
    BHAWAN_SECRETARY = "bhawan_secretary"
    MESS_AUTHORITY = "mess_authority"
    ADOSW = "adosw"
    VENDOR = "vendor"
    ADMIN = "admin"


# Roles that must be scoped to a Bhawan (DB check constraint role_assignments_scope).
BHAWAN_SCOPED_ROLES = frozenset(
    {AppRole.MESS_SECRETARY, AppRole.BHAWAN_SECRETARY, AppRole.MESS_AUTHORITY}
)

# Same rule as the before_user_created hook in supabase/migrations/003_auth.sql.
IITR_EMAIL_RE = re.compile(r"^[^@\s]+@([a-z0-9-]+\.)?iitr\.ac\.in$")
