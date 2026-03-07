import requests
import json
import sys

BASE_URL = "http://localhost:8000"

# Login as admin to get token
def login():
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={"email": "admin@hms.com", "password": "password123"})
        if response.status_code == 200:
            return response.json()["access_token"]
        print(f"Login failed: {response.text}")
        return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def verify_rooms(token):
    print("\n--- Verifying Rooms (Floors) ---")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        # Default should be grouped=True
        response = requests.get(f"{BASE_URL}/rooms/", headers=headers)
        if response.status_code != 200:
            print(f"Failed to get rooms: {response.text}")
            return False
        
        data = response.json()
        if not isinstance(data, list):
            print("Response is not a list")
            return False
            
        if len(data) > 0:
            first = data[0]
            # Check for Floor structure: { id, number, rooms: [...] }
            if "rooms" in first and "number" in first:
                print("✅ Rooms endpoint returns Floor structure (grouped)")
                # Check nested room
                if len(first["rooms"]) > 0:
                    room = first["rooms"][0]
                    if "tenants" in room:
                        print("✅ Nested Room contains 'tenants' list")
                    else:
                        print("❌ Nested Room MISSING 'tenants' list")
            else:
                 print("❌ Rooms endpoint does NOT return Floor structure. Got flat room?")
                 print(json.dumps(first, indent=2))
        else:
            print("⚠️ No rooms returned. Cannot verify structure.")
            
        return True
    except Exception as e:
        print(f"Error checking rooms: {e}")
        return False

def verify_payments_dues(token):
    print("\n--- Verifying Payment Dues ---")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"{BASE_URL}/payments/dues", headers=headers)
        if response.status_code != 200:
            print(f"Failed to get dues: {response.text}")
            return False
            
        data = response.json()
        if len(data) > 0:
            first = data[0]
            # Check fields: tenantName, room, month
            required = ["tenantName", "room", "month", "amount"] # Based on my update to payment_service (Wait, I used tenantName in one update but student_name in another?)
            # Let's check what I actually wrote in payment_service.py step 568
            # In 568 I wrote: "student_name": profile.get("name"...), "room_no": ...
            # Wait, MOCK_PAYMENTS uses `tenantName` and `room`.
            # I must have missed that in step 568. 
            # Step 568 was `get_dues_report` and `get_all_payments`.
            # Step 565 was `get_all_dues`?
            # Let's check the verification output to see what we validly have.
            print(json.dumps(first, indent=2))
        return True
    except Exception as e:
        print(f"Error checking dues: {e}")
        return False

def verify_expenses(token):
    print("\n--- Verifying Expenses ---")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"{BASE_URL}/expenses/", headers=headers)
        if response.status_code != 200:
            print(f"Failed to get expenses: {response.text}")
            return False
            
        data = response.json()
        if len(data) > 0:
            first = data[0]
            # Expect: title, amount, date, category
            if "title" in first and "category" in first:
                print("✅ Expenses match Mock structure")
            else:
                print("❌ Expenses structure mismatch")
                print(json.dumps(first, indent=2))
        return True
    except Exception as e:
        print(f"Error checking expenses: {e}")
        return False

def verify_complaints(token):
    print("\n--- Verifying Complaints ---")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"{BASE_URL}/complaints/", headers=headers)
        if response.status_code != 200:
            print(f"Failed to get complaints: {response.text}")
            return False
            
        data = response.json().get("complaints", [])
        if len(data) > 0:
            first = data[0]
            # Expect: tenantName, room, title
            if "tenantName" in first and "title" in first:
                 print("✅ Complaints match Mock structure")
            else:
                 print("❌ Complaints structure mismatch")
                 print(json.dumps(first, indent=2))
        return True
    except Exception as e:
        print(f"Error checking complaints: {e}")
        return False

if __name__ == "__main__":
    token = login()
    if token:
        verify_rooms(token)
        verify_payments_dues(token)
        verify_expenses(token)
        verify_complaints(token)
