import uuid
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.repositories.admin import (
    DuplicateError,
    InUseError,
    PasscodeRejectedError,
    get_admin_repository,
)
from app.schemas.admin import (
    AdminOut,
    BhawanOut,
    EateryOut,
    ProfileSummary,
    RoleAssignmentOut,
    VendorAccount,
    WhitelistEntry,
)
from app.schemas.common import AppRole
from tests.conftest import TokenFactory, bearer

ADMIN_ID = uuid.uuid4()
STUDENT_ID = uuid.uuid4()
OWNER_ID = uuid.uuid4()
OWNER_EMAIL = "meet_s@ece.iitr.ac.in"
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
            OWNER_ID: ProfileSummary(id=OWNER_ID, email=OWNER_EMAIL),
        }
        self.whitelist: dict[UUID, WhitelistEntry] = {}
        self.assignments: dict[UUID, RoleAssignmentOut] = {}
        self._assign(ADMIN_ID, AppRole.ADMIN, None)
        self._assign(OWNER_ID, AppRole.ADMIN, None)
        self.invites: dict[str, datetime] = {}
        # Whitelisted phone → its auth user (absent = no account yet), and the passcodes set.
        self.vendor_users: dict[str, UUID] = {}
        self.passcodes: dict[str, str] = {}
        self.masters: set[str] = set()
        self.deleted_users: list[UUID] = []
        self.bhawan_rows = {
            RAJENDRA: BhawanOut(id=RAJENDRA, name="Rajendra Bhawan", slug="rajendra", sort_order=1)
        }
        self.inhabited: set[UUID] = {RAJENDRA}  # profiles / rebates / complaints reference it
        self.eateries: dict[UUID, EateryOut] = {}
        self.eateries_with_complaints: set[UUID] = set()

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

    async def create_bhawan(self, name: str, slug: str, sort_order: int | None) -> BhawanOut:
        if any(b.name == name or b.slug == slug for b in self.bhawan_rows.values()):
            raise DuplicateError("bhawans_name_key")
        order = sort_order if sort_order is not None else len(self.bhawan_rows) + 1
        row = BhawanOut(id=uuid.uuid4(), name=name, slug=slug, sort_order=order)
        self.bhawan_rows[row.id] = row
        return row

    async def update_bhawan(
        self, bhawan_id: UUID, name: str | None, sort_order: int | None
    ) -> BhawanOut | None:
        row = self.bhawan_rows.get(bhawan_id)
        if row is None:
            return None
        if name and any(b.name == name and b.id != bhawan_id for b in self.bhawan_rows.values()):
            raise DuplicateError("bhawans_name_key")
        updated = row.model_copy(
            update={
                "name": name or row.name,
                "sort_order": row.sort_order if sort_order is None else sort_order,
            }
        )
        self.bhawan_rows[bhawan_id] = updated
        return updated

    async def delete_bhawan(self, bhawan_id: UUID) -> bool:
        if bhawan_id in self.inhabited:
            raise InUseError("bhawan has residents")
        return self.bhawan_rows.pop(bhawan_id, None) is not None

    async def create_eatery(
        self,
        name: str,
        slug: str,
        location_tag: str | None,
        latitude: float | None = None,
        longitude: float | None = None,
        contact_phone: str | None = None,
    ) -> EateryOut:
        if any(e.slug == slug for e in self.eateries.values()):
            raise DuplicateError("outlets_slug_key")
        row = EateryOut(
            id=uuid.uuid4(),
            name=name,
            slug=slug,
            location_tag=location_tag,
            latitude=latitude,
            longitude=longitude,
            contact_phone=contact_phone,
        )
        self.eateries[row.id] = row
        return row

    async def update_eatery(self, eatery_id: UUID, changes: dict[str, Any]) -> EateryOut | None:
        row = self.eateries.get(eatery_id)
        if row is None:
            return None
        self.eateries[eatery_id] = row.model_copy(update=changes)
        return self.eateries[eatery_id]

    async def delete_eatery(self, eatery_id: UUID) -> bool:
        if eatery_id in self.eateries_with_complaints:
            raise InUseError("complaints_outlet_id_fkey")
        return self.eateries.pop(eatery_id, None) is not None

    async def owner_admin_email(self) -> str | None:
        return OWNER_EMAIL

    async def list_admins(self) -> list[AdminOut]:
        active = [
            AdminOut(
                email=a.email or "",
                status="active",
                is_owner=a.email == OWNER_EMAIL,
                created_at=a.created_at,
            )
            for a in self.assignments.values()
            if a.role is AppRole.ADMIN
        ]
        invited = [
            AdminOut(email=e, status="invited", created_at=at) for e, at in self.invites.items()
        ]
        return active + invited

    async def add_admin_invite(self, email: str, invited_by: UUID) -> AdminOut:
        if email in self.invites:
            raise DuplicateError("admin_invites_pkey")
        self.invites[email] = datetime.now(UTC)
        return AdminOut(email=email, status="invited", created_at=self.invites[email])

    async def delete_admin_invite(self, email: str) -> bool:
        return self.invites.pop(email, None) is not None

    async def delete_user_role(self, user_id: UUID, role: AppRole) -> bool:
        ids = [a.id for a in self.assignments.values() if a.user_id == user_id and a.role is role]
        for assignment_id in ids:
            del self.assignments[assignment_id]
        return bool(ids)

    async def list_vendor_accounts(self) -> list[tuple[VendorAccount, UUID | None]]:
        phones = sorted({e.phone_e164 for e in self.whitelist.values()})
        return [
            (
                VendorAccount(
                    phone_e164=phone,
                    has_account=phone in self.vendor_users,
                    is_master=phone in self.masters,
                ),
                self.vendor_users.get(phone),
            )
            for phone in phones
        ]

    async def set_vendor_passcode(
        self, phone_e164: str, user_id: UUID | None, passcode: str
    ) -> VendorAccount:
        if passcode == "135790":  # stands in for a stricter Supabase password policy
            raise PasscodeRejectedError("Password should contain letters")
        assert user_id == self.vendor_users.get(phone_e164)  # reuses the account
        self.vendor_users.setdefault(phone_e164, uuid.uuid4())
        self.passcodes[phone_e164] = passcode
        return VendorAccount(
            phone_e164=phone_e164, has_account=True, passcode_set_at=datetime.now(UTC)
        )

    async def get_whitelist_entry(self, entry_id: UUID) -> WhitelistEntry | None:
        return self.whitelist.get(entry_id)

    async def is_master_vendor(self, phone_e164: str) -> bool:
        return phone_e164 in self.masters

    async def make_master_vendor(self, phone_e164: str, label: str | None, added_by: UUID) -> int:
        self.masters.add(phone_e164)
        for outlet_id in self.outlets:
            if not any(
                e.phone_e164 == phone_e164 and e.outlet_id == outlet_id
                for e in self.whitelist.values()
            ):
                await self.add_whitelist(phone_e164, outlet_id, label, added_by)
        return len(self.outlets)

    async def remove_master_vendor(self, phone_e164: str) -> bool:
        if phone_e164 not in self.masters:
            return False
        self.masters.discard(phone_e164)
        return True

    async def delete_vendor(self, phone_e164: str) -> tuple[int, UUID | None]:
        self.masters.discard(phone_e164)
        ids = [i for i, e in self.whitelist.items() if e.phone_e164 == phone_e164]
        for entry_id in ids:
            del self.whitelist[entry_id]
        return len(ids), self.vendor_users.get(phone_e164)

    async def delete_auth_user(self, user_id: UUID) -> None:
        self.deleted_users.append(user_id)
        self.vendor_users = {p: u for p, u in self.vendor_users.items() if u != user_id}

    def is_admin(self, user_id: UUID) -> bool:
        return any(
            a.user_id == user_id and a.role is AppRole.ADMIN for a in self.assignments.values()
        )


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


