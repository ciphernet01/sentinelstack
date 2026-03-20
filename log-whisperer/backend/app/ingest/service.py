"""
Log Ingestion Service - Handles file uploads, streaming, and window aggregation
Converts LogEvents into WindowFeatures for ML pipeline
"""

import io
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Callable, Generator
from statistics import mean, stdev, median

from app.core.schemas import LogEvent, WindowFeatures
from app.parse.parser import ParserManager


# ============================================================================
# CONSTANTS
# ============================================================================

# Window aggregation  
DEFAULT_WINDOW_SIZE_SECONDS = 60
DEFAULT_MAX_WINDOWS_IN_MEMORY = 500

# Level distribution tracking
LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']


# ============================================================================
# UTILITY CLASSES
# ============================================================================

class TimeWindow:
    """Represents aggregated metrics for a 1-minute window"""
    
    def __init__(self, window_start: datetime, window_end: datetime):
        self.window_start = window_start
        self.window_end = window_end
        self.events: List[LogEvent] = []
        self.level_counts: Dict[str, int] = {level: 0 for level in LEVELS}
        self.latencies: List[float] = []
        self.error_patterns: Dict[str, int] = defaultdict(int)
    
    def add_event(self, event: LogEvent) -> None:
        """Add event to window"""
        self.events.append(event)
        self.level_counts[event.level] += 1
        
        # Extract latency from metadata if available
        if 'response_time_ms' in event.metadata and isinstance(event.metadata['response_time_ms'], (int, float)):
            self.latencies.append(event.metadata['response_time_ms'])
        elif 'latency_ms' in event.metadata:
            self.latencies.append(event.metadata['latency_ms'])
        
        # Track error patterns
        if event.level in ['ERROR', 'FATAL']:
            # Use message template for pattern matching
            pattern = event.template or event.message[:50]
            self.error_patterns[pattern] += 1
    
    def to_window_features(self) -> WindowFeatures:
        """Convert TimeWindow to WindowFeatures for ML pipeline"""
        event_count = len(self.events)
        error_count = sum(self.level_counts[level] for level in ['ERROR', 'FATAL'])
        duration_sec = int(max((self.window_end - self.window_start).total_seconds(), 1))
        
        # Calculate metrics
        error_rate = error_count / event_count if event_count > 0 else 0.0
        throughput_eps = event_count / duration_sec
        
        # Latency statistics
        if self.latencies:
            latency_p50 = median(self.latencies)
            latency_p95 = sorted(self.latencies)[int(len(self.latencies) * 0.95)] if self.latencies else None
            latency_p99 = sorted(self.latencies)[int(len(self.latencies) * 0.99)] if self.latencies else None
            latency_max = max(self.latencies)
        else:
            latency_p50 = None
            latency_p95 = None
            latency_p99 = None
            latency_max = None
        
        # Unique messages
        unique_messages = len(set(e.message[:100] for e in self.events))
        unique_templates = len(set((e.template or e.message[:100]) for e in self.events))
        
        # Detect special conditions
        heartbeat_missing = event_count == 0
        error_burst = error_rate >= 0.10  # 10% threshold
        volume_spike = False  # Will be computed by detector with baseline
        sequence_anomaly = len(self.error_patterns) > 0 and max(self.error_patterns.values()) >= 3
        
        # Service detection
        services = list(set(e.service for e in self.events))
        service = services[0] if services else "unknown-service"
        top_error_messages = sorted(self.error_patterns.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return WindowFeatures(
            window_start=self.window_start,
            window_end=self.window_end,
            duration_sec=duration_sec,
            service=service,
            event_count=event_count,
            error_count=error_count,
            error_rate=error_rate,
            throughput_eps=throughput_eps,
            latency_p50=latency_p50,
            latency_p95=latency_p95,
            latency_p99=latency_p99,
            latency_max=latency_max,
            level_distribution={
                'DEBUG': self.level_counts['DEBUG'],
                'INFO': self.level_counts['INFO'],
                'WARN': self.level_counts['WARN'],
                'ERROR': self.level_counts['ERROR'],
                'FATAL': self.level_counts['FATAL'],
            },
            unique_messages=unique_messages,
            unique_templates=unique_templates,
            top_error_messages=top_error_messages,
            heartbeat_missing=heartbeat_missing,
            error_burst=error_burst,
            volume_spike=volume_spike,
            sequence_anomaly=sequence_anomaly,
            service_down=False,
        )
    
    def get_window_key(self) -> str:
        """Get unique key for window"""
        return self.window_start.isoformat()


# ============================================================================
# MAIN INGESTION SERVICE
# ============================================================================

class IngestionService:
    """
    Manages log ingestion, parsing, and aggregation into time windows
    """
    
    def __init__(self, 
                 window_size_sec: int = DEFAULT_WINDOW_SIZE_SECONDS,
                 max_windows: int = DEFAULT_MAX_WINDOWS_IN_MEMORY,
                 parser_manager: Optional[ParserManager] = None):
        """
        Initialize ingestion service
        
        Args:
            window_size_sec: Size of aggregation window in seconds (default 60)
            max_windows: Max windows to keep in memory (default 500)
            parser_manager: Custom ParserManager instance (creates default if None)
        """
        self.window_size_sec = window_size_sec
        self.max_windows = max_windows
        self.parser = parser_manager or ParserManager()
        
        # Window management
        self.windows: dict[str, TimeWindow] = {}  # window_key -> TimeWindow
        self.window_history: deque = deque(maxlen=max_windows)  # FIFO of window keys
        
        # Statistics
        self.total_events_ingested = 0
        self.total_events_parsed = 0
        self.total_events_failed = 0
        
        # Callbacks
        self.window_complete_callbacks: List[Callable[[WindowFeatures], None]] = []
        
        # Thread-safety
        self._lock = threading.RLock()
        self._current_window_key: Optional[str] = None
    
    def ingest_file(self, 
                    file_content: str, 
                    format_hint: Optional[str] = None,
                    service_name: Optional[str] = None) -> Dict[str, int]:
        """
        Ingest log file (all at once)
        
        Args:
            file_content: File content as string (split by newlines)
            format_hint: Optional hint for parser ('apache', 'nginx', etc.)
            service_name: Override service name in all events
        
        Returns:
            {
                'total': int,         # Total lines in file
                'parsed': int,        # Successfully parsed LogEvents
                'failed': int,        # Failed to parse
                'windows_created': int  # Number of time windows
            }
        """
        lines = file_content.strip().split('\n')
        log_events = []
        failed = 0
        
        # Parse all lines
        for line in lines:
            if not line.strip():
                continue
            
            self.total_events_ingested += 1
            event = self.parser.parse(line, format_hint=format_hint)
            
            if event:
                if service_name:
                    event.service = service_name
                log_events.append(event)
                self.total_events_parsed += 1
            else:
                failed += 1
                self.total_events_failed += 1
        
        # Aggregate into windows
        windows_before = len(self.windows)
        self._aggregate_events(log_events)
        windows_after = len(self.windows)
        
        return {
            'total': len(lines),
            'parsed': len(log_events),
            'failed': failed,
            'windows_created': windows_after - windows_before
        }
    
    def ingest_stream(self,
                      log_generator: Generator[str, None, None],
                      format_hint: Optional[str] = None,
                      service_name: Optional[str] = None) -> Generator[WindowFeatures, None, None]:
        """
        Ingest logs from stream (generator)
        Yields completed WindowFeatures as they complete
        
        Args:
            log_generator: Generator yielding log lines
            format_hint: Optional parser hint
            service_name: Override service name
        
        Yields:
            WindowFeatures when windows complete
        """
        for line in log_generator:
            if not line.strip():
                continue
            
            self.total_events_ingested += 1
            event = self.parser.parse(line, format_hint=format_hint)
            
            if event:
                if service_name:
                    event.service = service_name
                self.total_events_parsed += 1
                
                # Add to window and check if complete
                completed_windows = self._add_event_to_window(event)
                for window_features in completed_windows:
                    yield window_features
            else:
                self.total_events_failed += 1
    
    def _aggregate_events(self, events: List[LogEvent]) -> None:
        """Batch aggregate events into windows"""
        with self._lock:
            # Sort by timestamp
            events.sort(key=lambda e: e.timestamp)
            
            for event in events:
                self._add_event_to_window(event)
    
    def _add_event_to_window(self, event: LogEvent) -> List[WindowFeatures]:
        """
        Add single event to appropriate window
        Returns list of completed windows (may be empty)
        """
        with self._lock:
            # Calculate window boundaries
            window_start = self._get_window_start(event.timestamp)
            window_end = window_start + timedelta(seconds=self.window_size_sec)
            window_key = window_start.isoformat()
            
            # Get or create window
            if window_key not in self.windows:
                self.windows[window_key] = TimeWindow(window_start, window_end)
                self.window_history.append(window_key)
            
            # Add event to window
            self.windows[window_key].add_event(event)
            
            # Check if any older windows are complete
            completed = []
            current_window_key = self._get_window_start(datetime.utcnow()).isoformat()
            
            for old_key in list(self.windows.keys()):
                if old_key != window_key and old_key < current_window_key:
                    # Window is complete, emit it
                    old_window = self.windows[old_key]
                    features = old_window.to_window_features()
                    completed.append(features)
                    
                    # Invoke callbacks
                    for callback in self.window_complete_callbacks:
                        try:
                            callback(features)
                        except Exception:
                            pass  # Ignore callback errors
                    
                    # Remove old window to save memory
                    del self.windows[old_key]
            
            return completed
    
    def _get_window_start(self, timestamp: datetime) -> datetime:
        """Get start of window for a given timestamp"""
        if timestamp.tzinfo is not None:
            timestamp = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
        epoch = datetime.utcfromtimestamp(0)
        seconds_since_epoch = (timestamp - epoch).total_seconds()
        window_number = int(seconds_since_epoch / self.window_size_sec)
        window_start_epoch = window_number * self.window_size_sec
        return epoch + timedelta(seconds=window_start_epoch)
    
    def get_current_windows(self) -> List[WindowFeatures]:
        """Get all current windows as WindowFeatures"""
        with self._lock:
            return [w.to_window_features() for w in self.windows.values()]
    
    def get_window_by_time(self, timestamp: datetime) -> Optional[WindowFeatures]:
        """Get window containing given timestamp"""
        with self._lock:
            window_start = self._get_window_start(timestamp)
            window_key = window_start.isoformat()
            
            if window_key in self.windows:
                return self.windows[window_key].to_window_features()
            return None
    
    def register_window_callback(self, callback: Callable[[WindowFeatures], None]) -> None:
        """Register callback for when windows complete"""
        self.window_complete_callbacks.append(callback)
    
    def get_statistics(self) -> Dict[str, any]:
        """Get ingestion statistics"""
        with self._lock:
            return {
                'total_events_ingested': self.total_events_ingested,
                'total_events_parsed': self.total_events_parsed,
                'total_events_failed': self.total_events_failed,
                'current_windows': len(self.windows),
                'parse_success_rate': self.total_events_parsed / max(self.total_events_ingested, 1),
            }
    
    def reset(self) -> None:
        """Reset service to initial state"""
        with self._lock:
            self.windows.clear()
            self.window_history.clear()
            self.total_events_ingested = 0
            self.total_events_parsed = 0
            self.total_events_failed = 0


# ============================================================================
# STREAM SIMULATOR - For testing/demo
# ============================================================================

class LogStreamSimulator:
    """Simulates real-time log stream from static data"""
    
    def __init__(self, logs: List[str], events_per_second: float = 10.0):
        """
        Initialize simulator
        
        Args:
            logs: List of log lines
            events_per_second: Simulation speed (default 10 eps)
        """
        self.logs = logs
        self.events_per_second = events_per_second
    
    def stream(self) -> Generator[str, None, None]:
        """
        Yield logs with realistic timing
        
        Yields:
            Log line strings with delay between
        """
        delay_between_events = 1.0 / self.events_per_second
        
        for log in self.logs:
            yield log
            time.sleep(delay_between_events)
    
    def stream_burst(self, burst_size: int = 10) -> Generator[str, None, None]:
        """
        Yield logs in bursts (simulate traffic spikes)
        
        Args:
            burst_size: Number of logs per burst
        
        Yields:
            Log lines in bursts
        """
        for i, log in enumerate(self.logs):
            yield log
            
            # After each burst, pause longer
            if (i + 1) % burst_size == 0:
                time.sleep(1.0)  # 1 second pause between bursts
            else:
                time.sleep(1.0 / self.events_per_second)


# ============================================================================
# BATCH PROCESSOR - For one-time log processing
# ============================================================================

class BatchLogProcessor:
    """Process logs in batches and return aggregated windows"""
    
    def __init__(self, format_hint: Optional[str] = None):
        """
        Initialize processor
        
        Args:
            format_hint: Optional parser hint for all logs
        """
        self.format_hint = format_hint
        self.parser = ParserManager()
    
    def process_logs(self, 
                    logs: List[str],
                    service_name: Optional[str] = None) -> List[WindowFeatures]:
        """
        Process logs and return aggregated windows
        
        Args:
            logs: List of log lines
            service_name: Optional service name override
        
        Returns:
            List of WindowFeatures sorted by timestamp
        """
        service = IngestionService()
        
        # Parse all logs
        events = []
        for log in logs:
            event = self.parser.parse(log, format_hint=self.format_hint)
            if event:
                if service_name:
                    event.service = service_name
                events.append(event)
        
        # Aggregate into windows
        service._aggregate_events(events)
        
        # Return sorted windows
        windows = service.get_current_windows()
        return sorted(windows, key=lambda w: w.window_start)
    
    def process_file(self,
                    file_path: str,
                    service_name: Optional[str] = None) -> List[WindowFeatures]:
        """
        Process log file and return aggregated windows
        
        Args:
            file_path: Path to log file
            service_name: Optional service name override
        
        Returns:
            List of WindowFeatures sorted by timestamp
        """
        with open(file_path, 'r') as f:
            content = f.read()
        
        logs = content.strip().split('\n')
        return self.process_logs(logs, service_name)


# ============================================================================
# QUEUE-BASED INGESTOR - For high-volume scenarios
# ============================================================================

class QueuedIngestionService:
    """
    Thread-safe queue-based ingestion for high-volume scenarios
    Decouples parsing from aggregation
    """
    
    def __init__(self, 
                 ingestion_service: Optional[IngestionService] = None,
                 queue_size: int = 10000,
                 worker_threads: int = 4):
        """
        Initialize queued ingestor
        
        Args:
            ingestion_service: Underlying ingestion service
            queue_size: Parse queue max size
            worker_threads: Number of aggregation workers
        """
        self.ingestion_service = ingestion_service or IngestionService()
        self.queue_size = queue_size
        self.worker_threads = worker_threads
        self.queue: deque = deque(maxlen=queue_size)
        self._lock = threading.RLock()
        self._running = False
    
    def submit_logs(self, logs: List[str], format_hint: Optional[str] = None) -> int:
        """
        Submit logs for processing
        
        Args:
            logs: Log lines
            format_hint: Optional parser hint
        
        Returns:
            Number of logs submitted
        """
        with self._lock:
            for log in logs:
                if len(self.queue) < self.queue_size:
                    self.queue.append((log, format_hint))
            return len(self.queue)
    
    def get_queue_size(self) -> int:
        """Get current queue size"""
        with self._lock:
            return len(self.queue)
