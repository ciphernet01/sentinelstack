# ==========================================================
# LogicFlaw Sentinel Pro — Enterprise Edition v2.0
# Professional Business Logic Vulnerability Scanner
# ==========================================================

import os
import sys
import json
import time
import uuid
import random
import argparse
import threading
import hashlib
import csv
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, Counter
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# -----------------------------
# Enhanced Color Handling
# -----------------------------
try:
    from colorama import init as colorama_init, Fore, Style, Back
    colorama_init(autoreset=True)
    COLOR_SUPPORT = True
except Exception:
    class _C:
        def __getattr__(self, _): return ""
    Fore = Style = Back = _C()
    COLOR_SUPPORT = False

# -----------------------------
# Configuration & Constants
# -----------------------------
class Config:
    REQUEST_TIMEOUT = 15
    MAX_WORKERS = 5
    REQUEST_DELAY = 0.3
    MAX_RETRIES = 3
    BACKOFF_FACTOR = 0.5
    
    # Output directories
    OUTPUT_BASE = os.path.join("reports", "logicflaw_sentinel_pro")
    TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
    JSON_DIR = os.path.join(OUTPUT_BASE, "json")
    CSV_DIR = os.path.join(OUTPUT_BASE, "csv")
    HTML_DIR = os.path.join(OUTPUT_BASE, "html")
    
    # Headers for different scenarios
    HEADERS = {
        'default': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/html, application/xhtml+xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        },
        'ajax': {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        },
        'mobile': {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
        }
    }

# Create output directories
for d in [Config.TXT_DIR, Config.JSON_DIR, Config.CSV_DIR, Config.HTML_DIR]:
    os.makedirs(d, exist_ok=True)

# -----------------------------
# Enhanced Helper Functions
# -----------------------------
def utc_now():
    """Get current UTC time with timezone."""
    return datetime.now(timezone.utc)

def generate_timestamp(fmt="%Y-%m-%d_%H-%M-%S"):
    """Generate formatted timestamp."""
    return datetime.utcnow().strftime(fmt)

def generate_correlation_id():
    """Generate unique correlation ID for request tracking."""
    return f"LFSP-{uuid.uuid4().hex[:16].upper()}"

def sanitize_filename(filename):
    """Sanitize filename for safe filesystem usage."""
    keep = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")
    return ''.join(c for c in filename if c in keep)

def calculate_request_hash(method, url, data=None, headers=None):
    """Calculate hash for request deduplication."""
    content = f"{method}:{url}:{str(data or '')}:{str(headers or '')}"
    return hashlib.md5(content.encode()).hexdigest()

# -----------------------------
# Enhanced HTTP Client
# -----------------------------
class ResilientHTTPClient:
    """Professional HTTP client with retry logic and circuit breaker."""
    
    def __init__(self, timeout=Config.REQUEST_TIMEOUT, max_retries=Config.MAX_RETRIES):
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = self._create_session()
        self.request_cache = {}
        
    def _create_session(self):
        """Create session with retry strategy."""
        session = requests.Session()
        
        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=Config.BACKOFF_FACTOR,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST", "PUT", "DELETE"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def safe_request(self, method, url, headers=None, data=None, json_data=None, 
                     params=None, cookies=None, allow_redirects=True, verify_ssl=True):
        """
        Make HTTP request with comprehensive error handling.
        """
        request_id = generate_correlation_id()
        cache_key = calculate_request_hash(method, url, data or json_data, headers)
        
        # Check cache for recent identical requests
        if cache_key in self.request_cache:
            cached_time, cached_response = self.request_cache[cache_key]
            if (datetime.now() - cached_time).seconds < 60:  # 1 minute cache
                if COLOR_SUPPORT:
                    print(Fore.CYAN + f"[CACHE] Reusing cached response for {method} {url}")
                return cached_response
        
        try:
            start_time = time.time()
            
            # Prepare headers
            final_headers = Config.HEADERS['default'].copy()
            if headers:
                final_headers.update(headers)
            final_headers['X-Correlation-ID'] = request_id
            
            # Make request
            response = self.session.request(
                method=method.upper(),
                url=url,
                headers=final_headers,
                data=data,
                json=json_data,
                params=params,
                cookies=cookies,
                timeout=self.timeout,
                allow_redirects=allow_redirects,
                verify=verify_ssl
            )
            
            elapsed = time.time() - start_time
            
            # Build comprehensive response object
            result = {
                'request_id': request_id,
                'status_code': response.status_code,
                'url': response.url,
                'headers': dict(response.headers),
                'cookies': dict(response.cookies),
                'elapsed_ms': round(elapsed * 1000, 2),
                'content_length': len(response.content),
                'content_type': response.headers.get('Content-Type', ''),
                'redirect_chain': response.history if allow_redirects else [],
                'timestamp': utc_now().isoformat()
            }
            
            # Store response content based on type
            content_type = result['content_type'].lower()
            if 'application/json' in content_type:
                try:
                    result['json'] = response.json()
                except:
                    result['text'] = response.text[:5000]
            elif 'text/' in content_type:
                result['text'] = response.text[:10000]
            else:
                result['binary'] = True
            
            # Cache successful responses
            if response.status_code < 500:  # Don't cache server errors
                self.request_cache[cache_key] = (datetime.now(), result)
            
            # Rate limiting protection
            if response.status_code == 429:
                retry_after = response.headers.get('Retry-After', 5)
                if COLOR_SUPPORT:
                    print(Fore.YELLOW + f"[RATE LIMIT] Hit rate limit, waiting {retry_after}s")
                time.sleep(int(retry_after))
            
            return result
            
        except requests.exceptions.Timeout:
            return {
                'error': 'Request timeout',
                'request_id': request_id,
                'url': url,
                'timestamp': utc_now().isoformat()
            }
        except requests.exceptions.ConnectionError:
            return {
                'error': 'Connection error',
                'request_id': request_id,
                'url': url,
                'timestamp': utc_now().isoformat()
            }
        except requests.exceptions.RequestException as e:
            return {
                'error': str(e),
                'request_id': request_id,
                'url': url,
                'timestamp': utc_now().isoformat()
            }
        finally:
            # Small delay between requests
            time.sleep(Config.REQUEST_DELAY)
    
    def clear_cache(self):
        """Clear request cache."""
        self.request_cache.clear()

