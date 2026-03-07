-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT NOT NULL,
    category TEXT,
    priority TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'PENDING',
    staff_remarks TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS (Row Level Security) if needed, or leave open for now as this is a dev/test setup
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Create policies (simplified for dev)
CREATE POLICY "Enable all access for authenticated users" ON public.expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.complaints FOR ALL USING (auth.role() = 'authenticated');
