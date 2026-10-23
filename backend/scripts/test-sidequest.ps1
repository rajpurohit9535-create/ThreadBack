$body = @{
  missionObjective = "Build a Go CRUD API"
  sideQuestTopic = "Middleware in Go"
  messages = @(
    @{
      role = "user"
      content = "Explain middleware in Go with a simple example relevant to my API."
    }
  )
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/ai/sidequest/chat" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body

Write-Output "--- SIDEQUEST Reply ---"
Write-Output $response.reply
