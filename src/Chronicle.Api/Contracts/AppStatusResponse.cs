using NodaTime;

namespace Chronicle.Api.Contracts;

public sealed record AppStatusResponse(
    string Service,
    string State,
    string Version,
    Instant GeneratedAtUtc);
