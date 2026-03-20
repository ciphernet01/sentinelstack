"""
Log Parser Module - Converts various log formats to unified LogEvent
Supports: Apache, Nginx, Syslog, JSON, Spring Boot
"""

import re
import json
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Dict, Any
from urllib.parse import unquote

from app.core.schemas import LogEvent


# ============================================================================
# ABSTRACT BASE PARSER
# ============================================================================

class LogParser(ABC):
    """Abstract base class for all log parsers"""
    
    @abstractmethod
    def parse(self, log_line: str) -> Optional[LogEvent]:
        """Parse log line and return LogEvent or None if parsing fails"""
        pass
    
    def _normalize_timestamp(self, timestamp_str: str, format_str: str = "%d/%b/%Y:%H:%M:%S %z") -> datetime:
        """Normalize timestamp string to UTC datetime"""
        try:
            return datetime.strptime(timestamp_str.replace("+0000", "+0000"), format_str)
        except Exception:
            return datetime.utcnow()
    
    def _extract_ip(self, ip_str: str) -> Optional[str]:
        """Extract and validate IP address"""
        ip_pattern = r'^(?:\d{1,3}\.){3}\d{1,3}$'
        if re.match(ip_pattern, ip_str):
            return ip_str
        return None
    
    def _extract_http_status(self, status_str: str) -> Optional[int]:
        """Extract HTTP status code"""
        try:
            status = int(status_str)
            if 100 <= status <= 599:
                return status
        except (ValueError, TypeError):
            pass
        return None
    
    def _map_level(self, level_str: str) -> str:
        """Map various log level formats to standard levels"""
        level_str = level_str.upper().strip()
        
        if level_str in ["FATAL", "CRITICAL", "EMERGENCY", "ALERT"]:
            return "FATAL"
        elif level_str in ["ERROR", "ERR", "SEVERE"]:
            return "ERROR"
        elif level_str in ["WARN", "WARNING"]:
            return "WARN"
        elif level_str in ["INFO", "INFORMATION"]:
            return "INFO"
        elif level_str in ["DEBUG", "TRACE"]:
            return "DEBUG"
        
        return "INFO"  # Default


# ============================================================================
# 1. APACHE ACCESS LOG PARSER
# ============================================================================

class ApacheAccessParser(LogParser):
    """
    Parses Apache access logs (Combined Log Format)
    Pattern: 127.0.0.1 - user [20/Mar/2026:15:30:45 +0000] "GET /api/users HTTP/1.1" 200 1234 "ref" "ua"
    """
    
    # Pattern: IP IDENT USER [TIMESTAMP] "REQUEST" STATUS BYTES "REFERRER" "USERAGENT"
    PATTERN = re.compile(
        r'^(?P<ip>[\d.]+) '  # IP
        r'[-\w]+ '  # ident
        r'(?P<user>[-\w]+) '  # user
        r'\[(?P<timestamp>[^\]]+)\] '  # timestamp
        r'"(?P<method>\w+) (?P<path>[^ ]+) HTTP/[\d.]+" '  # request
        r'(?P<status>\d{3}) '  # status
        r'(?P<bytes>\d+|-) '  # bytes
        r'"(?P<referrer>[^"]*)" '  # referrer
        r'"(?P<useragent>[^"]*)"'  # user agent
    )
    
    def parse(self, log_line: str) -> Optional[LogEvent]:
        """Parse Apache access log line"""
        match = self.PATTERN.match(log_line)
        if not match:
            return None
        
        groups = match.groupdict()
        
        # Extract components
        ip = self._extract_ip(groups['ip'])
        timestamp = self._normalize_timestamp(groups['timestamp'], "%d/%b/%Y:%H:%M:%S %z")
        method = groups['method']
        path = groups['path']
        status = self._extract_http_status(groups['status'])
        
        # Determine log level from HTTP status
        if status and status >= 500:
            level = "ERROR"
        elif status and status >= 400:
            level = "WARN"
        else:
            level = "INFO"
        
        # Build message
        message = f"{method} {path} {status}"
        
        # Extract bytes
        try:
            bytes_sent = int(groups['bytes']) if groups['bytes'] != '-' else 0
        except ValueError:
            bytes_sent = 0
        
        # Create LogEvent
        return LogEvent(
            timestamp=timestamp,
            event_id=f"apache-{int(timestamp.timestamp() * 1000)}",
            service="apache-server",
            host=None,
            source="apache",
            level=level,
            message=message,
            template=f"{method} {path} HTTP -> {status}",
            raw=log_line,
            trace_id=None,
            request_id=None,
            user_id=groups['user'] if groups['user'] != '-' else None,
            origin_ip=ip,
            metadata={
                'http_status': status,
                'method': method,
                'path': path,
                'bytes_sent': bytes_sent,
                'referrer': groups['referrer'] if groups['referrer'] != '-' else None,
                'user_agent': groups['useragent']
            }
        )


