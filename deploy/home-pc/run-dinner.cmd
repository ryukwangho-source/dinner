@echo off
REM 집 PC 상시 실행 런처 — 실제 루프는 run-dinner.ps1 에 있다.
REM 이 파일은 기존 기동 경로(vbs / 시작프로그램 lnk)가 그대로 동작하도록 두는 shim 이다.
REM
REM 이 파일을 직접 실행하면 콘솔 창이 뜨고, 창을 닫으면 앱이 멈춘다.
REM    평소 기동은 창을 만들지 않는 run-dinner-hidden.vbs 로 한다 — 시작프로그램도 그것.
REM
REM 종료하려면: 작업 관리자에서 이 cmd.exe / powershell.exe / node.exe 를 함께 종료.
REM 로그는 logs\dinner.log 에 쌓인다.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-dinner.ps1"
