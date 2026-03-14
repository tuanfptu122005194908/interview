
-- Role enum
CREATE TYPE public.app_role AS ENUM ('interviewer_1', 'interviewer_2', 'interviewer_3', 'viewer');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS for user_roles: users can read their own role
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view candidates
CREATE POLICY "Authenticated users can view candidates"
  ON public.candidates FOR SELECT
  TO authenticated
  USING (true);

-- Only viewer can manage candidates
CREATE POLICY "Viewer can insert candidates"
  ON public.candidates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Viewer can update candidates"
  ON public.candidates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Viewer can delete candidates"
  ON public.candidates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- CV images table
CREATE TABLE public.cv_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cv_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cv images"
  ON public.cv_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Viewer can manage cv images"
  ON public.cv_images FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Viewer can update cv images"
  ON public.cv_images FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Viewer can delete cv images"
  ON public.cv_images FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- Interview questions (each interviewer writes their own)
CREATE TABLE public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  interviewer_role app_role NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, interviewer_role)
);
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- Interviewers can manage their own questions
CREATE POLICY "Interviewers can view own questions"
  ON public.interview_questions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'viewer')
  );

CREATE POLICY "Interviewers can insert own questions"
  ON public.interview_questions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Interviewers can update own questions"
  ON public.interview_questions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Interview scores
CREATE TABLE public.interview_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  interviewer_role app_role NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, interviewer_role)
);
ALTER TABLE public.interview_scores ENABLE ROW LEVEL SECURITY;

-- Interviewers can manage their own scores, viewer can see all
CREATE POLICY "View scores"
  ON public.interview_scores FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'viewer')
  );

CREATE POLICY "Insert own score"
  ON public.interview_scores FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own score"
  ON public.interview_scores FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Storage bucket for CV images
INSERT INTO storage.buckets (id, name, public) VALUES ('cv-images', 'cv-images', true);

CREATE POLICY "Anyone can view cv images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cv-images');

CREATE POLICY "Authenticated users can upload cv images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'cv-images');

CREATE POLICY "Authenticated users can delete cv images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'cv-images');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_interview_questions_updated_at
  BEFORE UPDATE ON public.interview_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_scores_updated_at
  BEFORE UPDATE ON public.interview_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
