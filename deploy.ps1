$src = "C:\Users\harry\iCloudDrive\Coffee Portfolio\Web-App-Gatekeeper\Newrelease\gatekeeper-v8-source\gatekeeper-v8"
$dst = "C:\Users\harry\iCloudDrive\Coffee Portfolio\Web-App-Gatekeeper\Newrelease\gatekeeper-v8-dist"
Set-Location $src
npm test; if ($LASTEXITCODE -ne 0) { throw "tests failed - not deploying" }
npm run build; if ($LASTEXITCODE -ne 0) { throw "build failed" }
Remove-Item "$dst\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$src\dist\*" $dst -Recurse -Force
$distFile = Get-ChildItem -Path "$dst\assets\index-*.js"
if (-not (Select-String -Path $distFile -Pattern "Menu-Verified" -Quiet)) { throw "deployed bundle missing v8 code!" }
Write-Host "V8 deployed to $dst - verified."
