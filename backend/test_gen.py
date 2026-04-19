import sys
import os
import asyncio
sys.path.append("/Users/valurothusharan/Desktop/hms/hms/backend")
from app.services.payment_service import generate_monthly_rent
from datetime import date

try:
    res = generate_monthly_rent(date(2026, 3, 1), user_id="test")
    print(res)
except Exception as e:
    import traceback
    traceback.print_exc()