# -----------------------------
# Business Logic Models
# -----------------------------
class WorkflowStep:
    """Enhanced workflow step with validation rules."""
    
    def __init__(self, name, method, path, expected_params=None, 
                 required_headers=None, success_criteria=None, 
                 state_dependencies=None, sensitive=False):
        self.name = name
        self.method = method.upper()
        self.path = path
        self.expected_params = expected_params or []
        self.required_headers = required_headers or {}
        self.sensitive = sensitive
        
        # Success criteria: status codes or response patterns
        self.success_criteria = success_criteria or {
            'status_codes': [200, 201, 302],
            'response_contains': [],
            'response_not_contains': ['error', 'invalid']
        }
        
        # State dependencies for multi-step workflows
        self.state_dependencies = state_dependencies or {}
        
        # Generate test data for this step
        self.test_data = self._generate_test_data()
    
    def _generate_test_data(self):
        """Generate realistic test data based on step context."""
        base_data = {
            'id': str(uuid.uuid4())[:8],
            'timestamp': int(time.time()),
            'nonce': random.randint(1000, 9999)
        }
        
        # Context-specific test data
        if 'cart' in self.name.lower() or 'add' in self.name.lower():
            base_data.update({
                'product_id': random.randint(1, 1000),
                'quantity': random.randint(1, 5),
                'price': round(random.uniform(1.0, 100.0), 2)
            })
        elif 'payment' in self.name.lower() or 'checkout' in self.name.lower():
            base_data.update({
                'amount': round(random.uniform(10.0, 500.0), 2),
                'currency': 'USD',
                'payment_method': 'credit_card',
                'card_last4': str(random.randint(1000, 9999))
            })
        elif 'user' in self.name.lower() or 'profile' in self.name.lower():
            base_data.update({
                'email': f'test{random.randint(100, 999)}@example.com',
                'name': f'Test User {random.randint(1, 100)}'
            })
        
        return base_data
    
    def validate_response(self, response):
        """Validate response against success criteria."""
        validation_result = {
            'passed': True,
            'issues': []
        }
        
        if not response or 'status_code' not in response:
            validation_result['passed'] = False
            validation_result['issues'].append('No valid response received')
            return validation_result
        
        # Check status code
        if response['status_code'] not in self.success_criteria['status_codes']:
            validation_result['passed'] = False
            validation_result['issues'].append(
                f"Unexpected status code: {response['status_code']}"
            )
        
        # Check response content if available
        if 'text' in response:
            text = response['text'].lower()
            
            for required in self.success_criteria['response_contains']:
                if required.lower() not in text:
                    validation_result['passed'] = False
                    validation_result['issues'].append(
                        f"Missing required text: {required}"
                    )
            
            for forbidden in self.success_criteria['response_not_contains']:
                if forbidden.lower() in text:
                    validation_result['passed'] = False
                    validation_result['issues'].append(
                        f"Found forbidden text: {forbidden}"
                    )
        
        return validation_result

class BusinessWorkflow:
    """Represents a complete business workflow with validation."""
    
    def __init__(self, name, steps, context=None):
        self.name = name
        self.steps = steps
        self.context = context or {}
        self.state = {}
        self.required_sequence = True  # Whether steps must be executed in order
    
    def execute_step(self, step_index, http_client, base_url, skip_validation=False):
        """Execute a specific step in the workflow."""
        if step_index >= len(self.steps):
            return None
        
        step = self.steps[step_index]
        url = urljoin(base_url + "/", step.path.lstrip("/"))
        
        # Prepare request data
        data = step.test_data.copy()
        data.update(self.state)  # Include current workflow state
        
        # Make request
        response = http_client.safe_request(
            method=step.method,
            url=url,
            json_data=data if step.method in ['POST', 'PUT', 'PATCH'] else None,
            params=data if step.method == 'GET' else None,
            headers=step.required_headers
        )
        
        # Update workflow state based on response
        if 'json' in response:
            self.state.update(response['json'].get('state', {}))
        
        # Validate unless skipped
        if not skip_validation:
            validation = step.validate_response(response)
            response['validation'] = validation
        
        return response

