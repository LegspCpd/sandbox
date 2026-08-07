@echo off
chcp 65001 >nul
title Sandbox 本地后端 + 隧道启动器
cd /d "%~dp0"

echo ============================================
echo    Sandbox 本地后端 + Cloudflare 隧道
echo ============================================
echo.

REM ---------- 检查 node ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 node，请先安装 Node.js
  echo         https://nodejs.org
  pause
  exit /b 1
)

REM ---------- 检查 cloudflared ----------
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 cloudflared
  echo 请先安装:  winget install Cloudflare.cloudflared
  pause
  exit /b 1
)

REM ---------- 检查后端是否已在运行（端口 4000）----------
netstat -ano | findstr ":4000" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [提示] 4000 端口已有进程在监听，后端可能已在运行，跳过启动。
  goto check_tunnel
)

REM ---------- 启动后端 ----------
echo [1/2] 正在启动后端（端口 4000）...
start "Sandbox-Backend" /min cmd /c "cd /d "%~dp0" && node server/dist/index.js"
timeout /t 3 /nobreak >nul

:check_tunnel
REM ---------- 检查 cloudflared 服务 ----------
set STATE=
for /f "tokens=3" %%i in ('sc query cloudflared 2^>nul ^| findstr /i "STATE"') do set STATE=%%i
if /i "%STATE%"=="RUNNING" (
  echo [2/2] cloudflared 服务运行中，隧道已连接 ✓
) else (
  echo [2/2] cloudflared 服务未运行，正在尝试启动服务...
  net start cloudflared >nul 2>nul
  if errorlevel 1 (
    echo [提示] 无法自动启动服务，可能尚未安装，或需要以管理员身份运行。
    echo        手动启动:  net start cloudflared
    echo        或直接运行: cloudflared tunnel run --token 你的token
  ) else (
    echo [2/2] cloudflared 服务已启动 ✓
  )
)

echo.
echo ============================================
echo   后端地址:  http://localhost:4000
echo   公网地址:  https://cmd.code.legspcpd.top
echo ============================================
echo.
echo   关闭 "Sandbox-Backend" 窗口即可停止后端。
echo   隧道随 Windows 服务常驻（开机自启）。
echo.
pause
