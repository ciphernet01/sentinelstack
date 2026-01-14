
from __future__ import annotations

import importlib
import inspect
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional, Protocol, Sequence, Type

from .context import AssessmentScope


class RegistryError(Exception):
	pass


class Tool(Protocol):
	"""Tool interface expected by the engine.

	Tools must implement:
	- name: str
	- supported_scopes: list[str]
	- run(ctx) -> list[dict]
	"""

	name: str
	supported_scopes: List[AssessmentScope]

	def run(self, ctx: Any) -> List[Dict[str, Any]]: ...


def register_tool(name: str) -> Callable[[Type[Any]], Type[Any]]:
	"""Decorator that marks a class as a scan tool.

	No side-effects: it only annotates the class with metadata.
	The ToolRegistry instance decides what to load/register.
	"""

	def decorator(cls: Type[Any]) -> Type[Any]:
		setattr(cls, "__tool_name__", name)
		return cls

	return decorator


@dataclass(frozen=True, slots=True)
class ToolRegistration:
	tool_type: Type[Any]


class ToolRegistry:
	"""Tool registry for pluggable security tools.

	Maintains a dictionary of registered tool classes.
	"""

	def __init__(self) -> None:
		self._tools: Dict[str, ToolRegistration] = {}

	def register(self, tool_type: Type[Any]) -> None:
		name = getattr(tool_type, "__tool_name__", None) or getattr(tool_type, "name", None)
		if not isinstance(name, str) or not name:
			raise RegistryError("Tool must have a non-empty name (via @register_tool or class.name)")

		if name in self._tools:
			raise RegistryError(f"Tool already registered: {name}")

		self._tools[name] = ToolRegistration(tool_type=tool_type)

	def list_tool_names(self) -> List[str]:
		return sorted(self._tools.keys())

	def resolve_all(self) -> List[Tool]:
		tools: List[Tool] = []
		for name in self.list_tool_names():
			tools.append(self._tools[name].tool_type())
		return tools

	def load_from_modules(self, module_paths: Sequence[str]) -> None:
		"""Import modules and register all classes decorated with @register_tool."""

		for module_path in module_paths:
			module = importlib.import_module(module_path)

			for _, obj in inspect.getmembers(module, inspect.isclass):
				if getattr(obj, "__tool_name__", None):
					self.register(obj)