# -----------------------------
# Business Risk Assessment Engine
# -----------------------------
class BusinessRiskAssessor:
    """Assess business impact of logic flaws."""
    
    # Business impact mappings
    BUSINESS_IMPACT_MATRIX = {
        'step_skipping': {
            'impact': 'Bypass of security controls or payment steps',
            'financial_risk': 'High',
            'compliance_risk': 'High',
            'reputation_risk': 'High',
            'weight': 40
        },
        'replay_attack': {
            'impact': 'Duplicate transactions or actions',
            'financial_risk': 'Critical',
            'compliance_risk': 'Medium',
            'reputation_risk': 'High',
            'weight': 45
        },
        'race_condition': {
            'impact': 'Concurrent execution causing state corruption',
            'financial_risk': 'High',
            'compliance_risk': 'Medium',
            'reputation_risk': 'Medium',
            'weight': 35
        },
        'parameter_tampering': {
            'impact': 'Unauthorized data manipulation',
            'financial_risk': 'Medium',
            'compliance_risk': 'High',
            'reputation_risk': 'Medium',
            'weight': 30
        },
        'idempotency_violation': {
            'impact': 'Multiple state changes from single action',
            'financial_risk': 'High',
            'compliance_risk': 'Low',
            'reputation_risk': 'Medium',
            'weight': 25
        },
        'auth_bypass': {
            'impact': 'Unauthorized access to protected resources',
            'financial_risk': 'Critical',
            'compliance_risk': 'Critical',
            'reputation_risk': 'Critical',
            'weight': 50
        }
    }
    
    # Industry-specific compliance frameworks
    COMPLIANCE_FRAMEWORKS = {
        'pci_dss': [
            'Requirement 6: Develop and maintain secure systems',
            'Requirement 10: Track and monitor access'
        ],
        'gdpr': [
            'Article 32: Security of processing',
            'Article 25: Data protection by design'
        ],
        'hipaa': [
            'Technical safeguards',
            'Access controls'
        ],
        'sox': [
            'Section 404: Internal controls',
            'IT general controls'
        ]
    }
    
    @staticmethod
    def assess_finding(finding):
        """Assess business impact of a finding."""
        base_score = finding.get('technical_score', 0)
        classification = finding.get('classification', [])
        
        business_impacts = []
        compliance_violations = []
        total_weight = 0
        
        for cls in classification:
            if cls in BusinessRiskAssessor.BUSINESS_IMPACT_MATRIX:
                impact = BusinessRiskAssessor.BUSINESS_IMPACT_MATRIX[cls]
                business_impacts.append(impact['impact'])
                total_weight += impact['weight']
                
                # Map to compliance frameworks
                if impact['compliance_risk'] in ['High', 'Critical']:
                    for framework, requirements in BusinessRiskAssessor.COMPLIANCE_FRAMEWORKS.items():
                        compliance_violations.append({
                            'framework': framework,
                            'requirements': requirements
                        })
        
        # Calculate business risk score
        business_score = min(100, base_score + (total_weight // 2))
        
        # Determine executive severity
        if business_score >= 90:
            exec_severity = 'CRITICAL'
            remediation_timeline = 'Immediate (24-48 hours)'
        elif business_score >= 75:
            exec_severity = 'HIGH'
            remediation_timeline = 'Urgent (3-5 days)'
        elif business_score >= 50:
            exec_severity = 'MEDIUM'
            remediation_timeline = 'Next release cycle'
        elif business_score >= 25:
            exec_severity = 'LOW'
            remediation_timeline = 'Planning phase'
        else:
            exec_severity = 'INFO'
            remediation_timeline = 'Monitoring'
        
        # Add business context
        finding['business_score'] = business_score
        finding['executive_severity'] = exec_severity
        finding['business_impacts'] = list(set(business_impacts))
        finding['compliance_violations'] = compliance_violations[:3]  # Top 3
        finding['remediation_timeline'] = remediation_timeline
        finding['risk_owner'] = 'Security Team / Development Team'
        
        return finding

# -----------------------------
# Enhanced Test Scenarios
# -----------------------------
class TestScenarioFactory:
    """Factory for generating comprehensive test scenarios."""
    
    @staticmethod
    def create_ecommerce_scenarios():
        """Create realistic e-commerce test scenarios."""
        return [
            BusinessWorkflow(
                name="Guest Checkout Bypass",
                steps=[
                    WorkflowStep("add_to_cart", "POST", "/api/cart/add", 
                               sensitive=False),
                    WorkflowStep("view_cart", "GET", "/api/cart", 
                               sensitive=False),
                    WorkflowStep("checkout_as_guest", "POST", "/api/checkout/guest",
                               sensitive=True),
                    WorkflowStep("submit_payment", "POST", "/api/payment/process",
                               sensitive=True),
                    WorkflowStep("order_confirmation", "GET", "/api/order/confirm",
                               sensitive=True)
                ],
                context={"workflow_type": "ecommerce", "user_type": "guest"}
            ),
            BusinessWorkflow(
                name="Payment Tampering",
                steps=[
                    WorkflowStep("init_checkout", "POST", "/api/checkout/init"),
                    WorkflowStep("select_payment", "POST", "/api/payment/method"),
                    WorkflowStep("review_order", "GET", "/api/order/review"),
                    WorkflowStep("finalize_payment", "POST", "/api/payment/finalize")
                ],
                context={"workflow_type": "payment", "test_focus": "parameter_tampering"}
            )
        ]
    
    @staticmethod
    def create_auth_scenarios():
        """Create authentication and authorization test scenarios."""
        return [
            BusinessWorkflow(
                name="Privilege Escalation",
                steps=[
                    WorkflowStep("user_login", "POST", "/api/auth/login"),
                    WorkflowStep("user_profile", "GET", "/api/user/profile"),
                    WorkflowStep("admin_endpoint_access", "GET", "/api/admin/users"),
                    WorkflowStep("admin_action", "POST", "/api/admin/actions")
                ],
                context={"test_type": "privilege_escalation"}
            )
        ]
    
    @staticmethod
    def create_api_scenarios():
        """Create API-specific test scenarios."""
        return [
            BusinessWorkflow(
                name="API Sequence Bypass",
                steps=[
                    WorkflowStep("create_resource", "POST", "/api/v1/resources"),
                    WorkflowStep("update_resource", "PUT", "/api/v1/resources/{id}"),
                    WorkflowStep("delete_resource", "DELETE", "/api/v1/resources/{id}")
                ],
                context={"api_version": "v1", "resource_type": "generic"}
            )
        ]

# -----------------------------
# Enhanced Finding Schema
# -----------------------------
class Finding:
    """Enhanced finding with comprehensive metadata."""
    
    def __init__(self, workflow_name, step_name, classification, evidence, 
                 technical_score, url=None, method=None):
        self.id = str(uuid.uuid4())
        self.workflow_name = workflow_name
        self.step_name = step_name
        self.classification = classification if isinstance(classification, list) else [classification]
        self.evidence = evidence
        self.technical_score = technical_score
        self.url = url
        self.method = method
        
        # Metadata
        self.timestamp = utc_now().isoformat()
        self.verified = False
        self.false_positive = False
        self.remediation_complexity = "Medium"
        
        # Initialize business risk
        self.business_score = technical_score
        self.executive_severity = "INFO"
        self.business_impacts = []
        self.compliance_violations = []
        self.remediation_timeline = ""
        self.risk_owner = ""
        
        # CVE/CWE mapping if applicable
        self.vulnerability_ids = self._map_to_vulnerability_ids()
    
    def _map_to_vulnerability_ids(self):
        """Map finding to standard vulnerability identifiers."""
        mapping = {
            'step_skipping': ['CWE-841', 'CWE-285'],
            'replay_attack': ['CWE-294', 'CWE-307'],
            'race_condition': ['CWE-362', 'CWE-366'],
            'parameter_tampering': ['CWE-472', 'CWE-602'],
            'auth_bypass': ['CWE-285', 'CWE-863']
        }
        
        ids = []
        for cls in self.classification:
            if cls in mapping:
                ids.extend(mapping[cls])
        return list(set(ids))
    
    def to_dict(self):
        """Convert finding to dictionary."""
        return {
            'id': self.id,
            'workflow': self.workflow_name,
            'step': self.step_name,
            'classification': self.classification,
            'technical_score': self.technical_score,
            'business_score': self.business_score,
            'executive_severity': self.executive_severity,
            'evidence': self.evidence,
            'url': self.url,
            'method': self.method,
            'vulnerability_ids': self.vulnerability_ids,
            'business_impacts': self.business_impacts,
            'compliance_violations': self.compliance_violations,
            'remediation_timeline': self.remediation_timeline,
            'risk_owner': self.risk_owner,
            'remediation_complexity': self.remediation_complexity,
            'verified': self.verified,
            'false_positive': self.false_positive,
            'timestamp': self.timestamp
        }

# -----------------------------
# Core Scanner Engine
# -----------------------------
class LogicFlawSentinelPro:
    """Enterprise-grade business logic vulnerability scanner."""
    
    def __init__(self, base_url, client_name="Enterprise Client", 
                 max_workers=Config.MAX_WORKERS, verify_ssl=True):
        self.base_url = base_url.rstrip("/")
        self.client_name = client_name
        self.http_client = ResilientHTTPClient()
        self.findings = []
        self.scan_metrics = {
            'start_time': None,
            'end_time': None,
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'vulnerabilities_found': 0
        }
        self.max_workers = max_workers
        self.verify_ssl = verify_ssl
        
        # Initialize test scenarios
        self.scenarios = []
        self._load_scenarios()
    
    def _load_scenarios(self):
        """Load all test scenarios."""
        self.scenarios.extend(TestScenarioFactory.create_ecommerce_scenarios())
        self.scenarios.extend(TestScenarioFactory.create_auth_scenarios())
        self.scenarios.extend(TestScenarioFactory.create_api_scenarios())
    
    def test_step_skipping(self, workflow):
        """Test skipping workflow steps."""
        print(Fore.CYAN + f"[TEST] Testing step skipping in workflow: {workflow.name}")
        
        for i in range(1, len(workflow.steps)):
            skipped_steps = workflow.steps[:i]
            target_step = workflow.steps[i]
            
            if COLOR_SUPPORT:
                print(Fore.YELLOW + f"  Attempting to skip: {[s.name for s in skipped_steps]}")
                print(Fore.WHITE + f"  Targeting step: {target_step.name}")
            
            # Execute target step without previous steps
            response = workflow.execute_step(i, self.http_client, self.base_url, skip_validation=True)
            
            finding = Finding(
                workflow_name=workflow.name,
                step_name=target_step.name,
                classification="step_skipping",
                evidence={
                    'skipped_steps': [s.name for s in skipped_steps],
                    'response_status': response.get('status_code') if response else None,
                    'validation_result': response.get('validation', {}) if response else {}
                },
                technical_score=85 if response and response.get('status_code') in [200, 201, 302] else 30,
                url=self.base_url + target_step.path,
                method=target_step.method
            )
            
            if response and response.get('status_code') in [200, 201, 302]:
                if COLOR_SUPPORT:
                    print(Fore.RED + f"  [VULNERABLE] Step {target_step.name} accessible without prerequisites")
                self.findings.append(finding)
                self.scan_metrics['vulnerabilities_found'] += 1
            else:
                if COLOR_SUPPORT:
                    print(Fore.GREEN + f"  [SECURE] Step {target_step.name} properly protected")
    
    def test_replay_attacks(self, workflow):
        """Test replay attack vulnerability."""
        print(Fore.CYAN + f"[TEST] Testing replay attacks in workflow: {workflow.name}")
        
        for step in workflow.steps:
            if step.sensitive:
                if COLOR_SUPPORT:
                    print(Fore.WHITE + f"  Testing replay on sensitive step: {step.name}")
                
                # Execute step twice
                response1 = workflow.execute_step(
                    workflow.steps.index(step), 
                    self.http_client, 
                    self.base_url
                )
                time.sleep(0.5)
                response2 = workflow.execute_step(
                    workflow.steps.index(step), 
                    self.http_client, 
                    self.base_url
                )
                
                # Check for replay vulnerability
                if (response1 and response2 and 
                    response1.get('status_code') == response2.get('status_code') and
                    response1.get('status_code') in [200, 201]):
                    
                    finding = Finding(
                        workflow_name=workflow.name,
                        step_name=step.name,
                        classification="replay_attack",
                        evidence={
                            'first_response_status': response1.get('status_code'),
                            'second_response_status': response2.get('status_code'),
                            'response_similarity': 'High'
                        },
                        technical_score=80,
                        url=self.base_url + step.path,
                        method=step.method
                    )
                    
                    if COLOR_SUPPORT:
                        print(Fore.RED + f"  [VULNERABLE] Replay attack possible on {step.name}")
                    self.findings.append(finding)
                    self.scan_metrics['vulnerabilities_found'] += 1
                else:
                    if COLOR_SUPPORT:
                        print(Fore.GREEN + f"  [SECURE] Replay protection detected on {step.name}")
    
    def test_race_conditions(self, workflow):
        """Test for race conditions using concurrent execution."""
        print(Fore.CYAN + f"[TEST] Testing race conditions in workflow: {workflow.name}")
        
        for step in workflow.steps:
            if step.sensitive:
                if COLOR_SUPPORT:
                    print(Fore.WHITE + f"  Testing race condition on: {step.name}")
                
                def execute_concurrent():
                    return workflow.execute_step(
                        workflow.steps.index(step),
                        self.http_client,
                        self.base_url
                    )
                
                # Execute concurrently
                with ThreadPoolExecutor(max_workers=3) as executor:
                    futures = [executor.submit(execute_concurrent) for _ in range(3)]
                    results = [f.result() for f in as_completed(futures)]
                
                # Analyze results for inconsistencies
                status_codes = [r.get('status_code') for r in results if r]
                if len(set(status_codes)) > 1:
                    finding = Finding(
                        workflow_name=workflow.name,
                        step_name=step.name,
                        classification="race_condition",
                        evidence={
                            'concurrent_results': results,
                            'status_code_variation': True
                        },
                        technical_score=75,
                        url=self.base_url + step.path,
                        method=step.method
                    )
                    
                    if COLOR_SUPPORT:
                        print(Fore.RED + f"  [VULNERABLE] Race condition detected on {step.name}")
                    self.findings.append(finding)
                    self.scan_metrics['vulnerabilities_found'] += 1
    
    def test_parameter_tampering(self, workflow):
        """Test parameter tampering vulnerabilities."""
        print(Fore.CYAN + f"[TEST] Testing parameter tampering in workflow: {workflow.name}")
        
        for step in workflow.steps:
            if step.method in ['POST', 'PUT', 'GET']:
                # Create tampered data
                original_data = step.test_data.copy()
                tampered_data = original_data.copy()
                
                # Tamper with numeric values
                for key, value in tampered_data.items():
                    if isinstance(value, (int, float)):
                        if key.lower() in ['price', 'amount', 'quantity', 'total']:
                            tampered_data[key] = value * 0.1  # Reduce by 90%
                
                # Test with tampered data
                url = urljoin(self.base_url + "/", step.path.lstrip("/"))
                response = self.http_client.safe_request(
                    method=step.method,
                    url=url,
                    json_data=tampered_data if step.method in ['POST', 'PUT'] else None,
                    params=tampered_data if step.method == 'GET' else None
                )
                
                if response and response.get('status_code') in [200, 201]:
                    finding = Finding(
                        workflow_name=workflow.name,
                        step_name=step.name,
                        classification="parameter_tampering",
                        evidence={
                            'original_data': original_data,
                            'tampered_data': tampered_data,
                            'response_status': response.get('status_code')
                        },
                        technical_score=70,
                        url=url,
                        method=step.method
                    )
                    
                    if COLOR_SUPPORT:
                        print(Fore.RED + f"  [VULNERABLE] Parameter tampering possible on {step.name}")
                    self.findings.append(finding)
                    self.scan_metrics['vulnerabilities_found'] += 1
    
    def run_comprehensive_tests(self):
        """Run all test scenarios."""
        self.scan_metrics['start_time'] = utc_now().isoformat()
        
        print(Fore.CYAN + "=" * 70)
        print(Fore.CYAN + " LOGICFLAW SENTINEL PRO - ENTERPRISE SCAN")
        print(Fore.CYAN + "=" * 70)
        print(Fore.WHITE + f"Target: {self.base_url}")
        print(Fore.WHITE + f"Client: {self.client_name}")
        print(Fore.WHITE + f"Started: {self.scan_metrics['start_time']}")
        print(Fore.CYAN + "=" * 70)
        
        for workflow in self.scenarios:
            if COLOR_SUPPORT:
                print(Fore.MAGENTA + f"\n[WORKFLOW] Testing: {workflow.name}")
            
            # Run all test types
            self.test_step_skipping(workflow)
            self.test_replay_attacks(workflow)
            self.test_race_conditions(workflow)
            self.test_parameter_tampering(workflow)
            
            time.sleep(1)  # Delay between workflows
        
        # Assess business risk
        self._assess_business_risk()
        
        self.scan_metrics['end_time'] = utc_now().isoformat()
        self.scan_metrics['total_requests'] = len(self.http_client.request_cache)
        
        return self.findings
    
    def _assess_business_risk(self):
        """Assess business risk for all findings."""
        for finding in self.findings:
            BusinessRiskAssessor.assess_finding(finding.to_dict())
    
    def generate_reports(self):
        """Generate comprehensive reports."""
        if not self.findings:
            print(Fore.YELLOW + "[INFO] No findings to report")
            return
        
        timestamp = generate_timestamp()
        safe_client = sanitize_filename(self.client_name)
        safe_host = sanitize_filename(urlparse(self.base_url).hostname or "target")
        
        base_name = f"{safe_client}_{safe_host}_logicflaw_{timestamp}"
        
        # Generate reports
        txt_path = self._generate_txt_report(base_name)
        json_path = self._generate_json_report(base_name)
        csv_path = self._generate_csv_report(base_name)
        html_path = self._generate_html_report(base_name)
        
        # Print summary
        self._print_executive_summary()
        
        if COLOR_SUPPORT:
            print(Fore.GREEN + "\n" + "=" * 70)
            print(Fore.GREEN + " REPORTS GENERATED:")
            print(Fore.GREEN + "=" * 70)
            print(Fore.WHITE + f"  TXT  → {txt_path}")
            print(Fore.WHITE + f"  JSON → {json_path}")
            print(Fore.WHITE + f"  CSV  → {csv_path}")
            print(Fore.WHITE + f"  HTML → {html_path}")
            print(Fore.GREEN + "=" * 70)
    
    def _generate_txt_report(self, base_name):
        """Generate executive text report."""
        path = os.path.join(Config.TXT_DIR, f"{base_name}.txt")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("LOGICFLAW SENTINEL PRO - EXECUTIVE SECURITY ASSESSMENT\n")
            f.write("=" * 80 + "\n\n")
            
            f.write(f"CLIENT: {self.client_name}\n")
            f.write(f"TARGET: {self.base_url}\n")
            f.write(f"SCAN DATE: {self.scan_metrics['start_time']}\n")
            f.write(f"DURATION: {self.scan_metrics['end_time']}\n")
            f.write(f"VULNERABILITIES FOUND: {self.scan_metrics['vulnerabilities_found']}\n\n")
            
            f.write("EXECUTIVE SUMMARY\n")
            f.write("-" * 40 + "\n")
            
            # Severity breakdown
            severity_counts = Counter(f['executive_severity'] for f in self.findings)
            for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']:
                count = severity_counts.get(severity, 0)
                f.write(f"{severity}: {count} findings\n")
            
            f.write("\nTOP BUSINESS RISKS:\n")
            f.write("-" * 40 + "\n")
            
            # Group by business impact
            business_impacts = defaultdict(list)
            for finding in self.findings:
                for impact in finding.get('business_impacts', []):
                    business_impacts[impact].append(finding)
            
            for impact, findings in sorted(business_impacts.items(), 
                                          key=lambda x: len(x[1]), reverse=True)[:5]:
                f.write(f"\n{impact}:\n")
                f.write(f"  Affected workflows: {len(findings)}\n")
            
            f.write("\nDETAILED FINDINGS\n")
            f.write("=" * 80 + "\n")
            
            for finding in sorted(self.findings, 
                                 key=lambda x: x['business_score'], reverse=True):
                f.write(f"\n[FINDING ID: {finding['id'][:8]}]\n")
                f.write(f"Severity: {finding['executive_severity']}\n")
                f.write(f"Workflow: {finding['workflow']}\n")
                f.write(f"Step: {finding['step']}\n")
                f.write(f"URL: {finding['method']} {finding['url']}\n")
                f.write(f"Business Score: {finding['business_score']}/100\n")
                
                if finding['vulnerability_ids']:
                    f.write(f"CVEs/CWEs: {', '.join(finding['vulnerability_ids'])}\n")
                
                f.write(f"Business Impacts:\n")
                for impact in finding.get('business_impacts', []):
                    f.write(f"  - {impact}\n")
                
                f.write(f"Remediation Timeline: {finding.get('remediation_timeline', 'N/A')}\n")
                f.write(f"Risk Owner: {finding.get('risk_owner', 'N/A')}\n")
                f.write("-" * 60 + "\n")
        
        return path
    
    def _generate_json_report(self, base_name):
        """Generate detailed JSON report."""
        path = os.path.join(Config.JSON_DIR, f"{base_name}.json")
        
        report = {
            'metadata': {
                'tool': 'LogicFlaw Sentinel Pro v2.0',
                'client': self.client_name,
                'target': self.base_url,
                'scan_start': self.scan_metrics['start_time'],
                'scan_end': self.scan_metrics['end_time'],
                'total_findings': len(self.findings)
            },
            'scan_metrics': self.scan_metrics,
            'findings': [f for f in self.findings]
        }
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)
        
        return path
    
    def _generate_csv_report(self, base_name):
        """Generate CSV report for data analysis."""
        path = os.path.join(Config.CSV_DIR, f"{base_name}.csv")
        
        if not self.findings:
            return path
        
        fieldnames = [
            'id', 'executive_severity', 'business_score', 'technical_score',
            'workflow', 'step', 'classification', 'url', 'method',
            'vulnerability_ids', 'remediation_timeline', 'risk_owner',
            'timestamp'
        ]
        
        with open(path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for finding in self.findings:
                row = {field: finding.get(field, '') for field in fieldnames}
                # Handle list fields
                row['classification'] = ';'.join(row['classification'])
                row['vulnerability_ids'] = ';'.join(row['vulnerability_ids'])
                writer.writerow(row)
        
        return path
    
    def _generate_html_report(self, base_name):
        """Generate HTML dashboard report."""
        path = os.path.join(Config.HTML_DIR, f"{base_name}.html")
        
        # Count severities
        severity_counts = Counter(f['executive_severity'] for f in self.findings)
        
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LogicFlaw Sentinel Pro Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
                .header {{ background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }}
                .severity-box {{ display: inline-block; padding: 10px 20px; margin: 10px; border-radius: 5px; color: white; }}
                .critical {{ background: #e74c3c; }}
                .high {{ background: #e67e22; }}
                .medium {{ background: #f1c40f; }}
                .low {{ background: #3498db; }}
                .info {{ background: #2ecc71; }}
                .finding {{ background: white; padding: 15px; margin: 10px 0; border-left: 5px solid #3498db; border-radius: 3px; }}
                .critical-finding {{ border-left-color: #e74c3c; }}
                .high-finding {{ border-left-color: #e67e22; }}
                .medium-finding {{ border-left-color: #f1c40f; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #2c3e50; color: white; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔍 LogicFlaw Sentinel Pro Report</h1>
                <p><strong>Client:</strong> {self.client_name}</p>
                <p><strong>Target:</strong> {self.base_url}</p>
                <p><strong>Scan Date:</strong> {self.scan_metrics['start_time']}</p>
            </div>
            
            <h2>Executive Summary</h2>
            <div>
                <div class="severity-box critical">CRITICAL: {severity_counts.get('CRITICAL', 0)}</div>
                <div class="severity-box high">HIGH: {severity_counts.get('HIGH', 0)}</div>
                <div class="severity-box medium">MEDIUM: {severity_counts.get('MEDIUM', 0)}</div>
                <div class="severity-box low">LOW: {severity_counts.get('LOW', 0)}</div>
                <div class="severity-box info">INFO: {severity_counts.get('INFO', 0)}</div>
            </div>
            
            <h2>Detailed Findings</h2>
        """
        
        # Add findings table
        html += """
            <table>
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Workflow</th>
                        <th>Step</th>
                        <th>Business Score</th>
                        <th>Remediation</th>
                        <th>Risk Owner</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        for finding in sorted(self.findings, key=lambda x: x['business_score'], reverse=True):
            severity_class = finding['executive_severity'].lower() + '-finding'
            html += f"""
                    <tr>
                        <td><span class="severity-box {finding['executive_severity'].lower()}">{finding['executive_severity']}</span></td>
                        <td>{finding['workflow']}</td>
                        <td>{finding['step']}</td>
                        <td>{finding['business_score']}/100</td>
                        <td>{finding.get('remediation_timeline', 'N/A')}</td>
                        <td>{finding.get('risk_owner', 'N/A')}</td>
                    </tr>
            """
        
        html += """
                </tbody>
            </table>
            
            <h2>Findings Details</h2>
        """
        
        # Add detailed findings
        for finding in sorted(self.findings, key=lambda x: x['business_score'], reverse=True):
            severity_class = finding['executive_severity'].lower() + '-finding'
            html += f"""
            <div class="finding {severity_class}">
                <h3>{finding['executive_severity']}: {finding['workflow']} - {finding['step']}</h3>
                <p><strong>Business Score:</strong> {finding['business_score']}/100</p>
                <p><strong>URL:</strong> {finding['method']} {finding['url']}</p>
                <p><strong>Classification:</strong> {', '.join(finding['classification'])}</p>
                <p><strong>Vulnerability IDs:</strong> {', '.join(finding.get('vulnerability_ids', []))}</p>
                <p><strong>Business Impacts:</strong></p>
                <ul>
            """
            
            for impact in finding.get('business_impacts', []):
                html += f"<li>{impact}</li>"
            
            html += f"""
                </ul>
                <p><strong>Remediation Timeline:</strong> {finding.get('remediation_timeline', 'N/A')}</p>
                <p><strong>Risk Owner:</strong> {finding.get('risk_owner', 'N/A')}</p>
            </div>
            """
        
        html += """
            <footer style="margin-top: 40px; padding: 20px; background: #2c3e50; color: white; text-align: center;">
                <p>Generated by LogicFlaw Sentinel Pro v2.0</p>
                <p>© 2024 Enterprise Security Division. Confidential.</p>
            </footer>
        </body>
        </html>
        """
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        return path
    
    def _print_executive_summary(self):
        """Print executive summary to console."""
        if not self.findings:
            print(Fore.GREEN + "\n[✓] No business logic vulnerabilities detected")
            return
        
        severity_counts = Counter(f['executive_severity'] for f in self.findings)
        
        print(Fore.CYAN + "\n" + "=" * 70)
        print(Fore.CYAN + " EXECUTIVE SUMMARY")
        print(Fore.CYAN + "=" * 70)
        
        for severity, color in [('CRITICAL', Fore.RED), ('HIGH', Fore.YELLOW), 
                               ('MEDIUM', Fore.CYAN), ('LOW', Fore.WHITE), ('INFO', Fore.GREEN)]:
            count = severity_counts.get(severity, 0)
            if count > 0:
                print(f"{color}{severity}: {count} findings")
        
        print(Fore.CYAN + "-" * 70)
        
        # Top 3 critical findings
        critical_findings = [f for f in self.findings if f['executive_severity'] == 'CRITICAL']
        if critical_findings:
            print(Fore.RED + "\nCRITICAL FINDINGS (Require Immediate Attention):")
            for finding in critical_findings[:3]:
                print(Fore.RED + f"  • {finding['workflow']} - {finding['step']}")
                print(Fore.RED + f"    Impact: {finding.get('business_impacts', ['N/A'])[0]}")
        
        print(Fore.CYAN + "=" * 70)

# -----------------------------
# Command Line Interface
# -----------------------------
def main():
    parser = argparse.ArgumentParser(
        description='LogicFlaw Sentinel Pro - Enterprise Business Logic Vulnerability Scanner',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python logicflaw_sentinel.py https://example.com --client "Acme Corp"
  python logicflaw_sentinel.py https://staging.example.com --verbose --no-ssl-verify
  python logicflaw_sentinel.py https://example.com --output-dir /path/to/reports
        """
    )
    
    parser.add_argument('url', help='Base URL to scan (e.g., https://example.com)')
    parser.add_argument('--client', '-c', default='Enterprise Client', 
                       help='Client/organization name')
    parser.add_argument('--workers', '-w', type=int, default=Config.MAX_WORKERS,
                       help=f'Number of concurrent workers (default: {Config.MAX_WORKERS})')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose output')
    parser.add_argument('--no-ssl-verify', action='store_true',
                       help='Disable SSL certificate verification')
    parser.add_argument('--output-dir', '-o', 
                       help='Custom output directory for reports')
    
    args = parser.parse_args()
    
    # Validate URL
    if not args.url.startswith(('http://', 'https://')):
        args.url = 'https://' + args.url
    
    # Update output directory if specified
    if args.output_dir:
        Config.OUTPUT_BASE = args.output_dir
        for d in ['txt', 'json', 'csv', 'html']:
            dir_path = os.path.join(Config.OUTPUT_BASE, d)
            os.makedirs(dir_path, exist_ok=True)
    
    # Print banner
    if COLOR_SUPPORT:
        print(Fore.CYAN + "=" * 70)
        print(Fore.CYAN + " LOGICFLAW SENTINEL PRO - ENTERPRISE EDITION")
        print(Fore.CYAN + " Professional Business Logic Vulnerability Scanner")
        print(Fore.CYAN + "=" * 70)
        print(Fore.WHITE + f"Target URL: {args.url}")
        print(Fore.WHITE + f"Client: {args.client}")
        print(Fore.WHITE + f"Workers: {args.workers}")
        print(Fore.WHITE + f"SSL Verify: {'Enabled' if not args.no_ssl_verify else 'Disabled'}")
        print(Fore.CYAN + "=" * 70)
    
    # Permission warning
    print(Fore.YELLOW + "\n[WARNING] This tool performs security testing.")
    print(Fore.YELLOW + "Only use on systems you own or have explicit permission to test.")
    
    confirm = input("\nType 'YES' to confirm you have permission: ")
    if confirm.upper() != 'YES':
        print(Fore.RED + "Permission not granted. Exiting.")
        sys.exit(1)
    
    try:
        # Initialize scanner
        scanner = LogicFlawSentinelPro(
            base_url=args.url,
            client_name=args.client,
            max_workers=args.workers,
            verify_ssl=not args.no_ssl_verify
        )
        
        # Run scan
        findings = scanner.run_comprehensive_tests()
        
        # Generate reports
        scanner.generate_reports()
        
        # Exit code based on findings
        critical_findings = len([f for f in findings if f['executive_severity'] == 'CRITICAL'])
        if critical_findings > 0:
            if COLOR_SUPPORT:
                print(Fore.RED + f"\n[ALERT] {critical_findings} CRITICAL findings require immediate attention!")
            sys.exit(2)  # Critical findings exit code
        elif len(findings) > 0:
            if COLOR_SUPPORT:
                print(Fore.YELLOW + f"\n[NOTICE] {len(findings)} findings require review.")
            sys.exit(1)  # Non-critical findings exit code
        else:
            if COLOR_SUPPORT:
                print(Fore.GREEN + "\n[SUCCESS] No business logic vulnerabilities detected.")
            sys.exit(0)  # Success exit code
            
    except KeyboardInterrupt:
        print(Fore.YELLOW + "\n[INFO] Scan interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(Fore.RED + f"\n[ERROR] {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()