# ─── Campus master list: Bhawans ─────────────────────────────────────────────
def test_students_cannot_manage_bhawans(
    client: TestClient, repo: InMemoryAdminRepository, make_token: TokenFactory
) -> None:
    response = client.post(
        "/v1/admin/bhawans", headers=bearer(make_token()), json={"name": "Kasturba Bhawan"}
    )

    assert response.status_code == 403
    assert len(repo.bhawan_rows) == 1


def test_create_bhawan_derives_seed_style_slug(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/bhawans", headers=admin_headers, json={"name": "  Kasturba Bhawan "}
    )

    assert response.status_code == 201
    body = response.json()
    assert (body["name"], body["slug"], body["sort_order"]) == ("Kasturba Bhawan", "kasturba", 2)


def test_duplicate_bhawan_is_409(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/bhawans", headers=admin_headers, json={"name": "Rajendra Bhawan"}
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "BHAWAN_DUPLICATE"


@pytest.mark.parametrize("name", ["AB", "!!! ???", "x" * 61], ids=["short", "symbols", "long"])
def test_invalid_bhawan_name_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str], name: str
) -> None:
    response = client.post("/v1/admin/bhawans", headers=admin_headers, json={"name": name})

    assert response.status_code == 422


def test_rename_and_reorder_bhawan(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"/v1/admin/bhawans/{RAJENDRA}",
        headers=admin_headers,
        json={"name": "Rajendra Bhawan (New Block)", "sort_order": 5},
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["slug"], body["sort_order"]) == (
        "Rajendra Bhawan (New Block)",
        "rajendra",
        5,
    )


