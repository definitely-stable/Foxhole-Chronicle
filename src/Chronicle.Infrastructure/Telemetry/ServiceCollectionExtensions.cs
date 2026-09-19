using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Chronicle.Infrastructure.Telemetry;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddChronicleTelemetry(
        this IServiceCollection services,
        IConfiguration configuration,
        string serviceName,
        bool includeAspNetCoreInstrumentation)
    {
        var exportOtlp =
            !string.IsNullOrWhiteSpace(configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);

        var telemetry = services
            .AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(serviceName));

        telemetry.WithTracing(tracing =>
        {
            if (includeAspNetCoreInstrumentation)
            {
                tracing.AddAspNetCoreInstrumentation();
            }

            tracing.AddHttpClientInstrumentation();

            if (exportOtlp)
            {
                tracing.AddOtlpExporter();
            }
        });

        telemetry.WithMetrics(metrics =>
        {
            if (includeAspNetCoreInstrumentation)
            {
                metrics.AddAspNetCoreInstrumentation();
            }

            metrics.AddRuntimeInstrumentation();

            if (exportOtlp)
            {
                metrics.AddOtlpExporter();
            }
        });

        return services;
    }
}