# ============================================================================
# 2. APACHE ERROR LOG PARSER
# ============================================================================

class ApacheErrorParser(LogParser):
    """
    Parses Apache error logs
    Pattern: [Wed Mar 20 15:30:45 2026] [error] [client 127.0.0.1] message
    """
    
    PATTERN = re.compile(
        r'\[(?P<timestamp>[^\]]+)\] '  # timestamp
        r'\[(?P<level>\w+)(?:\:(?P<module>[^\]]+))?\] '  # level and module
        r'(?:\[(?P<context>[^\]]+)\] )?'  # optional context
        r'(?P<message>.+)$'  # message
    )
    
    def parse(self, log_line: str) -> Optional[LogEvent]:
        """Parse Apache error log line"""
        match = self.PATTERN.match(log_line)
        if not match:
            return None
        
        groups = match.groupdict()
        
        # Parse timestamp (format: "Wed Mar 20 15:30:45 2026")
        try:
            timestamp = datetime.strptime(groups['timestamp'], "%a %b %d %H:%M:%S %Y")
        except ValueError:
            timestamp = datetime.utcnow()
        
        level = self._map_level(groups['level'])
        message = groups['message'].strip()
        
        # Extract client IP from context if present
        client_ip = None
        if groups['context'] and 'client' in groups['context']:
            ip_match = re.search(r'client ([\d.]+)', groups['context'])
            if ip_match:
                client_ip = ip_match.group(1)
        
        return LogEvent(
            timestamp=timestamp,
            event_id=f"apache-error-{int(timestamp.timestamp() * 1000)}",
            service="apache-server",
            host=None,
            source="apache",
            level=level,
            message=message,
            template=f"Apache [{level}] {groups['module'] or 'core'}",
            raw=log_line,
            trace_id=None,
            request_id=None,
            user_id=None,
            origin_ip=client_ip,
            metadata={
                'module': groups['module'],
                'context': groups['context']
            }
        )


# ============================================================================
# 3. NGINX ACCESS LOG PARSER
# ============================================================================

class NginxAccessParser(LogParser):
    """
    Parses Nginx access logs
    Pattern: 127.0.0.1 - - [20/Mar/2026:15:30:45 +0000] "GET /api/users HTTP/1.1" 200 1234 "ref" "ua" 0.123
    """
    
    PATTERN = re.compile(
        r'^(?P<ip>[\d.]+) '
        r'(?P<ident>[-\w]+) '
        r'(?P<user>[-\w]+) '
        r'\[(?P<timestamp>[^\]]+)\] '
        r'"(?P<method>\w+) (?P<path>[^ ]+) HTTP/[\d.]+" '
        r'(?P<status>\d{3}) '
        r'(?P<bytes>\d+|-) '
        r'"(?P<referrer>[^"]*)" '
        r'"(?P<useragent>[^"]*)" '
        r'(?P<response_time>[\d.]+)'
    )
    
    def parse(self, log_line: str) -> Optional[LogEvent]:
        """Parse Nginx access log line"""
        match = self.PATTERN.match(log_line)
        if not match:
            return None
        
        groups = match.groupdict()
        
        ip = self._extract_ip(groups['ip'])
        timestamp = self._normalize_timestamp(groups['timestamp'], "%d/%b/%Y:%H:%M:%S %z")
        status = self._extract_http_status(groups['status'])
        
        # Determine level
        if status and status >= 500:
            level = "ERROR"
        elif status and status >= 400:
            level = "WARN"
        else:
            level = "INFO"
        
        message = f"{groups['method']} {groups['path']} {status}"
        
        # Extract response time
        try:
            response_time_ms = float(groups['response_time']) * 1000
        except (ValueError, TypeError):
            response_time_ms = 0
        
        return LogEvent(
            timestamp=timestamp,
            event_id=f"nginx-{int(timestamp.timestamp() * 1000)}",
            service="nginx-server",
            host=None,
            source="nginx",
            level=level,
            message=message,
            template=f"{groups['method']} {groups['path']} -> {status}",
            raw=log_line,
            trace_id=None,
            request_id=None,
            user_id=groups['user'] if groups['user'] != '-' else None,
            origin_ip=ip,
            metadata={
                'http_status': status,
                'method': groups['method'],
                'path': groups['path'],
                'response_time_ms': response_time_ms,
                'bytes_sent': int(groups['bytes']) if groups['bytes'] != '-' else 0,
                'referrer': groups['referrer'] if groups['referrer'] != '-' else None
            }
        )


