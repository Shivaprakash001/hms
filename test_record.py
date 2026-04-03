import sys
from pathlib import Path
sys.path.append('/home/sp/Desktop/hms/backend')
from app.db import supabase
from app.services.payment_service import record_payment

try:
    user = supabase.table("students").select("id").limit(1).execute()
    student_id = user.data[0]["id"]
    
    ob = supabase.table("rent_obligations").select("id, amount").eq("status", "PENDING").limit(1).execute()
    if not ob.data:
        print("No pending obligations found")
        sys.exit(0)
    ob_id = ob.data[0]["id"]
    amount = float(ob.data[0]["amount"])
    
    print(f"Testing real record_payment on {ob_id} amount {amount}...")
    res = record_payment(
        obligation_id=ob_id,
        amount_paid=amount,
        payment_method="testing",
        reference_number="test_abc123"
    )
    print("Response: ", res)
except Exception as e:
    import traceback
    traceback.print_exc()
