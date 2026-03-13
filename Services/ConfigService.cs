using System.IO;
using System.Text.Json;
using MotionHub.Models;

namespace MotionHub.Services;

public sealed class ConfigService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public HubConfig LoadOrCreateDefault(string configPath)
    {
        if (!File.Exists(configPath))
        {
            var cfg = new HubConfig();
            Directory.CreateDirectory(Path.GetDirectoryName(configPath) ?? ".");
            File.WriteAllText(configPath, JsonSerializer.Serialize(cfg, new JsonSerializerOptions(JsonOptions) { WriteIndented = true }));
            return cfg;
        }

        var json = File.ReadAllText(configPath);
        return JsonSerializer.Deserialize<HubConfig>(json, JsonOptions) ?? new HubConfig();
    }
}

