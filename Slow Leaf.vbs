' Slow Leaf launcher: starts the app with no console window.
' First run (no .venv yet) opens run.bat so you can see the setup progress.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
d = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = d
If fso.FileExists(d & "\.venv\Scripts\pythonw.exe") Then
  sh.Run """" & d & "\.venv\Scripts\pythonw.exe"" """ & d & "\app.py""", 1, False
Else
  sh.Run """" & d & "\run.bat""", 1, False
End If
