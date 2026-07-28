# Secure File Sharing Module - Manual Test Guide

## Prerequisites
1. Backend running on `http://localhost:4000`
2. User account created (for authenticated endpoints)
3. `curl` or Postman installed

## Test Suite

### Setup: Get Authentication Token

```bash
# Login and save token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"YourPassword123"}' \
  | jq -r '.accessToken' > token.txt

# Set token variable (Windows PowerShell)
$TOKEN = Get-Content token.txt

# Set token variable (Linux/Mac)
export TOKEN=$(cat token.txt)
```

---

### Test 1: ✅ Create Share Link with Strong Password (8+ chars)

**Expected**: 201 Created, returns share URL

```bash
# Create a test file
echo "This is a secure test file" > test-file.txt

# Create share link (PowerShell)
curl -X POST http://localhost:4000/api/sharing/links `
  -H "Authorization: Bearer $TOKEN" `
  -F "file=@test-file.txt" `
  -F "password=SecurePass123" `
  -F "maxDownloads=5"

# Create share link (Linux/Mac/Git Bash)
curl -X POST http://localhost:4000/api/sharing/links \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-file.txt" \
  -F "password=SecurePass123" \
  -F "maxDownloads=5"
```

**Expected Response:**
```json
{
  "id": "uuid-here",
  "url": "http://localhost:3000/share/CODE",
  "hasPassword": true,
  "fileName": "test-file.txt",
  "fileSize": 28,
  "maxDownloads": 5,
  "createdAt": "2026-07-27T..."
}
```

**Save the share code from the URL** (e.g., `CODE` from the URL above)

---

### Test 2: ❌ Weak Password Should Be Rejected (<8 chars)

**Expected**: 400 Bad Request

```bash
curl -X POST http://localhost:4000/api/sharing/links \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-file.txt" \
  -F "password=weak"
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": ["Password must be at least 8 characters for secure sharing"]
}
```

---

### Test 3: ❌ Unsupported File Type Should Be Rejected

**Expected**: 400 Bad Request

```bash
# Create fake executable
echo "fake malware" > malware.exe

curl -X POST http://localhost:4000/api/sharing/links \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@malware.exe" \
  -F "password=SecurePass123"
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "File type \"application/x-msdownload\" is not allowed for sharing"
}
```

---

### Test 4: ✅ Access Link Metadata (Public, No Auth)

**Expected**: 200 OK, returns file info

```bash
# Replace CODE with your actual share code
curl http://localhost:4000/api/sharing/access/CODE
```

**Expected Response:**
```json
{
  "valid": true,
  "fileName": "test-file.txt",
  "fileSize": 28,
  "requiresPassword": true,
  "downloads": 0,
  "maxDownloads": 5
}
```

---

### Test 5: ❌ Download with Wrong Password

**Expected**: 403 Forbidden

```bash
curl -X POST http://localhost:4000/api/sharing/access/CODE/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"WrongPassword123"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
```json
{
  "statusCode": 403,
  "message": "Invalid password"
}
```

---

### Test 6: ✅ Download with Correct Password

**Expected**: 200 OK, file downloaded

```bash
curl -X POST http://localhost:4000/api/sharing/access/CODE/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"SecurePass123"}' \
  --output downloaded-file.txt \
  -w "\nHTTP Status: %{http_code}\n"
```

**Verify downloaded file:**
```bash
cat downloaded-file.txt
# Should output: This is a secure test file
```

---

### Test 7: ❌ Rate Limiting on Password Verification

**Expected**: 429 Too Many Requests after 5 attempts

```bash
# Make 6 rapid attempts (loop)
# PowerShell
for ($i=1; $i -le 6; $i++) {
  Write-Host "Attempt $i"
  curl -X POST http://localhost:4000/api/sharing/access/CODE/verify `
    -H "Content-Type: application/json" `
    -d '{"password":"WrongPassword123"}' `
    -w "\nStatus: %{http_code}\n"
  Start-Sleep -Milliseconds 500
}

# Linux/Mac
for i in {1..6}; do
  echo "Attempt $i"
  curl -X POST http://localhost:4000/api/sharing/access/CODE/verify \
    -H "Content-Type: application/json" \
    -d '{"password":"WrongPassword123"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.5
