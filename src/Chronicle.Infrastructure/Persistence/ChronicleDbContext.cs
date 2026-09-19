using Microsoft.EntityFrameworkCore;

namespace Chronicle.Infrastructure.Persistence;

public sealed class ChronicleDbContext(DbContextOptions<ChronicleDbContext> options)
    : DbContext(options);