def test_empty_bhawan_update_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.patch(f"/v1/admin/bhawans/{RAJENDRA}", headers=admin_headers, json={})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "NOTHING_TO_UPDATE"


def test_update_unknown_bhawan_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"/v1/admin/bhawans/{uuid.uuid4()}", headers=admin_headers, json={"sort_order": 3}
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "BHAWAN_NOT_FOUND"


def test_delete_empty_bhawan(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/admin/bhawans", headers=admin_headers, json={"name": "Typo Bhawan"}
    ).json()

    first = client.delete(f"/v1/admin/bhawans/{created['id']}", headers=admin_headers)
    second = client.delete(f"/v1/admin/bhawans/{created['id']}", headers=admin_headers)

    assert first.status_code == 204
    assert second.status_code == 404


def test_inhabited_bhawan_cannot_be_deleted(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.delete(f"/v1/admin/bhawans/{RAJENDRA}", headers=admin_headers)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "BHAWAN_IN_USE"
    assert RAJENDRA in repo.bhawan_rows


# ─── Campus master list: eateries ────────────────────────────────────────────
def test_create_eatery(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/eateries",
        headers=admin_headers,
        json={"name": "Nescafe Kiosk", "location_tag": "  "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "nescafe-kiosk"
    assert body["location_tag"] is None


def test_duplicate_eatery_is_409(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    client.post("/v1/admin/eateries", headers=admin_headers, json={"name": "Amul"})

    response = client.post("/v1/admin/eateries", headers=admin_headers, json={"name": "AMUL"})

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "EATERY_DUPLICATE"


def test_update_eatery_only_sent_fields(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/admin/eateries",
        headers=admin_headers,
        json={"name": "Amul", "location_tag": "Near SAC"},
    ).json()
    url = f"/v1/admin/eateries/{created['id']}"

    renamed = client.patch(url, headers=admin_headers, json={"name": "Amul Parlour"}).json()
    cleared = client.patch(url, headers=admin_headers, json={"location_tag": None}).json()

    assert (renamed["name"], renamed["location_tag"]) == ("Amul Parlour", "Near SAC")
    assert (cleared["name"], cleared["location_tag"], cleared["slug"]) == (
        "Amul Parlour",
        None,
        "amul",
    )


def test_eatery_pin_is_created_moved_and_cleared(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/admin/eateries",
        headers=admin_headers,
        json={"name": "Amul", "latitude": 29.8649, "longitude": 77.8966},
    ).json()
    url = f"/v1/admin/eateries/{created['id']}"

    moved = client.patch(url, headers=admin_headers, json={"latitude": 29.87, "longitude": 77.9})
    renamed = client.patch(url, headers=admin_headers, json={"name": "Amul Parlour"}).json()
    cleared = client.patch(url, headers=admin_headers, json={"latitude": None, "longitude": None})

    assert (created["latitude"], created["longitude"]) == (29.8649, 77.8966)
    assert moved.status_code == 200
    assert (renamed["latitude"], renamed["longitude"]) == (29.87, 77.9)
    assert (cleared.json()["latitude"], cleared.json()["longitude"]) == (None, None)


@pytest.mark.parametrize(
    "body",
    [
        {"latitude": 29.86},
        {"longitude": 77.89},
        {"latitude": 29.86, "longitude": None},
        {"latitude": 91, "longitude": 77.89},
        {"latitude": 29.86, "longitude": 181},
    ],
)
def test_incomplete_or_invalid_pin_is_422(
    client: TestClient,
    repo: InMemoryAdminRepository,
    admin_headers: dict[str, str],
    body: dict[str, float | None],
) -> None:
    created = client.post("/v1/admin/eateries", headers=admin_headers, json={"name": "Amul"})

    on_create = client.post(
        "/v1/admin/eateries", headers=admin_headers, json={"name": "CCD", **body}
    )
    on_update = client.patch(
        f"/v1/admin/eateries/{created.json()['id']}", headers=admin_headers, json=body
    )

    assert on_create.status_code == 422
    assert on_update.status_code == 422


def test_empty_eatery_update_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post("/v1/admin/eateries", headers=admin_headers, json={"name": "Amul"})

    response = client.patch(
        f"/v1/admin/eateries/{created.json()['id']}", headers=admin_headers, json={"name": None}
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "NOTHING_TO_UPDATE"


def test_update_unknown_eatery_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"/v1/admin/eateries/{uuid.uuid4()}", headers=admin_headers, json={"name": "Ghost"}
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "EATERY_NOT_FOUND"


def test_delete_eatery(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post("/v1/admin/eateries", headers=admin_headers, json={"name": "Amul"})
    url = f"/v1/admin/eateries/{created.json()['id']}"

    first = client.delete(url, headers=admin_headers)
    second = client.delete(url, headers=admin_headers)

    assert first.status_code == 204
    assert second.status_code == 404
    assert second.json()["detail"]["code"] == "EATERY_NOT_FOUND"


def test_eatery_with_complaints_cannot_be_deleted(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post("/v1/admin/eateries", headers=admin_headers, json={"name": "Amul"})
    eatery_id = created.json()["id"]
    repo.eateries_with_complaints.add(UUID(eatery_id))

    response = client.delete(f"/v1/admin/eateries/{eatery_id}", headers=admin_headers)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "EATERY_IN_USE"


# ─── Admins (web console) ────────────────────────────────────────────────────
def test_admin_list_marks_owner(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.get("/v1/admin/admins", headers=admin_headers)

    assert response.status_code == 200
    assert [a["email"] for a in response.json() if a["is_owner"]] == [OWNER_EMAIL]


def test_add_admin_with_account_is_active(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/admins", headers=admin_headers, json={"email": " Secy@ECE.iitr.ac.in "}
    )

    assert response.status_code == 201
    assert response.json()["status"] == "active"
    assert repo.is_admin(STUDENT_ID)


def test_add_admin_without_account_is_invited(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/admins", headers=admin_headers, json={"email": "new@iitr.ac.in"}
    )

    assert response.status_code == 201
    assert response.json()["status"] == "invited"
    assert "new@iitr.ac.in" in repo.invites


@pytest.mark.parametrize("email", ["admin@iitr.ac.in", "new@iitr.ac.in"], ids=["active", "invited"])
def test_duplicate_admin_is_409(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str], email: str
) -> None:
    repo.invites["new@iitr.ac.in"] = datetime.now(UTC)

    response = client.post("/v1/admin/admins", headers=admin_headers, json={"email": email})

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "ADMIN_DUPLICATE"


def test_non_iitr_admin_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/admins", headers=admin_headers, json={"email": "someone@gmail.com"}
    )

    assert response.status_code == 422


def test_remove_admin_and_invite(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    repo._assign(STUDENT_ID, AppRole.ADMIN, None)
    repo.invites["new@iitr.ac.in"] = datetime.now(UTC)

    active = client.delete("/v1/admin/admins/secy@ece.iitr.ac.in", headers=admin_headers)
    invited = client.delete("/v1/admin/admins/NEW@iitr.ac.in", headers=admin_headers)
    missing = client.delete("/v1/admin/admins/new@iitr.ac.in", headers=admin_headers)

    assert (active.status_code, invited.status_code) == (204, 204)
    assert not repo.is_admin(STUDENT_ID)
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "ADMIN_NOT_FOUND"


def test_owner_admin_cannot_be_removed(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.delete(f"/v1/admin/admins/{OWNER_EMAIL}", headers=admin_headers)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "OWNER_ADMIN"
    assert repo.is_admin(OWNER_ID)


def test_admin_cannot_remove_themselves(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.delete("/v1/admin/admins/admin@iitr.ac.in", headers=admin_headers)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "CANNOT_REMOVE_OWN_ADMIN"


# ─── Vendor passcodes ────────────────────────────────────────────────────────
def _whitelist(client: TestClient, headers: dict[str, str]) -> None:
    client.post(
        "/v1/admin/vendor-whitelist",
        headers=headers,
        json={"phone": "9510709195", "outlet_id": str(NIGHT_CANTEEN)},
    )


def test_set_passcode_creates_then_resets_account(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    _whitelist(client, admin_headers)
    before = client.get("/v1/admin/vendor-accounts", headers=admin_headers).json()

    first = client.post(
        "/v1/admin/vendor-accounts/passcode",
        headers=admin_headers,
        json={"phone": "95107 09195", "passcode": "482915"},
    )
    second = client.post(
        "/v1/admin/vendor-accounts/passcode",
        headers=admin_headers,
        json={"phone": "+919510709195", "passcode": "730264"},
    )

    assert before == [
        {
            "phone_e164": "+919510709195",
            "has_account": False,
            "is_master": False,
            "passcode_set_at": None,
            "last_sign_in_at": None,
        }
    ]
    assert first.status_code == 200
    assert first.json()["has_account"] is True
    assert second.status_code == 200
    assert repo.passcodes == {"+919510709195": "730264"}
    assert len(repo.vendor_users) == 1


def test_passcode_needs_whitelisted_phone(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/vendor-accounts/passcode",
        headers=admin_headers,
        json={"phone": "9510709195", "passcode": "482915"},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "VENDOR_NOT_WHITELISTED"


@pytest.mark.parametrize("passcode", ["12345", "1234567", "12a456", "000000", "123456"])
def test_weak_or_malformed_passcode_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str], passcode: str
) -> None:
    _whitelist(client, admin_headers)

    response = client.post(
        "/v1/admin/vendor-accounts/passcode",
        headers=admin_headers,
        json={"phone": "9510709195", "passcode": passcode},
    )

    assert response.status_code == 422
    assert repo.passcodes == {}


def test_passcode_refused_by_supabase_policy_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    _whitelist(client, admin_headers)

    response = client.post(
        "/v1/admin/vendor-accounts/passcode",
        headers=admin_headers,
        json={"phone": "9510709195", "passcode": "135790"},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "PASSCODE_REJECTED"


def test_students_cannot_set_passcodes(
    client: TestClient, repo: InMemoryAdminRepository, make_token: TokenFactory
) -> None:
    response = client.post(
        "/v1/admin/vendor-accounts/passcode",
        headers=bearer(make_token()),
        json={"phone": "9510709195", "passcode": "482915"},
    )

    assert response.status_code == 403


# ─── Master vendors / deleting vendors ───────────────────────────────────────
def test_make_master_vendor_links_every_outlet(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/master-vendors",
        headers=admin_headers,
        json={"phone": "95107 09195", "label": " "},
    )

    assert response.status_code == 201
    assert response.json() == {"phone_e164": "+919510709195", "outlets_linked": len(repo.outlets)}
    accounts = client.get("/v1/admin/vendor-accounts", headers=admin_headers).json()
    assert accounts[0]["is_master"] is True


def test_master_vendor_outlets_cannot_be_unassigned_one_by_one(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    client.post("/v1/admin/master-vendors", headers=admin_headers, json={"phone": "9510709195"})
    entry_id = next(iter(repo.whitelist))

    blocked = client.delete(f"/v1/admin/vendor-whitelist/{entry_id}", headers=admin_headers)
    removed = client.delete("/v1/admin/master-vendors/+919510709195", headers=admin_headers)
    allowed = client.delete(f"/v1/admin/vendor-whitelist/{entry_id}", headers=admin_headers)

    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "MASTER_VENDOR_OUTLET"
    assert removed.status_code == 204
    assert allowed.status_code == 204


def test_remove_unknown_master_vendor_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.delete("/v1/admin/master-vendors/9510709195", headers=admin_headers)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "MASTER_VENDOR_NOT_FOUND"


def test_delete_vendor_removes_links_and_account(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    client.post("/v1/admin/master-vendors", headers=admin_headers, json={"phone": "9510709195"})
    client.post(
        "/v1/admin/vendor-accounts/passcode",
        headers=admin_headers,
        json={"phone": "9510709195", "passcode": "482915"},
    )
    account = repo.vendor_users["+919510709195"]

    response = client.delete("/v1/admin/vendors/%2B919510709195", headers=admin_headers)

    assert response.status_code == 204
    assert repo.whitelist == {}
    assert repo.masters == set()
    assert repo.deleted_users == [account]


def test_delete_unknown_vendor_is_404(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.delete("/v1/admin/vendors/9510709195", headers=admin_headers)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "VENDOR_NOT_FOUND"


def test_delete_vendor_with_bad_phone_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.delete("/v1/admin/vendors/12345", headers=admin_headers)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_PHONE"


def test_students_cannot_make_master_vendors(
    client: TestClient, repo: InMemoryAdminRepository, make_token: TokenFactory
) -> None:
    response = client.post(
        "/v1/admin/master-vendors", headers=bearer(make_token()), json={"phone": "9510709195"}
    )

    assert response.status_code == 403
    assert repo.masters == set()


# ─── Eatery contact number (021) ─────────────────────────────────────────────
def test_eatery_contact_phone_is_normalised_changed_and_cleared(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/admin/eateries",
        headers=admin_headers,
        json={"name": "Nescafe", "contact_phone": "98765 43210"},
    ).json()
    url = f"/v1/admin/eateries/{created['id']}"

    changed = client.patch(url, headers=admin_headers, json={"contact_phone": "+91 91234 56789"})
    cleared = client.patch(url, headers=admin_headers, json={"contact_phone": ""})

    assert created["contact_phone"] == "+919876543210"
    assert changed.json()["contact_phone"] == "+919123456789"
    assert cleared.json()["contact_phone"] is None
    assert cleared.json()["name"] == "Nescafe"


def test_invalid_eatery_contact_phone_is_422(
    client: TestClient, repo: InMemoryAdminRepository, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/admin/eateries",
        headers=admin_headers,
        json={"name": "Nescafe", "contact_phone": "123"},
    )

    assert response.status_code == 422
