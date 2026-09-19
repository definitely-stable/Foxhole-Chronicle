using System.Reflection;
using Chronicle.Api.Contracts;
using Chronicle.Infrastructure.Health;
using Chronicle.Infrastructure.Persistence;
using Chronicle.Infrastructure.Telemetry;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.OutputCaching;
using NodaTime;
using NodaTime.Serialization.SystemTextJson;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi("app");
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy(
        "status",
        policy => policy.Expire(TimeSpan.FromSeconds(5)));
});

builder.Services.AddChroniclePersistence(builder.Configuration);
builder.Services.AddChronicleTelemetry(
    builder.Configuration,
    "foxhole-chronicle-api",
    includeAspNetCoreInstrumentation: true);

builder.Services
    .AddHealthChecks()
    .AddCheck<PostgresReadinessHealthCheck>(
        "postgres",
        tags: ["ready"]);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ConfigureForNodaTime(DateTimeZoneProviders.Tzdb);
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseOutputCache();

app.MapOpenApi("/api/openapi/{documentName}.json");

app.MapHealthChecks(
    "/health/live",
    new HealthCheckOptions
    {
        Predicate = _ => false
    });

app.MapHealthChecks(
    "/health/ready",
    new HealthCheckOptions
    {
        Predicate = registration => registration.Tags.Contains("ready")
    });

var applicationApi = app.MapGroup("/api/app");

applicationApi
    .MapGet(
        "/status",
        (TimeProvider timeProvider) =>
        {
            var version =
                Assembly.GetExecutingAssembly()
                    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
                    ?.InformationalVersion
                ?? "unknown";

            var generatedAt =
                Instant.FromDateTimeOffset(timeProvider.GetUtcNow());

            return TypedResults.Ok(
                new AppStatusResponse(
                    "foxhole-chronicle-api",
                    "bootstrap",
                    version,
                    generatedAt));
        })
    .WithName("GetApplicationStatus")
    .WithTags("Status")
    .Produces<AppStatusResponse>()
    .CacheOutput("status");

await app.RunAsync();

public partial class Program
{
}
