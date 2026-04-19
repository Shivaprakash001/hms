"""
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
    """
    callbacks = _hooks.get(event_name, [])
    
    if not callbacks:
        logger.debug(f"[Hook] No hooks registered for event: {event_name}")
        return
    
    logger.info(f"[Hook] Triggering {len(callbacks)} hook(s) for event: {event_name}")
    
    for callback in callbacks:
        callback_name = callback.__name__
        try:
            logger.info(f"[Hook] START: {callback_name} for {event_name}")
            callback(**kwargs)
            logger.info(f"[Hook] SUCCESS: {callback_name} for {event_name}")
        except Exception as e:
            logger.error(f"[Hook] FAILURE: {callback_name} for {event_name}. Error: {e}", exc_info=True)
            # Re-raising or handling depends on importance; here we log and continue
            # to prevent one bad hook from breaking the whole flow.


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
