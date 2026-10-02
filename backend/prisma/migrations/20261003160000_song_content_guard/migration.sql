-- This is an empty migration.


-- Match service String.trim semantics at the database boundary; a whitespace-only song is not content.
-- Already removed historical records remain final and are preserved without rewriting metadata.
ALTER TABLE photo ADD CONSTRAINT photo_song_has_text CHECK (
  removed_at IS NOT NULL OR song_title IS NULL
  OR (btrim(song_title, E' \t\n\r\f' || chr(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''
      AND btrim(song_artist, E' \t\n\r\f' || chr(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> '')
);
