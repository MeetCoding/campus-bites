import uuid
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.repositories.admin import DuplicateError, get_admin_repository
from app.schemas.admin import ProfileSummary, RoleAssignmentOut, WhitelistEntry
from app.schemas.common import AppRole
from tests.conftest import TokenFactory, bearer

ADMIN_ID = uuid.uuid4()
STUDENT_ID = uuid.uuid4()
RAJENDRA = uuid.uuid4()
NIGHT_CANTEEN = uuid.uuid4()


class InMemoryAdminRepository:
    """Mimics the DB constraints the Supabase repository relies on."""

    def __init__(self) -> None:
        self.outlets = {NIGHT_CANTEEN: "Rajendra Bhawan Night Canteen"}
        self.bhawans = {RAJENDRA: "Rajendra Bhawan"}
        self.profiles = {
            ADMIN_ID: ProfileSummary(id=ADMIN_ID, email="admin@iitr.ac.in"),
            STUDENT_ID: ProfileSummary(id=STUDENT_ID, email="secy@ece.iitr.ac.in"),
        }
        self.whitelist: dict[UUID, WhitelistEntry] = {}
        self.assignments: dict[UUID, RoleAssignmentOut] = {}
        self._assign(ADMIN_ID, AppRole.ADMIN, None)

    def _assign(self, user_id: UUID, role: AppRole, bhawan_id: UUID | None) -> RoleAssignmentOut:
        row = RoleAssignmentOut(
            id=uuid.uuid4(),
            user_id=user_id,
            email=self.profiles[user_id].email,
            role=role,
            bhawan_id=bhawan_id,
            bhawan_name=self.bhawans.get(bhawan_id) if bhawan_id else None,
            created_at=datetime.now(UTC),
        )
        self.assignments[row.id] = row
        return row

    async def user_has_role(self, user_id: UUID, role: AppRole) -> bool:
        return any(a.user_id == user_id and a.role is role for a in self.assignments.values())

    async def outlet_exists(self, outlet_id: UUID) -> bool:
        return outlet_id in self.outlets

    async def bhawan_exists(self, bhawan_id: UUID) -> bool:
        return bhawan_id in self.bhawans

    async def list_whitelist(self) -> list[WhitelistEntry]:
        return list(self.whitelist.values())

    async def add_whitelist(
        self, phone_e164: str, outlet_id: UUID, label: str | None, added_by: UUID
    ) -> WhitelistEntry:
        if any(
            e.phone_e164 == phone_e164 and e.outlet_id == outlet_id for e in self.whitelist.values()
        ):
            raise DuplicateError("whitelisted_vendors_phone_outlet_key")
        entry = WhitelistEntry(
            id=uuid.uuid4(),
            phone_e164=phone_e164,
            outlet_id=outlet_id,
            outlet_name=self.outlets[outlet_id],
            label=label,
            active=True,
            created_at=datetime.now(UTC),
        )
        self.whitelist[entry.id] = entry
        return entry

    async def delete_whitelist(self, entry_id: UUID) -> bool:
        return self.whitelist.pop(entry_id, None) is not None

    async def find_profile_by_email(self, email: str) -> ProfileSummary | None:
        return next((p for p in self.profiles.values() if p.email == email), None)

    async def list_role_assignments(self) -> list[RoleAssignmentOut]:
        return list(self.assignments.values())

    async def get_role_assignment(self, assignment_id: UUID) -> RoleAssignmentOut | None:
        return self.assignments.get(assignment_id)

    async def add_role_assignment(
        self, user_id: UUID, role: AppRole, bhawan_id: UUID | None, assigned_by: UUID
    ) -> RoleAssignmentOut:
        for a in self.assignments.values():
            if role is AppRole.MESS_SECRETARY and a.role is role and a.bhawan_id == bhawan_id:
                raise DuplicateError(
                    "duplicate key value violates unique constraint "
                    '"role_assignments_one_mess_secy"'
                )
            if a.user_id == user_id and a.role is role and a.bhawan_id == bhawan_id:
                raise DuplicateError("role_assignments_unique")
        return self._assign(user_id, role, bhawan_id)

    async def delete_role_assignment(self, assignment_id: UUID) -> bool:
        return self.assignments.pop(assignment_id, None) is not None


@pytest.fixture
def repo(app: FastAPI) -> InMemoryAdminRepository:
    repository = InMemoryAdminRepository()
    app.dependency_overrides[get_admin_repository] = lambda: repository
    return repository


@pytest.fixture
def admin_headers(make_token: TokenFactory) -> dict[str, str]:
    return bearer(make_token(sub=ADMIN_ID, roles=["student", "admin"], email="admin@iitr.ac.in"))


# ─── Access control ──────────────────────────────────────────────────────────
def test_students_cannot_use_admin_api(
    client: TestClient, repo: InMemoryAdminRepository, make_token: TokenFactory
) -> None:
    response = client.get("/v1/admin/vendor-whitelist", headers=bearer(make_token()))

    assert response.status_code == 403


