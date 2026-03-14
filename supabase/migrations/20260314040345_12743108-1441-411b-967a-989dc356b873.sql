-- Fix permissive INSERT policy on cv_images to restrict to interviewers and viewer
DROP POLICY IF EXISTS "Authenticated can insert cv images" ON public.cv_images;
CREATE POLICY "Interviewers and viewer can insert cv images"
  ON public.cv_images FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'interviewer_1'::app_role) OR
    has_role(auth.uid(), 'interviewer_2'::app_role) OR
    has_role(auth.uid(), 'interviewer_3'::app_role) OR
    has_role(auth.uid(), 'viewer'::app_role)
  );