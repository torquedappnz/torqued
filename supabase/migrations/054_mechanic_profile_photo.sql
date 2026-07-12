-- Add profile photo column for mechanic workshop profiles (bio already exists from 028)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_photo_url text;
