from dataclasses import dataclass
from typing import Optional

@dataclass
class Vehicle:
    vehicle_id: str
    make: str
    model: str
    submodel: Optional[str]
    chassis_code: Optional[str]
    year_from: int
    year_to: Optional[int]
    engine_family_id: str
    fuel: str
    body_type: str
    drivetrain: str
    is_jdm_import: bool = False
    notes: str = ""
