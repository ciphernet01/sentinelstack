"""
Comprehensive tests for log parsers
Tests all 5 log format parsers + ParserManager auto-detect
"""

import pytest
import json
from datetime import datetime
from app.parse.parser import (
    ParserManager,
    ApacheAccessParser,
    ApacheErrorParser,
    NginxAccessParser,
    SyslogParser,
    JSONParser,
    SpringBootParser,
)
from app.core.schemas import LogEvent


# ============================================================================
# TEST FIXTURES - Sample log lines for each format
# ============================================================================

@pytest.fixture
def apache_access_log():
    return '127.0.0.1 - john [20/Mar/2026:15:30:45 +0000] "GET /api/users HTTP/1.1" 200 1234 "https://example.com" "Mozilla/5.0"'

@pytest.fixture
def apache_error_log():
    return '[Wed Mar 20 15:30:45 2026] [error] [client 127.0.0.1] File not found: /var/www/html/missing.php'

@pytest.fixture
def nginx_access_log():
    return '192.168.1.100 - - [20/Mar/2026:15:30:45 +0000] "POST /api/auth/login HTTP/1.1" 401 512 "https://app.example.com" "Chrome/98.0" 0.125'

@pytest.fixture
def syslog_entry():
    return 'Mar 20 15:30:45 web-server auth-service[12345]: User authentication failed for user admin'

@pytest.fixture
def json_log():
    return json.dumps({
        'timestamp': '2026-03-20T15:30:45Z',
        'service': 'payment-api',
        'level': 'ERROR',
        'message': 'Payment processing failed',
        'trace_id': 'abc123def456',
        'request_id': 'req_789',
        'user_id': 'user_42',
        'metadata': {'amount': 100, 'currency': 'USD'}
    })

@pytest.fixture
def spring_boot_log():
    return '2026-03-20 15:30:45.123 WARN [order-service] --- [main] com.example.service.OrderService : Inventory check timed out after 5000ms'


# ============================================================================
# TEST APACHE ACCESS PARSER
# ============================================================================

class TestApacheAccessParser:
    
    def test_parse_valid_apache_access_log(self, apache_access_log):
        parser = ApacheAccessParser()
        event = parser.parse(apache_access_log)
        
        assert event is not None
        assert isinstance(event, LogEvent)
        assert event.source == 'apache'
        assert event.service == 'apache-server'
        assert event.level == 'INFO'
        assert event.origin_ip == '127.0.0.1'
        assert event.user_id == 'john'
        assert event.metadata['http_status'] == 200
        assert event.metadata['method'] == 'GET'
        assert event.metadata['path'] == '/api/users'
        assert event.metadata['bytes_sent'] == 1234
    
    def test_parse_apache_404_error(self):
        parser = ApacheAccessParser()
        log = '10.0.0.1 - - [20/Mar/2026:15:30:45 +0000] "GET /missing HTTP/1.1" 404 0 "-" "Mozilla/5.0"'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'WARN'
        assert event.metadata['http_status'] == 404
    
    def test_parse_apache_500_error(self):
        parser = ApacheAccessParser()
        log = '10.0.0.1 - - [20/Mar/2026:15:30:45 +0000] "POST /api/process HTTP/1.1" 500 512 "-" "Mozilla/5.0"'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'ERROR'
        assert event.metadata['http_status'] == 500
    
    def test_parse_invalid_apache_log(self):
        parser = ApacheAccessParser()
        event = parser.parse('invalid log line')
        assert event is None


# ============================================================================
# TEST APACHE ERROR PARSER
# ============================================================================

class TestApacheErrorParser:
    
    def test_parse_valid_apache_error_log(self, apache_error_log):
        parser = ApacheErrorParser()
        event = parser.parse(apache_error_log)
        
        assert event is not None
        assert isinstance(event, LogEvent)
        assert event.source == 'apache'
        assert event.level == 'ERROR'
        assert 'File not found' in event.message
        assert event.origin_ip == '127.0.0.1'
    
    def test_parse_apache_critical_error(self):
        parser = ApacheErrorParser()
        log = '[Wed Mar 20 15:30:45 2026] [critical] Database connection failed'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'FATAL'
    
    def test_parse_apache_warn_level(self):
        parser = ApacheErrorParser()
        log = '[Wed Mar 20 15:30:45 2026] [warn] Deprecated function call'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'WARN'


