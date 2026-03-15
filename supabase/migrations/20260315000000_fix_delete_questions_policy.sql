-- Fix: Allow any authenticated user to delete any question (not just their own)
DROP POLICY IF EXISTS "Interviewers can delete own questions" ON public.interview_questions;

CREATE POLICY "Authenticated users can delete any questions" ON public.interview_questions FOR DELETE TO authenticated USING (true);

-- Also ensure UPDATE is allowed for all
DROP POLICY IF EXISTS "Interviewers can update questions" ON public.interview_questions;

CREATE POLICY "Authenticated users can update any questions" ON public.interview_questions FOR
UPDATE TO authenticated USING (true);

-- Ensure INSERT is allowed
DROP POLICY IF EXISTS "Interviewers can insert questions" ON public.interview_questions;

CREATE POLICY "Authenticated users can insert questions" ON public.interview_questions FOR
INSERT
    TO authenticated
WITH
    CHECK (true);