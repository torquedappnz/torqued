"""Toyota + Lexus vehicles — NZ fleet mapping to engine families."""
from vehicle_base import Vehicle

V = Vehicle  # shorthand

TOYOTA_VEHICLES = [
    # ── COROLLA ──────────────────────────────────────────────────────
    V("TOY_COROLLA_AE10X_95_00","Toyota","Corolla","1.6/1.8","AE100/110",1995,2000,"TOY_4AFE_7AFE_16_18","petrol","sedan","fwd",True,"Sprinter also AE110"),
    V("TOY_COROLLA_NZE121_00_07","Toyota","Corolla","1.5","NZE121",2000,2007,"TOY_1NZFE_15","petrol","sedan","fwd"),
    V("TOY_COROLLA_NZE124_00_07","Toyota","Corolla","1.5 4WD","NZE124",2000,2007,"TOY_1NZFE_15","petrol","wagon","4wd",True),
    V("TOY_COROLLA_ZRE142_06_12","Toyota","Corolla","1.6","ZRE142",2006,2012,"TOY_1ZRFE_16","petrol","sedan","fwd"),
    V("TOY_COROLLA_ZRE152_06_12","Toyota","Corolla","1.8","ZRE152",2006,2012,"TOY_2ZRFE_18","petrol","hatch","fwd"),
    V("TOY_COROLLA_ZRE172_12_19","Toyota","Corolla","1.8","ZRE172",2012,2019,"TOY_2ZRFE_18","petrol","sedan","fwd"),
    V("TOY_COROLLA_ZRE182_12_18","Toyota","Corolla","1.8","ZRE182",2012,2018,"TOY_2ZRFE_18","petrol","hatch","fwd"),
    V("TOY_COROLLA_E210_18_NOW","Toyota","Corolla","2.0","E210/MXPA12",2018,None,"TOY_2ZRFE_18","petrol","hatch","fwd"),
    V("TOY_COROLLA_E210_HYB_18_NOW","Toyota","Corolla Hybrid","1.8 Hybrid","ZWE211",2018,None,"TOY_2ZRFXE_18_HYBRID","hybrid_petrol","hatch","fwd"),
    V("TOY_FIELDER_NZE161_12_NOW","Toyota","Corolla Fielder","1.5","NZE161",2012,None,"TOY_1NZFE_15","petrol","wagon","fwd",True),
    V("TOY_FIELDER_ZRE162_12_NOW","Toyota","Corolla Fielder","1.8","ZRE162",2012,None,"TOY_2ZRFE_18","petrol","wagon","fwd",True),
    V("TOY_FIELDER_HYB_NKE165_13_NOW","Toyota","Corolla Fielder","Hybrid","NKE165",2013,None,"TOY_1NZFXE_15_HYBRID","hybrid_petrol","wagon","fwd",True),
    V("TOY_AXIO_NZE161_12_NOW","Toyota","Corolla Axio","1.5","NZE161",2012,None,"TOY_1NZFE_15","petrol","sedan","fwd",True),
    V("TOY_AXIO_HYB_NKE165_13_NOW","Toyota","Corolla Axio","Hybrid","NKE165",2013,None,"TOY_1NZFXE_15_HYBRID","hybrid_petrol","sedan","fwd",True),
    V("TOY_AURIS_ZRE15X_06_12","Toyota","Auris","1.8","ZRE15X",2006,2012,"TOY_2ZRFE_18","petrol","hatch","fwd",True),

    # ── YARIS / VITZ / ECHO ──────────────────────────────────────────
    V("TOY_ECHO_NCP1X_99_05","Toyota","Echo","1.3/1.5","NCP10/13",1999,2005,"TOY_2NZFE_13","petrol","hatch","fwd"),
    V("TOY_VITZ_KSP90_05_10","Toyota","Vitz","1.0","KSP90",2005,2010,"TOY_1KRFE_10","petrol","hatch","fwd",True),
    V("TOY_VITZ_NCP91_05_10","Toyota","Vitz","1.3","NCP91",2005,2010,"TOY_2NZFE_13","petrol","hatch","fwd",True),
    V("TOY_VITZ_NCP95_05_10","Toyota","Vitz","1.5","NCP95",2005,2010,"TOY_1NZFE_15","petrol","hatch","fwd",True),
    V("TOY_VITZ_NSP130_10_20","Toyota","Vitz","1.3","NSP130",2010,2020,"TOY_1NR_2NR_13_15","petrol","hatch","fwd",True),
    V("TOY_VITZ_KSP130_10_20","Toyota","Vitz","1.0","KSP130",2010,2020,"TOY_1KRFE_10","petrol","hatch","fwd",True),
    V("TOY_YARIS_NCP93_05_11","Toyota","Yaris","1.5","NCP93",2005,2011,"TOY_1NZFE_15","petrol","hatch","fwd"),
    V("TOY_YARIS_NSP130_10_20","Toyota","Yaris","1.3","NSP130",2010,2020,"TOY_1NR_2NR_13_15","petrol","hatch","fwd"),
    V("TOY_YARIS_MXPA10_20_NOW","Toyota","Yaris","1.5","MXPA10",2020,None,"TOY_1NR_2NR_13_15","petrol","hatch","fwd"),
    V("TOY_AQUA_NHP10_11_21","Toyota","Aqua","Hybrid","NHP10",2011,2021,"TOY_1NZFXE_15_HYBRID","hybrid_petrol","hatch","fwd",False,"NZ #1 hybrid import"),
    V("TOY_AQUA_MXPK10_21_NOW","Toyota","Aqua","Hybrid Gen2","MXPK10",2021,None,"TOY_1NZFXE_15_HYBRID","hybrid_petrol","hatch","fwd"),
    V("TOY_PORTE_SPADE_NCP141_12_20","Toyota","Porte/Spade","1.5","NCP141",2012,2020,"TOY_1NZFE_15","petrol","van","fwd",True),

    # ── PRIUS ────────────────────────────────────────────────────────
    V("TOY_PRIUS_NHW20_03_09","Toyota","Prius","Gen 2","NHW20",2003,2009,"TOY_1NZFXE_15_HYBRID","hybrid_petrol","hatch","fwd"),
    V("TOY_PRIUS_ZVW30_09_15","Toyota","Prius","Gen 3","ZVW30",2009,2015,"TOY_2ZRFXE_18_HYBRID","hybrid_petrol","hatch","fwd"),
    V("TOY_PRIUS_ZVW50_15_22","Toyota","Prius","Gen 4","ZVW50",2015,2022,"TOY_2ZRFXE_18_HYBRID","hybrid_petrol","hatch","fwd","HV pack new $5-7k fitted"),
    V("TOY_PRIUS_ZVW52_PHV_17_22","Toyota","Prius PHV","PHEV","ZVW52",2017,2022,"TOY_2ZRFXE_18_HYBRID","phev","hatch","fwd","8.8kWh Li-ion"),
    V("TOY_PRIUS_ALPHA_ZVW40_11_21","Toyota","Prius Alpha","Wagon Hybrid","ZVW40",2011,2021,"TOY_2ZRFXE_18_HYBRID","hybrid_petrol","wagon","fwd",True),
    V("TOY_PRIUS_MXWH60_22_NOW","Toyota","Prius","Gen 5","MXWH60",2022,None,"TOY_A25AFXS_25_HYBRID","hybrid_petrol","hatch","fwd"),

    # ── CAMRY / AURION ───────────────────────────────────────────────
    V("TOY_CAMRY_ACV30_01_06","Toyota","Camry","2.4","ACV30",2001,2006,"TOY_2AZFE_24","petrol","sedan","fwd"),
    V("TOY_CAMRY_MCV30_V6_01_06","Toyota","Camry","3.0 V6","MCV30",2001,2006,"TOY_1MZFE_30_V6","petrol","sedan","fwd"),
    V("TOY_CAMRY_ACV40_06_11","Toyota","Camry","2.4","ACV40",2006,2011,"TOY_2AZFE_24","petrol","sedan","fwd"),
    V("TOY_CAMRY_AHV40_HYB_09_11","Toyota","Camry","Hybrid","AHV40",2009,2011,"TOY_2ARFXE_25_HYBRID","hybrid_petrol","sedan","fwd"),
    V("TOY_CAMRY_ASV50_11_17","Toyota","Camry","2.5","ASV50",2011,2017,"TOY_2ARFE_25","petrol","sedan","fwd"),
    V("TOY_CAMRY_AVV50_HYB_11_17","Toyota","Camry","Hybrid","AVV50",2011,2017,"TOY_2ARFXE_25_HYBRID","hybrid_petrol","sedan","fwd"),
    V("TOY_CAMRY_ASV70_17_NOW","Toyota","Camry","2.5","ASV70",2017,None,"TOY_A25AFXS_25_HYBRID","petrol","sedan","fwd"),
    V("TOY_CAMRY_AXVH71_HYB_17_NOW","Toyota","Camry","Hybrid","AXVH71",2017,None,"TOY_A25AFXS_25_HYBRID","hybrid_petrol","sedan","fwd"),
    V("TOY_AURION_GSV40_06_12","Toyota","Aurion","3.5 V6","GSV40",2006,2012,"TOY_2GRFE_35_V6","petrol","sedan","fwd"),
    V("TOY_AURION_GSV50_12_17","Toyota","Aurion","3.5 V6","GSV50",2012,2017,"TOY_2GRFE_35_V6","petrol","sedan","fwd"),

    # ── RAV4 ─────────────────────────────────────────────────────────
    V("TOY_RAV4_ACA21_00_05","Toyota","RAV4","2.0","ACA21",2000,2005,"TOY_1AZFE_20","petrol","suv","awd"),
    V("TOY_RAV4_ACA38_05_12","Toyota","RAV4","2.4","ACA38",2005,2012,"TOY_2AZFE_24","petrol","suv","awd"),
    V("TOY_RAV4_ASA44_13_18","Toyota","RAV4","2.5","ASA44",2013,2018,"TOY_2ARFE_25","petrol","suv","awd"),
    V("TOY_RAV4_AVA44_HYB_15_18","Toyota","RAV4","Hybrid","AVA44",2015,2018,"TOY_2ARFXE_25_HYBRID","hybrid_petrol","suv","awd"),
    V("TOY_RAV4_AXAH54_HYB_18_NOW","Toyota","RAV4","Hybrid","AXAH54",2018,None,"TOY_A25AFXS_25_HYBRID","hybrid_petrol","suv","awd","HV pack new $6-8k fitted"),
    V("TOY_RAV4_AXAA54_18_NOW","Toyota","RAV4","2.5 Petrol","AXAA54",2018,None,"TOY_A25AFXS_25_HYBRID","petrol","suv","awd"),
    V("TOY_RAV4_PHV_AXAP54_20_NOW","Toyota","RAV4 PHV","PHEV","AXAP54",2020,None,"TOY_A25AFXS_25_HYBRID","phev","suv","awd","18.1kWh Li-ion"),

    # ── HARRIER / KLUGER / HIGHLANDER ────────────────────────────────
    V("TOY_HARRIER_MCU30_03_13","Toyota","Harrier","3.0 V6","MCU30",2003,2013,"TOY_1MZFE_30_V6","petrol","suv","awd",True),
    V("TOY_HARRIER_AVU65_HYB_13_20","Toyota","Harrier","Hybrid","AVU65",2013,2020,"TOY_2ARFXE_25_HYBRID","hybrid_petrol","suv","awd",True),
    V("TOY_HARRIER_AXUH80_HYB_20_NOW","Toyota","Harrier","Hybrid","AXUH80",2020,None,"TOY_A25AFXS_25_HYBRID","hybrid_petrol","suv","awd",True),
    V("TOY_KLUGER_MCU28_03_07","Toyota","Kluger","3.0 V6","MCU28",2003,2007,"TOY_1MZFE_30_V6","petrol","suv","awd"),
    V("TOY_KLUGER_GSU40_07_14","Toyota","Kluger","3.5 V6","GSU40",2007,2014,"TOY_2GRFE_35_V6","petrol","suv","awd"),
    V("TOY_HIGHLANDER_GSU50_13_19","Toyota","Highlander","3.5 V6","GSU50",2013,2019,"TOY_2GRFE_35_V6","petrol","suv","awd"),

    # ── HILUX ────────────────────────────────────────────────────────
    V("TOY_HILUX_LN167_97_05","Toyota","Hilux","3.0 D","LN167",1997,2005,"TOY_5LE_30_DIESEL","diesel","ute","4wd"),
    V("TOY_HILUX_KUN26_05_15","Toyota","Hilux","3.0 D-4D","KUN26",2005,2015,"TOY_1KDFTV_30_DIESEL","diesel","ute","4wd"),
    V("TOY_HILUX_KUN16_05_15","Toyota","Hilux","2.5 D-4D","KUN16",2005,2015,"TOY_2KDFTV_25_DIESEL","diesel","ute","rwd"),
    V("TOY_HILUX_GGN15_05_15","Toyota","Hilux","4.0 V6","GGN15",2005,2015,"TOY_1GRFE_40_V6","petrol","ute","4wd"),
    V("TOY_HILUX_GUN126_15_NOW","Toyota","Hilux","2.8 GD","GUN126",2015,None,"TOY_1GDFTV_28_DIESEL","diesel","ute","4wd"),
    V("TOY_HILUX_GUN125_15_NOW","Toyota","Hilux","2.4 GD","GUN125",2015,None,"TOY_2GDFTV_24_DIESEL","diesel","ute","rwd"),

    # ── LAND CRUISER / PRADO ─────────────────────────────────────────
    V("TOY_LC80_HZJ80_90_98","Toyota","Land Cruiser 80","4.2 D","HZJ80",1990,1998,"TOY_1HZ_42_DIESEL_I6","diesel","suv","4wd"),
    V("TOY_LC105_HZJ105_98_07","Toyota","Land Cruiser 105","4.2 D","HZJ105",1998,2007,"TOY_1HZ_42_DIESEL_I6","diesel","suv","4wd"),
    V("TOY_PRADO_KZJ95_96_02","Toyota","Prado","3.0 D","KZJ95",1996,2002,"TOY_1KZTE_30_TDIESEL","diesel","suv","4wd"),
    V("TOY_PRADO_VZJ95_96_02","Toyota","Prado","3.4 V6","VZJ95",1996,2002,"TOY_5VZFE_34_V6","petrol","suv","4wd"),
    V("TOY_PRADO_KDJ120_02_09","Toyota","Prado","3.0 D-4D","KDJ120",2002,2009,"TOY_1KDFTV_30_DIESEL","diesel","suv","4wd"),
    V("TOY_PRADO_GRJ120_02_09","Toyota","Prado","4.0 V6","GRJ120",2002,2009,"TOY_1GRFE_40_V6","petrol","suv","4wd"),
    V("TOY_PRADO_KDJ150_09_15","Toyota","Prado","3.0 D-4D","KDJ150",2009,2015,"TOY_1KDFTV_30_DIESEL","diesel","suv","4wd"),
    V("TOY_PRADO_GRJ150_09_NOW","Toyota","Prado","4.0 V6","GRJ150",2009,None,"TOY_1GRFE_40_V6","petrol","suv","4wd"),
    V("TOY_PRADO_GDJ150_15_NOW","Toyota","Prado","2.8 GD","GDJ150",2015,None,"TOY_1GDFTV_28_DIESEL","diesel","suv","4wd"),

    # ── HIACE ────────────────────────────────────────────────────────
    V("TOY_HIACE_KZH106_95_04","Toyota","Hiace","3.0 D Turbo","KZH106",1995,2004,"TOY_1KZTE_30_TDIESEL","diesel","van","rwd",True),
    V("TOY_HIACE_KDH200_04_18","Toyota","Hiace","3.0 D-4D","KDH200",2004,2018,"TOY_1KDFTV_30_DIESEL","diesel","van","rwd"),
    V("TOY_HIACE_TRH200_04_18","Toyota","Hiace","2.7 Petrol","TRH200",2004,2018,"TOY_2ARFE_25","petrol","van","rwd"),
    V("TOY_HIACE_GDH200_18_NOW","Toyota","Hiace","2.8 GD","GDH201",2018,None,"TOY_1GDFTV_28_DIESEL","diesel","van","rwd"),

    # ── ESTIMA / ALPHARD / NOAH / VOXY ───────────────────────────────
    V("TOY_ESTIMA_ACR30_00_06","Toyota","Estima","2.4","ACR30",2000,2006,"TOY_2AZFE_24","petrol","van","fwd",True),
    V("TOY_ESTIMA_MCR30_V6_00_06","Toyota","Estima","3.0 V6","MCR30",2000,2006,"TOY_1MZFE_30_V6","petrol","van","fwd",True),
    V("TOY_ESTIMA_ACR50_06_19","Toyota","Estima","2.4","ACR50",2006,2019,"TOY_2AZFE_24","petrol","van","fwd",True),
    V("TOY_ESTIMA_GSR50_V6_06_19","Toyota","Estima","3.5 V6","GSR50",2006,2019,"TOY_2GRFE_35_V6","petrol","van","fwd",True),
    V("TOY_ALPHARD_ANH20_08_15","Toyota","Alphard","2.4","ANH20",2008,2015,"TOY_2AZFE_24","petrol","van","fwd",True),
    V("TOY_ALPHARD_GGH20_V6_08_15","Toyota","Alphard","3.5 V6","GGH20",2008,2015,"TOY_2GRFE_35_V6","petrol","van","fwd",True),
    V("TOY_ALPHARD_AGH30_15_NOW","Toyota","Alphard","2.5","AGH30",2015,None,"TOY_2ARFE_25","petrol","van","fwd",True),
    V("TOY_ALPHARD_AYH30_HYB_15_NOW","Toyota","Alphard Hybrid","Hybrid","AYH30",2015,None,"TOY_2ARFXE_25_HYBRID","hybrid_petrol","van","awd",True),
    V("TOY_VOXY_AZR60_01_07","Toyota","Voxy","2.0","AZR60",2001,2007,"TOY_1AZFE_20","petrol","van","fwd",True),
    V("TOY_VOXY_ZRR70_07_14","Toyota","Voxy","2.0","ZRR70",2007,2014,"TOY_1AZFE_20","petrol","van","fwd",True),
    V("TOY_VOXY_ZRR80_14_22","Toyota","Voxy","2.0","ZRR80",2014,2022,"TOY_2ZRFE_18","petrol","van","fwd",True),
    V("TOY_NOAH_ZRR70_07_14","Toyota","Noah","2.0","ZRR70",2007,2014,"TOY_1AZFE_20","petrol","van","fwd",True),
    V("TOY_SIENTA_NCP81_03_15","Toyota","Sienta","1.5","NCP81",2003,2015,"TOY_1NZFE_15","petrol","van","fwd",True),
    V("TOY_SIENTA_NSP170_15_NOW","Toyota","Sienta","1.5","NSP170",2015,None,"TOY_1NR_2NR_13_15","petrol","van","fwd",True),
    V("TOY_SIENTA_HYB_NHP170_15_NOW","Toyota","Sienta Hybrid","Hybrid","NHP170",2015,None,"TOY_1NZFXE_15_HYBRID","hybrid_petrol","van","fwd",True),

    # ── PROBOX / SUCCEED ─────────────────────────────────────────────
    V("TOY_PROBOX_NCP50_02_14","Toyota","Probox","1.5","NCP50",2002,2014,"TOY_1NZFE_15","petrol","wagon","fwd",True),
    V("TOY_PROBOX_NCP160_14_NOW","Toyota","Probox","1.5","NCP160",2014,None,"TOY_1NR_2NR_13_15","petrol","wagon","fwd",True),

    # ── JDM SPORT / LEGEND IMPORTS ───────────────────────────────────
    V("TOY_CHASER_JZX100_96_01","Toyota","Chaser","Tourer V","JZX100",1996,2001,"TOY_1JZ_25_I6","petrol","sedan","rwd",True),
    V("TOY_MARKII_JZX100_96_00","Toyota","Mark II","Tourer V","JZX100",1996,2000,"TOY_1JZ_25_I6","petrol","sedan","rwd",True),
    V("TOY_MARKII_JZX110_00_04","Toyota","Mark II","iR-V","JZX110",2000,2004,"TOY_1JZ_25_I6","petrol","sedan","rwd",True),
    V("TOY_CRESTA_JZX100_96_01","Toyota","Cresta","Tourer V","JZX100",1996,2001,"TOY_1JZ_25_I6","petrol","sedan","rwd",True),
    V("TOY_ARISTO_JZS161_97_04","Toyota","Aristo","V300","JZS161",1997,2004,"TOY_2JZ_30_I6","petrol","sedan","rwd",True),
    V("TOY_SUPRA_JZA80_93_02","Toyota","Supra","Twin Turbo","JZA80",1993,2002,"TOY_2JZ_30_I6","petrol","coupe","rwd",True),
    V("TOY_SOARER_JZZ31_91_00","Toyota","Soarer","2.5/3.0","JZZ31",1991,2000,"TOY_2JZ_30_I6","petrol","coupe","rwd",True),

    # ── LEXUS ────────────────────────────────────────────────────────
    V("LEX_IS200_GXE10_98_05","Lexus","IS200","2.0","GXE10",1998,2005,"TOY_1JZ_25_I6","petrol","sedan","rwd",True,"1G-FE belt — similar tier to 1JZ"),
    V("LEX_IS250_GSE20_05_13","Lexus","IS250","2.5","GSE20",2005,2013,"TOY_2GRFE_35_V6","petrol","sedan","rwd"),
    V("LEX_IS350_GSE21_05_13","Lexus","IS350","3.5","GSE21",2005,2013,"LEX_2GRFSE_35_D4S","petrol","sedan","rwd"),
    V("LEX_IS350_GSE31_13_20","Lexus","IS350","3.5","GSE31",2013,2020,"LEX_2GRFSE_35_D4S","petrol","sedan","rwd"),
    V("LEX_ISF_USE20_07_14","Lexus","IS-F","5.0","USE20",2007,2014,"LEX_2URGSE_50_V8","petrol","sedan","rwd"),
    V("LEX_RCF_USC10_14_NOW","Lexus","RC-F","5.0","USC10",2014,None,"LEX_2URGSE_50_V8","petrol","coupe","rwd"),
    V("LEX_RX300_MCU15_97_03","Lexus","RX300","3.0 V6","MCU15",1997,2003,"TOY_1MZFE_30_V6","petrol","suv","awd"),
    V("LEX_RX330_MCU38_03_08","Lexus","RX330","3.3 V6","MCU38",2003,2008,"TOY_3MZFE_33_V6","petrol","suv","awd"),
    V("LEX_RX350_GGL15_08_15","Lexus","RX350","3.5","GGL15",2008,2015,"LEX_2GRFSE_35_D4S","petrol","suv","awd"),
    V("LEX_RX450H_GYL15_08_15","Lexus","RX450h","3.5 Hybrid","GYL15",2008,2015,"LEX_2GRFSE_35_D4S","hybrid_petrol","suv","awd"),
    V("LEX_CT200H_ZWA10_10_22","Lexus","CT200h","Hybrid","ZWA10",2010,2022,"TOY_2ZRFXE_18_HYBRID","hybrid_petrol","hatch","fwd"),
    V("LEX_NX300H_AYZ10_14_21","Lexus","NX300h","Hybrid","AYZ10",2014,2021,"TOY_2ARFXE_25_HYBRID","hybrid_petrol","suv","awd"),
    V("LEX_ES300H_AVV60_12_18","Lexus","ES300h","Hybrid","AVV60",2012,2018,"TOY_2ARFXE_25_HYBRID","hybrid_petrol","sedan","fwd"),
    V("LEX_GS350_GRS191_05_11","Lexus","GS350","3.5","GRS191",2005,2011,"LEX_2GRFSE_35_D4S","petrol","sedan","rwd"),
]

if __name__ == "__main__":
    print(f"Toyota + Lexus vehicles: {len(TOYOTA_VEHICLES)}")
