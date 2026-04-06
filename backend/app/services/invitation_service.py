from app.db import supabase
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import secrets
import os
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.auth import get_password_hash
from app.services.email_service import EmailService

logger = get_logger(__name__)

class InvitationService:
    @staticmethod
    def invite_tenant(data: dict, owner_id: str, background_tasks=None) -> Dict[str, Any]:
        """
        Create a tenant invitation.
        1. Validate input
        2. Store invitation only (no user creation)
        3. Generate secure token (24h expiry) in 'invitations' table
        4. Send activation email
        """
        try:
            email = data.get("email")
            name = data.get("full_name") or data.get("name")
            phone = data.get("phone")
            room_id = str(data.get("room_id"))
            monthly_rent = data.get("monthly_rent")

            # 1. Validate email (duplicate check)
            existing_invite = supabase.table("invitations").select("*").eq("email", email).execute()
            if existing_invite.data:
                if existing_invite.data[0]["status"] == "PENDING":
                    return ServiceResponse.already_exists("Invitation", f"A pending invitation already exists for {email}")
            
            existing_profile = supabase.table("profiles").select("id").eq("email", email).execute()
            if existing_profile.data:
                return ServiceResponse.already_exists("Profile", f"A user with email {email} already exists")

            # 2. Get room to validate and use in email
            room_res = supabase.table("rooms").select("room_no").eq("id", room_id).execute()
            if not room_res.data:
                return ServiceResponse.not_found("Room")
            
            room = room_res.data[0]
            if not monthly_rent or float(monthly_rent) <= 0:
                return ServiceResponse.error(
                    ErrorCode.VALIDATION_ERROR,
                    "Monthly rent is required and must be greater than 0"
                )

            # 3. Generate secure invitation token (24h expiry)
            token = secrets.token_urlsafe(32)
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

            invitation_data = {
                "email": email,
                "name": name,
                "phone": phone,
                "room_id": room_id,
                "monthly_rent": monthly_rent,
                "token": token,
                "token_expires_at": expires_at,
                "status": "PENDING",
                "owner_id": owner_id,
                "invited_by": owner_id
            }
            if existing_invite.data:
                inv_res = supabase.table("invitations").update(invitation_data).eq("id", existing_invite.data[0]["id"]).execute()
            else:
                inv_res = supabase.table("invitations").insert(invitation_data).execute()
            invitation_id = inv_res.data[0]["id"]

            # 4. Send email asynchronously (non-blocking)
            base_url = os.getenv("FRONTEND_URL", "https://trishul.solutions")
            activation_link = f"{base_url}/activate/{token}"
            room_no = room.get("room_no", "N/A")
            
            if background_tasks:
                background_tasks.add_task(EmailService.send_invitation_email, email, name, activation_link, room_no, float(monthly_rent or 0))
            else:
                EmailService.send_invitation_email(email, name, activation_link, room_no, float(monthly_rent or 0))

            # SUCCESS: Return response with activation_link
            response_data = {
                "success": True,
                "invitation_id": invitation_id,
                "email": email,
                "activation_link": activation_link,  # ← CRITICAL
                "expires_in_hours": 24
            }
            
            return ServiceResponse.success(response_data, "Invitation sent successfully")

        except Exception as e:
            logger.exception(f"Error inviting tenant: {e}")
            return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

    @staticmethod
    def activate_tenant(token: str, password: str) -> Dict[str, Any]:
        """
        Activate tenant account using token.
        """
        try:
            # 1. Validate token
            res = supabase.table("invitations")\
                .select("*")\
                .eq("token", token)\
                .execute()
            
            if not res.data:
                return ServiceResponse.error(ErrorCode.RESOURCE_NOT_FOUND, "Invalid invitation token")
            
            invitation = res.data[0]
            if invitation["status"] != "PENDING":
                return ServiceResponse.error(ErrorCode.VALIDATION_ERROR, f"Invitation has already been {invitation['status']}")
            
            expires_at = datetime.fromisoformat(invitation["token_expires_at"].replace('Z', '+00:00'))
            if expires_at < datetime.now(timezone.utc):
                supabase.table("invitations").update({"status": "EXPIRED"}).eq("id", invitation["id"]).execute()
                return ServiceResponse.error(ErrorCode.VALIDATION_ERROR, "Invitation token has expired")

            # 2. Create Supabase Auth user now
            email = invitation.get("email")
            if not email:
                return ServiceResponse.error(ErrorCode.VALIDATION_ERROR, "Invitation email missing")

            existing_profile = supabase.table("profiles").select("id").eq("email", email).execute()
            if existing_profile.data:
                return ServiceResponse.already_exists("Profile", f"A user with email {email} already exists")

            auth_response = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True
            })

            if not auth_response.user:
                return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to create auth user")

            auth_user_id = str(auth_response.user.id)

            # 3. Create Profile
            new_profile = {
                "id": auth_user_id,
                "email": email,
                "name": invitation.get("name") or "Tenant",
                "phone": invitation.get("phone"),
                "role": "student",
                "is_active": True,
                "owner_id": invitation.get("owner_id"),
                "is_email_verified": True,
                "email_verified_at": datetime.now(timezone.utc).isoformat(),
                "password_hash": get_password_hash(password)
            }
            supabase.table("profiles").insert(new_profile).execute()

            # 4. Create Student record
            new_student = {
                "profile_id": auth_user_id,
                "owner_id": invitation.get("owner_id"),
                "monthly_rent": invitation.get("monthly_rent"),
                "status": "ACTIVE",
                "joined_on": datetime.now().date().isoformat(),
                "invited_by": invitation.get("invited_by"),
                "invitation_accepted_at": datetime.now(timezone.utc).isoformat()
            }
            stu_res = supabase.table("students").insert(new_student).execute()
            student_id = stu_res.data[0]["id"]

            # 5. Create Room Allocation (end_date=null means ACTIVE)
            room_id = invitation.get("room_id")
            if room_id:
                allocation_data = {
                    "student_id": student_id,
                    "room_id": room_id,
                    "start_date": datetime.now().date().isoformat(),
                    "owner_id": invitation.get("owner_id"),
                }
                supabase.table("room_allocations").insert(allocation_data).execute()

            # 6. Update Invitation status
            supabase.table("invitations").update({
                "status": "ACCEPTED",
                "profile_id": auth_user_id
            }).eq("id", invitation["id"]).execute()

            return ServiceResponse.success(None, "Account activated successfully")

        except Exception as e:
            logger.exception(f"Error activating tenant: {e}")
            return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

    @staticmethod
    def resend_invitation(email: str, background_tasks=None) -> Dict[str, Any]:
        """
        Resend invitation with a new token.
        """
        try:
            # 1. Find pending invitation
            res = supabase.table("invitations")\
                .select("*, profiles!invitations_profile_id_fkey(id, name)")\
                .eq("email", email)\
                .execute()
            
            if not res.data:
                return ServiceResponse.error(ErrorCode.RESOURCE_NOT_FOUND, "No pending invitation found for this email")
            
            invitation = res.data[0]
            if invitation.get("status") == "ACCEPTED":
                return ServiceResponse.error(ErrorCode.VALIDATION_ERROR, "Invitation has already been accepted")

            profile_name = invitation.get("name") or "Tenant"

            # Fetch room number from room_id stored on invitation
            room_no = "N/A"
            rent = float(invitation.get("monthly_rent") or 0)
            room_id = invitation.get("room_id")
            if room_id:
                room_res = supabase.table("rooms").select("room_no").eq("id", room_id).execute()
                if room_res.data:
                    room_no = room_res.data[0].get("room_no", "N/A")

            # 2. Generate new token
            token = secrets.token_urlsafe(32)
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

            # 3. Update invitation
            supabase.table("invitations").update({
                "token": token,
                "token_expires_at": expires_at,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "PENDING"
            }).eq("id", invitation["id"]).execute()

            # 4. Resend email
            base_url = os.getenv("FRONTEND_URL", "https://trishul.solutions")
            activation_link = f"{base_url}/activate/{token}"
            
            if background_tasks:
                background_tasks.add_task(EmailService.send_invitation_email, email, profile_name, activation_link, room_no, rent)
            else:
                EmailService.send_invitation_email(email, profile_name, activation_link, room_no, rent)

            return ServiceResponse.success(None, "Invitation resent successfully")

        except Exception as e:
            logger.exception(f"Error resending invitation: {e}")
            return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
