param(
  [Parameter(Mandatory=$false)]
  [string]$Key
)

if (-not $Key) {
  $secure = Read-Host -Prompt 'Enter Applitools API key (input hidden)' -AsSecureString
  $Key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

Set-Item -Path Env:APPLITOOLS_API_KEY -Value $Key
Write-Host "APPLITOOLS_API_KEY set for current session."
