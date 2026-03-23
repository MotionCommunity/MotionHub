param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ReplayPaths
)

$apiBase = "http://localhost:4001"
$hadError = $false

function Test-GameStats {
  param(
    [string]$ApiBase,
    [string]$GameId
  )

  if (-not $GameId) {
    Write-Host "Validation skipped: missing gameId."
    return
  }

  $requiredFields = @(
    "platform", "bpm", "avgBoostAmount",
    "amountCollected", "amountCollectedBig", "amountCollectedSmall",
    "countCollectedBig", "countCollectedSmall",
    "amountStolen", "amountStolenBig", "amountStolenSmall",
    "countStolenBig", "countStolenSmall",
    "timeZeroBoost", "timeFullBoost",
    "avgSpeed", "totalDistance",
    "timeSlowSpeed", "timeBoostSpeed", "timeSupersonic",
    "timeOnGround", "timeLowAir", "timeHighAir",
    "timeDefensiveThird", "timeNeutralThird", "timeOffensiveThird",
    "timeDefensiveHalf", "timeOffensiveHalf",
    "timeBehindBall", "timeInFrontBall",
    "avgDistanceToBall", "avgDistanceToBallHasPossession", "avgDistanceToBallNoPossession"
  )

  # Camera can be missing in rare replays; keep informational.
  $optionalFields = @(
    "onlineId",
    "cameraFov", "cameraHeight", "cameraAngle", "cameraDistance", "cameraStiffness", "cameraSwivel"
  )

  try {
    $statsResp = Invoke-RestMethod -Method Get -Uri "$ApiBase/v1/games/$GameId/stats" -ErrorAction Stop
  } catch {
    Write-Host "Validation failed: could not fetch game stats for $GameId"
    Write-Host $_.Exception.Message
    return
  }

  $players = @($statsResp.players)
  if ($players.Count -eq 0) {
    Write-Host "Validation: no players returned for game $GameId"
    return
  }

  Write-Host ""
  Write-Host "Validation summary (game $GameId):"

  $issues = 0
  foreach ($p in $players) {
    $ign = [string]$p.player.ign
    if (-not $ign) { $ign = "<unknown>" }

    $missingRequired = @()
    foreach ($f in $requiredFields) {
      $v = $p.$f
      if ($null -eq $v) { $missingRequired += $f }
    }

    $missingOptional = @()
    foreach ($f in $optionalFields) {
      $v = $p.$f
      if ($null -eq $v -or ([string]::IsNullOrWhiteSpace([string]$v))) { $missingOptional += $f }
    }

    $suspicious = @()
    if (($p.totalDistance -as [double]) -eq 0) { $suspicious += "totalDistance=0" }
    if (($p.avgSpeed -as [double]) -eq 0) { $suspicious += "avgSpeed=0" }
    $moveTotal = ([double]$p.timeOnGround) + ([double]$p.timeLowAir) + ([double]$p.timeHighAir)
    if ($moveTotal -lt 30) { $suspicious += "movementTimesTooLow" }

    if ($missingRequired.Count -eq 0 -and $suspicious.Count -eq 0) {
      Write-Host "  PASS  $ign"
      if ($missingOptional.Count -gt 0) {
        Write-Host "        optional missing: $($missingOptional -join ', ')"
      }
    } else {
      $issues++
      Write-Host "  WARN  $ign"
      if ($missingRequired.Count -gt 0) {
        Write-Host "        missing required: $($missingRequired -join ', ')"
      }
      if ($missingOptional.Count -gt 0) {
        Write-Host "        missing optional: $($missingOptional -join ', ')"
      }
      if ($suspicious.Count -gt 0) {
        Write-Host "        suspicious: $($suspicious -join ', ')"
      }
    }
  }

  if ($issues -eq 0) {
    Write-Host "Validation result: PASS ($($players.Count)/$($players.Count) players clean)"
  } else {
    Write-Host "Validation result: WARN ($issues player(s) need review)"
  }
}

