from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterable

from .models import Finding, ScanConfig, ScanTarget, ToolMetadata


class Tool(ABC):
    @property
    @abstractmethod
    def metadata(self) -> ToolMetadata:
        raise NotImplementedError

    @abstractmethod
    def run(self, target: ScanTarget, config: ScanConfig) -> Iterable[Finding]:
        raise NotImplementedError
