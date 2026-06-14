"""
TORQUED — Engine Family Registry (NZ Light Vehicle Fleet)

Architecture: vehicles point to engine families. Pricing and specs live on
the family, not the vehicle. ~60-80 families cover 90%+ of the NZ fleet.

Pricing anchors are GST-INCLUSIVE NZD, sourced from real NZ workshop pages.
Every anchor carries `source_url` and `searched_on` (2026-06-12).

Job time fields are hours (low, high) — labour rate is intentionally not
encoded here; mechanics set their own rates in Torqued.

Confidence levels per field:
  - timing_type, oil_spec, coolant_spec: high (OEM-published)
  - cambelt_interval_km: high
  - job_anchors total_job_low/high: high where source_url is a NZ workshop
    quoting an actual price; medium where decomposed from a tier average
  - segment_tier: used to apply tier-based pricing for jobs without a
    family-specific anchor (brake pads, basic service, etc.)
"""

from dataclasses import dataclass, field
from typing import Optional


# ──────────────────────────────────────────────────────────────────────
# NZ PRICING ANCHORS — from web searches 2026-06-12
# ──────────────────────────────────────────────────────────────────────
# These are the source-of-truth ranges that all family-level prices derive
# from. Each anchor cites the NZ workshop page it was pulled from.

NZ_ANCHORS = {
    # Cambelt — MechanicNearMe.co.nz, Jan 2026
    "cambelt_japanese_economy": {
        "range": (500, 800),
        "source": "https://mechanicnearme.co.nz/blog/cambelt-replacement-cost-nz/",
        "note": "Japanese economy cars, includes water pump",
    },
    "cambelt_japanese_mid": {
        "range": (650, 950),
        "source": "https://myautoshop.co.nz/cambelt-replacement/volkswagen",
        "note": "Mid-range Japanese (Subaru, larger Toyotas)",
    },
    "cambelt_vw_ea211": {
        # Miles Continental VW NZ — Golf 5 from $909, Tiguan from $959
        "range": (850, 1200),
        "source": "https://www.milescontinental.co.nz/news/advice/benefits-genuine-timing-cam-belts/",
        "note": "VW EA211 1.4 TSI (Golf 5/6/7, Tiguan, Polo, T-Roc). NOTE: 210,000km interval per VW TSB — reinforced kevlar belt",
    },
    "cambelt_euro_premium": {
        "range": (1200, 2000),
        "source": "https://mechanicnearme.co.nz/blog/cambelt-replacement-cost-nz/",
        "note": "European premium (Audi A4/A6, BMW where applicable)",
    },
    "cambelt_ford_ranger_wet_belt": {
        # Ford Ranger 3.2 TDCi wet belt — kaar.co.nz confirmed multiple jobs in West Auckland
        "range": (1800, 2800),
        "source": "https://www.kaar.co.nz/ford-ranger-wet-belt-replacement-what-you-need-to-know-in-nz/",
        "note": "Ford Ranger 3.2 TDCi wet belt + oil pump where required",
    },
    "cambelt_hilux_diesel_1kd_2kd": {
        "range": (900, 1400),
        "source": "https://www.scribd.com/document/446410863/maintenance-schedule-hilux-gd-series",
        "note": "Hilux 1KD-FTV/2KD-FTV 3.0/2.5 D-4D, 150,000km interval",
    },
    # Brake pads per axle — Sims Brakes NZ Jul 2025, TravelCarsNZ May 2025
    "brake_pads_economy": {
        "range": (150, 250),
        "source": "https://www.simsbrakes.co.nz/blogs/brake-pads-replacement-cost",
        "note": "Economy cars per axle, parts+labour, GST inc",
    },
    "brake_pads_mid": {
        "range": (250, 400),
        "source": "https://www.simsbrakes.co.nz/blogs/brake-pads-replacement-cost",
        "note": "Mid-range vehicles per axle, parts+labour, GST inc",
    },
    "brake_pads_luxury": {
        "range": (400, 600),
        "source": "https://www.simsbrakes.co.nz/blogs/brake-pads-replacement-cost",
        "note": "Luxury/performance per axle, parts+labour, GST inc",
    },
    # Basic service — My Auto Shop NZ averages
    "basic_service_economy": {
        "range": (150, 230),
        "source": "https://myautoshop.co.nz/info/corolla/",
        "note": "Corolla basic service avg $217",
    },
    "basic_service_mid": {
        "range": (220, 320),
        "source": "https://galeeco.co.nz/toyota/",
        "note": "Toyota Bronze service $120-180 + Hilux 4cyl $205 (Toyota official menu)",
    },
    "basic_service_premium": {
        "range": (280, 450),
        "source": "https://www.toyota.co.nz/globalassets/owners/servicing/menu-pricing/toyota_service_menu_sept_2024.pdf",
        "note": "Toyota LC200 $355, GR Yaris $255 (official Sept 2024 menu)",
    },
    # Comprehensive service
    "comprehensive_service_economy": {
        "range": (280, 380),
        "source": "https://myautoshop.co.nz/info/corolla/",
        "note": "Corolla comprehensive avg $326",
    },
    "comprehensive_service_mid": {
        "range": (380, 550),
        "source": "https://myautoshop.co.nz/info/corolla/",
        "note": "Larger Japanese / Korean mid",
    },
    "comprehensive_service_premium": {
        "range": (550, 850),
        "source": "https://myautoshop.co.nz/info/corolla/",
        "note": "Euro premium",
    },
    # HV batteries — tahaautogroup.co.nz 2026 Auckland averages, Toyota NZ official
    "hv_battery_aqua_prius_g23_refurb": {
        "range": (1500, 2000),
        "source": "https://tahaautogroup.co.nz/hybrid-battery-replacement-cost-nz/",
        "note": "Aqua/Prius gen 2-3 refurbished pack fitted, 12mo warranty",
    },
    "hv_battery_aqua_prius_g23_new": {
        "range": (2000, 4000),
        "source": "https://www.toyota.co.nz/owners/parts-and-accessories/hybrid-batteries/",
        "note": "Toyota Genuine new pack, 5yr/100,000km warranty",
    },
    "hv_battery_camry_hybrid_refurb": {
        "range": (2000, 2500),
        "source": "https://tahaautogroup.co.nz/hybrid-battery-replacement-cost-nz/",
        "note": "Camry hybrid refurb fitted",
    },
    "hv_battery_prius_g4_camry_new": {
        "range": (5000, 7000),
        "source": "https://tahaautogroup.co.nz/hybrid-battery-replacement-cost-nz/",
        "note": "Prius gen 4 / Camry hybrid new genuine fitted at dealer",
    },
    "hv_battery_rav4_hybrid_new": {
        "range": (6000, 8000),
        "source": "https://tahaautogroup.co.nz/hybrid-battery-replacement-cost-nz/",
        "note": "RAV4 hybrid new genuine fitted",
    },
    "hv_battery_leaf_24kwh_used": {
        "range": (4500, 7500),
        "source": "https://evsenhanced.com/services/hv-battery-swaps-and-upgrades/",
        "note": "Leaf 24kWh like-for-like used pack from damaged vehicle, fitted by EVs Enhanced",
    },
    "hv_battery_leaf_40kwh_upgrade": {
        "range": (15000, 23000),
        "source": "https://mynissanleaf.com/threads/nz-battery-replacement.34382/",
        "note": "Leaf 40kWh battery upgrade (was 24kWh) — major capacity upgrade, not like-for-like",
    },
}


# ──────────────────────────────────────────────────────────────────────
# DATA CLASSES
# ──────────────────────────────────────────────────────────────────────

@dataclass
class JobAnchor:
    """A specific job's GST-inclusive total cost range for this engine family."""
    job: str                          # category slug
    total_low: int                    # NZD GST inclusive
    total_high: int
    hours_low: float                  # job time (not labour cost)
    hours_high: float
    source_anchor: str                # key into NZ_ANCHORS
    confidence: int = 3               # 1=guess, 2=tier-derived, 3=family-anchored, 4=mechanic-verified
    notes: str = ""


@dataclass
class EngineFamily:
    family_id: str                    # e.g. "VW_EA211_14_TSI"
    common_name: str                  # e.g. "VW EA211 1.4 TSI"
    manufacturer: str
    displacement_l: float
    cylinders: int
    fuel: str                         # petrol|diesel|hybrid_petrol|phev|bev
    aspiration: str                   # na|turbo|twin-turbo|supercharged
    timing_type: str                  # belt|chain|wet_belt|none
    cambelt_interval_km: Optional[int] = None
    cambelt_interval_years: Optional[int] = None
    oil_spec: str = ""                # e.g. "5W-30 ACEA C3 / VW 504 00"
    oil_capacity_l: Optional[float] = None
    coolant_spec: str = ""            # e.g. "Toyota Super Long Life (pink)"
    transmission_options: list[str] = field(default_factory=list)
    segment_tier: str = "economy"     # economy|mid|premium|luxury|wet_belt|hybrid|bev
    service_interval_km: int = 10000
    service_interval_months: int = 12
    job_anchors: list[JobAnchor] = field(default_factory=list)
    notes: str = ""