# ============================================================================
# TEST NGINX ACCESS PARSER
# ============================================================================

class TestNginxAccessParser:
    
    def test_parse_valid_nginx_log(self, nginx_access_log):
        parser = NginxAccessParser()
        event = parser.parse(nginx_access_log)
        
        assert event is not None
        assert isinstance(event, LogEvent)
        assert event.source == 'nginx'
        assert event.service == 'nginx-server'
        assert event.level == 'WARN'  # 401 status
        assert event.metadata['http_status'] == 401
        assert event.metadata['method'] == 'POST'
        assert event.metadata['response_time_ms'] == 125.0
    
    def test_parse_nginx_success_log(self):
        parser = NginxAccessParser()
        log = '192.168.1.100 - - [20/Mar/2026:15:30:45 +0000] "GET /index.html HTTP/1.1" 200 5432 "-" "Mozilla/5.0" 0.045'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'INFO'
        assert event.metadata['http_status'] == 200
        assert event.metadata['response_time_ms'] == 45.0
    
    def test_parse_nginx_500_error(self):
        parser = NginxAccessParser()
        log = '10.0.0.1 - - [20/Mar/2026:15:30:45 +0000] "POST /api/submit HTTP/1.1" 503 1024 "-" "curl" 2.500'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'ERROR'
        assert event.metadata['http_status'] == 503


# ============================================================================
# TEST SYSLOG PARSER
# ============================================================================

class TestSyslogParser:
    
    def test_parse_valid_syslog(self, syslog_entry):
        parser = SyslogParser()
        event = parser.parse(syslog_entry)
        
        assert event is not None
        assert isinstance(event, LogEvent)
        assert event.source == 'syslog'
        assert event.service == 'auth-service'
        assert event.host == 'web-server'
        assert event.metadata['pid'] == '12345'
        assert 'authentication failed' in event.message.lower()
    
    def test_parse_syslog_fatal_level(self):
        parser = SyslogParser()
        log = 'Mar 20 15:30:45 db-server mysql[5678]: FATAL: Connection pool exhausted'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'FATAL'
        assert event.service == 'mysql'
    
    def test_parse_syslog_error_level(self):
        parser = SyslogParser()
        log = 'Mar 20 15:30:45 app-server service[1234]: ERROR: Timeout while processing request'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'ERROR'
    
    def test_parse_syslog_warning_level(self):
        parser = SyslogParser()
        log = 'Mar 20 15:30:45 cache-server redis[9999]: WARN: Memory usage above 80%'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'WARN'


# ============================================================================
# TEST JSON PARSER
# ============================================================================

class TestJSONParser:
    
    def test_parse_valid_json_log(self, json_log):
        parser = JSONParser()
        event = parser.parse(json_log)
        
        assert event is not None
        assert isinstance(event, LogEvent)
        assert event.source == 'json'
        assert event.service == 'payment-api'
        assert event.level == 'ERROR'
        assert event.message == 'Payment processing failed'
        assert event.trace_id == 'abc123def456'
        assert event.request_id == 'req_789'
        assert event.user_id == 'user_42'
    
    def test_parse_json_with_iso_timestamp(self):
        parser = JSONParser()
        log_data = {
            'timestamp': '2026-03-20T15:30:45.123456Z',
            'service': 'api',
            'level': 'INFO',
            'message': 'Request processed'
        }
        event = parser.parse(json.dumps(log_data))
        
        assert event is not None
        assert event.level == 'INFO'
    
    def test_parse_json_invalid_json(self):
        parser = JSONParser()
        event = parser.parse('not valid json')
        assert event is None
    
    def test_parse_json_non_dict(self):
        parser = JSONParser()
        event = parser.parse('["array", "not", "dict"]')
        assert event is None
    
    def test_parse_json_level_mapping(self):
        parser = JSONParser()
        log_data = {
            'timestamp': '2026-03-20T15:30:45Z',
            'service': 'test',
            'level': 'critical',
            'message': 'System error'
        }
        event = parser.parse(json.dumps(log_data))
        
        assert event is not None
        assert event.level == 'FATAL'


