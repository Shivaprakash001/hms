# 🎯 PRACTICAL IMPLEMENTATION PLAN

## Reality Check: What to Actually Implement

Based on mentor feedback, here's the **practical, timeline-focused** approach:

---

## ✅ **IMPLEMENT NOW** (Week 1-2)

### 1. JWT Authentication ✅
**Status:** Already implemented correctly  
**Priority:** CRITICAL  
**Effort:** Low (just use it)

**Why:**
- Industry standard
- Required for real deployment
- Required for RLS integration
- Required for mobile/frontend

**Action:**
```python
# Just use the auth dependencies
from app.utils.auth import get_current_user, require_admin

@router.post("/students/")
def create_student(user: UserContext = Depends(require_admin_or_warden)):
    # That's it!
```

**Setup:**
```bash
# 1. Already added to requirements.txt
uv pip install python-jose[cryptography]

# 2. Set secret in .env
JWT_SECRET_KEY=your-secret-key-here
```

---

### 2. is_active Column ✅
**Status:** Migration ready  
**Priority:** HIGH  
**Effort:** Very Low (5 minutes)

**Why:**
- Separates lifecycle from visibility
- Industry best practice
- Prevents data ambiguity
- Low effort, high value

**Action:**
```sql
-- Run in Supabase SQL Editor
ALTER TABLE students ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX idx_students_is_active ON students(is_active);
```

---

### 3. Simple Event Hooks (Lightweight) ⚠️ SIMPLIFIED
**Status:** Use simplified version below  
**Priority:** MEDIUM  
**Effort:** Low

**Why:**
- Useful for student status changes
- Keeps modules decoupled
- Easy to understand
- No complex infrastructure

**What NOT to do:**
- ❌ Full event bus
- ❌ Event sourcing
- ❌ Kafka/RabbitMQ
- ❌ Complex pub/sub

**What to do instead:**
- ✅ Simple callback functions
- ✅ Direct function calls with hooks
- ✅ Easy to debug

See simplified version below ⬇️

---

## ❌ **POSTPONE** (Overengineering)

### 4. Saga Pattern ❌
**Why postpone:**
- You have single database
- Use PostgreSQL transactions instead
- Saga is for distributed services
- Adds debugging complexity

**When to implement:**
- When you have multiple services
- When you can't use DB transactions
- When you have distributed data

**For now, use:**
```python
# Simple database transaction
from app.db import supabase

# Supabase handles transactions automatically
# Just make your operations atomic
```

---

### 5. Distributed Locks ❌
**Why postpone:**
- Single application server
- No contention yet
- Premature optimization

**When to implement:**
- Multiple app servers
- Actual race conditions observed
- High concurrent load

**For now:**
- Database handles locking
- UNIQUE constraints prevent duplicates
- Good enough for current scale

---

## 🔧 **SIMPLIFIED EVENT HOOKS** (Practical Version)

Instead of full event bus, use simple hooks:

<function_calls>
<invoke name="write_to_file">
<parameter name="CodeContent">"""
Simple Event Hooks - Practical Version

This is a lightweight alternative to full event bus.
Use this for small-to-medium systems with single backend.

When to upgrade to full event bus:
- Multiple services
- Async processing needed
- Event sourcing required
"""
from typing import Callable, List, Dict, Any
from app.utils.logger import get_logger

logger = get_logger(__name__)


# Simple hook registry
_hooks: Dict[str, List[Callable]] = {}


def register_hook(event_name: str, callback: Callable):
    """
    Register a callback for an event.
    
    Example:
        def on_student_left(student_id: str, **kwargs):
            close_room_allocation(student_id)
        
        register_hook("student_left", on_student_left)
    """
    if event_name not in _hooks:
        _hooks[event_name] = []
    
    _hooks[event_name].append(callback)
    logger.info(f"Registered hook for '{event_name}': {callback.__name__}")


def trigger_hook(event_name: str, **kwargs):
    """
    Trigger all callbacks for an event.
    
    Example:
        trigger_hook("student_left", student_id=student_id, reason="graduated")
    """
    callbacks = _hooks.get(event_name, [])
    
    if not callbacks:
        logger.debug(f"No hooks registered for '{event_name}'")
        return
    
    logger.info(f"Triggering {len(callbacks)} hook(s) for '{event_name}'")
    
    for callback in callbacks:
        try:
            callback(**kwargs)
            logger.debug(f"Hook executed: {callback.__name__}")
        except Exception as e:
            logger.error(f"Hook failed: {callback.__name__}: {e}", exc_info=True)
            # Continue with other hooks even if one fails


# Convenience functions for common events

def on_student_left(student_id: str, **kwargs):
    """Trigger when student status changes to LEFT"""
    trigger_hook("student_left", student_id=student_id, **kwargs)


def on_student_enrolled(student_id: str, **kwargs):
    """Trigger when new student is enrolled"""
    trigger_hook("student_enrolled", student_id=student_id, **kwargs)


def on_rent_changed(student_id: str, old_rent: float, new_rent: float, **kwargs):
    """Trigger when student rent changes"""
    trigger_hook("rent_changed", 
                 student_id=student_id, 
                 old_rent=old_rent, 
                 new_rent=new_rent, 
                 **kwargs)


# Example usage in other modules:
# 
# In room_service.py:
# from app.utils.hooks import register_hook
# 
# def handle_student_left(student_id: str, **kwargs):
#     logger.info(f"Closing room allocation for student {student_id}")
#     close_student_allocation(student_id)
# 
# # Register on module load
# register_hook("student_left", handle_student_left)
#
# In student_service.py:
# from app.utils.hooks import on_student_left
#
# def update_student_status(student_id, new_status):
#     # Update database
#     update_student(student_id, {"status": new_status})
#     
#     # Trigger hooks
#     if new_status == "LEFT":
#         on_student_left(student_id=student_id)
