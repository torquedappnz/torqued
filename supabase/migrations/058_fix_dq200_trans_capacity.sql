-- ============================================================
-- TORQUED — Migration 058: fix DQ200 dry-clutch DSG fluid capacity
-- Migration 037 seeded trans_capacity_l = 7.0L for several low-torque
-- VW/Audi engines whose real DSG pairing is the DQ200 (7-speed DRY
-- clutch), which takes ~1.7L, not the wet-clutch DQ250/DQ381 (~6-7L)
-- that higher-torque engines (EA888 2.0T, EA113 2.0T, EA189 2.0 TDI)
-- actually use. This was overstating Transmission Service quotes by
-- ~5.3L of $28-50/L DSG fluid (~$150-265) for every affected vehicle.
-- ============================================================

UPDATE public.service_schedule
SET trans_capacity_l = 1.7,
    notes = 'VW long-life oil 15k/12mo. DSG DQ200 (dry clutch) ~1.7L. Cambelt 210k.'
WHERE engine_family_id = 'VW_EA211_14_TSI' AND trans_capacity_l = 7.0;

UPDATE public.service_schedule
SET trans_capacity_l = 1.7,
    notes = 'Belt 3cyl. DSG DQ200 (dry clutch) ~1.7L. 210k belt interval.'
WHERE engine_family_id = 'VW_EA211_10_TSI_3CYL' AND trans_capacity_l = 7.0;

UPDATE public.service_schedule
SET trans_capacity_l = 1.7,
    notes = 'Chain (not belt). Earlier oil interval some markets. DSG DQ200 (dry clutch) ~1.7L.'
WHERE engine_family_id = 'VW_EA111_14_TSI' AND trans_capacity_l = 7.0;
