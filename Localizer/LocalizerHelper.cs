using System.Globalization;

namespace Passwordify.Localizer
{
    public static class LocalizerHelper
    {
        public const string NeutralCulture = "en-US";

        public static readonly CultureInfo[] SupportedCultures = new CultureInfo[]
        {
            new CultureInfo(NeutralCulture),
            new CultureInfo("it-IT")
        };

        public static bool IsSupported(string culture)
        {
            return SupportedCultures.Any(c => string.Equals(c.Name, culture, StringComparison.InvariantCultureIgnoreCase));
        }
    }
}
