from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


class RegisterStudent(BaseModel):
    name: str = Field(min_length=2, max_length=90)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    institution_code: str = Field(min_length=3, max_length=40)
    consent: bool = Field(description="Aceite dos termos de uso do piloto")


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class InstitutionInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=3, max_length=40)
    contact_email: Optional[EmailStr] = None
    admin_name: Optional[str] = Field(default=None, max_length=90)
    admin_email: Optional[EmailStr] = None
    admin_password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class InstitutionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    contact_email: Optional[EmailStr] = None
    support_note: Optional[str] = Field(default=None, max_length=400)


class ProfessionalInvite(BaseModel):
    name: str = Field(min_length=2, max_length=90)
    email: EmailStr
    link_type: str = Field(default="institution", pattern="^(institution|partner)$")
    specialty: Optional[str] = Field(default=None, max_length=120)


class InviteAccept(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class AvailabilityInput(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    times: List[str] = Field(min_length=1, max_length=20)


class RequestInput(BaseModel):
    availability_id: str
    reason_code: str = Field(pattern="^(conversar|dificuldade|orientacao|outro)$")
    reason_note: Optional[str] = Field(default=None, max_length=500)


class RoomLinkInput(BaseModel):
    room_link: str = Field(min_length=8, max_length=300)


class ReferralInput(BaseModel):
    status: str = Field(pattern="^(orientacao|encaminhamento_interno|encaminhamento_externo|sem_encaminhamento)$")
    note: Optional[str] = Field(default=None, max_length=400)


class FeedbackInput(BaseModel):
    score: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=400)


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)
