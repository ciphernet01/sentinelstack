# Phase 1 Security Testing Guide

## 🚀 Development Environment Status

✅ **Backend**: Running on `http://localhost:3001`
✅ **Frontend**: Running on `http://localhost:3000`
✅ **Database**: PostgreSQL running on port 5432
✅ **Email Service**: Console logging (development mode)

---

## 📋 Test Scenarios

### **Test 1: Sign Up & Email Verification**

**Steps:**
1. Go to `http://localhost:3000/signup`
2. Fill in registration form:
   - Email: `test@example.com`
   - Password: `SecurePass123!@#`
   - Confirm password: `SecurePass123!@#`
   - Role: Select any role
   - Check terms & conditions
3. Click "Sign Up"
4. **Expected:** Redirected to login, browser console shows "User initialized successfully"
5. Check backend logs for verification email:
   ```
   📧 [EMAIL] Would send email:
   To: test@example.com
   Subject: Verify Your Email - SentinelStack
   ```
6. Copy the verification token from the email content
7. Visit: `http://localhost:3000/verify-email?token=<TOKEN>`
8. **Expected:** "Email Verified!" message and auto-redirect to login

**Try logging in:**
- Without verifying email: **Should fail** with "Please verify your email address before logging in."
- After verifying email: **Should succeed** ✅

---

### **Test 2: Password Reset Flow**

**Steps:**
1. Go to `http://localhost:3000/login`
2. Click "Forgot your password?" link
3. Enter email: `test@example.com`
4. Click "Send Reset Link"
5. **Expected:** "Check Your Email" confirmation page
6. Check backend logs for reset email:
   ```
   📧 [EMAIL] Would send email:
   To: test@example.com
   Subject: Reset Your Password - SentinelStack
   ```
7. Copy the reset token from email content
8. Visit: `http://localhost:3000/reset-password?token=<TOKEN>`
9. Enter new password: `NewSecure456!@#`
10. **Expected:** "Password Reset Complete" and redirect to login
11. **Try login** with new password: **Should succeed** ✅

---

### **Test 3: Account Lockout Protection**

**Steps:**
1. Go to `http://localhost:3000/login`
2. Enter email: `test@example.com`
3. Enter WRONG password: `WrongPassword`
4. Click "Login"
5. **Repeat step 2-4 five times** with wrong password
6. **Expected on 5th attempt:**
   ```
   "Account is temporarily locked due to multiple failed login attempts. 
    Please try again in 30 minutes."
   ```
7. Check backend logs for account locked email:
   ```
   📧 [EMAIL] Would send email:
   Subject: Security Alert: Account Temporarily Locked - SentinelStack
   ```
8. Try logging in again: **Should fail** with same lockout message
9. **Option A (Quick Test):** Wait 2 seconds and manually update DB:
   ```sql
   UPDATE "User" SET "lockedUntil" = NULL, "failedLoginAttempts" = 0 
   WHERE email = 'test@example.com';
   ```
10. **Option B (Real Test):** Wait 30 minutes
11. Try logging in again: **Should succeed** ✅

---

### **Test 4: Password Strength Validation**

**Steps:**
1. Go to password reset page with valid token
2. Try entering weak passwords:
   - `password` → **Should fail:** "at least 8 characters, uppercase, number, special char"
   - `Pass123` → **Should fail:** "special character required"
   - `Pass@1` → **Should fail:** "at least 8 characters"
3. Try strong password: `NewSecure456!@#` → **Should succeed** ✅

---

### **Test 5: Password History (After Profile Page is Built)**

**Steps:**
1. User changes password to: `First@123`
2. Try changing back to same password: **Should fail** - "cannot reuse passwords"
3. Change to `Second@456`: **Should succeed** ✅
4. Wait for implementation of password history display

---

### **Test 6: Audit Logging**

**Check backend database:**
```sql
SELECT * FROM "AuditLog" 
ORDER BY "createdAt" DESC 
LIMIT 20;
```

