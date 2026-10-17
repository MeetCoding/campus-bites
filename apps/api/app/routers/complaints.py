from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends

from app.core.auth import CurrentUser, get_current_user
from app.repositories.complaints import ComplaintRepository, get_complaint_repository
from app.schemas.complaints import ComplaintOut, ComplaintTransition
from app.services.complaints import (
    ComplaintService,
    describe_for_handlers,
    describe_for_student,
    describe_nudge,
)
from app.services.notifications import Notifier, get_notifier

router = APIRouter(prefix="/v1/complaints", tags=["complaints"])

User = Annotated[CurrentUser, Depends(get_current_user)]


def get_complaint_service(
    repo: Annotated[ComplaintRepository, Depends(get_complaint_repository)],
) -> ComplaintService:
    return ComplaintService(repo)


Service = Annotated[ComplaintService, Depends(get_complaint_service)]
NotifierDep = Annotated[Notifier, Depends(get_notifier)]


@router.post("/{complaint_id}/transition", response_model=ComplaintOut)
async def transition_complaint(
    complaint_id: UUID,
    body: ComplaintTransition,
    user: User,
    service: Service,
    notifier: NotifierDep,
    background: BackgroundTasks,
) -> ComplaintOut:
    result = await service.transition(user, complaint_id, body)
    complaint = result.complaint
    data = {
        "type": "complaint",
        "complaint_id": str(complaint.id),
        "status": complaint.status.value,
    }
    # Notify the other party: handler actions → the student; student actions → the handlers.
    if result.actor_role == "handler":
        title, text = describe_for_student(complaint, body.message)
        background.add_task(
            notifier.notify_users, [complaint.created_by], title=title, body=text, data=data
        )
    else:
        title, text = describe_for_handlers(complaint, body.message)
        background.add_task(
            notifier.notify_users,
            await service.handler_ids(complaint),
            title=title,
            body=text,
            data=data,
        )
    return complaint


@router.post("/{complaint_id}/nudge", response_model=ComplaintOut)
async def nudge_complaint(
    complaint_id: UUID,
    user: User,
    service: Service,
    notifier: NotifierDep,
    background: BackgroundTasks,
) -> ComplaintOut:
    complaint = await service.nudge(user, complaint_id)
    title, text = describe_nudge(complaint)
    background.add_task(
        notifier.notify_users,
        await service.handler_ids(complaint),
        title=title,
        body=text,
        data={"type": "complaint", "complaint_id": str(complaint.id)},
        channel="nudges",
        priority="high",
    )
    return complaint
