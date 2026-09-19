using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Chronicle.Infrastructure.Persistence;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddChroniclePersistence(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Chronicle")
            ?? throw new InvalidOperationException(
                "Connection string 'Chronicle' is required. Set ConnectionStrings__Chronicle.");

        services.AddPooledDbContextFactory<ChronicleDbContext>(options =>
        {
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.UseNodaTime());
        });

        return services;
    }
}