# ──────────────────────────────────────────────────────────────────────
# ENGINE FAMILY REGISTRY
# Build order: highest-NZ-fleet-volume first. Each family below is mapped
# to multiple vehicles in vehicles_to_families.py
# ──────────────────────────────────────────────────────────────────────

ENGINE_FAMILIES: list[EngineFamily] = [

    # ════════════════════════════════════════════════════════════════════
    # TOYOTA — dominant share of NZ fleet
    # ════════════════════════════════════════════════════════════════════

    # Toyota 1NZ-FE 1.5L petrol — chain — Yaris/Vitz/Echo/Probox/Succeed/Corolla NZE12x
    EngineFamily(
        family_id="TOY_1NZFE_15",
        common_name="Toyota 1NZ-FE 1.5L",
        manufacturer="Toyota",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN/GF-5 (Toyota 08880-83321)",
        oil_capacity_l=3.7,
        coolant_spec="Toyota Super Long Life Coolant (pink, pre-mixed)",
        transmission_options=["4AT_U340E", "5MT", "CVT_K310"],
        segment_tier="economy",
        service_interval_km=10000,
        service_interval_months=12,
        job_anchors=[
            JobAnchor("brake_pads_front", 150, 250, 0.5, 0.8, "brake_pads_economy",
                      notes="Per axle, economy tier"),
            JobAnchor("brake_pads_rear", 150, 250, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 230, 0.6, 1.0, "basic_service_economy"),
            JobAnchor("comprehensive_service", 280, 380, 1.2, 1.8, "comprehensive_service_economy"),
        ],
        notes="Echo NCP10 1999-2005, Vitz/Yaris NCP91/131 2005-2020, Probox/Succeed NCP50/55, "
              "Corolla NZE121/124 2000-2007, Funcargo NCP21. Timing chain — no scheduled replacement.",
    ),

    # Toyota 2NZ-FE 1.3L petrol — chain — small Yaris/Vitz
    EngineFamily(
        family_id="TOY_2NZFE_13",
        common_name="Toyota 2NZ-FE 1.3L",
        manufacturer="Toyota",
        displacement_l=1.3,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=3.4,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["4AT_U340E", "5MT", "CVT_K310"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 150, 230, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("brake_pads_rear", 150, 230, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 220, 0.5, 1.0, "basic_service_economy",
                      notes="Toyota official menu: Yaris 3-cyl $170 (this engine is 4-cyl, similar pricing)"),
        ],
        notes="Yaris NCP10/13 1999-2005, Vitz KSP90 1.3 variant, Belta SCP92. Timing chain.",
    ),

    # Toyota 1KR-FE 1.0L 3-cylinder petrol — chain — Yaris/Vitz/Aygo/Passo
    EngineFamily(
        family_id="TOY_1KRFE_10",
        common_name="Toyota 1KR-FE 1.0L 3cyl",
        manufacturer="Toyota",
        displacement_l=1.0,
        cylinders=3,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=3.2,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["5MT", "4AT_U340", "CVT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 150, 220, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 210, 0.5, 0.9, "basic_service_economy",
                      notes="Toyota official menu: Yaris 3-cyl $170"),
        ],
        notes="Yaris KSP90 1.0 2005-2010, Vitz KSP90/130 1.0, Aygo, Passo, Daihatsu Boon. "
              "Timing chain — quiet, reliable.",
    ),

    # Toyota 2ZR-FE 1.8L — chain — Corolla ZRE/Auris/Fielder
    EngineFamily(
        family_id="TOY_2ZRFE_18",
        common_name="Toyota 2ZR-FE 1.8L",
        manufacturer="Toyota",
        displacement_l=1.8,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN GF-5 (Toyota 08880-83322)",
        oil_capacity_l=4.4,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["6MT", "CVT_K313", "CVT_K114"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 180, 280, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("brake_pads_rear", 180, 280, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 170, 240, 0.6, 1.0, "basic_service_economy"),
            JobAnchor("comprehensive_service", 290, 380, 1.2, 1.8, "comprehensive_service_economy",
                      notes="My Auto Shop NZ: Corolla comprehensive avg $326"),
        ],
        notes="Corolla ZRE172/182 2012-2019, Auris ZRE15x, Fielder ZRE16x, Avensis ZRT272. "
              "Timing chain. Also basis for 2ZR-FXE hybrid (separate family).",
    ),

    # Toyota 2ZR-FXE 1.8L Atkinson hybrid — chain — Prius gen3/4, Corolla hybrid, Auris hybrid
    EngineFamily(
        family_id="TOY_2ZRFXE_18_HYBRID",
        common_name="Toyota 2ZR-FXE 1.8L Hybrid (Atkinson)",
        manufacturer="Toyota",
        displacement_l=1.8,
        cylinders=4,
        fuel="hybrid_petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN GF-5 (Toyota 08880-83322)",
        oil_capacity_l=4.4,
        coolant_spec="Toyota Super Long Life Coolant (pink) + separate inverter coolant",
        transmission_options=["e-CVT_P410"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid",
                      notes="Regen braking — pads last longer but cost slightly more"),
            JobAnchor("brake_pads_rear", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 180, 260, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 320, 420, 1.4, 2.0, "comprehensive_service_mid"),
            JobAnchor("hv_battery_refurb", 1500, 2000, 2.5, 4.0,
                      "hv_battery_aqua_prius_g23_refurb", confidence=3,
                      notes="Prius gen3 fits in refurb tier; gen4 uses larger pack — see TOY_2ZRFXE_18_HYBRID_G4"),
            JobAnchor("hv_battery_new_genuine", 2000, 4000, 2.5, 4.0,
                      "hv_battery_aqua_prius_g23_new", confidence=3),
        ],
        notes="Prius ZVW30 (gen3) 2009-2015, Prius ZVW50 (gen4) 2015-2022, Corolla hybrid ZWE2xx, "
              "Auris hybrid, Lexus CT200h. Gen4 HV pack is more expensive new — see hv_battery_prius_g4 anchor.",
    ),

    # Toyota 1NZ-FXE 1.5L hybrid — chain — Aqua, Prius gen2, original Prius NHW20
    EngineFamily(
        family_id="TOY_1NZFXE_15_HYBRID",
        common_name="Toyota 1NZ-FXE 1.5L Hybrid",
        manufacturer="Toyota",
        displacement_l=1.5,
        cylinders=4,
        fuel="hybrid_petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=3.7,
        coolant_spec="Toyota Super Long Life Coolant (pink) + inverter coolant",
        transmission_options=["e-CVT_P310"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 180, 280, 0.5, 0.8, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 180, 280, 0.5, 0.8, "brake_pads_mid"),
            JobAnchor("basic_service", 170, 240, 0.6, 1.0, "basic_service_mid"),
            JobAnchor("hv_battery_refurb", 1500, 2000, 2.5, 3.5,
                      "hv_battery_aqua_prius_g23_refurb"),
            JobAnchor("hv_battery_new_genuine", 2000, 4000, 2.5, 3.5,
                      "hv_battery_aqua_prius_g23_new"),
        ],
        notes="Aqua NHP10 2011-2021 (NZ's #1 hybrid import), Prius gen2 NHW20 2003-2009. "
              "Sterling Cars NZ data: 10-12yr / 220,000km pack life typical.",
    ),

    # Toyota 1ZR-FE 1.6L — chain — Corolla 1.6, some Auris
    EngineFamily(
        family_id="TOY_1ZRFE_16",
        common_name="Toyota 1ZR-FE 1.6L",
        manufacturer="Toyota",
        displacement_l=1.6,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.2,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["6MT", "CVT", "4AT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 170, 270, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 170, 240, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Corolla ZRE142 1.6, Auris ZRE151 1.6. Chain.",
    ),

    # Toyota 2AR-FE 2.5L — chain — Camry, RAV4, Lexus ES250
    EngineFamily(
        family_id="TOY_2ARFE_25",
        common_name="Toyota 2AR-FE 2.5L",
        manufacturer="Toyota",
        displacement_l=2.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN GF-5",
        oil_capacity_l=4.4,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["6AT_U760E", "CVT_K112"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 290, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 380, 500, 1.4, 2.0, "comprehensive_service_mid"),
        ],
        notes="Camry ASV50/70, RAV4 ASA44 (2.5L), Lexus ES250, Avalon. Chain.",
    ),

    # Toyota 2AR-FXE 2.5L hybrid — chain — Camry hybrid, RAV4 hybrid (gen 4), Lexus ES300h
    EngineFamily(
        family_id="TOY_2ARFXE_25_HYBRID",
        common_name="Toyota 2AR-FXE 2.5L Hybrid",
        manufacturer="Toyota",
        displacement_l=2.5,
        cylinders=4,
        fuel="hybrid_petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=4.4,
        coolant_spec="Toyota Super Long Life Coolant (pink) + inverter coolant",
        transmission_options=["e-CVT_P314"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 240, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 320, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("hv_battery_refurb", 2000, 2500, 3.0, 4.5,
                      "hv_battery_camry_hybrid_refurb"),
            JobAnchor("hv_battery_new_genuine", 5000, 7000, 3.0, 4.5,
                      "hv_battery_prius_g4_camry_new"),
        ],
        notes="Camry hybrid AVV50/AXVH71, RAV4 hybrid AVA44 gen4, Lexus ES300h, NX300h.",
    ),

    # Toyota A25A-FXS 2.5L hybrid (TNGA) — chain — Camry/RAV4/Harrier hybrid gen5
    EngineFamily(
        family_id="TOY_A25AFXS_25_HYBRID",
        common_name="Toyota A25A-FXS 2.5L Hybrid (TNGA)",
        manufacturer="Toyota",
        displacement_l=2.5,
        cylinders=4,
        fuel="hybrid_petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-16 API SP",
        oil_capacity_l=4.5,
        coolant_spec="Toyota Super Long Life Coolant (pink) + inverter coolant",
        transmission_options=["e-CVT_P810"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 250, 380, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 250, 380, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 340, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("hv_battery_new_genuine", 6000, 8000, 3.0, 4.5,
                      "hv_battery_rav4_hybrid_new"),
        ],
        notes="RAV4 hybrid AXAH54 gen5 (TNGA, 2019+), Camry hybrid AXVH71, Harrier hybrid AXUH80, "
              "Lexus NX350h, ES300h facelift. Newer Li-ion HV pack.",
    ),

    # Toyota 1KD-FTV 3.0L D-4D — TIMING BELT, 150,000km — Hilux/Prado/Hiace
    EngineFamily(
        family_id="TOY_1KDFTV_30_DIESEL",
        common_name="Toyota 1KD-FTV 3.0L D-4D",
        manufacturer="Toyota",
        displacement_l=3.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=150000,
        cambelt_interval_years=10,
        oil_spec="5W-30 ACEA C2/C3 (Toyota 08880-83422)",
        oil_capacity_l=7.5,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["5MT", "5AT_A750F", "6AT_AC60F"],
        segment_tier="mid",
        service_interval_km=10000,
        job_anchors=[
            JobAnchor("cambelt_full", 900, 1400, 4.0, 6.0, "cambelt_hilux_diesel_1kd_2kd",
                      notes="Includes water pump, tensioner, idler. Hilux service manual interval 150,000km"),
            JobAnchor("brake_pads_front", 230, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 230, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 205, 290, 0.8, 1.2, "basic_service_mid",
                      notes="Toyota NZ official menu: Hilux 4cyl $205"),
            JobAnchor("comprehensive_service", 380, 520, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Hilux KUN26 2005-2015, Prado KDJ150 2009-2015, Hiace KDH200/220 2004-2018, "
              "Land Cruiser 70-series. TIMING BELT — replace 150,000km. Famous for timing chain "
              "noise on 1KD is wrong — 1KD has a belt. 1GD-FTV that replaced it has a chain.",
    ),

    # Toyota 2KD-FTV 2.5L D-4D — TIMING BELT, 150,000km — Hilux/Hiace
    EngineFamily(
        family_id="TOY_2KDFTV_25_DIESEL",
        common_name="Toyota 2KD-FTV 2.5L D-4D",
        manufacturer="Toyota",
        displacement_l=2.5,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=150000,
        cambelt_interval_years=10,
        oil_spec="5W-30 ACEA C2/C3",
        oil_capacity_l=6.6,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["5MT", "5AT_A340F"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 900, 1400, 4.0, 6.0, "cambelt_hilux_diesel_1kd_2kd"),
            JobAnchor("brake_pads_front", 230, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 205, 290, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Hilux KUN16/25 2005-2015, Hiace KDH206/216, lower output diesel of the KD family.",
    ),

    # Toyota 1GD-FTV 2.8L — CHAIN — Hilux GUN1xx, Prado, Hiace (current)
    EngineFamily(
        family_id="TOY_1GDFTV_28_DIESEL",
        common_name="Toyota 1GD-FTV 2.8L",
        manufacturer="Toyota",
        displacement_l=2.8,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="0W-30 or 5W-30 fully synthetic (Toyota 08880-83265)",
        oil_capacity_l=7.5,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["6MT", "6AT_AC60F"],
        segment_tier="mid",
        service_interval_km=10000,
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 380, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 240, 380, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.8, 1.2, "basic_service_mid",
                      notes="Toyota NZ official: Hilux 4cyl $205 (1GD slightly higher due to DPF service)"),
            JobAnchor("comprehensive_service", 400, 550, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Hilux GUN126 2015+, Prado GDJ150 2015+, Hiace GDH200/300, Fortuner. "
              "Timing chain — no scheduled replacement. DPF needs highway runs to regen. "
              "Some reports of chain rattle at 130,000km in heavy dust use.",
    ),

    # Toyota 2GD-FTV 2.4L — CHAIN — Hilux entry diesel
    EngineFamily(
        family_id="TOY_2GDFTV_24_DIESEL",
        common_name="Toyota 2GD-FTV 2.4L",
        manufacturer="Toyota",
        displacement_l=2.4,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="0W-30 or 5W-30 fully synthetic",
        oil_capacity_l=6.7,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["6MT", "6AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 230, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Hilux GUN125 2.4 entry diesel 2015+, Fortuner 2.4. Detuned 1GD. Chain.",
    ),

    # Toyota 1GR-FE 4.0L V6 — chain — Hilux V6, Prado, FJ Cruiser, Land Cruiser
    EngineFamily(
        family_id="TOY_1GRFE_40_V6",
        common_name="Toyota 1GR-FE 4.0L V6",
        manufacturer="Toyota",
        displacement_l=4.0,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=5.7,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["5AT_A750F", "6AT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 250, 360, 0.8, 1.2, "basic_service_premium"),
            JobAnchor("comprehensive_service", 420, 580, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Prado GRJ150/120, Hilux GGN15/25, FJ Cruiser GSJ15, Land Cruiser 70-series V6, "
              "Tacoma. Chain both banks.",
    ),

    # Toyota 2GR-FE 3.5L V6 — chain — Camry V6, Aurion, RAV4 3.5, Highlander, Estima
    EngineFamily(
        family_id="TOY_2GRFE_35_V6",
        common_name="Toyota 2GR-FE 3.5L V6",
        manufacturer="Toyota",
        displacement_l=3.5,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=6.1,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["6AT_U660E", "8AT_UA80"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 280, 420, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 250, 360, 0.8, 1.2, "basic_service_premium"),
            JobAnchor("comprehensive_service", 420, 580, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Aurion GSV40/50, Camry V6, RAV4 GSA33 3.5, Highlander/Kluger GSU40/50, "
              "Estima/Tarago GSR50, Lexus ES350, RX350. Chain.",
    ),

    # Toyota 1AZ-FE 2.0L — chain — RAV4 2.0, Avensis, Caldina, older Camry
    EngineFamily(
        family_id="TOY_1AZFE_20",
        common_name="Toyota 1AZ-FE 2.0L",
        manufacturer="Toyota",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SM/SN",
        oil_capacity_l=4.2,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["4AT", "5AT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 180, 280, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 170, 240, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="RAV4 ACA21/31 2.0, Avensis AZT220, Caldina AZT241, Voxy/Noah AZR60. Chain.",
    ),

    # Toyota 2AZ-FE 2.4L — chain — Camry 2.4, RAV4 2.4, Estima, Alphard
    EngineFamily(
        family_id="TOY_2AZFE_24",
        common_name="Toyota 2AZ-FE 2.4L",
        manufacturer="Toyota",
        displacement_l=2.4,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.4,
        coolant_spec="Toyota Super Long Life Coolant (pink)",
        transmission_options=["4AT_U241E", "5AT_U151E", "CVT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 290, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Camry ACV30/40, RAV4 ACA38, Estima ACR50, Alphard ANH20 2.4, Tarago, Ipsum.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # VOLKSWAGEN GROUP — EA211, EA888, EA189
    # ════════════════════════════════════════════════════════════════════

    # VW EA211 1.4 TSI — BELT (reinforced kevlar, 210,000km TSB) — Golf, Tiguan, Polo, T-Roc, Audi A3
    EngineFamily(
        family_id="VW_EA211_14_TSI",
        common_name="VW EA211 1.4 TSI",
        manufacturer="Volkswagen",
        displacement_l=1.4,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=210000,
        cambelt_interval_years=None,
        oil_spec="5W-30 VW 504 00 / 507 00",
        oil_capacity_l=3.6,
        coolant_spec="VW G13 coolant (purple/lilac, OAT)",
        transmission_options=["6MT", "DSG7_DQ200", "DSG7_DQ381"],
        segment_tier="mid",
        service_interval_km=15000,
        service_interval_months=12,
        job_anchors=[
            JobAnchor("cambelt_full", 850, 1200, 4.0, 5.5, "cambelt_vw_ea211",
                      notes="Miles Continental VW NZ: Golf 5 from $909, Tiguan from $959. "
                            "TECHNICAL BULLETIN: reinforced kevlar belt — 210,000km interval, "
                            "but many workshops still default to 5yr/100k. Confirm with VIN."),
            JobAnchor("brake_pads_front", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 280, 380, 0.8, 1.2, "basic_service_mid"),
            JobAnchor("comprehensive_service", 400, 550, 1.4, 2.0, "comprehensive_service_mid"),
        ],
        notes="Engine codes: CHZJ/CHZD/CHZB/CHZC/CHYB (1.0), CJZA/CJZB (1.2), "
              "CGGA/CHPA/CMBA/CPVA/CRJA/CXSA/CZCA/CZDA/CHPB/CZEA (1.4), CPTA (1.4 ACT), "
              "DACA/DADA (1.5). Vehicles: Golf MK7 1.4 TSI 2013-2020, Tiguan 5N/AD1 1.4 TSI, "
              "Polo 6R/AW 1.4 TSI, T-Roc 1.4 TSI 2018+, Audi A3 8V 1.4 TFSI, Skoda Octavia 1.4 TSI, "
              "SEAT Leon 1.4 TSI, Audi A1 1.4. SHARES CAMBELT with Golf GTE / Audi A3 e-tron "
              "(those use DQ400e DCT — separate drivetrain entry).",
    ),

    # VW EA888 2.0 TSI — CHAIN (Gen 3 onwards, chain reliable; Gen 1/2 chain had stretch issues)
    EngineFamily(
        family_id="VW_EA888_20_TSI",
        common_name="VW EA888 2.0 TSI",
        manufacturer="Volkswagen",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 VW 504 00 / 507 00",
        oil_capacity_l=4.6,
        coolant_spec="VW G13 coolant (purple/lilac)",
        transmission_options=["6MT", "DSG6_DQ250", "DSG7_DQ381", "DSG7_DQ500"],
        segment_tier="premium",
        service_interval_km=15000,
        job_anchors=[
            JobAnchor("brake_pads_front", 350, 500, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 320, 480, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 320, 420, 0.8, 1.2, "basic_service_premium"),
            JobAnchor("comprehensive_service", 500, 700, 1.5, 2.2, "comprehensive_service_premium"),
        ],
        notes="Golf GTI/R MK6/7/8, Tiguan 2.0 TSI, Audi A3/S3, A4, A5, A6 2.0 TFSI, Q3/Q5 2.0 TFSI, "
              "Skoda Octavia vRS, SEAT Leon Cupra. Gen3+ chain is reliable; pre-2012 Gen1/2 had "
              "chain stretch — flag at intake if customer reports rattle.",
    ),

    # VW EA189 2.0 TDI — BELT — Dieselgate era diesels (Golf, Passat, Audi A4, Skoda)
    EngineFamily(
        family_id="VW_EA189_20_TDI",
        common_name="VW EA189 2.0 TDI",
        manufacturer="Volkswagen",
        displacement_l=2.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=140000,
        cambelt_interval_years=5,
        oil_spec="5W-30 VW 507 00",
        oil_capacity_l=4.3,
        coolant_spec="VW G13 coolant (purple/lilac)",
        transmission_options=["6MT", "DSG6_DQ250", "DSG7_DQ381"],
        segment_tier="mid",
        service_interval_km=15000,
        job_anchors=[
            JobAnchor("cambelt_full", 1000, 1400, 4.5, 6.0, "cambelt_japanese_mid",
                      confidence=2,
                      notes="Decomposed from Euro mid range; includes water pump"),
            JobAnchor("brake_pads_front", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 300, 400, 0.9, 1.3, "basic_service_mid"),
            JobAnchor("comprehensive_service", 450, 600, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Golf MK6/7 TDI, Passat B7/B8 TDI, Audi A3/A4/A6 2.0 TDI, Skoda Octavia/Superb TDI, "
              "Tiguan 5N TDI. Dieselgate-affected engine — many have had emissions update which "
              "altered fuel economy slightly.",
    ),

    # VW DQ400e DCT — hybrid wet-clutch DSG — Golf GTE, Audi A3 e-tron, Passat GTE
    # Note: this is a DRIVETRAIN family, not engine. Engine is EA211. But for fluid/service
    # purposes Torqued needs both. We model it under a separate transmission_family table.
    # For now, encode as a virtual engine family for these specific vehicles since the
    # quote_resolution flow needs to handle them.
    EngineFamily(
        family_id="VW_EA211_GTE_PHEV",
        common_name="VW EA211 1.4 TSI + DQ400e (GTE/e-tron PHEV)",
        manufacturer="Volkswagen",
        displacement_l=1.4,
        cylinders=4,
        fuel="phev",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=210000,
        oil_spec="5W-30 VW 504 00",
        oil_capacity_l=3.6,
        coolant_spec="VW G13 (engine) + separate G13 inverter loop",
        transmission_options=["DSG6_DQ400e"],
        segment_tier="premium",
        service_interval_km=15000,
        job_anchors=[
            JobAnchor("cambelt_full", 850, 1200, 4.0, 5.5, "cambelt_vw_ea211"),
            JobAnchor("brake_pads_front", 320, 480, 0.6, 1.0, "brake_pads_mid",
                      notes="Regen braking extends pad life"),
            JobAnchor("brake_pads_rear", 320, 480, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 320, 430, 0.8, 1.2, "basic_service_premium"),
            JobAnchor("dq400e_oil_service", 450, 650, 1.5, 2.5, "comprehensive_service_premium",
                      confidence=2,
                      notes="DQ400e wet-clutch DCT requires specific G055540 ATF + filter, "
                            "every 60,000km. NZ workshops vary widely on pricing."),
        ],
        notes="Golf GTE MK7 RAH190-class, Audi A3 e-tron 8V, Passat GTE B8. Engine is EA211 — "
              "same cambelt anchor applies. DQ400e is the differentiating drivetrain (wet-clutch "
              "6-speed DCT with integrated electric motor). HV battery 8.7kWh.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # NISSAN — HR/MR/QR/VQ
    # ════════════════════════════════════════════════════════════════════

    # Nissan HR15DE 1.5L — chain — Tiida, Note, Cube, Wingroad
    EngineFamily(
        family_id="NIS_HR15DE_15",
        common_name="Nissan HR15DE 1.5L",
        manufacturer="Nissan",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=3.4,
        coolant_spec="Nissan Long Life Coolant (blue/green)",
        transmission_options=["4AT", "CVT_RE0F08", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 160, 250, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 170, 240, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Tiida C11/C12 1.5, Note E11/E12, Cube Z12, Wingroad Y12, March K13 1.5, "
              "Pulsar C13. Chain.",
    ),

    # Nissan MR18DE 1.8L — chain — Tiida 1.8, Bluebird Sylphy, Note Nismo
    EngineFamily(
        family_id="NIS_MR18DE_18",
        common_name="Nissan MR18DE 1.8L",
        manufacturer="Nissan",
        displacement_l=1.8,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.3,
        coolant_spec="Nissan Long Life Coolant",
        transmission_options=["CVT_RE0F08", "6MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 170, 270, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 180, 250, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Tiida C11 1.8, Bluebird Sylphy G11, Lafesta B30. Chain.",
    ),

    # Nissan MR20DE 2.0L — chain — X-Trail T31/T32, Qashqai, Serena, Lafesta
    EngineFamily(
        family_id="NIS_MR20DE_20",
        common_name="Nissan MR20DE 2.0L",
        manufacturer="Nissan",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.4,
        coolant_spec="Nissan Long Life Coolant",
        transmission_options=["CVT_RE0F09", "6MT", "6AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 290, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 380, 500, 1.4, 2.0, "comprehensive_service_mid"),
        ],
        notes="X-Trail T31/T32 2.0, Qashqai J10/J11 2.0, Serena C25/C26, Lafesta Highway Star, "
              "Bluebird Sylphy G11 2.0, Wingroad. Chain.",
    ),

    # Nissan QR25DE 2.5L — chain — X-Trail 2.5, Altima, Teana
    EngineFamily(
        family_id="NIS_QR25DE_25",
        common_name="Nissan QR25DE 2.5L",
        manufacturer="Nissan",
        displacement_l=2.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=4.8,
        coolant_spec="Nissan Long Life Coolant",
        transmission_options=["CVT_RE0F10", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 210, 300, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="X-Trail T31/T32 2.5, Altima L32/L33, Teana J32, Murano Z51, Pathfinder R51. Chain.",
    ),

    # Nissan VQ35DE 3.5L V6 — chain — Skyline V35/V36, Murano, Maxima, Teana V6, 350Z
    EngineFamily(
        family_id="NIS_VQ35DE_35_V6",
        common_name="Nissan VQ35DE 3.5L V6",
        manufacturer="Nissan",
        displacement_l=3.5,
        cylinders=6,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN",
        oil_capacity_l=5.0,
        coolant_spec="Nissan Long Life Coolant",
        transmission_options=["5AT_RE5R05A", "7AT_RE7R01A", "6MT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 320, 480, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 260, 360, 0.8, 1.2, "basic_service_premium"),
        ],
        notes="Skyline V35/V36 350GT, Murano Z50/Z51 3.5, Maxima A33/A34, Teana J31/J32 3.5, "
              "350Z Z33, Elgrand E51/E52, Pathfinder R51 V6. Chain.",
    ),

    # Nissan Leaf — BEV — ZE0/AZE0 24/30kWh, ZE1 40/62kWh
    EngineFamily(
        family_id="NIS_LEAF_BEV",
        common_name="Nissan Leaf BEV (ZE0/AZE0/ZE1)",
        manufacturer="Nissan",
        displacement_l=0.0,
        cylinders=0,
        fuel="bev",
        aspiration="na",
        timing_type="none",
        oil_spec="N/A (no engine oil)",
        oil_capacity_l=None,
        coolant_spec="Inverter/motor coolant only — Nissan blue LLC",
        transmission_options=["1_speed_reducer"],
        segment_tier="bev",
        service_interval_km=20000,
        service_interval_months=12,
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid",
                      notes="Regen braking means pads last very long"),
            JobAnchor("brake_pads_rear", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 150, 220, 0.5, 0.9, "basic_service_economy",
                      notes="No engine oil. Cabin filter, brake fluid, inverter coolant check, "
                            "12V battery check."),
            JobAnchor("hv_battery_used_24kwh", 4500, 7500, 3.0, 5.0,
                      "hv_battery_leaf_24kwh_used", confidence=3,
                      notes="EVs Enhanced NZ — used pack from damaged vehicle. Nissan NZ does "
                            "NOT sell new packs."),
            JobAnchor("hv_battery_upgrade_40kwh", 15000, 23000, 4.0, 6.0,
                      "hv_battery_leaf_40kwh_upgrade",
                      notes="Major capacity upgrade, not like-for-like"),
        ],
        notes="Leaf ZE0 24kWh 2011-2017, AZE0 30kWh 2016-2017, ZE1 40kWh 2018+ and 62kWh e+. "
              "NZ's most common EV by far. NO traditional cambelt/oil service.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # MAZDA — SkyActiv-G, LF, ZJ/ZY
    # ════════════════════════════════════════════════════════════════════

    # Mazda SkyActiv-G 2.0L PE-VPS — chain — Mazda3, CX-5, Mazda6, CX-3, Atenza
    EngineFamily(
        family_id="MAZ_SKYACTIVG_20",
        common_name="Mazda SkyActiv-G 2.0L (PE-VPS)",
        manufacturer="Mazda",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 Mazda Original Supra DPF",
        oil_capacity_l=4.2,
        coolant_spec="Mazda FL22 (yellow)",
        transmission_options=["6AT_SkyActiv-Drive", "6MT"],
        segment_tier="mid",
        service_interval_km=10000,
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 290, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 380, 500, 1.4, 2.0, "comprehensive_service_mid"),
        ],
        notes="Mazda3 BM/BN/BP 2.0, CX-5 KE/KF 2.0, Mazda6 GJ 2.0, CX-3 DK, Atenza GJ 2.0, "
              "MX-5 ND 2.0. High compression (13:1 / 14:1) — premium fuel recommended.",
    ),

    # Mazda SkyActiv-G 2.5L PY-VPS — chain — CX-5 2.5, Mazda6 2.5, CX-9 2.5T
    EngineFamily(
        family_id="MAZ_SKYACTIVG_25",
        common_name="Mazda SkyActiv-G 2.5L (PY-VPS)",
        manufacturer="Mazda",
        displacement_l=2.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 Mazda Original",
        oil_capacity_l=4.5,
        coolant_spec="Mazda FL22 (yellow)",
        transmission_options=["6AT_SkyActiv-Drive"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="CX-5 KE/KF 2.5, Mazda6 GJ 2.5, CX-8 KG 2.5, CX-9 TC 2.5 turbo (different tune). Chain.",
    ),

    # Mazda SkyActiv-D 2.2L — chain — CX-5 diesel, Mazda6 diesel, CX-8 diesel
    EngineFamily(
        family_id="MAZ_SKYACTIVD_22",
        common_name="Mazda SkyActiv-D 2.2L (SH-VPTR)",
        manufacturer="Mazda",
        displacement_l=2.2,
        cylinders=4,
        fuel="diesel",
        aspiration="twin-turbo",
        timing_type="chain",
        oil_spec="0W-30 Mazda Original DL-1",
        oil_capacity_l=5.1,
        coolant_spec="Mazda FL22 (yellow)",
        transmission_options=["6AT_SkyActiv-Drive", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 250, 370, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 330, 0.8, 1.2, "basic_service_mid"),
            JobAnchor("comprehensive_service", 420, 550, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="CX-5 KE/KF diesel, Mazda6 GJ diesel, CX-8 KG diesel, Atenza GJ diesel. "
              "Low compression (14:1). DPF requires highway runs. Chain.",
    ),

    # Mazda ZY-VE / ZJ-VE 1.5L — chain — Demio/Mazda2, Verisa
    EngineFamily(
        family_id="MAZ_ZY_VE_15",
        common_name="Mazda ZY-VE 1.5L",
        manufacturer="Mazda",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SM",
        oil_capacity_l=3.5,
        coolant_spec="Mazda FL22 (yellow)",
        transmission_options=["4AT", "5MT", "CVT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 160, 250, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 160, 230, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Demio/Mazda2 DE/DY 1.5, Verisa DC 1.5, Mazda3 BK 1.5.",
    ),

    # Mazda SkyActiv-G 1.5L P5-VPS — chain — Mazda2/Demio DJ, CX-3
    EngineFamily(
        family_id="MAZ_SKYACTIVG_15",
        common_name="Mazda SkyActiv-G 1.5L (P5-VPS)",
        manufacturer="Mazda",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 Mazda Original",
        oil_capacity_l=3.7,
        coolant_spec="Mazda FL22 (yellow)",
        transmission_options=["6AT_SkyActiv-Drive", "6MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 170, 270, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 170, 240, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Mazda2/Demio DJ 2014+, CX-3 DK 1.5, Mazda3 BM 1.5. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # HONDA — L/R/K series + hybrid LDA
    # ════════════════════════════════════════════════════════════════════

    # Honda L13A/L15A 1.3-1.5L i-VTEC — chain — Jazz/Fit, City, Insight (older)
    EngineFamily(
        family_id="HON_L13_L15_13_15",
        common_name="Honda L13A/L15A 1.3-1.5L i-VTEC",
        manufacturer="Honda",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 Honda Genuine",
        oil_capacity_l=3.6,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["5AT", "CVT_HMMF", "5MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 170, 270, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 180, 250, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Jazz/Fit GD/GE/GK 1.3/1.5, City GM, Freed GB, Mobilio GB. Chain.",
    ),

    # Honda L15B 1.5L turbo — chain — Civic FK 1.5T, CR-V RW 1.5T
    EngineFamily(
        family_id="HON_L15B_15T",
        common_name="Honda L15B 1.5L Turbo VTEC",
        manufacturer="Honda",
        displacement_l=1.5,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="0W-20 Honda Genuine",
        oil_capacity_l=3.7,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["CVT", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Civic FK7/FK8 1.5T 2017-2021, CR-V RW 1.5T 2017+, Accord CV3 1.5T. Chain.",
    ),

    # Honda R18A 1.8L i-VTEC — chain — Civic FD, Stream, Stepwgn
    EngineFamily(
        family_id="HON_R18A_18",
        common_name="Honda R18A 1.8L i-VTEC",
        manufacturer="Honda",
        displacement_l=1.8,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 Honda Genuine",
        oil_capacity_l=4.0,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["5AT", "CVT", "6MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 180, 280, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 190, 260, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Civic FD1/FD2 1.8, Stream RN6 1.8, Stepwgn RG1/RG2 1.8, Edix BE1. Chain.",
    ),

    # Honda K20A/K20Z/K20C 2.0L — chain — Civic, Integra, CR-V, Accord, Civic Type R FK8
    EngineFamily(
        family_id="HON_K20_20",
        common_name="Honda K20 2.0L i-VTEC",
        manufacturer="Honda",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 Honda Genuine",
        oil_capacity_l=4.4,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["5AT", "6MT", "CVT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 300, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Civic FD2 Type R, Integra DC5, CR-V RE3/4, Accord CL/CM 2.0, Stream RN8, "
              "Edix BE3. Chain. K20C turbo in FK8 Type R is separate higher-spec variant.",
    ),

    # Honda K24A/K24Z/K24W 2.4L — chain — Accord, CR-V 2.4, Odyssey, Step Wagon Spada
    EngineFamily(
        family_id="HON_K24_24",
        common_name="Honda K24 2.4L i-VTEC",
        manufacturer="Honda",
        displacement_l=2.4,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 Honda Genuine",
        oil_capacity_l=4.4,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["5AT", "CVT", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 230, 350, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 230, 350, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Accord CL9/CU2/CR2 2.4, CR-V RE4/RM4/RW1 2.4, Odyssey RB1/RB3/RC1 2.4, "
              "Step Wagon Spada RG/RK/RP. Chain.",
    ),

    # Honda LEA / LDA hybrid 1.3/1.5 — chain — Fit/Insight/Civic hybrid IMA, then i-DCD
    EngineFamily(
        family_id="HON_LDA_IMA_HYBRID",
        common_name="Honda LDA 1.3L IMA Hybrid",
        manufacturer="Honda",
        displacement_l=1.3,
        cylinders=4,
        fuel="hybrid_petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 Honda Genuine",
        oil_capacity_l=3.6,
        coolant_spec="Honda Type 2 Long Life (blue)",
        transmission_options=["CVT_IMA"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 190, 270, 0.6, 1.0, "basic_service_mid"),
            JobAnchor("hv_battery_refurb", 1800, 2800, 2.5, 4.0, "hv_battery_aqua_prius_g23_refurb",
                      confidence=2,
                      notes="Honda IMA pack — similar tier to Aqua/Prius gen2 refurb"),
        ],
        notes="Fit Hybrid GP1 1.3 IMA, Insight ZE2 1.3 IMA, Civic Hybrid FD3 1.3 IMA. "
              "Honda IMA (Integrated Motor Assist) — single-motor mild hybrid.",
    ),

    # Honda LEB 1.5 i-DCD hybrid — chain — Fit Hybrid GP5, Vezel/HR-V hybrid, Grace/City
    EngineFamily(
        family_id="HON_LEB_15_IDCD_HYBRID",
        common_name="Honda LEB 1.5L i-DCD Hybrid",
        manufacturer="Honda",
        displacement_l=1.5,
        cylinders=4,
        fuel="hybrid_petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 Honda Genuine",
        oil_capacity_l=3.7,
        coolant_spec="Honda Type 2 Long Life (blue) + inverter coolant",
        transmission_options=["7DCT_iDCD"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 200, 280, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("hv_battery_refurb", 2000, 3200, 2.5, 4.0, "hv_battery_aqua_prius_g23_refurb",
                      confidence=2,
                      notes="i-DCD Li-ion pack — refurb tier higher than IMA NiMH"),
        ],
        notes="Fit Hybrid GP5/GP6 1.5, Vezel/HR-V RU3/RU4 hybrid, Grace/City GM4/GM5 hybrid, "
              "Freed Hybrid GB7. Honda i-DCD: 7-speed DCT with motor between engine and gearbox.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # SUBARU — EJ, FB, FA boxer
    # ════════════════════════════════════════════════════════════════════

    # Subaru EJ20 / EJ25 boxer petrol — BELT (pre-2012) — Impreza, Legacy, Forester, Outback
    EngineFamily(
        family_id="SUB_EJ25_25_BOXER_BELT",
        common_name="Subaru EJ25 2.5L Boxer (belt-driven)",
        manufacturer="Subaru",
        displacement_l=2.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=160000,
        cambelt_interval_years=10,
        oil_spec="5W-30 API SN (synthetic)",
        oil_capacity_l=4.0,
        coolant_spec="Subaru Super Coolant (blue)",
        transmission_options=["4EAT", "5AT", "5MT", "Lineartronic_CVT_TR580"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("cambelt_full", 800, 1200, 4.5, 6.5, "cambelt_japanese_mid",
                      notes="Boxer engine cambelt — more labour due to access. "
                            "Replace water pump + tensioner at same time."),
            JobAnchor("brake_pads_front", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 220, 340, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 310, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 400, 540, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Impreza GD/GG/GH 2.5, Legacy BL/BP 2.5, Forester SG/SH 2.5, Outback BP/BR 2.5. "
              "Belt-driven (pre-2012). FB25 successor is chain.",
    ),

    # Subaru EJ20 turbo — BELT — WRX/STI GC8/GD/GR, Forester XT, Legacy GT
    EngineFamily(
        family_id="SUB_EJ20_20_TURBO",
        common_name="Subaru EJ20 2.0L Turbo Boxer",
        manufacturer="Subaru",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="belt",
        cambelt_interval_km=160000,
        cambelt_interval_years=10,
        oil_spec="5W-40 API SN (synthetic)",
        oil_capacity_l=4.5,
        coolant_spec="Subaru Super Coolant (blue)",
        transmission_options=["5MT", "6MT", "4EAT", "5AT"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("cambelt_full", 900, 1300, 4.5, 6.5, "cambelt_japanese_mid"),
            JobAnchor("brake_pads_front", 300, 450, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 250, 360, 0.8, 1.2, "basic_service_premium"),
        ],
        notes="WRX/STI GC8/GD/GR/GV, Forester SG5/SH5 XT, Legacy BL5/BP5 GT, Liberty GT. "
              "Belt-driven.",
    ),

    # Subaru FB20 / FB25 — CHAIN — Forester SJ/SK, Outback BS, Impreza GP, XV
    EngineFamily(
        family_id="SUB_FB25_25_CHAIN",
        common_name="Subaru FB25 2.5L Boxer (chain)",
        manufacturer="Subaru",
        displacement_l=2.5,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN (synthetic)",
        oil_capacity_l=4.4,
        coolant_spec="Subaru Super Coolant (blue)",
        transmission_options=["Lineartronic_CVT_TR580", "6MT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 230, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 230, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("comprehensive_service", 400, 540, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Forester SJ/SK 2.5 2012+, Outback BS 2.5 2014+, Legacy BN 2.5 2014+, "
              "Impreza GP/GT 2.5, Crosstrek/XV 2.5. Chain — no replacement interval.",
    ),

    # Subaru FB20 — CHAIN — Impreza GP, XV/Crosstrek, Forester SJ 2.0
    EngineFamily(
        family_id="SUB_FB20_20_CHAIN",
        common_name="Subaru FB20 2.0L Boxer (chain)",
        manufacturer="Subaru",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN (synthetic)",
        oil_capacity_l=4.0,
        coolant_spec="Subaru Super Coolant (blue)",
        transmission_options=["Lineartronic_CVT_TR580", "6MT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 210, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 220, 300, 0.7, 1.1, "basic_service_economy"),
        ],
        notes="Impreza GP/GT 2.0 2011+, XV/Crosstrek 2.0, Forester SJ 2.0. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # FORD — Ranger/Everest diesels + others
    # ════════════════════════════════════════════════════════════════════

    # Ford Duratorq P5-AT 3.2 TDCi — WET BELT — Ranger PX1/2/3 3.2, Everest 3.2, Mazda BT-50 3.2
    EngineFamily(
        family_id="FORD_P5AT_32_TDCI",
        common_name="Ford Duratorq 3.2 TDCi (P5-AT)",
        manufacturer="Ford",
        displacement_l=3.2,
        cylinders=5,
        fuel="diesel",
        aspiration="turbo",
        timing_type="wet_belt",
        cambelt_interval_km=240000,
        cambelt_interval_years=10,
        oil_spec="5W-30 Ford WSS-M2C913-D (ACEA C2)",
        oil_capacity_l=8.5,
        coolant_spec="Ford Super Plus Premium (orange)",
        transmission_options=["6MT", "6AT_6R80"],
        segment_tier="wet_belt",
        service_interval_km=15000,
        job_anchors=[
            JobAnchor("wet_belt_replacement", 1800, 2800, 6.0, 9.0,
                      "cambelt_ford_ranger_wet_belt", confidence=3,
                      notes="Wet belt is INSIDE engine, runs in oil. NZ workshops (KAAR Auckland) "
                            "doing this job regularly. Includes new belt + oil pump pickup screen "
                            "where needed. Significantly more labour than dry belt."),
            JobAnchor("brake_pads_front", 280, 420, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 260, 400, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 250, 350, 0.8, 1.2, "basic_service_premium"),
            JobAnchor("comprehensive_service", 450, 600, 1.5, 2.2, "comprehensive_service_mid"),
        ],
        notes="Ranger PX1/PX2/PX3 3.2 2011-2022, Everest UA 3.2, Mazda BT-50 UR 3.2 (same engine). "
              "WET BELT — runs in oil bath. Critical: many workshops still treating it like a dry "
              "belt. Oil-change discipline matters — degraded oil causes belt failure.",
    ),

    # Ford Duratorq P4-AT 2.2 TDCi — wet belt — Ranger PX/PX2 2.2, Transit
    EngineFamily(
        family_id="FORD_P4AT_22_TDCI",
        common_name="Ford Duratorq 2.2 TDCi (P4-AT)",
        manufacturer="Ford",
        displacement_l=2.2,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="wet_belt",
        cambelt_interval_km=240000,
        cambelt_interval_years=10,
        oil_spec="5W-30 Ford WSS-M2C913-D",
        oil_capacity_l=6.0,
        coolant_spec="Ford Super Plus Premium (orange)",
        transmission_options=["6MT", "6AT_6R80"],
        segment_tier="wet_belt",
        job_anchors=[
            JobAnchor("wet_belt_replacement", 1500, 2400, 5.5, 8.5,
                      "cambelt_ford_ranger_wet_belt", confidence=2),
            JobAnchor("brake_pads_front", 260, 400, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 340, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Ranger PX1/PX2/PX3 2.2 (lower spec), Transit Custom 2.2. Wet belt same as 3.2.",
    ),

    # Ford 2.0L Bi-Turbo YN2S — CHAIN — Ranger PX3, Everest UA2, Raptor (lesser variant)
    EngineFamily(
        family_id="FORD_YN2S_20_BITURBO",
        common_name="Ford 2.0L Bi-Turbo (YN2S)",
        manufacturer="Ford",
        displacement_l=2.0,
        cylinders=4,
        fuel="diesel",
        aspiration="twin-turbo",
        timing_type="chain",
        oil_spec="5W-30 Ford WSS-M2C913-D",
        oil_capacity_l=6.0,
        coolant_spec="Ford Super Plus Premium (orange)",
        transmission_options=["10AT_10R80"],
        segment_tier="premium",
        job_anchors=[
            JobAnchor("brake_pads_front", 300, 450, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 280, 380, 0.8, 1.2, "basic_service_premium"),
        ],
        notes="Ranger PX3 2.0 Bi-Turbo 2018+, Everest UA2 2.0 BiT, Ranger Wildtrak. "
              "Chain — no scheduled replacement.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # MITSUBISHI
    # ════════════════════════════════════════════════════════════════════

    # Mitsubishi 4N15 2.4 MIVEC diesel — chain — Triton, Pajero Sport
    EngineFamily(
        family_id="MIT_4N15_24_DIESEL",
        common_name="Mitsubishi 4N15 2.4L MIVEC Diesel",
        manufacturer="Mitsubishi",
        displacement_l=2.4,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 ACEA C2",
        oil_capacity_l=6.4,
        coolant_spec="Mitsubishi Super Long Life Coolant (green)",
        transmission_options=["6MT", "6AT", "8AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Triton MQ/MR 2015+, Pajero Sport QE/QF 2015+. Chain. DPF.",
    ),

    # Mitsubishi 4B11 / 4B12 2.0/2.4 — chain — Lancer CY, Outlander GF, ASX/RVR
    EngineFamily(
        family_id="MIT_4B11_4B12_20_24",
        common_name="Mitsubishi 4B11/4B12 2.0/2.4L",
        manufacturer="Mitsubishi",
        displacement_l=2.4,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=4.3,
        coolant_spec="Mitsubishi Super Long Life Coolant (green)",
        transmission_options=["CVT_JF011E", "5MT", "6AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 210, 320, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 210, 300, 0.7, 1.1, "basic_service_mid"),
        ],
        notes="Lancer CY 2.0/2.4, Outlander GF 2.4, ASX/RVR GA 2.0/2.4, Eclipse Cross GK. Chain.",
    ),

    # Mitsubishi Outlander PHEV — 2.4 4B12 + twin motor — chain — GG2W/GG3W
    EngineFamily(
        family_id="MIT_OUTLANDER_PHEV_24",
        common_name="Mitsubishi Outlander PHEV 2.4L + twin motor",
        manufacturer="Mitsubishi",
        displacement_l=2.4,
        cylinders=4,
        fuel="phev",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=4.3,
        coolant_spec="Mitsubishi SLLC (green) + separate inverter coolant",
        transmission_options=["e-CVT_PHEV"],
        segment_tier="hybrid",
        job_anchors=[
            JobAnchor("brake_pads_front", 240, 360, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.7, 1.1, "basic_service_mid"),
            JobAnchor("hv_battery_refurb", 4000, 7000, 3.5, 5.5, "hv_battery_camry_hybrid_refurb",
                      confidence=2,
                      notes="Outlander PHEV HV pack 12-13.8kWh — larger than Toyota hybrids, "
                            "refurb pricing extrapolated. Verify with NZ Mitsubishi specialist."),
        ],
        notes="Outlander GG2W/GG3W PHEV 2013-2021, GN0W 2022+. Series/parallel hybrid with "
              "twin motors. NZ has many — first PHEV SUV in market.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # SUZUKI
    # ════════════════════════════════════════════════════════════════════

    # Suzuki K12B 1.2L — chain — Swift, Solio, Alto
    EngineFamily(
        family_id="SUZ_K12B_12",
        common_name="Suzuki K12B 1.2L",
        manufacturer="Suzuki",
        displacement_l=1.2,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=3.1,
        coolant_spec="Suzuki Long Life Coolant (blue)",
        transmission_options=["5MT", "4AT", "CVT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 150, 230, 0.4, 0.7, "brake_pads_economy"),
            JobAnchor("basic_service", 150, 220, 0.5, 0.9, "basic_service_economy"),
        ],
        notes="Swift ZC72/ZC83 1.2, Solio MA15, Alto HA36 (1.0 K10C also similar). Chain.",
    ),

    # Suzuki K14B / K14C 1.4L — chain — Swift Sport, Vitara, S-Cross
    EngineFamily(
        family_id="SUZ_K14_14",
        common_name="Suzuki K14B/K14C 1.4L",
        manufacturer="Suzuki",
        displacement_l=1.4,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="0W-20 API SN",
        oil_capacity_l=3.5,
        coolant_spec="Suzuki Long Life Coolant (blue)",
        transmission_options=["6MT", "6AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 200, 310, 0.5, 0.9, "brake_pads_mid"),
            JobAnchor("basic_service", 190, 270, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Swift Sport ZC32S/ZC33S, Vitara LY 1.4T, S-Cross 1.4T. Chain.",
    ),

    # Suzuki M16A 1.6L — chain — Swift Sport ZC31, SX4, Vitara 1.6
    EngineFamily(
        family_id="SUZ_M16A_16",
        common_name="Suzuki M16A 1.6L",
        manufacturer="Suzuki",
        displacement_l=1.6,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SM",
        oil_capacity_l=3.5,
        coolant_spec="Suzuki Long Life Coolant (blue)",
        transmission_options=["5MT", "4AT", "CVT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 170, 260, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 170, 240, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="Swift Sport ZC31S, SX4 YA/YB 1.6, Vitara LY 1.6, Aerio. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # HYUNDAI / KIA — shared engines
    # ════════════════════════════════════════════════════════════════════

    # Hyundai/Kia G4FC 1.6L Gamma — BELT — i30 (pre-2012), Cerato, Rio, Accent
    EngineFamily(
        family_id="HKM_G4FC_16",
        common_name="Hyundai/Kia G4FC 1.6L Gamma",
        manufacturer="Hyundai-Kia",
        displacement_l=1.6,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="belt",
        cambelt_interval_km=160000,
        cambelt_interval_years=10,
        oil_spec="5W-30 API SM/SN",
        oil_capacity_l=3.5,
        coolant_spec="Hyundai/Kia OAT Coolant (pink/red)",
        transmission_options=["4AT", "5MT", "6AT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("cambelt_full", 550, 800, 3.5, 5.0, "cambelt_japanese_economy"),
            JobAnchor("brake_pads_front", 170, 270, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 180, 250, 0.6, 1.0, "basic_service_economy"),
        ],
        notes="i30 FD 2007-2012, Cerato TD 2009-2013, Rio JB/UB, Accent MC/RB 1.6, Soul AM. "
              "BELT — replace 160,000km. Later G4FG (chain) is separate family.",
    ),

    # Hyundai/Kia G4FG / G4NA / G4KH — CHAIN — i30 PD, Cerato BD, Sportage, Tucson, Sonata
    EngineFamily(
        family_id="HKM_G4FG_G4NA_CHAIN",
        common_name="Hyundai/Kia G4FG 1.6 / G4NA 2.0 Gamma/Nu (chain)",
        manufacturer="Hyundai-Kia",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="na",
        timing_type="chain",
        oil_spec="5W-30 API SN/SP",
        oil_capacity_l=4.2,
        coolant_spec="Hyundai/Kia OAT Coolant (pink/red)",
        transmission_options=["6AT", "6MT", "7DCT"],
        segment_tier="economy",
        job_anchors=[
            JobAnchor("brake_pads_front", 190, 290, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("brake_pads_rear", 190, 290, 0.5, 0.8, "brake_pads_economy"),
            JobAnchor("basic_service", 190, 270, 0.6, 1.0, "basic_service_economy"),
            JobAnchor("comprehensive_service", 320, 430, 1.4, 2.0, "comprehensive_service_economy"),
        ],
        notes="i30 PD 2017+, Cerato BD 2018+, Sportage QL 2.0, Tucson TL 2.0, Sonata LF/DN8 2.0, "
              "Elantra AD 2.0, Forte. Chain.",
    ),

    # Hyundai/Kia D4FB / D4HA diesel — chain — i30 CRDi, Sportage CRDi, Tucson CRDi
    EngineFamily(
        family_id="HKM_D4HA_20_DIESEL",
        common_name="Hyundai/Kia D4HA 2.0L CRDi (R-Series)",
        manufacturer="Hyundai-Kia",
        displacement_l=2.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 ACEA C3",
        oil_capacity_l=6.5,
        coolant_spec="Hyundai/Kia OAT Coolant (pink/red)",
        transmission_options=["6MT", "6AT", "8AT"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 220, 340, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 230, 320, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="Sportage SL/QL 2.0 CRDi, Tucson IX/TL CRDi, Santa Fe DM/TM CRDi, Sorento UM CRDi, "
              "i30 GD/PD CRDi, Carnival YP. Chain. DPF.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # ISUZU
    # ════════════════════════════════════════════════════════════════════

    # Isuzu 4JJ1-TC 3.0L — chain — D-Max RA/RT/RG, MU-X
    EngineFamily(
        family_id="ISU_4JJ1_30_DIESEL",
        common_name="Isuzu 4JJ1-TC 3.0L Diesel",
        manufacturer="Isuzu",
        displacement_l=3.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 ACEA C3",
        oil_capacity_l=7.4,
        coolant_spec="Isuzu Genuine Long Life Coolant (green)",
        transmission_options=["6MT", "6AT_AISIN"],
        segment_tier="mid",
        job_anchors=[
            JobAnchor("brake_pads_front", 250, 380, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("brake_pads_rear", 240, 360, 0.6, 1.0, "brake_pads_mid"),
            JobAnchor("basic_service", 240, 330, 0.8, 1.2, "basic_service_mid"),
        ],
        notes="D-Max RA/RT85/RG 3.0L 2008+, MU-X 3.0L 2014+, Holden Colorado RG 2.8/3.0. "
              "Chain. DPF on later models.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # BMW — selected high-NZ-volume engines
    # ════════════════════════════════════════════════════════════════════

    # BMW N20 2.0 TwinPower turbo — chain — 320i F30, 520i F10, X1/X3 sDrive20i
    EngineFamily(
        family_id="BMW_N20_20_TURBO",
        common_name="BMW N20 2.0L TwinPower Turbo",
        manufacturer="BMW",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 BMW Longlife-01/01FE",
        oil_capacity_l=5.2,
        coolant_spec="BMW Coolant (blue)",
        transmission_options=["8AT_ZF8HP", "6MT"],
        segment_tier="luxury",
        service_interval_km=15000,
        job_anchors=[
            JobAnchor("brake_pads_front", 400, 600, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("brake_pads_rear", 400, 600, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 380, 500, 0.9, 1.3, "basic_service_premium"),
            JobAnchor("comprehensive_service", 600, 850, 1.6, 2.4, "comprehensive_service_premium"),
        ],
        notes="320i/328i F30, 520i F10, X1 F48 sDrive20i, X3 F25 xDrive20i, 220i F22, 420i F32. "
              "Chain — known for stretch issues if oil changes stretched.",
    ),

    # BMW B48 2.0 TwinPower (replacement for N20) — chain
    EngineFamily(
        family_id="BMW_B48_20_TURBO",
        common_name="BMW B48 2.0L TwinPower Turbo",
        manufacturer="BMW",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 BMW Longlife-17FE+",
        oil_capacity_l=5.25,
        coolant_spec="BMW Coolant (blue)",
        transmission_options=["8AT_ZF8HP", "7DCT"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 400, 600, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 400, 520, 0.9, 1.3, "basic_service_premium"),
            JobAnchor("comprehensive_service", 600, 850, 1.6, 2.4, "comprehensive_service_premium"),
        ],
        notes="320i/330i G20, 520i G30, X1 F48 sDrive20i (post-2018), X2 F39, X3 G01 xDrive20i, "
              "230i G42. B48 replaced N20 from ~2014-2018 depending on model.",
    ),

    # BMW N47/B47 2.0 diesel — chain — most NZ-imported 320d/520d/X1d/X3d
    EngineFamily(
        family_id="BMW_B47_20_DIESEL",
        common_name="BMW B47/N47 2.0L Diesel",
        manufacturer="BMW",
        displacement_l=2.0,
        cylinders=4,
        fuel="diesel",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 BMW Longlife-04",
        oil_capacity_l=5.5,
        coolant_spec="BMW Coolant (blue)",
        transmission_options=["8AT_ZF8HP", "6MT"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 400, 600, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 400, 520, 0.9, 1.3, "basic_service_premium"),
            JobAnchor("comprehensive_service", 600, 850, 1.6, 2.4, "comprehensive_service_premium"),
        ],
        notes="320d F30/G20, 520d F10/G30, X1 xDrive18d/20d, X3 xDrive20d. N47 (earlier) had "
              "well-known timing chain failures — flag at intake. B47 (post-2014) much improved.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # MERCEDES-BENZ — selected
    # ════════════════════════════════════════════════════════════════════

    # Mercedes M274 2.0 turbo — chain — C200/C250, E200, GLC200, A250
    EngineFamily(
        family_id="MB_M274_20_TURBO",
        common_name="Mercedes M274 2.0L Turbo",
        manufacturer="Mercedes-Benz",
        displacement_l=2.0,
        cylinders=4,
        fuel="petrol",
        aspiration="turbo",
        timing_type="chain",
        oil_spec="5W-30 MB 229.5/229.51",
        oil_capacity_l=5.5,
        coolant_spec="MB Coolant (blue, OAT)",
        transmission_options=["7G-Tronic", "9G-Tronic"],
        segment_tier="luxury",
        job_anchors=[
            JobAnchor("brake_pads_front", 420, 600, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("brake_pads_rear", 400, 580, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 400, 550, 0.9, 1.3, "basic_service_premium"),
        ],
        notes="C200/C250 W204/W205, E200 W212/W213, GLC200/250 X253, A250 W176/W177, "
              "B250 W246. Chain.",
    ),

    # ════════════════════════════════════════════════════════════════════
    # TESLA
    # ════════════════════════════════════════════════════════════════════

    EngineFamily(
        family_id="TES_MODEL3_BEV",
        common_name="Tesla Model 3 BEV",
        manufacturer="Tesla",
        displacement_l=0.0,
        cylinders=0,
        fuel="bev",
        aspiration="na",
        timing_type="none",
        oil_spec="N/A",
        coolant_spec="Tesla coolant (battery loop + motor loop)",
        transmission_options=["1_speed_reducer"],
        segment_tier="bev",
        service_interval_km=20000,
        service_interval_months=24,
        job_anchors=[
            JobAnchor("brake_pads_front", 350, 550, 0.6, 1.0, "brake_pads_luxury",
                      notes="Regen braking dramatically extends pad life — many cars 100,000km+ "
                            "on original pads."),
            JobAnchor("brake_pads_rear", 350, 550, 0.6, 1.0, "brake_pads_luxury"),
            JobAnchor("basic_service", 200, 350, 0.5, 1.0, "basic_service_mid",
                      notes="Cabin filter, brake fluid, A/C desiccant. No engine oil. "
                            "Tesla recommended interval longer than ICE."),
        ],
        notes="Model 3 Standard Range Plus / Long Range / Performance 2017+. NO engine oil. "
              "No NZ-fitted HV battery replacement market — out-of-warranty pack replacement "
              "is dealer-only at $20,000+ for SR/LR. Flag as 'manual quote required'.",
    ),

]


# ──────────────────────────────────────────────────────────────────────
# COUNTS — for sanity check during expansion
# ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    by_mfr: dict[str, int] = {}
    by_fuel: dict[str, int] = {}
    by_timing: dict[str, int] = {}
    for f in ENGINE_FAMILIES:
        by_mfr[f.manufacturer] = by_mfr.get(f.manufacturer, 0) + 1
        by_fuel[f.fuel] = by_fuel.get(f.fuel, 0) + 1
        by_timing[f.timing_type] = by_timing.get(f.timing_type, 0) + 1
    print(f"Total engine families: {len(ENGINE_FAMILIES)}")
    print(f"By manufacturer: {by_mfr}")
    print(f"By fuel: {by_fuel}")
    print(f"By timing: {by_timing}")
    print(f"NZ pricing anchors: {len(NZ_ANCHORS)}")
