-- Oil pricing breakdown columns for service packages
alter table service_packages
  add column if not exists base_fee numeric default null,
  add column if not exists oil_grade text default null,
  add column if not exists oil_litres numeric default null,
  add column if not exists oil_cost_per_l numeric default null,
  add column if not exists filter_cost numeric default null,
  add column if not exists trans_oil_litres numeric default null,
  add column if not exists trans_oil_cost_per_l numeric default null,
  add column if not exists freight numeric default null,
  add column if not exists scan_tool_fee numeric default null;
