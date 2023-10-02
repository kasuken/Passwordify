using Blazored.LocalStorage;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using System.Globalization;

namespace Passwordify.Extensions
{
    public static class HostExtensions
    {
        public async static Task SetDefaultCulture(this WebAssemblyHost host)
        {
            var localStorage = host.Services.GetRequiredService<ILocalStorageService>();
            var cultureString = await localStorage.GetItemAsync<string>("culture");

            CultureInfo cultureInfo;

            if (Localizer.LocalizerHelper.IsSupported(cultureString))
            {
                cultureInfo = new CultureInfo(cultureString);
            }
            else
            {
                cultureInfo = new CultureInfo("en-US");
            }

            CultureInfo.DefaultThreadCurrentCulture = cultureInfo;
            CultureInfo.DefaultThreadCurrentUICulture = cultureInfo;
        }
    }
}
