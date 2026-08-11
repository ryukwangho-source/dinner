' 자동 배포 감시 루프를 **창 없이** 실행한다 (시작프로그램이 이 파일을 실행한다).
' run-dinner-hidden.vbs 와 함께 등록한다 — 서버 실행 루프와 배포 감시 루프는 별개 프로세스다.
' 콘솔 창이 살아 있으면 실수로 닫아 감시가 통째로 멈출 수 있어 창을 만들지 않는다.
'
' 종료하려면: 작업 관리자에서 powershell.exe(auto-deploy.ps1) 종료.
' 로그는 logs\deploy.log 에 쌓인다.

Dim shell, fso, here
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)

' 0 = 창 숨김, False = 종료를 기다리지 않음
shell.Run """" & here & "\auto-deploy.cmd""", 0, False
