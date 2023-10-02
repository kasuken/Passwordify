using Blazored.LocalStorage;
using BlazorKit.CopyToClipboard;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using MudBlazor.Services;
using Passwordify;
using Passwordify.Extensions;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddMudServices();
builder.Services.AddScoped<IClipboardService, ClipboardService>();
builder.Services.AddBlazoredLocalStorage();

builder.Services.AddLocalization();


var host = builder.Build();
await host.SetDefaultCulture(); // Retrieves local storage value and sets the thread's current culture.
await host.RunAsync();
