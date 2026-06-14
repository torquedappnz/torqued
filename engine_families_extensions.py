"""
TORQUED — Engine Family Extensions (Chunk 2a)

Extends engine_families.ENGINE_FAMILIES with the long-tail engines needed
to map 300+ NZ-fleet vehicles. These are mostly:
  - Older JDM imports (1MZ-FE V6, 1JZ/2JZ, 4G63 EVO, SR20, 4A-FE)
  - Aussie metal (Holden Alloytec, Falcon Cyclone)
  - Chinese / MG / GWM / BYD
  - Kei car engines (KF, K6A)
  - Niche diesels (1HZ, 1KZ-TE, ZD30, YD25, 4D56, EE20)

Pricing follows the same anchor-or-tier discipline as Chunk 1. Where no
NZ workshop page exists for a specific engine, the segment_tier drives the
estimate and confidence=2 is set explicitly.

Usage:
    from engine_families import ENGINE_FAMILIES
    from engine_families_extensions import ADDITIONAL_FAMILIES
    ALL_FAMILIES = ENGINE_FAMILIES + ADDITIONAL_FAMILIES
"""

from engine_families import EngineFamily, JobAnchor


ADDITIONAL_FAMILIES: list[EngineFamily] = [

    # ════════════════════════════════════════════════════════════════════
    # TOYOTA — older JDM imports + heavy diesel
    # ════════════════════════════════════════════════════════════════════

    # 1MZ-FE 3.0 V6 — BELT — Camry V6, Estima, Kluger, RX300, Sienna, Avalon
    EngineFamily(
        family_id="TOY_1MZFE_30_V6",
        common_name="Toyota 1MZ-FE 3.0L V6",
        manufacturer="Toyota",
        displacement_l=3.0,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=150000,
        cambelt_interval_years=10,
        oil_spec="5W-30 API SM/SN",
        oil_capacity_l=5.0,
        coolant_spec="Toyota Long Life Coolant (red, pre-2004) / Super Long Life (pink, 2004+)",
        transmission_options=["4AT_U140E", "5AT_U151E"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 800, 1100, 4.5, 6.0, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 230, 350, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 400, 540, 1.4, 2.0, "comprehensive_service_mid"),
        ],
        notes="Camry MCV30/36 V6, Estima ACR30/40 V6, Kluger MCU28, Lexus RX300 MCU15, "
              "Avalon MCX10/20, Windom MCV30, Pronard MCX20. Belt — replace 150,000km.",
    ),

    # 3MZ-FE 3.3 V6 — BELT — Estima ACR50 V6, RX330, Sienna
    EngineFamily(
        family_id="TOY_3MZFE_33_V6",
        common_name="Toyota 3MZ-FE 3.3L V6",
        manufacturer="Toyota",
        displacement_l=3.3,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=150000,
        oil_spec="5W-30 API SM",
        oil_capacity_l=5.2,
        coolant_spec="Toyota Super Long Life (pink)",
        transmission_options=["5AT_U151F"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 850, 1150, 4.5, 6.0, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 240, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 330, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Estima ACR50 3.3 V6, Lexus RX330 MCU38, Sienna MCL23, Harrier MCU30. Belt.",
    ),

    # 5VZ-FE 3.4 V6 — BELT — Hilux Surf, older Prado, Granvia
    EngineFamily(
        family_id="TOY_5VZFE_34_V6",
        common_name="Toyota 5VZ-FE 3.4L V6",
        manufacturer="Toyota",
        displacement_l=3.4,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=150000,
        cambelt_interval_years=10,
        oil_spec="5W-30 API SM",
        oil_capacity_l=5.2,
        coolant_spec="Toyota Long Life Coolant (red)",
        transmission_options=["4AT_A340E", "5MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 850, 1200, 5.0, 7.0, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 240, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Hilux Surf VZN185, Prado VZJ95/120, Granvia VCH10, Tacoma. Belt.",
    ),

    # 4A-FE / 7A-FE — BELT — older Corolla AE100/110/120, Sprinter, Carina, Caldina
    EngineFamily(
        family_id="TOY_4AFE_7AFE_16_18",
        common_name="Toyota 4A-FE/7A-FE 1.6/1.8L",
        manufacturer="Toyota",
        displacement_l=1.8,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        cambelt_interval_years=7,
        oil_spec="5W-30 API SL",
        oil_capacity_l=3.7,
        coolant_spec="Toyota Long Life Coolant (red)",
        transmission_options=["3AT", "4AT_A245E", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("cambelt_full", 500, 750, 3.0, 4.5, "cambelt_japanese_economy"),
            JobAnchor("brake_pads_front", 150, 230, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 220, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Corolla AE100/AE110/AE111/AE114, Sprinter AE100/AE110, Carina AT211, "
              "Caldina ST215, Avensis AT220. Belt 100,000km.",
    ),

    # 1NR-FE / 2NR-FE — chain — Yaris NSP130, Vios, Sienta, Etios
    EngineFamily(
        family_id="TOY_1NR_2NR_13_15",
        common_name="Toyota 1NR-FE 1.3 / 2NR-FE 1.5",
        manufacturer="Toyota",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=3.4,
        coolant_spec="Toyota Super Long Life (pink)",
        transmission_options=["CVT_K310", "4AT", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 160, 250, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 160, 230, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Yaris NSP130/131 1.3 2010+, Vios NCP150 1.5, Sienta NSP170 1.5, Etios. Chain.",
    ),

    # 1JZ-GE / 1JZ-GTE 2.5 inline-6 — BELT — Chaser, Mark II, Cresta, Tourer V, Soarer
    EngineFamily(
        family_id="TOY_1JZ_25_I6",
        common_name="Toyota 1JZ-GE/1JZ-GTE 2.5L Inline-6",
        manufacturer="Toyota",
        displacement_l=2.5,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        cambelt_interval_years=10,
        oil_spec="5W-40 API SL (turbo) / 5W-30 (NA)",
        oil_capacity_l=4.7,
        coolant_spec="Toyota Long Life Coolant (red)",
        transmission_options=["4AT_A340E", "5MT_R154"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("cambelt_full", 700, 1000, 4.0, 5.5, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 240, 380, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Chaser JZX100/JZX110, Mark II JZX90/100/110, Cresta JZX100, Tourer V, "
              "Soarer JZZ30, Crown JZS151/171. 1JZ-GTE is twin-turbo (later single VVT-i). "
              "Cult import family in NZ.",
    ),

    # 2JZ-GE / 2JZ-GTE 3.0 inline-6 — BELT — Aristo, Soarer, Crown, Supra MK4
    EngineFamily(
        family_id="TOY_2JZ_30_I6",
        common_name="Toyota 2JZ-GE/2JZ-GTE 3.0L Inline-6",
        manufacturer="Toyota",
        displacement_l=3.0,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        cambelt_interval_years=10,
        oil_spec="5W-40 API SL",
        oil_capacity_l=5.4,
        coolant_spec="Toyota Long Life Coolant (red)",
        transmission_options=["4AT_A340E", "6MT_V160_GETRAG"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("cambelt_full", 750, 1100, 4.5, 6.0, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 340, 0.7, 1.1, "basic_service_premium"),
        ],
        notes="Aristo JZS147/JZS161, Soarer JZZ31, Crown JZS155/175, Supra JZA80, "
              "Mark II Wagon Qualis. 2JZ-GTE twin-turbo is the legendary one.",
    ),

    # 1HZ 4.2 diesel inline-6 — BELT — Land Cruiser 80/100/Coaster
    EngineFamily(
        family_id="TOY_1HZ_42_DIESEL_I6",
        common_name="Toyota 1HZ 4.2L Diesel Inline-6",
        manufacturer="Toyota",
        displacement_l=4.2,
        cylinders=6,
        fuel="diesel",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=150000,
        cambelt_interval_years=10,
        oil_spec="15W-40 API CI-4 (heavy duty)",
        oil_capacity_l=9.6,
        coolant_spec="Toyota Long Life Coolant (red)",
        transmission_options=["5MT_H151F", "4AT_A442F"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("cambelt_full", 1000, 1500, 5.0, 7.0, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 280, 420, 0.7, 1.1, "brake_pads_mid"),
            JobAnchor("basic_service", 250, 350, 0.9, 1.3, "basic_service_premium"),
        ],
        notes="Land Cruiser HZJ80/HZJ105, Coaster HZB50/HZB60, Hiace LH178/LH184 (some). "
              "Indirect injection, mechanical pump — very durable. Belt.",
    ),

    # 1KZ-TE 3.0 turbodiesel — BELT — Hilux Surf, Prado KZJ95, Hiace
    EngineFamily(
        family_id="TOY_1KZTE_30_TDIESEL",
        common_name="Toyota 1KZ-TE 3.0L Turbo Diesel",
        manufacturer="Toyota",
        displacement_l=3.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=150000,
        cambelt_interval_years=10,
        oil_spec="15W-40 ACEA E5/E7",
        oil_capacity_l=7.4,
        coolant_spec="Toyota Long Life Coolant (red)",
        transmission_options=["5MT_R150F", "4AT_A340F"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 900, 1300, 4.5, 6.0, "cambelt_hilux_diesel_1kd_2kd"),
            JobAnchor("brake_pads_front", 230, 350, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Hilux Surf KZN185, Prado KZJ90/95/120, Hilux KZN165, Hiace KZH106/116. "
              "Belt 150,000km. Predecessor to 1KD-FTV.",
    ),

    # 5L-E 3.0 diesel — BELT — older Hilux/Hiace
    EngineFamily(
        family_id="TOY_5LE_30_DIESEL",
        common_name="Toyota 5L-E 3.0L Diesel",
        manufacturer="Toyota",
        displacement_l=3.0,
        cylinders=4,
        fuel="diesel",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=150000,
        oil_spec="15W-40 ACEA E5",
        oil_capacity_l=7.5,
        coolant_spec="Toyota Long Life Coolant (red)",
        transmission_options=["5MT", "4AT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("cambelt_full", 800, 1100, 4.0, 5.5, "cambelt_hilux_diesel_1kd_2kd"),
            JobAnchor("brake_pads_front", 200, 320, 0.6, 1.0, "brake_pads_economy"),
            JobAnchor("basic_service", 200, 290, 0.8, 1.2, "basic_service_economy"),
        ],
        notes="Hilux LN167/172, Hiace LH172/178, Toyoace, Dyna. Belt. Mechanical injection.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # HONDA — older B/F/J series
    # ════════════════════════════════════════════════════════════════════

    # Honda B16A / B16B / B18C / B20B — chain — Civic Type R EK9, Integra Type R DC2/DC5, CR-V RD1
    EngineFamily(
        family_id="HON_B_SERIES_16_18_20",
        common_name="Honda B-series 1.6/1.8/2.0L VTEC",
        manufacturer="Honda",
        displacement_l=1.8,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        oil_spec="5W-30 API SL/SM",
        oil_capacity_l=4.0,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["5MT", "4AT", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 600, 900, 3.5, 5.0, "cambelt_japanese_economy"),
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.8, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 280, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Civic Type R EK9 (B16B), Integra Type R DC2/DC5 (B18C/K20A), CR-V RD1 (B20B), "
              "Civic SiR EK4, Integra DC2. Belt 100,000km. NB: DC5 Type R uses K20A — "
              "see TOY/HON K20.",
    ),

    # Honda F20B / F22B / F23A — chain — Accord, Odyssey RA1, Prelude
    EngineFamily(
        family_id="HON_F_SERIES_20_22_23",
        common_name="Honda F-series 2.0/2.2/2.3L",
        manufacturer="Honda",
        displacement_l=2.3,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        oil_spec="5W-30 API SL",
        oil_capacity_l=4.2,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["4AT", "5MT", "5AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 600, 900, 3.5, 5.0, "cambelt_japanese_economy"),
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 280, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Accord CF3/CF4/CL7/CL9 (F20B/F23A), Odyssey RA1/RA2/RA3 (F22B/F23A), "
              "Prelude BB5/BB6 (F22B), Stepwgn RF1/RF2 (F23A). Belt.",
    ),

    # Honda J30 / J35 V6 — belt — Odyssey RB1/RB3, Legend KB1, MDX, Accord CM2
    EngineFamily(
        family_id="HON_J_SERIES_V6",
        common_name="Honda J-series 3.0/3.5L V6",
        manufacturer="Honda",
        displacement_l=3.5,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=160000,
        cambelt_interval_years=10,
        oil_spec="5W-30 Honda Genuine",
        oil_capacity_l=4.5,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["5AT", "6AT", "9AT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("cambelt_full", 800, 1150, 4.5, 6.0, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 280, 420, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 250, 340, 0.7, 1.1, "basic_service_premium"),
        ],
        notes="Odyssey RA6/RB1/RB3 V6, Legend KB1/KB2, MDX YD1/YD2, Accord CM2 V6, "
              "Pilot, Ridgeline, Acura TL/TLX V6. Belt 160,000km.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # NISSAN — older + diesel
    # ════════════════════════════════════════════════════════════════════

    # Nissan SR20DE / SR20DET 2.0 — chain — Primera, Bluebird, Almera, X-Trail T30, Pulsar GTI-R
    EngineFamily(
        family_id="NIS_SR20_20",
        common_name="Nissan SR20DE/SR20DET 2.0L",
        manufacturer="Nissan",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SL/SM",
        oil_capacity_l=3.4,
        coolant_spec="Nissan Long Life Coolant (green, older / blue, newer)",
        transmission_options=["5MT", "4AT", "CVT_RE0F06A"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 190, 290, 0.5, 0.8, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 280, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Primera P11/P12, Bluebird U13/U14, Almera N16, X-Trail T30, Wingroad Y11, "
              "Pulsar GTI-R N14 (SR20DET), Silvia S13/S14/S15 (SR20DET). Chain.",
    ),

    # Nissan VQ25/VQ30 V6 — chain — Cefiro, Maxima, Fuga
    EngineFamily(
        family_id="NIS_VQ25_VQ30_V6",
        common_name="Nissan VQ25/VQ30 2.5/3.0L V6",
        manufacturer="Nissan",
        displacement_l=3.0,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SL/SM",
        oil_capacity_l=4.0,
        coolant_spec="Nissan Long Life Coolant (green)",
        transmission_options=["4AT", "5AT_RE5R05A"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 260, 400, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 330, 0.7, 1.1, "basic_service_premium"),
        ],
        notes="Cefiro A32/A33, Maxima A32/A33, Skyline V35 250GT (VQ25HR), Fuga Y50 (VQ25HR), "
              "Stagea M35 (VQ25/VQ30). Chain.",
    ),

    # Nissan YD25DDTi 2.5 diesel — chain — Navara D40, Pathfinder R51, Cabstar
    EngineFamily(
        family_id="NIS_YD25_25_DIESEL",
        common_name="Nissan YD25DDTi 2.5L Diesel",
        manufacturer="Nissan",
        displacement_l=2.5,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 ACEA C3 (Nissan KLAM5)",
        oil_capacity_l=6.9,
        coolant_spec="Nissan Long Life Coolant (blue)",
        transmission_options=["6MT", "5AT_RE5R05A", "7AT_RE7R01B"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Navara D40 2005-2015, Navara D23 2015+ (early models), Pathfinder R51, "
              "Cabstar, NP300. Chain — but known for chain stretch on early models <80,000km. "
              "Flag at intake if customer reports rattle.",
    ),

    # Nissan ZD30 3.0 diesel — BELT — Patrol Y61, Caravan, older Elgrand diesel
    EngineFamily(
        family_id="NIS_ZD30_30_DIESEL",
        common_name="Nissan ZD30DDTi 3.0L Diesel",
        manufacturer="Nissan",
        displacement_l=3.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=100000,
        oil_spec="15W-40 ACEA E5/E7",
        oil_capacity_l=8.5,
        coolant_spec="Nissan Long Life Coolant (green)",
        transmission_options=["5MT", "4AT_RE4R03A"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 900, 1300, 4.5, 6.0, "cambelt_hilux_diesel_1kd_2kd"),
            JobAnchor("brake_pads_front", 240, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Patrol Y61 GU 3.0, Caravan E25 3.0, Elgrand E51 3.0 diesel, Cabstar. "
              "Belt 100,000km. Earlier ZD30 (pre-2007) has piston issues — flag if engine "
              "has not been rebuilt and is high km.",
    ),

    # Nissan VK56DE / VK56VD 5.6 V8 — chain — Patrol Y62
    EngineFamily(
        family_id="NIS_VK56_56_V8",
        common_name="Nissan VK56 5.6L V8",
        manufacturer="Nissan",
        displacement_l=5.6,
        cylinders=8,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=6.7,
        coolant_spec="Nissan Long Life Coolant (blue)",
        transmission_options=["7AT_RE7R01A"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 320, 480, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 280, 380, 0.8, 1.2, "basic_service_premium"),
        ],
        notes="Patrol Y62, Armada, QX56/QX80. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # MAZDA — older NA + rotary
    # ════════════════════════════════════════════════════════════════════

    # Mazda B6 / BP / FS — belt — Familia, MX-5 NA/NB, 323, Capella
    EngineFamily(
        family_id="MAZ_B6_BP_FS_LEGACY",
        common_name="Mazda B6/BP/FS 1.6/1.8/2.0L",
        manufacturer="Mazda",
        displacement_l=1.8,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        oil_spec="5W-30 API SL",
        oil_capacity_l=4.0,
        coolant_spec="Mazda FL22 (yellow) or older green LLC",
        transmission_options=["4AT", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("cambelt_full", 500, 750, 3.0, 4.5, "cambelt_japanese_economy"),
            JobAnchor("brake_pads_front", 160, 250, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 160, 230, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Familia BJ/BG, 323 BJ, MX-5 NA/NB (B6/BP), Capella GF/GH (FS), "
              "Demio DW (B3/B5). Belt.",
    ),

    # Mazda 13B-REW / 13B-MSP rotary — N/A timing (rotor housings) — RX-7 FD3S, RX-8
    EngineFamily(
        family_id="MAZ_13B_ROTARY",
        common_name="Mazda 13B Rotary (13B-REW / RENESIS)",
        manufacturer="Mazda",
        displacement_l=1.3,
        cylinders=0,
        fuel="petrol",
        aspiration="turbo",
        timing_type="none",
        oil_spec="10W-40 mineral or rotary-specific (NOT synthetic for apex seals)",
        oil_capacity_l=4.0,
        coolant_spec="Mazda green LLC",
        transmission_options=["5MT", "6MT", "4AT", "6AT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 280, 420, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 250, 340, 0.7, 1.1, "basic_service_mid",
                      notes="Premix oil required if not running OMP. No cambelt — but apex "
                            "seal life is the real maintenance concern."),
            JobAnchor("rotor_rebuild", 6000, 12000, 25.0, 40.0, "comprehensive_service_premium",
                      confidence=2,
                      notes="Full rebuild — apex seals, side seals, rotor housings. NZ "
                            "specialist territory. Common at 80,000-150,000km."),
        ],
        notes="RX-7 FD3S 1992-2002 (13B-REW twin turbo), RX-8 SE3P 2003-2012 (13B-MSP RENESIS NA). "
              "No timing belt or chain — eccentric shaft, no valves. Apex seals are the wear item.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # MITSUBISHI — EVO 4G63, 6G7x, older diesels
    # ════════════════════════════════════════════════════════════════════

    # Mitsubishi 4G63T / 4G63 2.0 — BELT — Lancer EVO IV-IX, Galant VR-4, RVR turbo
    EngineFamily(
        family_id="MIT_4G63_20_TURBO",
        common_name="Mitsubishi 4G63T 2.0L Turbo",
        manufacturer="Mitsubishi",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=100000,
        cambelt_interval_years=7,
        oil_spec="5W-40 API SL/SM (synthetic)",
        oil_capacity_l=4.0,
        coolant_spec="Mitsubishi Super Long Life (green)",
        transmission_options=["5MT", "6MT", "5SST_DCT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("cambelt_full", 700, 1000, 4.0, 5.5, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 280, 420, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 330, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Lancer EVO IV-IX (CN9A, CP9A, CT9A, CT9W), Galant VR-4 EC5A, RVR Hyper Sports R, "
              "Eclipse GS-T D32A. Belt 100,000km mandatory.",
    ),

    # Mitsubishi 6G72 / 6G74 V6 — BELT — Pajero V60/V80, Galant V6, GTO/3000GT, Eclipse V6
    EngineFamily(
        family_id="MIT_6G72_6G74_V6",
        common_name="Mitsubishi 6G72/6G74 3.0/3.5L V6",
        manufacturer="Mitsubishi",
        displacement_l=3.5,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        oil_spec="5W-30 API SL/SM",
        oil_capacity_l=4.5,
        coolant_spec="Mitsubishi Super Long Life (green)",
        transmission_options=["4AT", "5AT", "5MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 750, 1050, 4.5, 6.0, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 230, 350, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 300, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Pajero V63/V73/V83 (6G72), Pajero V65/V75 (6G74), Galant E84A V6, "
              "GTO/3000GT Z16A (6G72TT), Eclipse D38A V6, Diamante F31A. Belt 100,000km.",
    ),

    # Mitsubishi 4D56 2.5 diesel — BELT — older Triton, Pajero, L300, Delica
    EngineFamily(
        family_id="MIT_4D56_25_DIESEL",
        common_name="Mitsubishi 4D56 2.5L Turbo Diesel",
        manufacturer="Mitsubishi",
        displacement_l=2.5,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=100000,
        cambelt_interval_years=7,
        oil_spec="15W-40 ACEA E5",
        oil_capacity_l=6.5,
        coolant_spec="Mitsubishi Super Long Life (green)",
        transmission_options=["5MT", "4AT", "5AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 850, 1200, 4.5, 6.0, "cambelt_hilux_diesel_1kd_2kd"),
            JobAnchor("brake_pads_front", 220, 340, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Triton MK/ML/MN 2.5 1996-2015, Pajero V44/V46 2.5, Pajero Sport K94W, "
              "L300/Delica P25W/P35W, Challenger PA. Belt 100,000km.",
    ),

    # Mitsubishi 4M40 / 4M41 3.2 diesel — chain — Pajero NM/NP/NS/NT
    EngineFamily(
        family_id="MIT_4M41_32_DIESEL",
        common_name="Mitsubishi 4M40/4M41 2.8/3.2L Diesel",
        manufacturer="Mitsubishi",
        displacement_l=3.2,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 ACEA E5/C3",
        oil_capacity_l=8.5,
        coolant_spec="Mitsubishi Super Long Life (green)",
        transmission_options=["5MT", "5AT_INVECS"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 330, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Pajero NM/NP/NS/NT/NW/NX 3.2 DiD 2000-2021, Triton ML 3.2 (limited), "
              "Pajero Sport. Chain.",
    ),

    # Mitsubishi 4G15 / 4G18 1.5/1.6 — chain — Mirage, older Lancer, Colt
    EngineFamily(
        family_id="MIT_4G15_4G18_15_16",
        common_name="Mitsubishi 4G15/4G18 1.5/1.6L",
        manufacturer="Mitsubishi",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=100000,
        oil_spec="5W-30 API SL",
        oil_capacity_l=3.5,
        coolant_spec="Mitsubishi Super Long Life (green)",
        transmission_options=["4AT", "5MT", "CVT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("cambelt_full", 500, 750, 3.0, 4.5, "cambelt_japanese_economy"),
            JobAnchor("brake_pads_front", 150, 230, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 220, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Mirage CJ4A/CK4A, Lancer CK4A/CS1A/CS5A 1.5/1.6, Colt Z27A, Galant Fortis. "
              "Belt 100,000km.",
    ),

    # Mitsubishi 3B20 / 3A92 1.0/1.2 3-cyl — chain — Mirage A05/A03, Attrage
    EngineFamily(
        family_id="MIT_3A92_3B20_10_12",
        common_name="Mitsubishi 3A92/3B20 1.0-1.2L 3cyl",
        manufacturer="Mitsubishi",
        displacement_l=1.2,
        cylinders=3,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=2.9,
        coolant_spec="Mitsubishi SLLC (green)",
        transmission_options=["CVT_JF015E", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 150, 220, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 210, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Mirage A05A/A03A 2012+, Space Star, Attrage A11A 1.2. Chain.",
    ),

    # Mitsubishi i-MiEV — kei BEV
    EngineFamily(
        family_id="MIT_IMIEV_BEV",
        common_name="Mitsubishi i-MiEV BEV",
        manufacturer="Mitsubishi",
        displacement_l=0.0,
        cylinders=0,
        fuel="bev",
        aspiration="na",
        timing_type="none",
        oil_spec="N/A",
        coolant_spec="Mitsubishi battery coolant (separate loop)",
        transmission_options=["1_speed_reducer"],
        segment_tier="bev",
        service_interval_km=20000,
        job_anchors=[
            JobAnchor("brake_pads_front", 180, 280, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 220, 0.5, 0.9, "basic_service_economy"),
            JobAnchor("hv_battery_used", 4000, 8000, 3.0, 5.0, "hv_battery_leaf_24kwh_used",
                      confidence=2,
                      notes="i-MiEV 16kWh pack — very limited NZ replacement market"),
        ],
        notes="i-MiEV HA3W, Outlander Sport EV (rare). Kei BEV, 16kWh pack. NZ market shrinking "
              "as range too limited for many uses.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # SUBARU — H6, diesel
    # ════════════════════════════════════════════════════════════════════

    # Subaru EE20 2.0 diesel — BELT — Forester SH/SJ, Outback BR/BS, Legacy BM (Euro market mainly, some in NZ)
    EngineFamily(
        family_id="SUB_EE20_20_DIESEL",
        common_name="Subaru EE20 2.0L Boxer Diesel",
        manufacturer="Subaru",
        displacement_l=2.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=160000,
        oil_spec="5W-30 ACEA C3",
        oil_capacity_l=5.6,
        coolant_spec="Subaru Super Coolant (blue)",
        transmission_options=["6MT", "Lineartronic_CVT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 1000, 1400, 5.5, 7.5, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 240, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 330, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Forester SH/SJ 2.0D, Outback BR/BS 2.0D, Legacy BM 2.0D, Impreza GH/GP 2.0D, "
              "XV GP 2.0D. Boxer diesel — rare globally but some in NZ.",
    ),

    # Subaru EZ30 / EZ36 H6 — chain — Outback BP/BR/BS 3.0/3.6, Legacy GT-spec B, Tribeca
    EngineFamily(
        family_id="SUB_EZ30_EZ36_H6",
        common_name="Subaru EZ30/EZ36 3.0/3.6L H6 Boxer",
        manufacturer="Subaru",
        displacement_l=3.6,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN (synthetic)",
        oil_capacity_l=6.6,
        coolant_spec="Subaru Super Coolant (blue)",
        transmission_options=["5AT", "Lineartronic_CVT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 260, 360, 0.8, 1.2, "basic_service_premium"),
        ],
        notes="Outback BP9 3.0R, BR9 3.6R, BS9 3.6R, Legacy 3.0R Spec B, Tribeca B9. "
              "Chain — no scheduled replacement.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # VW — older + diesel additions
    # ════════════════════════════════════════════════════════════════════

    # VW EA111 1.4 TSI Twincharger — chain — older Golf 5/6 1.4 TSI, Polo 6R GTI, Tiguan 1.4 TSI (early)
    EngineFamily(
        family_id="VW_EA111_14_TSI",
        common_name="VW EA111 1.4 TSI Twincharger",
        manufacturer="Volkswagen",
        displacement_l=1.4,
        cylinders=4,
        fuel="petrol",
        aspiration="twin-turbo",
        timing_type="chain",
        oil_spec="5W-30 VW 504 00",
        oil_capacity_l=3.6,
        coolant_spec="VW G12+ (pink)",
        transmission_options=["6MT", "DSG7_DQ200"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 280, 380, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Golf MK5/6 1.4 TSI 2006-2013 (CAVD/CTHD), Polo 6R GTI (CAVE), Tiguan 5N 1.4 TSI "
              "(early), Audi A1 1.4 TFSI (CAVG), Scirocco 1.4 TSI. CHAIN (distinct from EA211 "
              "BELT). Known for timing chain stretch — flag at intake. NB: this engine REPLACED "
              "by EA211 (belt) from ~2012-2013.",
    ),

    # VW EA113 2.0 TFSI — chain — older Golf GTI MK5, Audi A3 8P, A4 B7
    EngineFamily(
        family_id="VW_EA113_20_TFSI",
        common_name="VW EA113 2.0 TFSI",
        manufacturer="Volkswagen",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=160000,
        oil_spec="5W-30 VW 502 00",
        oil_capacity_l=4.6,
        coolant_spec="VW G12+ (pink)",
        transmission_options=["6MT", "DSG6_DQ250"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("cambelt_full", 1100, 1500, 4.5, 6.0, "cambelt_euro_premium",
                      confidence=2),
            JobAnchor("brake_pads_front", 320, 480, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 320, 420, 0.8, 1.2, "basic_service_premium"),
        ],
        notes="Golf GTI MK5 2005-2009 (BWA/AXX/BYD), Audi A3 8P 2.0 TFSI (BWA), Audi A4 B7 "
              "2.0 TFSI (BWE/BUL), SEAT Leon Cupra 1P. BELT (distinct from EA888 chain).",
    ),

    # Audi 3.0 TDI (CDYA/CCWA/CRCA) — chain — A4 B8/B9, A6 C7, Q7, Q5, Touareg
    EngineFamily(
        family_id="AUDI_30_TDI_V6",
        common_name="Audi 3.0L TDI V6",
        manufacturer="Audi",
        displacement_l=3.0,
        cylinders=6,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 VW 507 00",
        oil_capacity_l=6.5,
        coolant_spec="VW G13 (purple/lilac)",
        transmission_options=["8AT_ZF8HP", "7DSG_DL501"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 420, 600, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 400, 540, 0.9, 1.3, "basic_service_premium"),
            JobAnchor("comprehensive_service", 600, 850, 1.6, 2.4, "comprehensive_service_premium"),
        ],
        notes="A4 B8/B9 3.0 TDI, A6 C7/C8 3.0 TDI, Q5 8R/FY 3.0 TDI, Q7 4L/4M 3.0 TDI, "
              "Touareg 7P. Chain — rear-mounted (engine-out for replacement). Includes some "
              "Dieselgate-affected variants.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # HOLDEN
    # ════════════════════════════════════════════════════════════════════

    # Holden Alloytec LY7 / LFW 3.6 V6 — chain — Commodore VE/VF, Captiva 7, Statesman WM
    EngineFamily(
        family_id="HOL_ALLOYTEC_36_V6",
        common_name="Holden Alloytec LY7/LFW 3.6L V6",
        manufacturer="Holden",
        displacement_l=3.6,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SM/SN",
        oil_capacity_l=5.7,
        coolant_spec="GM Dex-Cool (orange)",
        transmission_options=["5AT_5L40-E", "6AT_6L50", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 400, 540, 1.4, 2.0, "comprehensive_service_mid"),
        ],
        notes="Commodore VE/VF SV6/Calais V6, Statesman WM/WN, Captiva 7 LY7, Rodeo/Colorado RA "
              "3.6, Crewman VZ. Chain — known for chain stretch on early LY7 (pre-2008).",
    ),

    # Holden Ecotec L36 / L67 3.8 V6 — chain — VT/VX/VY/VZ Commodore, WH/WK/WL Statesman
    EngineFamily(
        family_id="HOL_ECOTEC_38_V6",
        common_name="Holden Ecotec L36/L67 3.8L V6",
        manufacturer="Holden",
        displacement_l=3.8,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="10W-30 API SL",
        oil_capacity_l=4.5,
        coolant_spec="GM Dex-Cool (orange)",
        transmission_options=["4AT_4L60-E", "5AT_5L40-E", "5MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 290, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Commodore VT/VX/VY/VZ Executive/Acclaim, Berlina VT-VZ, Statesman WH/WK/WL, "
              "Calais VT-VZ. L67 is supercharged. Chain.",
    ),

    # Holden LS1 / L98 / LS2 / LS3 V8 — chain — HSV, SS Commodore VE/VF
    EngineFamily(
        family_id="HOL_LS_V8",
        common_name="Holden/HSV LS-series V8 (LS1/L98/LS2/LS3)",
        manufacturer="Holden",
        displacement_l=6.0,
        cylinders=8,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="10W-40 API SM (track) / 5W-30 (street)",
        oil_capacity_l=5.7,
        coolant_spec="GM Dex-Cool (orange)",
        transmission_options=["6MT_TR6060", "6AT_6L80"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 380, 580, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 260, 360, 0.7, 1.1, "basic_service_premium"),
        ],
        notes="SS Commodore VE/VF (L98 6.0/L77 6.0/LS3 6.2), HSV GTS/Clubsport/Maloo VE/VF "
              "(LS3 6.2/LSA 6.2 SC), Statesman/Caprice WM/WN V8. Chain. Iconic NZ V8 family.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # FORD AUSTRALIA
    # ════════════════════════════════════════════════════════════════════

    # Ford Barra (Cyclone) 4.0 inline-6 — chain — Falcon BA/BF/FG, Territory, Ute
    EngineFamily(
        family_id="FORD_BARRA_40_I6",
        common_name="Ford Barra 4.0L Inline-6 (Cyclone)",
        manufacturer="Ford",
        displacement_l=4.0,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 Ford WSS-M2C913-D",
        oil_capacity_l=5.5,
        coolant_spec="Ford Super Plus Premium (orange)",
        transmission_options=["5AT", "6AT_ZF6HP", "6MT_T56"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Falcon BA/BF/FG/FG-X (XR6, XR6 Turbo, G6E, G6E Turbo, XR8 has different engine), "
              "Territory SY/SZ, Falcon Ute. Barra Turbo variants run higher boost — same engine "
              "family. Chain. Cult NZ import status.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # LEXUS-specific (Toyota-shared engines covered already)
    # ════════════════════════════════════════════════════════════════════

    # Lexus 2GR-FSE 3.5 D4S — chain — IS350, GS350, RC350, RX350
    EngineFamily(
        family_id="LEX_2GRFSE_35_D4S",
        common_name="Lexus 2GR-FSE 3.5L D4S V6",
        manufacturer="Lexus",
        displacement_l=3.5,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 Toyota Genuine",
        oil_capacity_l=6.0,
        coolant_spec="Toyota Super Long Life (pink)",
        transmission_options=["8AT_UA80", "6AT_A960E"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 380, 560, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 320, 420, 0.8, 1.2, "basic_service_premium"),
        ],
        notes="IS350 GSE21/31, GS350 GRS191/196/L10, RC350 GSC10, RX350 GGL15. D4S dual injection. Chain.",
    ),

    # Lexus 2UR-GSE 5.0 V8 — chain — IS-F, RC-F, GS-F
    EngineFamily(
        family_id="LEX_2URGSE_50_V8",
        common_name="Lexus 2UR-GSE 5.0L V8",
        manufacturer="Lexus",
        displacement_l=5.0,
        cylinders=8,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-30 Toyota Genuine",
        oil_capacity_l=7.4,
        coolant_spec="Toyota Super Long Life (pink)",
        transmission_options=["8AT_AA80E"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 500, 750, 0.7, 1.1, "brake_pads_luxury"),
            JobAnchor("basic_service", 420, 580, 0.9, 1.3, "basic_service_premium"),
        ],
        notes="IS-F USE20, RC-F USC10, GS-F URL10, LC500 URZ100. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # SUZUKI — older + kei
    # ════════════════════════════════════════════════════════════════════

    # Suzuki K6A / F6A 660cc kei — chain — Wagon R, Alto Works, Cappuccino, Jimny JB23
    EngineFamily(
        family_id="SUZ_K6A_F6A_KEI",
        common_name="Suzuki K6A/F6A 660cc Kei",
        manufacturer="Suzuki",
        displacement_l=0.66,
        cylinders=3,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 API SL",
        oil_capacity_l=2.8,
        coolant_spec="Suzuki Long Life Coolant (green)",
        transmission_options=["3AT", "4AT", "5MT", "CVT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 140, 220, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 220, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Wagon R MC/MH/MH21, Alto HA12/HA23/HA25, Jimny JB23 (K6A turbo), Cappuccino EA11R, "
              "Cervo HG21, Carry, Every. Kei-class. Chain.",
    ),

    # Suzuki K10C 1.0 BoosterJet — chain — Swift RST Turbo, Vitara 1.0T, Baleno 1.0T
    EngineFamily(
        family_id="SUZ_K10C_10_TURBO",
        common_name="Suzuki K10C 1.0L BoosterJet Turbo",
        manufacturer="Suzuki",
        displacement_l=1.0,
        cylinders=3,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=3.4,
        coolant_spec="Suzuki Long Life (blue)",
        transmission_options=["5MT", "6AT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 170, 260, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 170, 240, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Swift RST/Sport ZC83 1.0T, Vitara LY 1.0T, Baleno 1.0T, Ignis. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # DAIHATSU — kei
    # ════════════════════════════════════════════════════════════════════

    # Daihatsu KF 660cc kei — chain — Mira, Tanto, Move, Hijet, Copen
    EngineFamily(
        family_id="DAI_KF_KEI",
        common_name="Daihatsu KF 660cc Kei",
        manufacturer="Daihatsu",
        displacement_l=0.66,
        cylinders=3,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 API SL",
        oil_capacity_l=2.7,
        coolant_spec="Daihatsu LLC (green)",
        transmission_options=["CVT", "4AT", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 140, 220, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 220, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Mira L275/L285/L375/L385, Tanto L350/L375, Move L150/L175/L185, Hijet S210, "
              "Copen L880K (early)/LA400K. Chain. Kei-class.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # CHINESE / EMERGING
    # ════════════════════════════════════════════════════════════════════

    # MG SAIC 15S4C / 15E4E — chain — MG ZS, MG HS, MG3
    EngineFamily(
        family_id="MG_SAIC_15_TURBO",
        common_name="MG/SAIC 1.5L Turbo (15S4C / 15E4E)",
        manufacturer="MG",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.0,
        coolant_spec="SAIC long-life (red)",
        transmission_options=["7DCT", "6AT", "CVT", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 180, 280, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 180, 260, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="MG ZS 2018+, MG HS 2019+, MG3 2018+, MG5 wagon. Confidence 2 on pricing — "
              "limited NZ workshop pricing visibility. Chain.",
    ),

    # BYD Blade LFP BEV — Atto 3, Dolphin, Seal
    EngineFamily(
        family_id="BYD_BLADE_BEV",
        common_name="BYD Blade LFP BEV",
        manufacturer="BYD",
        displacement_l=0.0,
        cylinders=0,
        fuel="bev",
        aspiration="na",
        timing_type="none",
        oil_spec="N/A",
        coolant_spec="BYD coolant (cell-to-pack LFP, lower thermal management requirements)",
        transmission_options=["1_speed_reducer"],
        segment_tier="bev",
        service_interval_km=20000,
        service_interval_months=12,
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 180, 260, 0.5, 0.9, "basic_service_economy"),
            JobAnchor("hv_battery_replacement", 18000, 30000, 4.0, 6.0,
                      "hv_battery_leaf_40kwh_upgrade", confidence=1,
                      notes="BYD Blade LFP pack — out of warranty replacement pricing speculative. "
                            "No mature NZ replacement market yet. Flag manual quote."),
        ],
        notes="Atto 3 2022+, Dolphin 2023+, Seal 2023+. LFP chemistry — different lifecycle/cost "
              "profile to NMC. Confidence 2 on pricing.",
    ),

    # GWM 4N20 2.0 turbo petrol — chain — Haval H6, Jolion, Tank 300
    EngineFamily(
        family_id="GWM_4N20_20_TURBO",
        common_name="GWM 4N20 2.0L Turbo",
        manufacturer="GWM",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.5,
        coolant_spec="GWM coolant (pink)",
        transmission_options=["7DCT", "9AT_DCT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Haval H6 2021+, Jolion 2021+ 1.5T variant uses 4B15A — this entry covers 2.0T. "
              "Tank 300. Chain. Confidence 2 on NZ pricing.",
    ),

    # LDV V80/G10/T60/T70/D90/Deliver 9 — Maxus diesel SC25R/SC28R
    EngineFamily(
        family_id="LDV_MAXUS_DIESEL",
        common_name="LDV/Maxus 2.0/2.8L Diesel",
        manufacturer="LDV",
        displacement_l=2.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 ACEA C3",
        oil_capacity_l=6.0,
        coolant_spec="LDV coolant (green)",
        transmission_options=["6MT", "6AT", "8AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="T60 ute 2017+, T70, D90 SUV, V80 van, Deliver 9 van, G10 van. Chain. "
              "Confidence 2 on NZ pricing.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # MERCEDES — additional engines
    # ════════════════════════════════════════════════════════════════════

    # Mercedes OM651 2.1 diesel — chain — C/E-class CDI, GLK, Sprinter, Vito
    EngineFamily(
        family_id="MB_OM651_21_DIESEL",
        common_name="Mercedes OM651 2.1L CDI",
        manufacturer="Mercedes-Benz",
        displacement_l=2.1,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 MB 229.51/229.52",
        oil_capacity_l=6.5,
        coolant_spec="MB Coolant (blue, OAT)",
        transmission_options=["7G-Tronic", "9G-Tronic", "6MT"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 400, 580, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 380, 520, 0.9, 1.3, "basic_service_premium"),
            JobAnchor("comprehensive_service", 580, 800, 1.6, 2.4, "comprehensive_service_premium"),
        ],
        notes="C200/220/250 CDI W204/W205, E200/220/250 CDI W212/W213, GLK220/250 CDI X204, "
              "Vito/V-Class W639/W447, Sprinter NCV3/VS30. Chain.",
    ),

    # Mercedes M271 1.8 supercharged/turbo — chain — C200 Kompressor, E200 Kompressor, SLK200K
    EngineFamily(
        family_id="MB_M271_18_FORCED",
        common_name="Mercedes M271 1.8L Kompressor/Turbo",
        manufacturer="Mercedes-Benz",
        displacement_l=1.8,
        cylinders=4,
        fuel="petrol",
        aspiration="supercharged",
        timing_type="chain",
        oil_spec="5W-40 MB 229.5",
        oil_capacity_l=6.0,
        coolant_spec="MB Coolant (blue)",
        transmission_options=["5AT", "7G-Tronic", "6MT"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 380, 560, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 380, 500, 0.9, 1.3, "basic_service_premium"),
        ],
        notes="C200/180 Kompressor W203/W204, C250 CGI Turbo W204, E200 Kompressor W211, "
              "SLK200/250 R171/R172, CLK200 Kompressor C209. M271 EVO is the turbo variant. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # HYUNDAI / KIA — additional
    # ════════════════════════════════════════════════════════════════════

    # Hyundai/Kia G4KD / G4KE 2.0/2.4 Theta II — chain — older Sonata/Sportage/Optima/Tucson
    EngineFamily(
        family_id="HKM_THETA_II_20_24",
        common_name="Hyundai/Kia Theta II 2.0/2.4L (G4KD/G4KE)",
        manufacturer="Hyundai-Kia",
        displacement_l=2.4,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.3,
        coolant_spec="Hyundai/Kia OAT Coolant (pink/red)",
        transmission_options=["6AT", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 290, 0.7, 1.1, "basic_service_economy"),
        ],
        notes="Sonata YF/LF 2.0/2.4, Sportage SL 2.0/2.4 (older), Tucson IX/LM 2.0/2.4, "
              "Optima TF, Santa Fe DM 2.4 GDI, Forte. Chain. Known engine failure issues at "
              "high km on 2.4 GDI — flag at intake.",
    ),

    # Hyundai/Kia G6DA / Lambda V6 3.5/3.8 — chain — Genesis, Equus, Veracruz, Santa Fe V6
    EngineFamily(
        family_id="HKM_LAMBDA_V6",
        common_name="Hyundai/Kia Lambda 3.3/3.8L V6 (G6DH/G6DA)",
        manufacturer="Hyundai-Kia",
        displacement_l=3.8,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=6.5,
        coolant_spec="Hyundai/Kia OAT (pink/red)",
        transmission_options=["8AT", "6AT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 280, 420, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 260, 360, 0.7, 1.1, "basic_service_premium"),
        ],
        notes="Genesis BH/DH 3.3/3.8, Equus VI 4.6/5.0, Veracruz EN 3.8, Santa Fe DM/TM 3.5 V6, "
              "Stinger CK 3.3T. Chain.",
    ),

    # Hyundai/Kia Smartstream 1.6 hybrid (Kappa hybrid) — chain — Niro, Ioniq, Kona, Tucson hybrid
    EngineFamily(
        family_id="HKM_SMARTSTREAM_16_HYBRID",
        common_name="Hyundai/Kia Smartstream/Kappa 1.6L Hybrid",
        manufacturer="Hyundai-Kia",
        displacement_l=1.6,
        cylinders=4,
        fuel="hybrid_petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN/SP",
        oil_capacity_l=3.8,
        coolant_spec="Hyundai/Kia OAT (pink/red) + inverter coolant",
        transmission_options=["6DCT_hybrid"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 210, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 280, 0.6, 1.0, "basic_service_mid"),
            JobAnchor("hv_battery_refurb", 2500, 4500, 3.0, 4.5,
                      "hv_battery_aqua_prius_g23_new", confidence=2,
                      notes="Li-Po pack — newer chemistry than Toyota NiMH. Refurb market less developed."),
        ],
        notes="Niro DE Hybrid, Niro DE PHEV, Ioniq AE Hybrid, Kona OS Hybrid, Tucson NX4 Hybrid, "
              "Sportage NQ5 Hybrid, Sonata DN8 Hybrid, Elantra CN7 Hybrid. Chain. 6-speed DCT "
              "with integrated motor — distinct from Toyota e-CVT.",
    ),

    # Hyundai/Kia EV — Ioniq EV / Kona EV / Niro EV / Ioniq 5 / EV6 / EV9
    EngineFamily(
        family_id="HKM_EV_BEV",
        common_name="Hyundai/Kia BEV (E-GMP and predecessors)",
        manufacturer="Hyundai-Kia",
        displacement_l=0.0,
        cylinders=0,
        fuel="bev",
        aspiration="na",
        timing_type="none",
        oil_spec="N/A",
        coolant_spec="Hyundai EV coolant (battery + motor loops)",
        transmission_options=["1_speed_reducer"],
        segment_tier="bev",
        service_interval_km=20000,
        job_anchors=[
            JobAnchor("brake_pads_front", 280, 420, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 320, 0.5, 1.0, "basic_service_mid"),
        ],
        notes="Ioniq AE EV 28/38kWh, Kona OS EV 39/64kWh, Niro DE EV 39/64kWh, Ioniq 5 NE 58/77kWh, "
              "Ioniq 6 CE, EV6 CV 58/77kWh, EV9. NMC chemistry, 400V (pre-E-GMP) and 800V (E-GMP). "
              "No NZ-fitted out-of-warranty pack replacement market yet — flag manual quote.",
    ),

]


if __name__ == "__main__":
    from engine_families import ENGINE_FAMILIES
    combined = ENGINE_FAMILIES + ADDITIONAL_FAMILIES
    by_mfr: dict[str, int] = {}
    for f in combined:
        by_mfr[f.manufacturer] = by_mfr.get(f.manufacturer, 0) + 1
    print(f"Chunk 1 families:    {len(ENGINE_FAMILIES)}")
    print(f"Chunk 2a additions:  {len(ADDITIONAL_FAMILIES)}")
    print(f"Total combined:      {len(combined)}")
    print(f"By manufacturer: {sorted(by_mfr.items(), key=lambda x: -x[1])}")