# ============================================================================
# TEST SPRING BOOT PARSER
# ============================================================================

class TestSpringBootParser:
    
    def test_parse_valid_spring_boot_log(self, spring_boot_log):
        parser = SpringBootParser()
        event = parser.parse(spring_boot_log)
        
        assert event is not None
        assert isinstance(event, LogEvent)
        assert event.source == 'spring-boot'
        assert event.service == 'order-service'
        assert event.level == 'WARN'
        assert 'Inventory check timed out' in event.message
        assert event.metadata['java_class'] == 'com.example.service.OrderService'
        assert event.metadata['thread'] == 'main'
    
    def test_parse_spring_boot_error_level(self):
        parser = SpringBootParser()
        log = '2026-03-20 15:30:45.123 ERROR [user-service] --- [http-nio-8080-exec-1] com.example.UserService : Failed to fetch user profile'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'ERROR'
        assert event.service == 'user-service'
    
    def test_parse_spring_boot_with_trace_id(self):
        parser = SpringBootParser()
        log = '2026-03-20 15:30:45.123 DEBUG [service] --- [main] com.example.Class : Processing with traceId=xyz789abc123'
        event = parser.parse(log)
        
        assert event is not None
        assert event.trace_id == 'xyz789abc123'
    
    def test_parse_spring_boot_fatal_level(self):
        parser = SpringBootParser()
        log = '2026-03-20 15:30:45.123 FATAL [critical-service] --- [main] com.example.CriticalService : Application shutting down'
        event = parser.parse(log)
        
        assert event is not None
        assert event.level == 'FATAL'


# ============================================================================
# TEST PARSER MANAGER (AUTO-DETECT)
# ============================================================================

class TestParserManager:
    
    def test_manager_parse_apache_with_hint(self, apache_access_log):
        manager = ParserManager()
        event = manager.parse(apache_access_log, format_hint='apache')
        
        assert event is not None
        assert event.source == 'apache'
    
    def test_manager_parse_nginx_with_hint(self, nginx_access_log):
        manager = ParserManager()
        event = manager.parse(nginx_access_log, format_hint='nginx')
        
        assert event is not None
        assert event.source == 'nginx'
    
    def test_manager_parse_json_with_hint(self, json_log):
        manager = ParserManager()
        event = manager.parse(json_log, format_hint='json')
        
        assert event is not None
        assert event.source == 'json'
    
    def test_manager_auto_detect_apache(self, apache_access_log):
        manager = ParserManager()
        event = manager.parse(apache_access_log)
        
        assert event is not None
        assert event.source == 'apache'
    
    def test_manager_auto_detect_nginx(self, nginx_access_log):
        manager = ParserManager()
        event = manager.parse(nginx_access_log)
        
        assert event is not None
        assert event.source == 'nginx'
    
    def test_manager_auto_detect_json(self, json_log):
        manager = ParserManager()
        event = manager.parse(json_log)
        
        assert event is not None
        assert event.source == 'json'
    
    def test_manager_auto_detect_syslog(self, syslog_entry):
        manager = ParserManager()
        event = manager.parse(syslog_entry)
        
        assert event is not None
        assert event.source == 'syslog'
    
    def test_manager_auto_detect_spring_boot(self, spring_boot_log):
        manager = ParserManager()
        event = manager.parse(spring_boot_log)
        
        assert event is not None
        assert event.source == 'spring-boot'
    
    def test_manager_parse_batch(self):
        manager = ParserManager()
        logs = [
            '127.0.0.1 - - [20/Mar/2026:15:30:45 +0000] "GET /api HTTP/1.1" 200 100 "-" "Mozilla"',
            '2026-03-20 15:30:45.123 INFO [service] --- [main] Class : Message',
            'Mar 20 15:30:45 host service[123]: Info message',
        ]
        
        events = manager.parse_batch(logs)
        assert len(events) == 3
        assert events[0].source == 'apache'
        assert events[1].source == 'spring-boot'
        assert events[2].source == 'syslog'
    
    def test_manager_parse_batch_with_failures(self):
        manager = ParserManager()
        logs = [
            '127.0.0.1 - - [20/Mar/2026:15:30:45 +0000] "GET /api HTTP/1.1" 200 100 "-" "Mozilla"',
            'invalid log line that wont parse',
            '',  # Empty line
            '2026-03-20 15:30:45.123 INFO [service] --- [main] Class : Message',
        ]
        
        events = manager.parse_batch(logs)
        assert len(events) == 2  # Only valid ones
    
    def test_manager_parse_empty_line(self):
        manager = ParserManager()
        event = manager.parse('')
        assert event is None
    
    def test_manager_parse_whitespace_only(self):
        manager = ParserManager()
        event = manager.parse('   \n   ')
        assert event is None


