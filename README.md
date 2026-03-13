# MotionHub (Windows Launcher)

A simple Windows “hub” app that opens your tools:
- Launch other Windows apps (`.exe`)
- Open links (Google Forms / Discord)
- Open local files (like your updater `.html`)
- Start your Discord bot (via a command like `powershell ... npm start`)

The UI is driven by a config file (`hub.config.json`) that lives next to the built `.exe`, so you can change buttons without rebuilding.

## Run (dev)

```powershell
cd C:\Users\Halep\MotionHub
dotnet run
```

## Configure tiles

Edit `hub.config.json`.

Supported item `type` values:
- `OpenUrl` (uses default browser)
- `RunExe` (launch an `.exe`)
- `RunCommand` (launch a command like `powershell`, `node`, `python`)
- `OpenFile` (open a local file like `index.html`)

Visibility control:
- Set top-level `"profile"` to `"Admin"` or `"Staff"`
- For each item, set `"visibleForProfiles": ["Admin","Staff"]` (or just `["Admin"]`)

## Staff edition (stripped down)

Option A (recommended):
- Build once
- Copy `hub.config.json` to a staff version and remove Admin-only items

The app has a button **Create Staff Config** (Admin only) which copies your current config to:
- `hub.config.staff.json`

Then you can:
- Change `"profile"` to `"Staff"`
- Keep only the tiles staff should have

Option B:
- Ship the same app with `hub.config.json` already set to `"profile": "Staff"`

## Publish a distributable build

```powershell
cd C:\Users\Halep\MotionHub
dotnet publish -c Release -r win-x64 --self-contained false
```

Output folder (typical):
- `bin\Release\net8.0-windows\win-x64\publish\`

Put your final `hub.config.json` in that same publish folder (it is copied automatically on build).

