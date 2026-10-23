$body = @{
  missionObjective = "Build a Go CRUD API"
  messages = @(
    @{
      role = "user"
      content = "What is middleware in Go?"
    }
  )
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/ai/chat" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body

Write-Output "--- SIDEQUEST Reply ---"
Write-Output $response.reply
