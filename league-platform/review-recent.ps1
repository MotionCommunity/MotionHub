param(
  [int]$Limit = 10,
  [ValidateSet("pending", "parsed", "failed", "all")]
  [string]$Status = "parsed",
  [string]$Since = ""
)

$apiBase = "http://localhost:4001"

function Format-ShortPath {
  param([string]$Path)
  if (-not $Path) { return "" }
  try {
    return [System.IO.Path]::GetFileName($Path)
  } catch {
    return $Path
  }
}

Write-Host ""
Write-Host "Checking API at $apiBase/health ..."
try {
  $health = Invoke-RestMethod -Method Get -Uri "$apiBase/health" -ErrorAction Stop
  if (-not $health.ok) { throw "API health is not ok." }
  Write-Host "API is up."
} catch {
  Write-Host "API is not running. Run run-local.cmd first."
  exit 1
}

$statusQuery = ""
if ($Status -ne "all") { $statusQuery = "&status=$Status" }
$sinceQuery = ""
if (-not [string]::IsNullOrWhiteSpace($Since)) {
  $encodedSince = [Uri]::EscapeDataString($Since.Trim())
  $sinceQuery = "&since=$encodedSince"
}
$url = "$apiBase/v1/replays/recent?limit=$Limit$statusQuery$sinceQuery"

try {
  $recent = Invoke-RestMethod -Method Get -Uri $url -ErrorAction Stop
} catch {
  Write-Host "Failed to fetch recent replays."
  Write-Host $_.Exception.Message
  exit 1
}

$items = @($recent.items)
if ($items.Count -eq 0) {
  Write-Host ""
  Write-Host "No replays found for that filter."
  exit 0
}

Write-Host ""
Write-Host "Recent replay imports:"
foreach ($r in $items) {
  $short = Format-ShortPath -Path ([string]$r.storageKey)
  Write-Host "- [$($r.parserStatus)] $($r.id) | game=$($r.gameId) | $($r.createdAt) | $short"
  if ($r.parserError) {
    Write-Host "  parserError: $($r.parserError)"
  }
}

$parsedItems = @($items | Where-Object { $_.parserStatus -eq "parsed" -and $_.gameId })
if ($parsedItems.Count -eq 0) {
  Write-Host ""
  Write-Host "No parsed games in this selection."
  exit 0
}

Write-Host ""
Write-Host "Stats preview:"
foreach ($r in $parsedItems) {
  Write-Host ""
  Write-Host "=================================================="
  Write-Host "Replay: $($r.id)"
  Write-Host "Game:   $($r.gameId)"
  Write-Host "File:   $(Format-ShortPath -Path ([string]$r.storageKey))"
  Write-Host "When:   $($r.createdAt)"
  Write-Host "--------------------------------------------------"

  try {
    $statsResp = Invoke-RestMethod -Method Get -Uri "$apiBase/v1/games/$($r.gameId)/stats" -ErrorAction Stop
  } catch {
    Write-Host "Could not load stats for game $($r.gameId)"
    continue
  }

  $players = @($statsResp.players)
  if ($players.Count -eq 0) {
    Write-Host "No player stats found."
    continue
  }

  foreach ($p in $players) {
    $ign = [string]$p.player.ign
    Write-Host ("{0,-18} G/A/S/Sh: {1}/{2}/{3}/{4}  Spd:{5}  Dist:{6}  Pads B/S:{7}/{8}  AvgBoost:{9}%" -f `
      $ign, $p.goals, $p.assists, $p.saves, $p.shots, $p.avgSpeed, $p.totalDistance, $p.countCollectedBig, $p.countCollectedSmall, $p.avgBoostAmount)
  }
}

Write-Host ""
Write-Host "Done."
