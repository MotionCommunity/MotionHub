using System.Text.Json.Serialization;

namespace MotionHub.Models;

public sealed class HubConfig
{
    [JsonPropertyName("profile")]
    public string Profile { get; init; } = "Admin";

    [JsonPropertyName("windowTitle")]
    public string WindowTitle { get; init; } = "Motion Hub";

    [JsonPropertyName("items")]
    public List<HubItemConfig> Items { get; init; } = new();
}

public sealed class HubItemConfig
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = Guid.NewGuid().ToString("n");

    [JsonPropertyName("title")]
    public string Title { get; init; } = "";

    [JsonPropertyName("subtitle")]
    public string? Subtitle { get; init; }

    [JsonPropertyName("category")]
    public string? Category { get; init; }

    [JsonPropertyName("icon")]
    public string? Icon { get; init; }

    /// <summary>
    /// Supported: OpenUrl, RunExe, RunCommand, OpenFile
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; init; } = "OpenUrl";

    // OpenUrl
    [JsonPropertyName("url")]
    public string? Url { get; init; }

    // RunExe / OpenFile
    [JsonPropertyName("path")]
    public string? Path { get; init; }

    // RunExe / RunCommand
    [JsonPropertyName("args")]
    public string? Args { get; init; }

    // RunCommand
    [JsonPropertyName("command")]
    public string? Command { get; init; }

    [JsonPropertyName("visibleForProfiles")]
    public List<string>? VisibleForProfiles { get; init; }
}

