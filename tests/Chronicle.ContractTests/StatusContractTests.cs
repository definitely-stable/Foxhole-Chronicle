using System.Net;
using System.Net.Http.Json;
using Chronicle.Api.Contracts;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Chronicle.ContractTests;

public sealed class StatusContractTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public StatusContractTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ApplicationStatusIsAvailableUnderTheAppContract()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        using var response = await _client.GetAsync("/api/app/status", cancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<AppStatusResponse>(
            cancellationToken);

        Assert.NotNull(body);
        Assert.Equal("foxhole-chronicle-api", body.Service);
        Assert.Equal("bootstrap", body.State);
        Assert.Equal(TimeSpan.Zero, body.GeneratedAtUtc.Offset);
    }
}
