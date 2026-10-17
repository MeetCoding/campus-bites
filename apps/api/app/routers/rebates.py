from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.auth import CurrentUser, get_current_user
from app.repositories.rebates import RebateRepository, get_rebate_repository
from app.schemas.rebates import RebateCreate, RebateOut, RebateTransition
from app.services.notifications import Notifier, get_notifier
from app.services.rebates import RebateService, describe_transition

router = APIRouter(prefix="/v1/rebates", tags=["rebates"])

User = Annotated[CurrentUser, Depends(get_current_user)]


def get_rebate_service(
    repo: Annotated[RebateRepository, Depends(get_rebate_repository)],
) -> RebateService:
    return RebateService(repo)


Service = Annotated[RebateService, Depends(get_rebate_service)]


@router.post("", response_model=RebateOut, status_code=status.HTTP_201_CREATED)
async def submit_rebate(body: RebateCreate, user: User, service: Service) -> RebateOut:
    return await service.submit(user, body)


@router.post("/{rebate_id}/transition", response_model=RebateOut)
async def transition_rebate(
    rebate_id: UUID,
    body: RebateTransition,
    user: User,
    service: Service,
    notifier: Annotated[Notifier, Depends(get_notifier)],
    background: BackgroundTasks,
) -> RebateOut:
    updated = await service.transition(user, rebate_id, body)
    title, text = describe_transition(updated)
    background.add_task(
        notifier.notify_user,
        updated.student_id,
        title=title,
        body=text,
        data={"type": "rebate", "rebate_id": str(updated.id), "status": updated.status.value},
    )
    return updated
