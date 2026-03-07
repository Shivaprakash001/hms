-- Comprehensive fix for the missing room_allocations table and its relationships
-- Copy and paste this entirely into your Supabase SQL Editor and click "RUN"

-- 1. Create the room_allocations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.room_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Critical for Owner Isolation
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE, -- NULL means active allocation
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Business Rule Index: One active allocation per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_one_active_allocation 
ON public.room_allocations(student_id) 
WHERE (end_date IS NULL);

-- 3. Essential Indexes for performance
CREATE INDEX IF NOT EXISTS idx_allocations_room_id ON public.room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_allocations_active ON public.room_allocations(room_id) WHERE (end_date IS NULL);
CREATE INDEX IF NOT EXISTS idx_allocations_owner_id ON public.room_allocations(owner_id);

-- 4. Enable RLS and setup Policies
ALTER TABLE public.room_allocations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS owner_manage_own_allocations ON public.room_allocations;
DROP POLICY IF EXISTS "Allow service role to manage allocations" ON public.room_allocations;
DROP POLICY IF EXISTS "Allow all authenticated to view allocations" ON public.room_allocations;

-- Allow owners to only manage their own allocations
CREATE POLICY owner_manage_own_allocations ON public.room_allocations
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Allow the Service Role Key full access
CREATE POLICY "Allow service role to manage allocations" ON public.room_allocations FOR ALL TO service_role USING (true);

-- 5. Trigger for updated_at (Assumes handle_updated_at function exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
        DROP TRIGGER IF EXISTS set_updated_at_room_allocations ON public.room_allocations;
        CREATE TRIGGER set_updated_at_room_allocations BEFORE UPDATE ON public.room_allocations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- 6. Important: Force refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
