' 상시구동 런처를 **창 없이** 실행한다 (시작프로그램이 이 파일을 실행한다).
' 콘솔 창이 살아 있으면 실수로 닫아 앱이 통째로 멈출 수 있어 창을 만들지 않는다.
' (invest/travel에서 실제로 겪은 사고의 재발 방지 — 같은 패턴)
'
' 종료하려면: 작업 관리자에서 node.exe(next start, 3300 포트) 종료.
' 로그는 logs\dinner.log 에 쌓인다.

Dim shell, fso, here
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)

' 0 = 창 숨김, False = 종료를 기다리지 않음
shell.Run """" & here & "\run-dinner.cmd""", 0, False