**Expected actions logged:**
- `LOGIN` (successful login)
- `LOGIN_FAILED` (failed attempts with attempt count)
- `EMAIL_VERIFIED` (when email verified)
- `PASSWORD_RESET_REQUESTED`
- `PASSWORD_RESET`
- `PASSWORD_CHANGED`

---

## 🔍 Key Features to Verify

### ✅ Email Verification
- [ ] Verification email contains token link
- [ ] Token expires in 24 hours
- [ ] Can resend verification email
- [ ] Cannot login until verified
- [ ] Successful verification redirects to login

### ✅ Password Reset
- [ ] Reset email sent to registered email only
- [ ] Token expires in 1 hour
- [ ] Password must meet strength requirements
- [ ] Can only reset with valid token
- [ ] After reset, can login with new password

### ✅ Account Lockout
- [ ] Failed attempts counter increments
- [ ] Account locks after 5 failed attempts
- [ ] Lockout email sent
- [ ] Locked for 30 minutes
- [ ] Failed attempts reset on successful login
- [ ] Can still reset password while locked

### ✅ Audit Logging
- [ ] All login attempts logged
- [ ] IP address captured
- [ ] User agent captured
- [ ] Action type recorded
- [ ] Timestamp recorded

---

## 🐛 Troubleshooting

### Backend logs show errors:
```bash
docker logs sentinel-backend --tail 50
```

### Frontend issues:
- Clear browser cache: `Ctrl+Shift+Delete`
- Check browser console: `F12 → Console`

### Database connection issues:
```bash
psql -U user -h localhost -d sentinelstack
```

### Test with real email (Gmail example):
1. Generate Gmail App Password: https://myaccount.google.com/apppasswords
2. Update `.env`:
   ```env
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=<16-char app password>
   ```
3. Restart backend: `docker restart sentinel-backend`

---

## 📊 Test Results Template

```
Date: January 7, 2026
Tester: [Your Name]

Test 1: Sign Up & Email Verification
- Sign up: ✅ / ❌
- Verification email sent: ✅ / ❌
- Email verification works: ✅ / ❌
- Cannot login unverified: ✅ / ❌
- Can login after verified: ✅ / ❌

Test 2: Password Reset
- Forgot password link works: ✅ / ❌
- Reset email sent: ✅ / ❌
- Invalid token rejected: ✅ / ❌
- Password strength checked: ✅ / ❌
- Can login with new password: ✅ / ❌

Test 3: Account Lockout
- Failed attempts tracked: ✅ / ❌
- Locked after 5 attempts: ✅ / ❌
- Lockout email sent: ✅ / ❌
- 30-minute lockout enforced: ✅ / ❌
- Can reset password while locked: ✅ / ❌

Test 4: Password Strength
- Weak passwords rejected: ✅ / ❌
- Strong passwords accepted: ✅ / ❌
- Error messages clear: ✅ / ❌

Test 5: Audit Logging
- Login events logged: ✅ / ❌
- Failed attempts logged: ✅ / ❌
- IP address captured: ✅ / ❌
- Timestamps accurate: ✅ / ❌

Overall Status: ✅ / ⚠️ / ❌
Notes: [Any issues or observations]
```

---

## 🎯 Next Steps After Testing

1. **Phase 2: Advanced Access Control**
   - Multi-tenancy / Organizations
   - Granular permissions
   - Team management

2. **Profile Management Page**
   - Change password
   - View login history
   - Manage sessions

3. **Admin Dashboard**
   - User management
   - Audit log viewer
   - Security settings

---

## 📝 API Endpoints Reference

### Auth Endpoints
```
POST   /api/auth/login                    → Login with Firebase token
POST   /api/auth/init                     → Initialize new user
POST   /api/auth/verify-email             → Verify email with token
POST   /api/auth/resend-verification      → Resend verification email
POST   /api/auth/request-password-reset   → Request password reset
POST   /api/auth/reset-password           → Reset password with token
POST   /api/auth/change-password          → Change password (authenticated)
```

### Test with cURL
```bash
# Verify email
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"your-token-here"}'

# Request password reset
curl -X POST http://localhost:3001/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Reset password
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"reset-token","newPassword":"NewPass123!@#"}'
```

---

**Happy Testing! 🚀**