def test_revoked_admin_is_rejected_despite_stale_jwt(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    repo.assignments.clear()  # admin role removed in DB; JWT still says admin

    response = client.get("/v1/admin/role-assignments", headers=admin_headers)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "FORBIDDEN"


# ─── Vendor whitelist ────────────────────────────────────────────────────────
def test_whitelist_add_normalises_phone(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/vendor-whitelist",
        headers=admin_headers,
        json={"phone": "095107 09195", "outlet_id": str(NIGHT_CANTEEN), "label": "Owner"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["phone_e164"] == "+919510709195"
    assert body["outlet_name"] == "Rajendra Bhawan Night Canteen"
    listed = client.get("/v1/admin/vendor-whitelist", headers=admin_headers).json()
    assert [e["id"] for e in listed] == [body["id"]]


def test_whitelist_duplicate_is_409(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    payload = {"phone": "9510709195", "outlet_id": str(NIGHT_CANTEEN)}
    client.post("/v1/admin/vendor-whitelist", headers=admin_headers, json=payload)

    response = client.post("/v1/admin/vendor-whitelist", headers=admin_headers, json=payload)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "WHITELIST_DUPLICATE"


def test_whitelist_unknown_outlet_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/vendor-whitelist",
        headers=admin_headers,
        json={"phone": "9510709195", "outlet_id": str(uuid.uuid4())},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "OUTLET_NOT_FOUND"


def test_whitelist_invalid_phone_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/vendor-whitelist",
        headers=admin_headers,
        json={"phone": "12345", "outlet_id": str(NIGHT_CANTEEN)},
    )

    assert response.status_code == 422


def test_whitelist_delete(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/admin/vendor-whitelist",
        headers=admin_headers,
        json={"phone": "9510709195", "outlet_id": str(NIGHT_CANTEEN)},
    ).json()

    first = client.delete(f"/v1/admin/vendor-whitelist/{created['id']}", headers=admin_headers)
    second = client.delete(f"/v1/admin/vendor-whitelist/{created['id']}", headers=admin_headers)

    assert first.status_code == 204
    assert second.status_code == 404
    assert second.json()["detail"]["code"] == "WHITELIST_NOT_FOUND"


# ─── Role assignments ────────────────────────────────────────────────────────
def test_assign_mess_secretary(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/role-assignments",
        headers=admin_headers,
        json={"email": "Secy@ECE.iitr.ac.in", "role": "mess_secretary", "bhawan_id": str(RAJENDRA)},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == str(STUDENT_ID)
    assert body["bhawan_name"] == "Rajendra Bhawan"


def test_assign_unknown_user_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/role-assignments",
        headers=admin_headers,
        json={"email": "nobody@iitr.ac.in", "role": "adosw"},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "USER_NOT_FOUND"


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "someone@gmail.com", "role": "adosw"},
        {"email": "secy@ece.iitr.ac.in", "role": "mess_secretary"},  # missing bhawan
        {"email": "secy@ece.iitr.ac.in", "role": "adosw", "bhawan_id": str(RAJENDRA)},
        {"email": "secy@ece.iitr.ac.in", "role": "vendor"},
        {"email": "secy@ece.iitr.ac.in", "role": "student"},
    ],
    ids=["non-iitr", "scoped-without-bhawan", "campus-wide-with-bhawan", "vendor", "student"],
)
def test_invalid_role_requests_are_422(
    client: TestClient,
    repo: InMemoryAdminRepository,
    admin_headers: dict[str, str],
    payload: dict[str, str],
) -> None:
    response = client.post("/v1/admin/role-assignments", headers=admin_headers, json=payload)

    assert response.status_code == 422


def test_unknown_bhawan_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/role-assignments",
        headers=admin_headers,
        json={
            "email": "secy@ece.iitr.ac.in",
            "role": "bhawan_secretary",
            "bhawan_id": str(uuid.uuid4()),
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "BHAWAN_NOT_FOUND"


def test_second_mess_secretary_for_bhawan_is_409(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    repo._assign(ADMIN_ID, AppRole.MESS_SECRETARY, RAJENDRA)

    response = client.post(
        "/v1/admin/role-assignments",
        headers=admin_headers,
        json={"email": "secy@ece.iitr.ac.in", "role": "mess_secretary", "bhawan_id": str(RAJENDRA)},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "MESS_SECRETARY_EXISTS"


def test_duplicate_role_is_409(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    payload = {"email": "secy@ece.iitr.ac.in", "role": "adosw"}
    client.post("/v1/admin/role-assignments", headers=admin_headers, json=payload)

    response = client.post("/v1/admin/role-assignments", headers=admin_headers, json=payload)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "ROLE_DUPLICATE"


def test_revoke_role(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/admin/role-assignments",
        headers=admin_headers,
        json={"email": "secy@ece.iitr.ac.in", "role": "adosw"},
    ).json()

    response = client.delete(f"/v1/admin/role-assignments/{created['id']}", headers=admin_headers)

    assert response.status_code == 204
    assert UUID(created["id"]) not in repo.assignments


def test_admin_cannot_remove_own_admin_role(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    own = next(a for a in repo.assignments.values() if a.user_id == ADMIN_ID)

    response = client.delete(f"/v1/admin/role-assignments/{own.id}", headers=admin_headers)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "CANNOT_REMOVE_OWN_ADMIN"


def test_revoke_unknown_assignment_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.delete(f"/v1/admin/role-assignments/{uuid.uuid4()}", headers=admin_headers)

    assert response.status_code == 404
