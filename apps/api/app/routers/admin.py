from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.auth import CurrentUser, require_role
from app.repositories.admin import AdminRepository, get_admin_repository
from app.schemas.admin import (
    BhawanCreate,
    BhawanOut,
    BhawanUpdate,
    EateryCreate,
    EateryOut,
    EateryUpdate,
    RoleAssignmentCreate,
    RoleAssignmentOut,
    WhitelistCreate,
    WhitelistEntry,
)
from app.schemas.common import AppRole
from app.services.admin import AdminService

router = APIRouter(prefix="/v1/admin", tags=["admin"])

Admin = Annotated[CurrentUser, Depends(require_role(AppRole.ADMIN))]


def get_admin_service(
    repo: Annotated[AdminRepository, Depends(get_admin_repository)],
) -> AdminService:
    return AdminService(repo)


Service = Annotated[AdminService, Depends(get_admin_service)]


@router.get("/vendor-whitelist", response_model=list[WhitelistEntry])
async def list_whitelist(actor: Admin, service: Service) -> list[WhitelistEntry]:
    return await service.list_whitelist(actor)


@router.post(
    "/vendor-whitelist", response_model=WhitelistEntry, status_code=status.HTTP_201_CREATED
)
async def add_whitelist(actor: Admin, service: Service, body: WhitelistCreate) -> WhitelistEntry:
    return await service.add_whitelist(actor, body)


@router.delete("/vendor-whitelist/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_whitelist(actor: Admin, service: Service, entry_id: UUID) -> None:
    await service.remove_whitelist(actor, entry_id)


@router.get("/role-assignments", response_model=list[RoleAssignmentOut])
async def list_role_assignments(actor: Admin, service: Service) -> list[RoleAssignmentOut]:
    return await service.list_role_assignments(actor)


@router.post(
    "/role-assignments", response_model=RoleAssignmentOut, status_code=status.HTTP_201_CREATED
)
async def assign_role(
    actor: Admin, service: Service, body: RoleAssignmentCreate
) -> RoleAssignmentOut:
    return await service.assign_role(actor, body)


@router.delete("/role-assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role(actor: Admin, service: Service, assignment_id: UUID) -> None:
    await service.revoke_role(actor, assignment_id)


@router.post("/bhawans", response_model=BhawanOut, status_code=status.HTTP_201_CREATED)
async def create_bhawan(actor: Admin, service: Service, body: BhawanCreate) -> BhawanOut:
    return await service.create_bhawan(actor, body)


@router.patch("/bhawans/{bhawan_id}", response_model=BhawanOut)
async def update_bhawan(
    actor: Admin, service: Service, bhawan_id: UUID, body: BhawanUpdate
) -> BhawanOut:
    return await service.update_bhawan(actor, bhawan_id, body)


@router.delete("/bhawans/{bhawan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bhawan(actor: Admin, service: Service, bhawan_id: UUID) -> None:
    await service.delete_bhawan(actor, bhawan_id)


@router.post("/eateries", response_model=EateryOut, status_code=status.HTTP_201_CREATED)
async def create_eatery(actor: Admin, service: Service, body: EateryCreate) -> EateryOut:
    return await service.create_eatery(actor, body)


@router.patch("/eateries/{eatery_id}", response_model=EateryOut)
async def update_eatery(
    actor: Admin, service: Service, eatery_id: UUID, body: EateryUpdate
) -> EateryOut:
    return await service.update_eatery(actor, eatery_id, body)


@router.delete("/eateries/{eatery_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_eatery(actor: Admin, service: Service, eatery_id: UUID) -> None:
    await service.delete_eatery(actor, eatery_id)
