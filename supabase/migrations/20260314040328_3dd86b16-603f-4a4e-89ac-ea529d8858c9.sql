-- Add score column to interview_questions
ALTER TABLE public.interview_questions ADD COLUMN IF NOT EXISTS score numeric NOT NULL DEFAULT 0;

-- Update SELECT policy on interview_questions: all authenticated can view
DROP POLICY IF EXISTS "Interviewers can view own questions" ON public.interview_questions;
CREATE POLICY "Authenticated users can view all questions"
  ON public.interview_questions FOR SELECT TO authenticated
  USING (true);

-- Allow interviewers to delete their own questions
CREATE POLICY "Interviewers can delete own questions"
  ON public.interview_questions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Allow interviewers to upload CVs (INSERT)
DROP POLICY IF EXISTS "Viewer can manage cv images" ON public.cv_images;
CREATE POLICY "Authenticated can insert cv images"
  ON public.cv_images FOR INSERT TO authenticated
  WITH CHECK (true);

-- Update SELECT policy on interview_scores: all authenticated can view
DROP POLICY IF EXISTS "View scores" ON public.interview_scores;
CREATE POLICY "Authenticated users can view all scores"
  ON public.interview_scores FOR SELECT TO authenticated
  USING (true);

-- Enable realtime for interview_questions and interview_scores
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_scores;