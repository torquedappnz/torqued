"""Nissan, Mazda, Honda, Subaru — NZ fleet vehicle mapping."""
from vehicle_base import Vehicle
V = Vehicle

JDM_VEHICLES = [
    # ══ NISSAN ════════════════════════════════════════════════════════
    # Tiida / Note / Pulsar / March
    V("NIS_TIIDA_C11_15_04_12","Nissan","Tiida","1.5","C11",2004,2012,"NIS_HR15DE_15","petrol","hatch","fwd",True),
    V("NIS_TIIDA_C11_18_04_12","Nissan","Tiida","1.8","C11",2004,2012,"NIS_MR18DE_18","petrol","hatch","fwd",True),
    V("NIS_TIIDA_C12_15_12_20","Nissan","Tiida","1.5","C12",2012,2020,"NIS_HR15DE_15","petrol","hatch","fwd"),
    V("NIS_NOTE_E11_05_12","Nissan","Note","1.5","E11",2005,2012,"NIS_HR15DE_15","petrol","hatch","fwd",True),
    V("NIS_NOTE_E12_12_20","Nissan","Note","1.2/1.5","E12",2012,2020,"NIS_HR15DE_15","petrol","hatch","fwd"),
    V("NIS_NOTE_EPOWER_E12_16_20","Nissan","Note e-POWER","e-POWER","E12",2016,2020,"NIS_HR15DE_15","hybrid_petrol","hatch","fwd",True,"HR12DE generator — engine runs as generator only"),
    V("NIS_MARCH_K12_02_10","Nissan","March","1.2","K12",2002,2010,"NIS_HR15DE_15","petrol","hatch","fwd",True),
    V("NIS_MARCH_K13_10_20","Nissan","March","1.2","K13",2010,2020,"NIS_HR15DE_15","petrol","hatch","fwd",True),
    V("NIS_PULSAR_C13_13_18","Nissan","Pulsar","1.6/1.8","C13",2013,2018,"NIS_MR18DE_18","petrol","sedan","fwd"),
    V("NIS_CUBE_Z12_08_19","Nissan","Cube","1.5","Z12",2008,2019,"NIS_HR15DE_15","petrol","van","fwd",True),
    # X-Trail / Qashqai / Dualis
    V("NIS_XTRAIL_T30_25_00_07","Nissan","X-Trail","2.5","T30",2000,2007,"NIS_QR25DE_25","petrol","suv","awd"),
    V("NIS_XTRAIL_T31_20_07_13","Nissan","X-Trail","2.0","T31",2007,2013,"NIS_MR20DE_20","petrol","suv","awd"),
    V("NIS_XTRAIL_T31_25_07_13","Nissan","X-Trail","2.5","T31",2007,2013,"NIS_QR25DE_25","petrol","suv","awd"),
    V("NIS_XTRAIL_T32_25_13_22","Nissan","X-Trail","2.5","T32",2013,2022,"NIS_QR25DE_25","petrol","suv","awd"),
    V("NIS_XTRAIL_T33_22_NOW","Nissan","X-Trail","2.5","T33",2022,None,"NIS_QR25DE_25","petrol","suv","awd"),
    V("NIS_QASHQAI_J10_07_14","Nissan","Qashqai/Dualis","2.0","J10",2007,2014,"NIS_MR20DE_20","petrol","suv","fwd"),
    V("NIS_QASHQAI_J11_14_21","Nissan","Qashqai","2.0","J11",2014,2021,"NIS_MR20DE_20","petrol","suv","fwd"),
    # Navara / Patrol
    V("NIS_NAVARA_D40_25_05_15","Nissan","Navara","2.5 D","D40",2005,2015,"NIS_YD25_25_DIESEL","diesel","ute","4wd"),
    V("NIS_NAVARA_D23_25_15_NOW","Nissan","Navara","2.5 D","D23",2015,None,"NIS_YD25_25_DIESEL","diesel","ute","4wd"),
    V("NIS_PATROL_Y61_30_97_17","Nissan","Patrol","3.0 D","Y61",1997,2017,"NIS_ZD30_30_DIESEL","diesel","suv","4wd"),
    V("NIS_PATROL_Y62_56_10_NOW","Nissan","Patrol","5.6 V8","Y62",2010,None,"NIS_VK56_56_V8","petrol","suv","4wd"),
    V("NIS_PATHFINDER_R51_25D_05_13","Nissan","Pathfinder","2.5 D","R51",2005,2013,"NIS_YD25_25_DIESEL","diesel","suv","4wd"),
    # Leaf
    V("NIS_LEAF_ZE0_24_10_17","Nissan","Leaf","24kWh","ZE0",2010,2017,"NIS_LEAF_BEV","bev","hatch","fwd",False,"NZ #1 BEV. No new packs from Nissan NZ."),
    V("NIS_LEAF_ZE1_40_17_NOW","Nissan","Leaf","40kWh","ZE1",2017,None,"NIS_LEAF_BEV","bev","hatch","fwd"),
    V("NIS_LEAF_ZE1_62_19_NOW","Nissan","Leaf e+","62kWh","ZE1",2019,None,"NIS_LEAF_BEV","bev","hatch","fwd"),
    # Skyline / 350Z / sport sedans
    V("NIS_SKYLINE_V35_35_02_07","Nissan","Skyline","350GT","V35",2002,2007,"NIS_VQ35DE_35_V6","petrol","sedan","rwd",True),
    V("NIS_SKYLINE_V36_35_07_14","Nissan","Skyline","370GT","V36",2007,2014,"NIS_VQ35DE_35_V6","petrol","sedan","rwd",True),
    V("NIS_350Z_Z33_02_08","Nissan","350Z","3.5","Z33",2002,2008,"NIS_VQ35DE_35_V6","petrol","coupe","rwd"),
    V("NIS_370Z_Z34_08_20","Nissan","370Z","3.7","Z34",2008,2020,"NIS_VQ35DE_35_V6","petrol","coupe","rwd"),
    V("NIS_CEFIRO_A33_98_03","Nissan","Cefiro","2.5/3.0","A33",1998,2003,"NIS_VQ25_VQ30_V6","petrol","sedan","fwd",True),
    V("NIS_STAGEA_M35_01_07","Nissan","Stagea","2.5/3.5","M35",2001,2007,"NIS_VQ25_VQ30_V6","petrol","wagon","awd",True),
    V("NIS_BLUEBIRD_SYLPHY_G11_05_12","Nissan","Bluebird Sylphy","1.5/1.8","G11",2005,2012,"NIS_MR18DE_18","petrol","sedan","fwd",True),
    V("NIS_PRIMERA_P12_01_08","Nissan","Primera","2.0","P12",2001,2008,"NIS_SR20_20","petrol","sedan","fwd",True),
    # Elgrand / Serena / vans
    V("NIS_ELGRAND_E52_25_10_NOW","Nissan","Elgrand","2.5","E52",2010,None,"NIS_QR25DE_25","petrol","van","fwd",True),
    V("NIS_ELGRAND_E52_35_10_NOW","Nissan","Elgrand","3.5","E52",2010,None,"NIS_VQ35DE_35_V6","petrol","van","fwd",True),
    V("NIS_SERENA_C26_10_16","Nissan","Serena","2.0","C26",2010,2016,"NIS_MR20DE_20","petrol","van","fwd",True),
    V("NIS_SERENA_C27_16_22","Nissan","Serena","2.0","C27",2016,2022,"NIS_MR20DE_20","petrol","van","fwd",True),
    V("NIS_CARAVAN_E25_30D_01_12","Nissan","Caravan","3.0 D","E25",2001,2012,"NIS_ZD30_30_DIESEL","diesel","van","rwd",True),

    # ══ MAZDA ═════════════════════════════════════════════════════════
    V("MAZ_DEMIO_DY_02_07","Mazda","Demio","1.3/1.5","DY",2002,2007,"MAZ_ZY_VE_15","petrol","hatch","fwd",True),
    V("MAZ_DEMIO_DE_07_14","Mazda","Demio/Mazda2","1.5","DE",2007,2014,"MAZ_ZY_VE_15","petrol","hatch","fwd"),
    V("MAZ_MAZDA2_DJ_14_NOW","Mazda","Mazda2/Demio","1.5 SkyActiv","DJ",2014,None,"MAZ_SKYACTIVG_15","petrol","hatch","fwd"),
    V("MAZ_MAZDA3_BK_03_09","Mazda","Mazda3/Axela","1.5/2.0","BK",2003,2009,"MAZ_ZY_VE_15","petrol","hatch","fwd"),
    V("MAZ_MAZDA3_BL_09_13","Mazda","Mazda3/Axela","2.0","BL",2009,2013,"MAZ_SKYACTIVG_20","petrol","hatch","fwd"),
    V("MAZ_MAZDA3_BM_13_19","Mazda","Mazda3/Axela","2.0 SkyActiv","BM",2013,2019,"MAZ_SKYACTIVG_20","petrol","hatch","fwd"),
    V("MAZ_MAZDA3_BP_19_NOW","Mazda","Mazda3","2.5 SkyActiv","BP",2019,None,"MAZ_SKYACTIVG_25","petrol","hatch","fwd"),
    V("MAZ_MAZDA6_GJ_20_12_NOW","Mazda","Mazda6/Atenza","2.0","GJ",2012,None,"MAZ_SKYACTIVG_20","petrol","sedan","fwd"),
    V("MAZ_MAZDA6_GJ_25_12_NOW","Mazda","Mazda6/Atenza","2.5","GJ",2012,None,"MAZ_SKYACTIVG_25","petrol","sedan","fwd"),
    V("MAZ_MAZDA6_GJ_22D_12_NOW","Mazda","Mazda6/Atenza","2.2D","GJ",2012,None,"MAZ_SKYACTIVD_22","diesel","sedan","fwd"),
    V("MAZ_CX3_DK_15_NOW","Mazda","CX-3","1.5/2.0","DK",2015,None,"MAZ_SKYACTIVG_15","petrol","suv","awd"),
    V("MAZ_CX5_KE_20_12_17","Mazda","CX-5","2.0","KE",2012,2017,"MAZ_SKYACTIVG_20","petrol","suv","awd"),
    V("MAZ_CX5_KE_25_12_17","Mazda","CX-5","2.5","KE",2012,2017,"MAZ_SKYACTIVG_25","petrol","suv","awd"),
    V("MAZ_CX5_KE_22D_12_17","Mazda","CX-5","2.2D","KE",2012,2017,"MAZ_SKYACTIVD_22","diesel","suv","awd"),
    V("MAZ_CX5_KF_20_17_NOW","Mazda","CX-5","2.0","KF",2017,None,"MAZ_SKYACTIVG_20","petrol","suv","awd"),
    V("MAZ_CX5_KF_25_17_NOW","Mazda","CX-5","2.5","KF",2017,None,"MAZ_SKYACTIVG_25","petrol","suv","awd"),
    V("MAZ_CX5_KF_22D_17_NOW","Mazda","CX-5","2.2D","KF",2017,None,"MAZ_SKYACTIVD_22","diesel","suv","awd"),
    V("MAZ_CX8_KG_25_17_NOW","Mazda","CX-8","2.5","KG",2017,None,"MAZ_SKYACTIVG_25","petrol","suv","awd"),
    V("MAZ_CX8_KG_22D_17_NOW","Mazda","CX-8","2.2D","KG",2017,None,"MAZ_SKYACTIVD_22","diesel","suv","awd"),
    V("MAZ_CX9_TC_25T_16_NOW","Mazda","CX-9","2.5T","TC",2016,None,"MAZ_SKYACTIVG_25","petrol","suv","awd"),
    V("MAZ_BT50_UR_32_11_20","Mazda","BT-50","3.2 TDCi","UR",2011,2020,"FORD_P5AT_32_TDCI","diesel","ute","4wd",False,"Same wet belt as Ford Ranger"),
    V("MAZ_BT50_TF_20_20_NOW","Mazda","BT-50","2.0 BiT","TF",2020,None,"FORD_YN2S_20_BITURBO","diesel","ute","4wd"),
    V("MAZ_MX5_NA_NB_89_05","Mazda","MX-5","1.6/1.8","NA/NB",1989,2005,"MAZ_B6_BP_FS_LEGACY","petrol","convertible","rwd"),
    V("MAZ_MX5_ND_15_NOW","Mazda","MX-5","2.0 SkyActiv","ND",2015,None,"MAZ_SKYACTIVG_20","petrol","convertible","rwd"),
    V("MAZ_RX7_FD3S_92_02","Mazda","RX-7","13B-REW","FD3S",1992,2002,"MAZ_13B_ROTARY","petrol","coupe","rwd",True),
    V("MAZ_RX8_SE3P_03_12","Mazda","RX-8","13B RENESIS","SE3P",2003,2012,"MAZ_13B_ROTARY","petrol","coupe","rwd"),

    # ══ HONDA ═════════════════════════════════════════════════════════
    # Jazz / Fit
    V("HON_JAZZ_GD_01_08","Honda","Jazz/Fit","1.3/1.5","GD",2001,2008,"HON_L13_L15_13_15","petrol","hatch","fwd"),
    V("HON_JAZZ_GE_08_14","Honda","Jazz","1.3/1.5","GE",2008,2014,"HON_L13_L15_13_15","petrol","hatch","fwd"),
    V("HON_JAZZ_GK_14_20","Honda","Jazz","1.5","GK",2014,2020,"HON_L13_L15_13_15","petrol","hatch","fwd"),
    V("HON_FIT_HYB_GP1_10_13","Honda","Fit Hybrid","1.3 IMA","GP1",2010,2013,"HON_LDA_IMA_HYBRID","hybrid_petrol","hatch","fwd",True),
    V("HON_FIT_HYB_GP5_13_20","Honda","Fit Hybrid","1.5 i-DCD","GP5",2013,2020,"HON_LEB_15_IDCD_HYBRID","hybrid_petrol","hatch","fwd",True),
    # Civic
    V("HON_CIVIC_FD_06_11","Honda","Civic","1.8","FD1",2006,2011,"HON_R18A_18","petrol","sedan","fwd"),
    V("HON_CIVIC_FB_11_15","Honda","Civic","1.8","FB",2011,2015,"HON_R18A_18","petrol","sedan","fwd"),
    V("HON_CIVIC_FK7_15T_17_21","Honda","Civic","1.5T","FK7",2017,2021,"HON_L15B_15T","petrol","hatch","fwd"),
    V("HON_CIVIC_FK8_TR_17_21","Honda","Civic Type R","2.0T","FK8",2017,2021,"HON_K20_20","petrol","hatch","fwd"),
    # CR-V
    V("HON_CRV_RD_97_01","Honda","CR-V","2.0","RD1",1997,2001,"HON_B_SERIES_16_18_20","petrol","suv","awd",True),
    V("HON_CRV_RE4_07_12","Honda","CR-V","2.4","RE4",2007,2012,"HON_K24_24","petrol","suv","awd"),
    V("HON_CRV_RM4_12_16","Honda","CR-V","2.4","RM4",2012,2016,"HON_K24_24","petrol","suv","awd"),
    V("HON_CRV_RW1_15T_17_22","Honda","CR-V","1.5T","RW1",2017,2022,"HON_L15B_15T","petrol","suv","awd"),
    # Accord / Odyssey
    V("HON_ACCORD_CM_24_03_08","Honda","Accord","2.4","CM2",2003,2008,"HON_K24_24","petrol","sedan","fwd"),
    V("HON_ACCORD_CU_24_08_15","Honda","Accord","2.4","CU2",2008,2015,"HON_K24_24","petrol","sedan","fwd"),
    V("HON_ACCORD_CV3_15T_17_22","Honda","Accord","1.5T","CV3",2017,2022,"HON_L15B_15T","petrol","sedan","fwd"),
    V("HON_ODYSSEY_RB1_24_03_08","Honda","Odyssey","2.4","RB1",2003,2008,"HON_K24_24","petrol","van","fwd",True),
    V("HON_ODYSSEY_RB3_24_08_13","Honda","Odyssey","2.4","RB3",2008,2013,"HON_K24_24","petrol","van","fwd",True),
    V("HON_ODYSSEY_RC1_24_13_20","Honda","Odyssey","2.4","RC1",2013,2020,"HON_K24_24","petrol","van","fwd",True),
    V("HON_ODYSSEY_RA_V6_99_04","Honda","Odyssey","3.5 V6","RA6",1999,2004,"HON_J_SERIES_V6","petrol","van","fwd",True),
    # HR-V / Vezel
    V("HON_VEZEL_HYB_RU3_13_21","Honda","Vezel/HR-V","Hybrid","RU3",2013,2021,"HON_LEB_15_IDCD_HYBRID","hybrid_petrol","suv","fwd",True),
    V("HON_HRV_RV5_HYB_21_NOW","Honda","HR-V","e:HEV","RV5",2021,None,"HON_LEB_15_IDCD_HYBRID","hybrid_petrol","suv","fwd"),
    # Stepwagon / Stream
    V("HON_STEPWAGON_RG_18_03_09","Honda","Stepwagon","1.8","RG1",2003,2009,"HON_R18A_18","petrol","van","fwd",True),
    V("HON_STEPWAGON_RK_24_09_15","Honda","Stepwagon Spada","2.4","RK5",2009,2015,"HON_K24_24","petrol","van","awd",True),
    V("HON_STREAM_RN6_18_06_14","Honda","Stream","1.8","RN6",2006,2014,"HON_R18A_18","petrol","wagon","fwd",True),
    # Integra
    V("HON_INTEGRA_DC5_TR_01_06","Honda","Integra Type R","2.0","DC5",2001,2006,"HON_K20_20","petrol","coupe","fwd",True),
    # Legend / Pilot
    V("HON_LEGEND_KB1_35V6_04_12","Honda","Legend","3.5 V6","KB1",2004,2012,"HON_J_SERIES_V6","petrol","sedan","awd",True),

    # ══ SUBARU ════════════════════════════════════════════════════════
    V("SUB_IMPREZA_GD_25_00_07","Subaru","Impreza","2.5","GD",2000,2007,"SUB_EJ25_25_BOXER_BELT","petrol","sedan","awd"),
    V("SUB_IMPREZA_GH_20_07_11","Subaru","Impreza","2.0","GH",2007,2011,"SUB_FB20_20_CHAIN","petrol","hatch","awd"),
    V("SUB_IMPREZA_GP_20_11_16","Subaru","Impreza","2.0","GP",2011,2016,"SUB_FB20_20_CHAIN","petrol","hatch","awd"),
    V("SUB_IMPREZA_GT_20_16_NOW","Subaru","Impreza","2.0","GT",2016,None,"SUB_FB20_20_CHAIN","petrol","hatch","awd"),
    V("SUB_WRX_GD_20T_00_07","Subaru","Impreza WRX","2.0T","GDA",2000,2007,"SUB_EJ20_20_TURBO","petrol","sedan","awd",True),
    V("TOY_WRX_VA_20T_14_21","Subaru","WRX","2.0T","VA",2014,2021,"SUB_EJ20_20_TURBO","petrol","sedan","awd"),
    V("SUB_STI_GRB_20T_07_14","Subaru","Impreza STI","2.0T","GRB",2007,2014,"SUB_EJ20_20_TURBO","petrol","sedan","awd"),
    V("SUB_LEGACY_BP9_30_03_09","Subaru","Legacy","3.0 H6","BP9",2003,2009,"SUB_EZ30_EZ36_H6","petrol","wagon","awd"),
    V("SUB_LEGACY_BR9_36_09_14","Subaru","Legacy","3.6 H6","BR9",2009,2014,"SUB_EZ30_EZ36_H6","petrol","wagon","awd"),
    V("SUB_LEGACY_BL5_20T_03_09","Subaru","Legacy GT","2.0T","BL5",2003,2009,"SUB_EJ20_20_TURBO","petrol","sedan","awd"),
    V("SUB_LEGACY_BM_25_09_14","Subaru","Legacy","2.5","BM",2009,2014,"SUB_FB25_25_CHAIN","petrol","sedan","awd"),
    V("SUB_LEGACY_BN_25_14_NOW","Subaru","Legacy","2.5","BN",2014,None,"SUB_FB25_25_CHAIN","petrol","sedan","awd"),
    V("SUB_FORESTER_SG5_20T_02_08","Subaru","Forester","2.0 XT","SG5",2002,2008,"SUB_EJ20_20_TURBO","petrol","suv","awd"),
    V("SUB_FORESTER_SH_25_08_12","Subaru","Forester","2.5","SH",2008,2012,"SUB_EJ25_25_BOXER_BELT","petrol","suv","awd"),
    V("SUB_FORESTER_SJ_25_12_18","Subaru","Forester","2.5","SJ",2012,2018,"SUB_FB25_25_CHAIN","petrol","suv","awd"),
    V("SUB_FORESTER_SK_25_18_NOW","Subaru","Forester","2.5","SK",2018,None,"SUB_FB25_25_CHAIN","petrol","suv","awd"),
    V("SUB_OUTBACK_BP_25_03_09","Subaru","Outback","2.5","BP",2003,2009,"SUB_EJ25_25_BOXER_BELT","petrol","wagon","awd"),
    V("SUB_OUTBACK_BR_25_09_14","Subaru","Outback","2.5","BR",2009,2014,"SUB_FB25_25_CHAIN","petrol","wagon","awd"),
    V("SUB_OUTBACK_BS_25_14_20","Subaru","Outback","2.5","BS",2014,2020,"SUB_FB25_25_CHAIN","petrol","wagon","awd"),
    V("SUB_OUTBACK_BT_25_20_NOW","Subaru","Outback","2.5","BT",2020,None,"SUB_FB25_25_CHAIN","petrol","wagon","awd"),
    V("SUB_XV_GP_20_11_17","Subaru","XV","2.0","GP",2011,2017,"SUB_FB20_20_CHAIN","petrol","suv","awd"),
    V("SUB_XV_GT_20_17_NOW","Subaru","XV","2.0","GT",2017,None,"SUB_FB20_20_CHAIN","petrol","suv","awd"),
    V("SUB_BRZ_ZC6_20_12_21","Subaru","BRZ","2.0","ZC6",2012,2021,"SUB_FB20_20_CHAIN","petrol","coupe","rwd",False,"FA20D with Toyota 86 — same engine"),
    V("TOY_86_ZN6_20_12_21","Toyota","86","2.0","ZN6",2012,2021,"SUB_FB20_20_CHAIN","petrol","coupe","rwd"),
]

if __name__ == "__main__":
    print(f"Nissan/Mazda/Honda/Subaru vehicles: {len(JDM_VEHICLES)}")
