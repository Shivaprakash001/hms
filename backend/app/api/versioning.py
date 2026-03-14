from enum import Enum
from typing import Dict, Any, Optional
from datetime import date

class APIVersion(str, Enum):
    V1 = "v1"
    V2 = "v2"

class VersionConfig:
    def __init__(
        self,
        version: APIVersion,
        is_deprecated: bool = False,
        sunset_date: Optional[date] = None,
        description: str = ""
    ):
        self.version = version
        self.is_deprecated = is_deprecated
        self.sunset_date = sunset_date
        self.description = description

        
VERSION_CONFIGS = {
    APIVersion.V1: VersionConfig(
        version=APIVersion.V1,
        description="Current stable version of the HMS API"
    )
}
