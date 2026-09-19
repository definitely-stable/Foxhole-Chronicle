using Chronicle.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Chronicle.IntegrationTests;

public sealed class BootstrapPersistenceTests
{
    [Fact]
    public void DbContext_model_can_be_created_with_the_PostgreSQL_provider()
    {
        var options = new DbContextOptionsBuilder<ChronicleDbContext>()
            .UseNpgsql("Host=localhost;Database=chronicle;Username=chronicle;Password=unused")
            .Options;

        using var dbContext = new ChronicleDbContext(options);

        Assert.Empty(dbContext.Model.GetEntityTypes());
    }
}
