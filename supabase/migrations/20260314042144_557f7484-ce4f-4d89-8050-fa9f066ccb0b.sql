
-- Allow interviewers to insert candidates (not just viewer)
DROP POLICY IF EXISTS "Interviewers can insert candidates" ON public.candidates;
CREATE POLICY "Interviewers can insert candidates"
ON public.candidates
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'interviewer_1'::app_role) OR
  has_role(auth.uid(), 'interviewer_2'::app_role) OR
  has_role(auth.uid(), 'interviewer_3'::app_role) OR
  has_role(auth.uid(), 'viewer'::app_role)
);
