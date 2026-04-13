-- Add field type support to template fields
-- Updates existing fields JSONB to include type: "text" as default

-- Update all existing template fields to have type: "text" if not set
UPDATE ticket_templates
SET fields = (
  SELECT jsonb_agg(
    CASE
      WHEN (field->>'type') IS NULL
      THEN field || '{"type": "text", "options": [], "validation": {}}'::jsonb
      ELSE field
    END
  )
  FROM jsonb_array_elements(fields) AS field
)
WHERE jsonb_array_length(fields) > 0;
