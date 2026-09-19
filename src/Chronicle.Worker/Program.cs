using Chronicle.Infrastructure.Persistence;
using Chronicle.Infrastructure.Telemetry;
using Chronicle.Worker;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddChroniclePersistence(builder.Configuration);
builder.Services.AddChronicleTelemetry(
    builder.Configuration,
    "foxhole-chronicle-worker",
    includeAspNetCoreInstrumentation: false);
builder.Services.AddHostedService<BootstrapWorker>();

await builder.Build().RunAsync();
