-- Phase 4: private project media and owner-authored project updates.
-- Additive only. The bucket remains private; public media is served through short-lived signed URLs.

CREATE TABLE public.project_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  alt_text text NOT NULL CHECK (char_length(btrim(alt_text)) BETWEEN 1 AND 180),
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, position),
  CHECK (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$')
);

CREATE INDEX project_media_project_position_idx
  ON public.project_media (project_id, position, id);

CREATE TABLE public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_updates_project_created_idx
  ON public.project_updates (project_id, created_at DESC, id DESC);
CREATE INDEX project_updates_author_created_idx
  ON public.project_updates (author_id, created_at DESC, id DESC);

CREATE TRIGGER project_updates_updated_at
  BEFORE UPDATE ON public.project_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visible project media is readable"
  ON public.project_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_media.project_id
      AND ((p.visibility = 'public' AND p.status = 'published') OR p.owner_id = auth.uid())
  ));
CREATE POLICY "project owners add media"
  ON public.project_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_media.project_id AND p.owner_id = auth.uid()
  ));
CREATE POLICY "project owners update media metadata"
  ON public.project_media FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_media.project_id AND p.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_media.project_id AND p.owner_id = auth.uid()
  ));
CREATE POLICY "project owners delete media metadata"
  ON public.project_media FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_media.project_id AND p.owner_id = auth.uid()
  ));

CREATE POLICY "visible project updates are readable"
  ON public.project_updates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_updates.project_id
      AND ((p.visibility = 'public' AND p.status = 'published') OR p.owner_id = auth.uid())
  ));
CREATE POLICY "project owners create updates"
  ON public.project_updates FOR INSERT
  WITH CHECK (
    project_updates.author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_updates.project_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "project owners edit updates"
  ON public.project_updates FOR UPDATE
  USING (
    project_updates.author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_updates.project_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    project_updates.author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_updates.project_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "project owners delete updates"
  ON public.project_updates FOR DELETE
  USING (
    project_updates.author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_updates.project_id AND p.owner_id = auth.uid()
    )
  );

GRANT SELECT ON TABLE public.project_media, public.project_updates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.project_media, public.project_updates TO authenticated;

-- Projects are created as drafts while browser uploads complete. The caller's RLS identity
-- remains in force; publishing is a separate owner-authorized update after media is registered.
CREATE OR REPLACE FUNCTION public.create_project_draft_with_tags(
  p_name text,
  p_slug text,
  p_tagline text,
  p_description text,
  p_repository_url text,
  p_demo_url text,
  p_tags text[]
)
RETURNS TABLE (id uuid, slug text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  created_project_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.projects AS inserted_project
    (owner_id, slug, name, tagline, description, repository_url, demo_url, visibility, status)
  VALUES
    (auth.uid(), p_slug, p_name, p_tagline, p_description, p_repository_url, p_demo_url, 'public', 'draft')
  RETURNING inserted_project.id INTO created_project_id;

  INSERT INTO public.project_tags (project_id, tag)
  SELECT created_project_id, lower(btrim(raw_tag))
  FROM unnest(p_tags) AS raw_tags(raw_tag);

  RETURN QUERY SELECT created_project_id, p_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_draft_with_tags(text, text, text, text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_project_draft_with_tags(text, text, text, text, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_project_draft_with_tags(text, text, text, text, text, text, text[]) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-media', 'project-media', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "owners upload project media objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "visible project media objects are readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'project-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_media pm
        JOIN public.projects p ON p.id = pm.project_id
        WHERE pm.storage_path = storage.objects.name
          AND p.visibility = 'public'
          AND p.status = 'published'
      )
    )
  );
CREATE POLICY "owners delete project media objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid()
    )
  );

-- RLS still restricts these operations to the owning profile; the grant exposes only the status column for publishing.
GRANT UPDATE (status) ON TABLE public.projects TO authenticated;
GRANT DELETE ON TABLE public.projects TO authenticated;