if (-not $ReplayPaths -or $ReplayPaths.Count -eq 0) {
  Write-Host ""
  Write-Host "Drag one or more .replay files onto ingest-replay.cmd."
  Write-Host "The League API and worker must be running (run-local.cmd)."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "Checking API at $apiBase/health ..."
try {
  $health = Invoke-RestMethod -Method Get -Uri "$apiBase/health" -ErrorAction Stop
  if (-not $health.ok) {
    throw "Health check returned non-ok result."
  }
  Write-Host "API is up."
} catch {
  Write-Host ""
  Write-Host "API is not running or unreachable."
  Write-Host "Run run-local.cmd first, then try again."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

foreach ($rawPath in $ReplayPaths) {
  Write-Host ""
  Write-Host "-----------------------------------------------"
  Write-Host "Input: $rawPath"
  Write-Host "-----------------------------------------------"

  try {
    $fullPath = (Resolve-Path -LiteralPath $rawPath -ErrorAction Stop).Path
  } catch {
    Write-Host "ERROR: File not found: $rawPath"
    $hadError = $true
    continue
  }

  if ([System.IO.Path]::GetExtension($fullPath).ToLowerInvariant() -ne ".replay") {
    Write-Host "WARNING: File does not end with .replay -> $fullPath"
  }

  Write-Host "Resolved: $fullPath"

  $sha256 = $null
  try {
    $sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    Write-Host "SHA256: $sha256"
  } catch {
    Write-Host "WARN: Could not compute SHA256, continuing with path-only dedupe."
  }

  $payload = @{ storageKey = $fullPath }
  if ($sha256) { $payload.sha256 = $sha256 }
  $body = $payload | ConvertTo-Json -Compress
  try {
    $enqueue = Invoke-RestMethod -Method Post -Uri "$apiBase/v1/replays/ingest" -ContentType "application/json" -Body $body -ErrorAction Stop
    $replayId = $enqueue.item.id
    if (-not $replayId) {
      throw "API response missing replay id."
    }
    if ($enqueue.duplicate -eq $true) {
      Write-Host "DUPLICATE: Replay already ingested (id: $replayId)."
      try {
        $existingStatus = Invoke-RestMethod -Method Get -Uri "$apiBase/v1/replays/$replayId/status" -ErrorAction Stop
        $existingParserStatus = [string]$existingStatus.item.parserStatus
        Write-Host "Existing status: $existingParserStatus"
        if ($existingParserStatus -eq "parsed") {
          $existingGameId = [string]$existingStatus.item.gameId
          Test-GameStats -ApiBase $apiBase -GameId $existingGameId
        } elseif ($existingParserStatus -eq "failed") {
          Write-Host "Tip: Use /v1/replays/retry-failed or re-run worker after fixing parser issues."
          $hadError = $true
        }
      } catch {
        Write-Host "WARN: Could not fetch existing replay status."
      }
      continue
    }
    Write-Host "Queued replay id: $replayId"
  } catch {
    Write-Host "ERROR: Failed to queue replay."
    Write-Host $_.Exception.Message
    $hadError = $true
    continue
  }

  $done = $false
  for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 1
    try {
      $statusResp = Invoke-RestMethod -Method Get -Uri "$apiBase/v1/replays/$replayId/status" -ErrorAction Stop
      $status = [string]$statusResp.item.parserStatus
      $err = [string]$statusResp.item.parserError
      Write-Host "Status [$i/20]: $status"

      if ($status -eq "parsed") {
        Write-Host "SUCCESS: replay parsed and stats were written."
        $gameId = [string]$statusResp.item.gameId
        Test-GameStats -ApiBase $apiBase -GameId $gameId
        $done = $true
        break
      }
      if ($status -eq "failed") {
        Write-Host "FAILED: parser/worker reported an error."
        if ($err) {
          Write-Host "Reason: $err"
        }
        $hadError = $true
        $done = $true
        break
      }
    } catch {
      Write-Host "WARN: Could not fetch status right now."
    }
  }

  if (-not $done) {
    Write-Host "Still pending/processing. Keep worker window open and check again soon."
    Write-Host "Status URL: $apiBase/v1/replays/$replayId/status"
  }
}

Write-Host ""
if ($hadError) {
  Write-Host "Completed with some errors."
} else {
  Write-Host "Completed successfully."
}
Write-Host "Open open-studio.cmd and check ReplayFile, Game, Player, PlayerGameStat."
Write-Host ""
Read-Host "Press Enter to close"
