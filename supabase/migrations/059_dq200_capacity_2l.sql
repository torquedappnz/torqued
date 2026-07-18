-- ============================================================
-- TORQUED — Migration 059: DQ200 DSG fluid capacity is 2.0L, not 1.7L
-- Supersedes/corrects migration 058's figure (safe to run whether or
-- not 058 already applied — sets the value unconditionally rather than
-- gating on the old 7.0L figure). DQ200 mechatronic/hydraulic fluid
-- service fill is ~2L; the separate final-drive gear oil (~1L) is
-- handled in code (server.ts DQ200_ENGINE_FAMILIES), not this table,
-- since service_schedule only models one transmission fluid per engine.
-- ============================================================

UPDATE public.service_schedule
SET trans_capacity_l = 2.0
WHERE engine_family_id IN ('VW_EA211_14_TSI', 'VW_EA211_10_TSI_3CYL', 'VW_EA111_14_TSI');
