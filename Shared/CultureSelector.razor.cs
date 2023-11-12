using System.Globalization;

namespace Passwordify.Shared;

public partial class CultureSelector
{
    private string CurrentCulture { get; set; }

    protected override async Task OnInitializedAsync()
    {
        CurrentCulture = CultureInfo.CurrentCulture.Name;

        await base.OnInitializedAsync();
    }

    public void OnCultureChanged(string culture)
    {
        _localStorage.SetItemAsync<string>("culture", culture);
        _navigationManager.NavigateTo(_navigationManager.Uri, forceLoad: true);
    }
}