@echo off
REM Rate Limit Test Script for Windows
REM Tests the upload rate limiting functionality
REM Usage: test-rate-limit.bat [number_of_uploads]

if "%~1"=="" (
    set UPLOAD_COUNT=55
) else (
    set UPLOAD_COUNT=%~1
)

echo 🛡️  Rate Limit Test Starting...
echo 📊 Testing %UPLOAD_COUNT% uploads
echo ⏱️  Rate limit: 50 uploads per hour per IP
echo.

REM Test image data (1x1 pixel JPEG in base64)
set TEST_IMAGE="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="

set /a SUCCESSFUL=0
set /a RATE_LIMITED=0
set /a ERRORS=0

for /L %%i in (1,1,%UPLOAD_COUNT%) do (
    echo Testing upload %%i/%UPLOAD_COUNT%...

    REM Create unique filename
    set FILENAME=rate_limit_test_!time:~0,2!!time:~3,2!!time:~6,2!_%%i.jpg

    REM Make the request and capture output
    curl -s -X POST http://localhost:3000/api/upload ^
         -H "Content-Type: application/json" ^
         -d "{\"filename\":\"!FILENAME!\",\"image\":%TEST_IMAGE%}" > temp_response.txt 2>nul

    REM Check if curl succeeded
    if errorlevel 1 (
        echo ❌ %%i/%UPLOAD_COUNT% - NETWORK ERROR
        set /a ERRORS+=1
    ) else (
        REM Parse response
        findstr /C:"\"success\":true" temp_response.txt >nul 2>&1
        if !errorlevel! equ 0 (
            echo ✅ %%i/%UPLOAD_COUNT% - SUCCESS
            set /a SUCCESSFUL+=1
        ) else (
            findstr /C:"Rate limit exceeded" temp_response.txt >nul 2>&1
            if !errorlevel! equ 0 (
                echo 🚫 %%i/%UPLOAD_COUNT% - RATE LIMITED
                set /a RATE_LIMITED+=1
            ) else (
                echo ❌ %%i/%UPLOAD_COUNT% - ERROR
                set /a ERRORS+=1
            )
        )
    )

    REM Progress indicator
    set /a MOD=%%i%%10
    if !MOD! equ 0 if %%i lss %UPLOAD_COUNT% (
        echo.
        echo 📈 Progress: %%i/%UPLOAD_COUNT% completed
        echo.
    )

    REM Small delay between requests
    if %%i lss %UPLOAD_COUNT% (
        timeout /t 1 /nobreak >nul 2>&1
    )
)

REM Clean up temp file
if exist temp_response.txt del temp_response.txt

REM Final results
echo.
echo ==================================================
echo 🎯 FINAL RESULTS
echo ==================================================
echo 📊 Total attempts: %UPLOAD_COUNT%
echo ✅ Successful uploads: %SUCCESSFUL%
echo 🚫 Rate limited: %RATE_LIMITED%
echo ❌ Errors: %ERRORS%

if %RATE_LIMITED% gtr 0 (
    echo.
    echo 🎉 SUCCESS: Rate limiting is working!
    echo    Blocked %RATE_LIMITED% requests after %SUCCESSFUL% successful uploads.
) else if %UPLOAD_COUNT% leq 50 (
    echo.
    echo ⚠️  PARTIAL: Rate limit not triggered yet.
    echo    Try running with more than 50 uploads to test the limit.
) else (
    echo.
    echo ❌ FAILURE: No rate limiting detected!
    echo    Check if the rate limiting code is deployed and working.
)

echo.
echo 💡 Tips:
echo    • Rate limit resets every hour
echo    • Each IP address has its own limit
echo    • Use different IP addresses to test further
echo    • Check Vercel logs for detailed rate limit activity
echo.
echo 📝 For production testing, update the URL in this script
echo    from http://localhost:3000 to your Vercel deployment URL

pause
