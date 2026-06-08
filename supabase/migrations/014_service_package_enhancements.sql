-- Add pkg_type and included_items to service_packages
alter table service_packages
  add column if not exists pkg_type text not null default 'standard',
  add column if not exists included_items text[] default null;
