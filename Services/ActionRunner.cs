using System.Diagnostics;
using System.IO;
using MotionHub.Models;

namespace MotionHub.Services;

public sealed class ActionRunner
{
    public void Run(HubItemConfig item)
    {
        var type = (item.Type ?? "").Trim();

        switch (type)
        {
            case "OpenUrl":
                OpenUrl(item.Url);
                return;
            case "RunExe":
                RunExe(item.Path, item.Args);
                return;
            case "RunCommand":
                RunExe(item.Command, item.Args);
                return;
            case "OpenFile":
                OpenFile(item.Path);
                return;
            default:
                throw new InvalidOperationException($"Unknown hub item type '{item.Type}'.");
        }
    }

    private static void OpenUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("Missing url.");

        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static void RunExe(string? path, string? args)
    {
        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Missing path/command.");

        Process.Start(new ProcessStartInfo(path)
        {
            Arguments = args ?? "",
            UseShellExecute = true,
            WorkingDirectory = InferWorkingDirectory(path)
        });
    }

    private static void OpenFile(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Missing path.");

        Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
    }

    private static string? InferWorkingDirectory(string pathOrCommand)
    {
        try
        {
            // If it's a file path, use its directory; if it's just "node"/"powershell", return null.
            if (Path.IsPathRooted(pathOrCommand) && File.Exists(pathOrCommand))
                return Path.GetDirectoryName(pathOrCommand);
        }
        catch { }
        return null;
    }
}

