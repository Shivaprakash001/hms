import requests
import json

def test_api_login():
    url = "http://localhost:8000/auth/login"
    payload = {
        "email": "admin@hms.com",
        "password": "password123"
    }
    headers = {"Content-Type": "application/json"}
    
    print(f"POST {url}")
    print(f"Payload: {payload}")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ API Login Successful")
        else:
            print("❌ API Login Failed")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    test_api_login()
