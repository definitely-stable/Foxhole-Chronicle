using Chronicle.Core;
using Microsoft.Extensions.Time.Testing;

namespace Chronicle.UnitTests;

public sealed class BootstrapTests
{
    [Fact]
    public void CoreAssemblyIsAvailable()
    {
        Assert.NotNull(typeof(AssemblyMarker).Assembly);
    }

    [Fact]
    public void TimeDependentCodeCanUseAFakeClock()
    {
        var expected = new DateTimeOffset(2026, 9, 19, 18, 30, 0, TimeSpan.Zero);
        var clock = new FakeTimeProvider(expected);

        Assert.Equal(expected, clock.GetUtcNow());
    }
}
