from flask import Flask, jsonify, request, make_response
import jwt
import datetime
import time

app = Flask(__name__)
SECRET_KEY = "insecure-key-123"
tokens = []

# INTENTIONALLY VULNERABLE ENDPOINTS
@app.route('/vuln/token', methods=['POST'])
def vulnerable_token():
    """Token with NO expiration - SECURITY FLAW"""
    payload = {
        'user_id': 123,
        'username': 'testuser',
        # MISSING: 'exp' and 'iat' claims - INTENTIONAL VULNERABILITY
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    tokens.append(token)
    
    response = jsonify({
        'access_token': token,
        'refresh_token': 'vulnerable-refresh-token-123',  # Exposed in response
        'token_type': 'Bearer'
    })
    return response

@app.route('/vuln/long_token', methods=['POST'])
def long_lived_token():
    """Token with 30-day expiration - EXCESSIVE LIFETIME"""
    payload = {
        'user_id': 456,
        'username': 'admin',
        'iat': int(time.time()),
        'exp': int(time.time()) + (30 * 24 * 3600)  # 30 DAYS - TOO LONG
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return jsonify({'access_token': token})

@app.route('/vuln/protected', methods=['GET'])
def protected():
    """Protected endpoint that doesn't validate tokens properly"""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return jsonify({'error': 'No token'}), 401
    
    token = auth[7:]  # Remove 'Bearer '
    
    # INSECURE: Accepts ANY token without proper validation
    if token in tokens:
        return jsonify({'data': 'Sensitive data accessed!'})
    
    try:
        # Just decode, don't verify expiration
        decoded = jwt.decode(token, SECRET_KEY, algorithms=['HS256'], options={'verify_exp': False})
        return jsonify({'data': f'Welcome {decoded.get("username", "user")}'})
    except:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/vuln/logout', methods=['POST'])
def logout():
    """Logout that doesn't invalidate tokens - SECURITY FLAW"""
    return jsonify({'message': 'Logged out (but tokens still work!)'})

# NORMAL/STANDARD ENDPOINTS
@app.route('/secure/token', methods=['POST'])
def secure_token():
    """Proper token implementation"""
    payload = {
        'user_id': 789,
        'username': 'secure_user',
        'iat': int(time.time()),
        'exp': int(time.time()) + 3600,  # 1 hour - reasonable
        'scope': 'read'
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return jsonify({
        'access_token': token,
        'expires_in': 3600,
        'token_type': 'Bearer'
    })

if __name__ == '__main__':
    print("=" * 60)
    print("VULNERABLE TEST SERVER RUNNING")
    print("URL: http://localhost:9999")
    print("\nVULNERABLE ENDPOINTS:")
    print("  POST /vuln/token        - Missing exp/iat claims")
    print("  POST /vuln/long_token   - 30-day token lifetime")
    print("  GET  /vuln/protected    - Weak token validation")
    print("  POST /vuln/logout       - Doesn't revoke tokens")
    print("\nSECURE ENDPOINTS:")
    print("  POST /secure/token      - Proper implementation")
    print("=" * 60)
    app.run(debug=True, port=9999)