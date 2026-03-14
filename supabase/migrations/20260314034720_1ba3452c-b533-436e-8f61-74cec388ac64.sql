
-- Enable realtime for scores and questions tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_questions;