# ============================================================================
# INTEGRATION TESTS - Multiple parsers working together
# ============================================================================

class TestParserIntegration:
    
    def test_mixed_format_batch_parsing(self):
        """Test parsing batch with mixed log formats"""
        manager = ParserManager()
        
        logs = [
            # Apache Access
            '192.168.1.1 - user1 [20/Mar/2026:15:30:45 +0000] "GET /dashboard HTTP/1.1" 200 2048 "-" "Firefox"',
            # Nginx Access
            '10.0.0.5 - - [20/Mar/2026:15:30:46 +0000] "POST /api/data HTTP/1.1" 201 512 "-" "curl" 0.234',
            # Syslog
            'Mar 20 15:30:47 prod-server app-service[9876]: ERROR: Database connection failed',
            # JSON
            json.dumps({'timestamp': '2026-03-20T15:30:48Z', 'service': 'worker', 'level': 'WARN', 'message': 'Task queue filling up'}),
            # Spring Boot
            '2026-03-20 15:30:49.999 DEBUG [cache] --- [pool-1] com.cache.Manager : Evicting cold entries',
        ]
        
        events = manager.parse_batch(logs)
        
        assert len(events) == 5
        assert events[0].source == 'apache'
        assert events[1].source == 'nginx'
        assert events[2].source == 'syslog'
        assert events[3].source == 'json'
        assert events[4].source == 'spring-boot'
        
        # Verify diverse services
        services = [e.service for e in events]
        assert 'apache-server' in services
        assert 'nginx-server' in services
        assert 'app-service' in services
        assert 'worker' in services
        assert 'cache' in services
    
    def test_parser_produces_valid_log_events(self):
        """Ensure all parsers produce valid LogEvent objects"""
        manager = ParserManager()
        
        test_logs = {
            'apache': '192.168.1.1 - - [20/Mar/2026:15:30:45 +0000] "GET / HTTP/1.1" 200 100 "-" "-"',
            'nginx': '10.0.0.1 - - [20/Mar/2026:15:30:45 +0000] "POST / HTTP/1.1" 200 100 "-" "-" 0.1',
            'syslog': 'Mar 20 15:30:45 host svc[1]: msg',
            'json': json.dumps({'timestamp': '2026-03-20T15:30:45Z', 'service': 'svc', 'level': 'INFO', 'message': 'msg'}),
            'spring-boot': '2026-03-20 15:30:45.000 INFO [svc] --- [main] Class : msg',
        }
        
        for fmt, log in test_logs.items():
            event = manager.parse(log, format_hint=fmt)
            assert event is not None, f"Failed to parse {fmt}"
            
            # Verify required fields
            assert event.timestamp is not None
            assert isinstance(event.timestamp, datetime)
            assert event.service is not None
            assert event.level in ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
            assert event.message is not None
            assert event.raw is not None
            assert event.source is not None
