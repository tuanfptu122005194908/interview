
-- Drop existing restrictive policies on candidates
DROP POLICY IF EXISTS "Interviewers can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Viewer can delete candidates" ON public.candidates;
DROP POLICY IF EXISTS "Viewer can update candidates" ON public.candidates;
DROP POLICY IF EXISTS "Viewer can insert candidates" ON public.candidates;

-- Allow all authenticated users (interviewers + viewer) to insert candidates
CREATE POLICY "Authenticated users can insert candidates"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update candidates
CREATE POLICY "Authenticated users can update candidates"
ON public.candidates FOR UPDATE TO authenticated
USING (true);

-- Allow all authenticated users to delete candidates
CREATE POLICY "Authenticated users can delete candidates"
ON public.candidates FOR DELETE TO authenticated
USING (true);

-- Also allow interviewers to delete cv_images (currently only viewer can)
DROP POLICY IF EXISTS "Viewer can delete cv images" ON public.cv_images;
CREATE POLICY "Authenticated users can delete cv images"
ON public.cv_images FOR DELETE TO authenticated
USING (true);

-- Allow interviewers to update cv_images too
DROP POLICY IF EXISTS "Viewer can update cv images" ON public.cv_images;
CREATE POLICY "Authenticated users can update cv images"
ON public.cv_images FOR UPDATE TO authenticated
USING (true);