# ============================================================================
# 4. SYSLOG PARSER
# ============================================================================

class SyslogParser(LogParser):
    """
    Parses Syslog format (RFC 3164)
    Pattern: Mar 20 15:30:45 hostname service[pid]: message
    """
    
    PATTERN = re.compile(
        r'^(?P<timestamp>[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}) '
        r'(?P<hostname>[-\w.]+) '
        r'(?P<service>[-\w.]+)(?:\[(?P<pid>\d+)\])?: '
        r'(?P<message>.+)$'
    )
    
    def parse(self, log_line: str) -> Optional[LogEvent]:
        """Parse Syslog line"""
        match = self.PATTERN.match(log_line)
        if not match:
            return None
        
        groups = match.groupdict()
        
        # Parse timestamp (format: "Mar 20 15:30:45" - assume current year)
        try:
            now = datetime.utcnow()
            timestamp_str = f"{groups['timestamp']} {now.year}"
            timestamp = datetime.strptime(timestamp_str, "%b %d %H:%M:%S %Y")
        except ValueError:
            timestamp = datetime.utcnow()
        
        # Extract log level from message
        message = groups['message']
        level = "INFO"
        if any(keyword in message.upper() for keyword in ["FATAL", "CRITICAL", "EMERGENCY"]):
            level = "FATAL"
        elif any(keyword in message.upper() for keyword in ["ERROR", "ERR"]):
            level = "ERROR"
        elif any(keyword in message.upper() for keyword in ["WARN", "WARNING"]):
            level = "WARN"
        elif any(keyword in message.upper() for keyword in ["DEBUG"]):
            level = "DEBUG"
        
        return LogEvent(
            timestamp=timestamp,
            event_id=f"syslog-{int(timestamp.timestamp() * 1000)}",
            service=groups['service'],
            host=groups['hostname'],
            source="syslog",
            level=level,
            message=message,
            template=f"{groups['service']} - {level}",
            raw=log_line,
            trace_id=None,
            request_id=None,
            user_id=None,
            origin_ip=None,
            metadata={
                'hostname': groups['hostname'],
                'pid': groups['pid']
            }
        )


# ============================================================================
# 5. JSON STRUCTURED LOG PARSER
# ============================================================================

class JSONParser(LogParser):
    """
    Parses JSON structured logs
    Expected fields: timestamp, service, level, message, trace_id, request_id, metadata
    """
    
    def parse(self, log_line: str) -> Optional[LogEvent]:
        """Parse JSON log line"""
        try:
            data = json.loads(log_line)
        except (json.JSONDecodeError, ValueError):
            return None
        
        # Extract required fields
        if not isinstance(data, dict):
            return None
        
        # Parse timestamp
        timestamp_str = data.get('timestamp') or data.get('@timestamp')
        if isinstance(timestamp_str, str):
            try:
                if timestamp_str.endswith('Z'):
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                else:
                    timestamp = datetime.fromisoformat(timestamp_str)
            except (ValueError, AttributeError):
                timestamp = datetime.utcnow()
        else:
            timestamp = datetime.utcnow()
        
        # Extract fields with fallbacks
        service = data.get('service') or data.get('logger') or 'unknown-service'
        level = self._map_level(data.get('level', 'INFO'))
        message = data.get('message') or data.get('msg') or ''
        trace_id = data.get('trace_id') or data.get('traceId') or data.get('correlation_id')
        request_id = data.get('request_id') or data.get('requestId')
        
        return LogEvent(
            timestamp=timestamp,
            event_id=data.get('event_id') or f"json-{int(timestamp.timestamp() * 1000)}",
            service=str(service),
            host=data.get('host') or data.get('hostname'),
            source="json",
            level=level,
            message=str(message),
            template=data.get('template'),
            raw=log_line,
            trace_id=trace_id,
            request_id=request_id,
            user_id=data.get('user_id') or data.get('userId'),
            origin_ip=data.get('origin_ip') or data.get('client_ip'),
            metadata=data.get('metadata') or data
        )


