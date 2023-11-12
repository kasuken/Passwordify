using MudBlazor;

namespace Passwordify.Pages;

public partial class Index
{
    private int _passwordLength = 12;
    private bool _includeUppercase = true;
    private bool _includeNumbers = true;
    private bool _includeSpecialChars = false;
    private string _generatedPassword = "";

    private const string UppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private const string LowercaseChars = "abcdefghijklmnopqrstuvwxyz";
    private const string NumberChars = "0123456789";
    private const string SpecialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    private void GeneratePassword()
    {
        var chars = LowercaseChars;
        if (_includeUppercase)
            chars += UppercaseChars;
        if (_includeNumbers)
            chars += NumberChars;
        if (_includeSpecialChars)
            chars += SpecialChars;

        var random = new Random();
        var result = new string(
            Enumerable.Repeat(chars, _passwordLength)
                .Select(s => s[random.Next(s.Length)])
                .ToArray());

        _generatedPassword = result;
    }

    private async Task CopyToClipboardAsync()
    {
        try
        {
            await ClipboardService.CopyToClipboard(_generatedPassword);
            Snackbar.Add(@_localizer[nameof(Resources.Resources.PasswordSuccesfullyCopiedMessage)], Severity.Success);
        }
        catch
        {
            Snackbar.Add(@_localizer[nameof(Resources.Resources.PasswordCopyErrorMessage)], Severity.Warning);
        }
    }

    protected override void OnInitialized()
    {
        Snackbar.Configuration.PositionClass = Defaults.Classes.Position.BottomRight;
    }
}