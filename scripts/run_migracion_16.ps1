$sql = Get-Content -Raw "database/migracion_16_track_driver_data.sql"
$token = (Get-Content -Raw ".supabase-token").Trim()
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}
$body = @{ query = $sql } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/pwgofasontumxgzahuph/database/query" -Method POST -Headers $headers -Body $body
Write-Output "Resultado migracion 16:"
$res | ConvertTo-Json -Depth 3
