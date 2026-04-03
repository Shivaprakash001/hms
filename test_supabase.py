import sys
from pathlib import Path
sys.path.append('/home/sp/Desktop/hms/backend')
from app.db import supabase

try:
    print("Testing Supabase connection...")
    user = supabase.table("students").select("id").limit(1).execute()
    student_id = user.data[0]["id"]
    
    ob = supabase.table("rent_obligations").select("id").limit(1).execute()
    ob_id = ob.data[0]["id"]
    
    payment_data = {
        "obligation_id": ob_id,
        "student_id": student_id,
        "amount_paid": 5000.0,
        "payment_method": "testing",
        "reference_number": "test_123",
        "payment_date": "2026-04-02"
    }
    res = supabase.table("payments").insert(payment_data).execute()
    print("Success: ", res.data)
except Exception as e:
    print("Error:", str(e))
