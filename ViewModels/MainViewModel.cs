using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Windows;
using MotionHub.Models;
using MotionHub.Services;

namespace MotionHub.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged
{
    private readonly ActionRunner _runner = new();
    private readonly ConfigService _configService = new();

    private HubConfig _config = new();
    private string _search = "";
    private string _selectedCategory = "All";

    public ObservableCollection<HubItemConfig> AllItems { get; } = new();
    public ObservableCollection<HubItemConfig> FilteredItems { get; } = new();
    public ObservableCollection<string> Categories { get; } = new() { "All" };

    public string WindowTitle => string.IsNullOrWhiteSpace(_config.WindowTitle) ? "Motion Hub" : _config.WindowTitle;

    public string Profile => string.IsNullOrWhiteSpace(_config.Profile) ? "Admin" : _config.Profile;

    public bool IsAdmin => string.Equals(Profile, "Admin", StringComparison.OrdinalIgnoreCase);

    public string ConfigPath => Path.Combine(AppContext.BaseDirectory, "hub.config.json");

    public string Search
    {
        get => _search;
        set
        {
            if (value == _search) return;
            _search = value ?? "";
            OnPropertyChanged();
            ApplyFilter();
        }
    }

    public string SelectedCategory
    {
        get => _selectedCategory;
        set
        {
            if (value == _selectedCategory) return;
            _selectedCategory = value ?? "All";
            OnPropertyChanged();
            ApplyFilter();
        }
    }

    public RelayCommand RunItemCommand { get; }
    public RelayCommand ReloadCommand { get; }
    public RelayCommand CopyStaffConfigCommand { get; }

    public MainViewModel()
    {
        RunItemCommand = new RelayCommand(p =>
        {
            if (p is not HubItemConfig item) return;
            try
            {
                _runner.Run(item);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Motion Hub", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        });

        ReloadCommand = new RelayCommand(_ => LoadConfigAndRefresh());

        CopyStaffConfigCommand = new RelayCommand(_ =>
        {
            try
            {
                var staffPath = Path.Combine(AppContext.BaseDirectory, "hub.config.staff.json");
                File.Copy(ConfigPath, staffPath, overwrite: true);
                MessageBox.Show($"Created/updated:\n{staffPath}\n\nSet \"profile\" to \"Staff\" and remove any Admin-only items.", "Motion Hub", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Motion Hub", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }, _ => IsAdmin);

        LoadConfigAndRefresh();
    }

    private void LoadConfigAndRefresh()
    {
        _config = _configService.LoadOrCreateDefault(ConfigPath);

        OnPropertyChanged(nameof(WindowTitle));
        OnPropertyChanged(nameof(Profile));
        OnPropertyChanged(nameof(IsAdmin));
        CopyStaffConfigCommand.RaiseCanExecuteChanged();

        AllItems.Clear();
        foreach (var item in _config.Items ?? new List<HubItemConfig>())
        {
            if (!IsVisibleForProfile(item, Profile)) continue;
            AllItems.Add(item);
        }

        RefreshCategories();
        ApplyFilter();
    }

    private void RefreshCategories()
    {
        var cats = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in AllItems)
        {
            var c = string.IsNullOrWhiteSpace(item.Category) ? "Other" : item.Category.Trim();
            cats.Add(c);
        }

        Categories.Clear();
        Categories.Add("All");
        foreach (var c in cats) Categories.Add(c);

        if (!Categories.Contains(SelectedCategory))
            SelectedCategory = "All";
    }

    private void ApplyFilter()
    {
        var q = (Search ?? "").Trim();
        var cat = (SelectedCategory ?? "All").Trim();

        IEnumerable<HubItemConfig> items = AllItems;

        if (!string.Equals(cat, "All", StringComparison.OrdinalIgnoreCase))
            items = items.Where(i => string.Equals((i.Category ?? "Other").Trim(), cat, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(q))
        {
            items = items.Where(i =>
                Contains(i.Title, q) ||
                Contains(i.Subtitle, q) ||
                Contains(i.Category, q));
        }

        FilteredItems.Clear();
        foreach (var item in items) FilteredItems.Add(item);
    }

    private static bool Contains(string? haystack, string needle)
        => (haystack ?? "").IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0;

    private static bool IsVisibleForProfile(HubItemConfig item, string profile)
    {
        if (item.VisibleForProfiles == null || item.VisibleForProfiles.Count == 0)
            return true;
        return item.VisibleForProfiles.Any(p => string.Equals(p, profile, StringComparison.OrdinalIgnoreCase));
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