done
```

**Expected**: First 5 attempts return `403`, 6th attempt returns `429`

---

### Test 8: ✅ Get User's Share Links

**Expected**: 200 OK, returns array of links

```bash
curl http://localhost:4000/api/sharing/links \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": "uuid-here",
    "url": "http://localhost:3000/share/CODE",
    "hasPassword": true,
    "fileName": "test-file.txt",
    "fileSize": 28,
    "maxDownloads": 5,
    "downloads": 1,
    "createdAt": "2026-07-27T..."
  }
]
```

---

### Test 9: ✅ Delete Share Link

**Expected**: 200 OK

```bash
# Replace LINK_ID with the ID from Test 8
curl -X DELETE http://localhost:4000/api/sharing/links/LINK_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Verify deletion:**
```bash
curl http://localhost:4000/api/sharing/access/CODE \
  -w "\nStatus: %{http_code}\n"

# Expected: 404 Not Found
```

---

### Test 10: ✅ Frontend Integration Test

1. **Create a share link** using Test 1 above
2. **Copy the share URL** from response (e.g., `http://localhost:3000/share/CODE`)
3. **Open in browser** (make sure frontend is running)
4. **Verify UI shows:**
   - File name and size
   - Password required indicator
   - Password input with "minimum 8 characters" label
   - Download button is disabled until password is entered
5. **Enter wrong password** → Should show error toast
6. **Enter correct password** (`SecurePass123`) → File should download
7. **Try to download again** → Should work (until max downloads reached)

---

### Test 11: ✅ IP Restriction Test

```bash
# Create link with IP restriction
curl -X POST http://localhost:4000/api/sharing/links \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-file.txt" \
  -F "password=SecurePass123" \
  -F "isIPRestricted=true" \
  -F "allowedIPs=[\"127.0.0.1\"]"

# Try to access from different IP (should fail with 403)
# This requires testing from a different machine or using a proxy
```

---

## Security Improvements Verified

### ✅ What We Fixed:
1. **Password Hashing**: Changed from bcrypt to argon2 (stronger, consistent with auth)
2. **Password Policy**: Increased minimum from 4 to 8 characters
3. **IP Bypass Vulnerability**: Fixed `startsWith` fallback that allowed IP spoofing
4. **File Validation**: Added extension vs. MIME type verification
5. **Content-Type Headers**: Now sets proper Content-Type based on file extension
6. **Security Headers**: Added `X-Content-Type-Options: nosniff` and `Cache-Control`
7. **Rate Limiting**: Reduced from 10 to 5 attempts/minute on password verification
8. **Frontend Validation**: Added password length check and file size verification
9. **UI Improvements**: Shows password requirements and rate limit errors

---

## Summary Checklist

- [ ] All authenticated endpoints require valid JWT token
- [ ] Weak passwords (<8 chars) are rejected
- [ ] Unsupported file types are rejected
- [ ] Public access endpoints work without authentication
- [ ] Password protection works correctly
- [ ] Rate limiting prevents brute force attacks
- [ ] Download counter increments properly
- [ ] Max downloads limit is enforced
- [ ] Link deletion works and makes link inaccessible
- [ ] Frontend shows proper validation messages
- [ ] File size verification prevents incomplete downloads
- [ ] IP restrictions work (if configured)

---

## Notes

- **Rate Limit Reset**: Wait 60 seconds between rate-limited tests
- **Max Downloads**: Create new links for each test to avoid hitting limits
- **Argon2 Migration**: Existing links with bcrypt passwords won't work after update (expected)
- **Production**: Change `APP_URL` environment variable for proper URL generation

---

## Quick Smoke Test (All-in-One)

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"YourPassword123"}' \
  | jq -r '.accessToken')

echo "Got token: ${TOKEN:0:20}..."

# 2. Create test file
echo "Secure test content" > test.txt

# 3. Create share link
RESPONSE=$(curl -s -X POST http://localhost:4000/api/sharing/links \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt" \
  -F "password=TestPass123" \
  -F "maxDownloads=3")

echo "Share created: $RESPONSE"

SHARE_CODE=$(echo $RESPONSE | jq -r '.url' | grep -oP '(?<=share/)[^/]+$')
echo "Share code: $SHARE_CODE"

# 4. Access metadata
curl -s http://localhost:4000/api/sharing/access/$SHARE_CODE | jq

# 5. Download file
curl -s -X POST http://localhost:4000/api/sharing/access/$SHARE_CODE/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"TestPass123"}' \
  --output downloaded.txt

echo "Downloaded content:"
cat downloaded.txt

# 6. Cleanup
rm test.txt downloaded.txt

echo "✅ Smoke test complete!"
```
