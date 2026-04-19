import os
import sys
from unittest.mock import MagicMock, patch

# Add the project root to sys.path to allow imports from 'app'
sys.path.append("/Users/valurothusharan/Desktop/hms/hms/backend")

# Mock supabase to avoid actual DB connection
sys.modules['app.db'] = MagicMock()
from app.services.email_service import EmailService

def test_email_service_mock():
    print("Testing EmailService with mock...")
    
    # Set dummy env vars for the test
    os.environ["RESEND_API_KEY"] = "re_123456789"
    os.environ["EMAIL_FROM"] = "noreply@trishul.solutions"
    
    with patch("resend.Emails.send") as mock_send:
        mock_send.return_value = {"id": "test_id"}
        
        result = EmailService.send_invitation_email(
            to_email="test@example.com",
            name="Test User",
            activation_link="https://trishul.solutions/activate?token=abc"
        )
        
        print(f"Result: {result}")
        assert result["sent"] is True
        assert result["provider_id"] == "test_id"
        
        # Verify the template content in the call
        args, kwargs = mock_send.call_args
        html_body = args[0]["html"]
        print(f"HTML Body Preview: {html_body[:100]}...")
        assert "This activation link expires in 48 hours." in html_body
        assert "Test User" in html_body
        print("Mock test passed!")

if __name__ == "__main__":
    try:
        test_email_service_mock()
    except Exception as e:
        print(f"Test failed: {e}")
        sys.exit(1)