# ============================================================================
# 6. SPRING BOOT LOG PARSER
# ============================================================================

class SpringBootParser(LogParser):
    """
    Parses Spring Boot logs
    Pattern: 2026-03-20 15:30:45.123 INFO [service-name] --- [main] com.example.Class : message
    """
    
    PATTERN = re.compile(
        r'^(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) '
        r'(?P<level>\w+) '
        r'\[(?P<service>[^\]]+)\] '
        r'--- '
        r'\[(?P<thread>[^\]]+)\] '
        r'(?P<class>[^\s]+) : '
        r'(?P<message>.+)$'
    )
    
    def parse(self, log_line: str) -> Optional[LogEvent]:
        """Parse Spring Boot log line"""
        match = self.PATTERN.match(log_line)
        if not match:
            return None
        
        groups = match.groupdict()
        
        # Parse timestamp
        try:
            timestamp = datetime.strptime(groups['timestamp'], "%Y-%m-%d %H:%M:%S.%f")
        except ValueError:
            timestamp = datetime.utcnow()
        
        level = self._map_level(groups['level'])
        message = groups['message'].strip()
        
        # Extract trace ID from message if present
        trace_id = None
        trace_match = re.search(r'traceId=([a-f0-9]+)', message)
        if trace_match:
            trace_id = trace_match.group(1)
        
        return LogEvent(
            timestamp=timestamp,
            event_id=f"spring-{int(timestamp.timestamp() * 1000)}",
            service=groups['service'],
            host=None,
            source="spring-boot",
            level=level,
            message=message,
            template=f"{groups['class']} - {level}",
            raw=log_line,
            trace_id=trace_id,
            request_id=None,
            user_id=None,
            origin_ip=None,
            metadata={
                'java_class': groups['class'],
                'thread': groups['thread']
            }
        )


# ============================================================================
# PARSER FACTORY & MANAGER
# ============================================================================

class ParserManager:
    """Manages all available parsers and auto-detects format"""
    
    def __init__(self):
        self.parsers = [
            ApacheAccessParser(),
            ApacheErrorParser(),
            NginxAccessParser(),
            SyslogParser(),
            SpringBootParser(),
            JSONParser(),  # Try JSON last as most permissive
        ]
    
    def parse(self, log_line: str, format_hint: Optional[str] = None) -> Optional[LogEvent]:
        """
        Parse log line using specified format or auto-detect
        
        Args:
            log_line: Raw log line
            format_hint: Optional hint ('apache', 'nginx', 'syslog', 'json', 'spring-boot')
        
        Returns:
            LogEvent or None if parsing fails
        """
        if not log_line or not log_line.strip():
            return None
        
        # If format hint provided, use specific parser
        if format_hint:
            format_hint = format_hint.lower()
            parser_map = {
                'apache': [ApacheAccessParser(), ApacheErrorParser()],
                'nginx': [NginxAccessParser()],
                'syslog': [SyslogParser()],
                'json': [JSONParser()],
                'spring-boot': [SpringBootParser()],
                'spring': [SpringBootParser()],
            }
            
            if format_hint in parser_map:
                for parser in parser_map[format_hint]:
                    result = parser.parse(log_line)
                    if result:
                        return result
        
        # Auto-detect: try all parsers
        for parser in self.parsers:
            try:
                result = parser.parse(log_line)
                if result:
                    return result
            except Exception:
                continue
        
        return None
    
    def parse_batch(self, log_lines: list, format_hint: Optional[str] = None) -> list:
        """Parse multiple log lines, filtering out failures"""
        return [
            event for event in 
            (self.parse(line, format_hint) for line in log_lines)
            if event is not None
        ]
