from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.auth import CurrentUser, get_current_user
from app.repositories.timings import TimingRepository, get_timing_repository
from app.schemas.timings import TimingOverrideCreate, TimingOverrideOut
from app.services.notifications import Notifier, get_notifier
from app.services.timings import TimingService, describe_override

router = APIRouter(prefix="/v1", tags=["timings"])

User = Annotated[CurrentUser, Depends(get_current_user)]


def get_timing_service(
    repo: Annotated[TimingRepository, Depends(get_timing_repository)],
) -> TimingService:
    return TimingService(repo)


Service = Annotated[TimingService, Depends(get_timing_service)]


@router.post(
    "/outlets/{outlet_id}/timing-overrides",
    response_model=TimingOverrideOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_timing_override(
    outlet_id: UUID,
    body: TimingOverrideCreate,
    user: User,
    service: Service,
    notifier: Annotated[Notifier, Depends(get_notifier)],
    background: BackgroundTasks,
) -> TimingOverrideOut:
    created, outlet = await service.create_override(user, outlet_id, body)
    notify = service.should_notify(outlet, body)
    if notify and outlet.bhawan_id is not None:
        title, text = describe_override(outlet, body)
        # After the response: residents' phones must not hold up the secretary's request.
        background.add_task(
            notifier.notify_bhawan_residents,
            outlet.bhawan_id,
            title=title,
            body=text,
            data={
                "type": "timing_override",
                "outlet_id": str(outlet.id),
                "outlet_type": outlet.type.value,
                "override_id": str(created.id),
            },
        )
    return created.model_copy(update={"notified": notify})


@router.delete("/timing-overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_timing_override(override_id: UUID, user: User, service: Service) -> None:
    await service.revoke_override(user, override_id)
